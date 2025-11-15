// tests/helpers/test-data-loader.js
// Helper utilities for loading test reference faces into the extension

import path from 'path';
import { fileURLToPath } from 'url';
import { startTestServer } from './test-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testServerUrl = null;

/**
 * Load reference face descriptors from test images into the extension
 * @param {BrowserContext} context - Playwright browser context with extension loaded
 * @param {Object} config - Configuration for which faces to load
 * @param {Array<string>} config.people - Array of person names
 *   - For Trump: use 'donald_trump', 'trump', or 'Donald Trump' (uses test-data/trump/source/)
 *   - For others: folder name in tests/fixtures/images/ (legacy system)
 * @param {string} config.extensionId - Optional extension ID (will be detected if not provided)
 * @returns {Promise<string>} The test server URL
 */
export async function loadTestReferenceData(context, { people, extensionId: providedExtensionId }) {
  const oldFixturesPath = path.join(__dirname, '..', 'fixtures', 'images');
  const trumpTestSetPath = path.join(__dirname, '..', 'fixtures', 'test-data', 'trump');

  // Create a temporary page to process reference images
  const tempPage = await context.newPage();

  try {
    // Start a local test server if not already running
    if (!testServerUrl) {
      testServerUrl = await startTestServer();
    }

    // Navigate to our local test server page so extension content script runs
    console.log(`Navigating to test server: ${testServerUrl}`);
    // Don't wait for any specific load event to avoid race conditions
    await tempPage.goto(testServerUrl, { timeout: 10000 }).catch(() => {});

    // Now ensure the page is actually loaded (will return immediately if already loaded)
    await tempPage.waitForLoadState('domcontentloaded', { timeout: 5000 });

    // Inject face-api.js directly into the page context (not content script context)
    // Content scripts run in isolated world, so we can't access their faceapi object
    console.log('Injecting face-api into page context...');
    const faceApiPath = path.join(process.cwd(), 'extension', 'libs', 'face-api.min.js');
    await tempPage.addScriptTag({ path: faceApiPath });

    // Get the extension ID
    let extensionId = providedExtensionId;
    if (!extensionId) {
      console.log('Getting extension ID from service worker...');
      // Get it from the service worker
      const serviceWorker = context.serviceWorkers()[0];
      if (serviceWorker) {
        const url = serviceWorker.url();
        const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
        if (match) extensionId = match[1];
      }
    }

    if (!extensionId) {
      throw new Error('Could not find extension ID. Please pass it explicitly.');
    }

    console.log('Extension ID:', extensionId);

    // Load the face detection models
    console.log('Loading face-api models...');
    await tempPage.evaluate(async extId => {
      // Build model path using extension ID
      const modelPath = `chrome-extension://${extId}/models`;
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      console.log('Models loaded successfully');
    }, extensionId);

    const fs = await import('fs');

    // Get absolute paths to all reference images
    const referencePaths = [];
    for (const person of people) {
      let personDir;
      let personName = person;

      // Check if this is Trump - support multiple variations
      const isTrump = ['donald_trump', 'trump', 'donald trump'].includes(person.toLowerCase());

      if (isTrump) {
        // For Trump, use the test-data/trump/source directory
        personDir = path.join(trumpTestSetPath, 'source');
        personName = 'Donald Trump'; // Normalize name

        if (!fs.existsSync(personDir)) {
          console.warn(
            `Trump test set not found at ${personDir}. Run: cd tests/fixtures/generators/image-curator && ./curate_trump_images.sh`
          );
          continue;
        }
      } else {
        // Try old system for backwards compatibility
        personDir = path.join(oldFixturesPath, person);

        if (!fs.existsSync(personDir)) {
          console.warn(`Test images not found for ${person} at ${personDir}. Skipping...`);
          continue;
        }
      }

      // Get all jpg/png files in the person's directory
      const files = fs.readdirSync(personDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

      for (const file of files) {
        referencePaths.push({
          person: personName,
          path: path.join(personDir, file),
        });
      }
    }

    console.log(`Loading ${referencePaths.length} reference images for: ${people.join(', ')}`);

    // Group descriptors by person to batch storage calls
    // Multiple descriptors per person improve matching accuracy across different angles/lighting
    const descriptorsByPerson = {};
    for (const person of people) {
      // Normalize person name same way as above
      const isTrump = ['donald_trump', 'trump', 'donald trump'].includes(person.toLowerCase());
      const normalizedName = isTrump ? 'Donald Trump' : person;
      descriptorsByPerson[normalizedName] = [];
    }

    // Process each reference image to extract face descriptors
    for (const { person, path: imgPath } of referencePaths) {
      // Convert image to base64 data URL
      const imageBuffer = fs.readFileSync(imgPath);
      const base64 = imageBuffer.toString('base64');
      const ext = imgPath.endsWith('.png') ? 'png' : 'jpeg';
      const dataUrl = `data:image/${ext};base64,${base64}`;

      // Process the image to get face descriptor (in page context)
      const detection = await tempPage.evaluate(
        async ({ dataUrl }) => {
          // Create an image element
          const img = document.createElement('img');
          img.src = dataUrl;

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            setTimeout(reject, 5000); // 5 second timeout
          });

          // Detect face and get descriptor
          // Use same options as content script for consistency
          const result = await faceapi
            .detectSingleFace(
              img,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!result) {
            return { success: false, error: 'No face detected' };
          }

          // Return the descriptor (convert Float32Array to regular array for message passing)
          return {
            success: true,
            descriptor: Array.from(result.descriptor),
          };
        },
        { dataUrl }
      );

      if (!detection.success) {
        console.warn(
          `Failed to detect face for ${person} in ${imgPath.split('/').pop()}:`,
          detection.error
        );
        console.warn('Skipping this image and continuing...');
        continue; // Skip this image and try the next one
      }

      // Accumulate descriptor for this person
      descriptorsByPerson[person].push(detection.descriptor);
      console.log(
        `Processed reference image for ${person} (${descriptorsByPerson[person].length} total)`
      );
    }

    // Store all descriptors for each person in extension storage
    // Must use service worker context because chrome.storage is not available in page context
    const serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      throw new Error('No service worker found');
    }

    for (const person of people) {
      // Normalize person name same way as above
      const isTrump = ['donald_trump', 'trump', 'donald trump'].includes(person.toLowerCase());
      const normalizedName = isTrump ? 'Donald Trump' : person;

      if (descriptorsByPerson[normalizedName].length === 0) {
        console.warn(`No valid reference images for ${normalizedName}, skipping storage`);
        continue;
      }

      const backgroundResult = await serviceWorker.evaluate(
        async ({ personName, descriptors }) => {
          // Import storage and create instance
          // This is a service worker context, so we can use importScripts
          if (typeof FaceStorage === 'undefined') {
            self.importScripts('storage.js');
          }

          // Create or get storage instance
          if (!self._testStorage) {
            self._testStorage = new FaceStorage();
            await self._testStorage.init();
          }

          const storage = self._testStorage;
          const float32Descriptors = descriptors.map(d => new Float32Array(d));
          await storage.addPerson(personName, float32Descriptors, []);

          return { success: true };
        },
        { personName: normalizedName, descriptors: descriptorsByPerson[normalizedName] }
      );

      if (!backgroundResult.success) {
        console.error(`Failed to add reference faces for ${normalizedName}`);
        throw new Error(`Failed to add reference faces for ${normalizedName}`);
      }

      console.log(
        `Added ${descriptorsByPerson[normalizedName].length} reference face(s) for ${normalizedName}`
      );
    }

    console.log(`Successfully loaded reference data for ${people.length} people`);

    // Return the test server URL
    return testServerUrl;
  } catch (error) {
    console.error('Error loading test reference data:', error);
    throw error;
  } finally {
    // Always close the temporary page
    if (tempPage && !tempPage.isClosed()) {
      await tempPage.close();
    }
  }
}

/**
 * Clear all reference data from the extension
 * @param {BrowserContext} context - Playwright browser context with extension loaded
 * @returns {Promise<void>}
 */
export async function clearTestReferenceData(context) {
  const serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    throw new Error('No service worker found');
  }

  await serviceWorker.evaluate(async () => {
    // Import storage and create instance
    if (typeof FaceStorage === 'undefined') {
      self.importScripts('storage.js');
    }

    if (!self._testStorage) {
      self._testStorage = new FaceStorage();
      await self._testStorage.init();
    }

    const storage = self._testStorage;
    await storage.clearAll();

    console.log('Cleared all reference data');
  });
}

/**
 * Get absolute path to a test fixture image
 * @param {string} filename - Filename in tests/fixtures/images (e.g., 'marilyn_monroe.jpg')
 * @returns {string} Absolute path to the image
 */
export function getFixtureImagePath(filename) {
  return path.join(__dirname, '..', 'fixtures', 'images', filename);
}

/**
 * Create a data URL from a test fixture image
 * @param {string} filename - Filename in tests/fixtures/images
 * @returns {Promise<string>} Data URL of the image
 */
export async function getFixtureImageDataUrl(filename) {
  const fs = await import('fs');
  const imagePath = getFixtureImagePath(filename);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const ext = filename.endsWith('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${base64}`;
}
