// content.js - Main content script for face detection and blurring

(async function() {
  'use strict';

  // Configuration
  let config = {
    blurIntensity: 20,
    matchThreshold: 0.6,
    enabled: true
  };

  let modelsLoaded = false;
  let faceMatcher = null;
  let processing = false;
  const processedImages = new WeakSet();
  let observer = null;

  console.log('Face Block Chromium Extension: Content script loaded');

  // Initialize
  async function initialize() {
    try {
      // Load settings
      await loadSettings();

      // Load face-api.js models
      await loadModels();

      // Get reference descriptors from background
      await loadReferenceDescriptors();

      // Process existing images (even if no reference data)
      await processExistingImages();

      // Set up dynamic content monitoring
      setupMutationObserver();

      if (faceMatcher) {
        console.log('Face Block Chromium Extension: Initialized successfully');
      } else {
        console.log('Face Block Chromium Extension: No reference faces stored yet - images will be shown normally');
      }
    } catch (error) {
      console.error('Face Block Chromium Extension: Initialization error:', error);
    }
  }

  // Load settings from chrome.storage
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['blurIntensity', 'matchThreshold', 'enabled'], (result) => {
        if (result.blurIntensity) config.blurIntensity = result.blurIntensity;
        if (result.matchThreshold) config.matchThreshold = result.matchThreshold;
        if (result.enabled !== undefined) config.enabled = result.enabled;
        resolve();
      });
    });
  }

  // Load face-api.js models
  async function loadModels() {
    if (modelsLoaded) return;

    try {
      const MODEL_URL = chrome.runtime.getURL('models');

      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

      modelsLoaded = true;
      console.log('Face Block Chromium Extension: Models loaded');
    } catch (error) {
      console.error('Face Block Chromium Extension: Error loading models:', error);
      throw error;
    }
  }

  // Load reference descriptors from background
  async function loadReferenceDescriptors() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_REFERENCE_DESCRIPTORS' }, (response) => {
        console.log('Content: Received reference data response:', response);

        if (response && response.success && response.referenceData && response.referenceData.length > 0) {
          try {
            const labeledDescriptors = response.referenceData.map(person => {
              console.log(`Content: Processing ${person.name}, ${person.descriptors.length} descriptors`);

              // Validate and convert descriptors
              const validDescriptors = person.descriptors
                .map((d, idx) => {
                  console.log(`Content: Descriptor ${idx} - type: ${typeof d}, isArray: ${Array.isArray(d)}, length: ${d?.length}`);

                  const float32 = new Float32Array(d);
                  console.log(`Content: Converted to Float32Array, length: ${float32.length}`);

                  if (float32.length !== 128) {
                    console.error(`Face Block Chromium Extension: Invalid descriptor length for ${person.name}: ${float32.length}`);
                    return null;
                  }
                  return float32;
                })
                .filter(d => d !== null);

              console.log(`Content: ${person.name} has ${validDescriptors.length} valid descriptors`);

              if (validDescriptors.length === 0) {
                console.error(`Face Block Chromium Extension: No valid descriptors for ${person.name}`);
                return null;
              }

              return new faceapi.LabeledFaceDescriptors(person.name, validDescriptors);
            }).filter(ld => ld !== null);

            if (labeledDescriptors.length > 0) {
              faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.matchThreshold);
              console.log(`Face Block Chromium Extension: Loaded ${labeledDescriptors.length} reference face(s)`);
            } else {
              console.error('Face Block Chromium Extension: No valid reference descriptors loaded');
            }
          } catch (error) {
            console.error('Face Block Chromium Extension: Error creating face matcher:', error);
          }
        } else {
          console.log('Face Block Chromium Extension: No reference data available');
        }
        resolve();
      });
    });
  }

  // Process existing images on page
  // This runs even when no reference data exists to restore image visibility
  async function processExistingImages() {
    if (!config.enabled) return;

    const images = document.querySelectorAll('img');
    console.log(`Face Block Chromium Extension: Processing ${images.length} existing images`);

    // Process images in batches to avoid blocking UI
    const batchSize = 5;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = Array.from(images).slice(i, i + batchSize);
      await Promise.all(batch.map(img => processImage(img)));

      // Yield to browser
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Process a single image
  async function processImage(img) {
    // Skip if already processed
    if (processedImages.has(img)) return;

    // If no reference data, just restore visibility
    if (!faceMatcher) {
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      processedImages.add(img);
      return;
    }

    // Skip if image not loaded or too small
    // Use display dimensions (offsetWidth/Height) instead of natural dimensions
    // to properly handle CSS-scaled images (e.g., thumbnails)
    const displayWidth = img.offsetWidth || img.width;
    const displayHeight = img.offsetHeight || img.height;
    if (!img.complete || displayWidth < 50 || displayHeight < 50) {
      console.debug('Face Block Chromium Extension: Skipping image (not loaded or too small):', img.src.substring(0, 100));
      processedImages.add(img); // Mark as processed to avoid retrying
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      return;
    }

    // Additional check for invalid dimensions
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      console.debug('Face Block Chromium Extension: Skipping image with 0 dimensions:', img.src.substring(0, 100));
      processedImages.add(img);
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      return;
    }

    // Skip if src is data URL or blob (likely already processed)
    if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return;

    console.log('Face Block Chromium Extension: Processing image:', img.src.substring(0, 100));

    // Detect background color (image is already hidden by preload.js)
    const bgColor = getBackgroundColor(img.parentElement || img);
    const bgRgb = parseRgb(bgColor);

    // Mark that we're processing this image (preload.js already hid it)
    img.dataset.wasHidden = 'true';

    try {
      // Set crossOrigin for HTTP/HTTPS images only (not file:// or data:)
      const isHttpImage = img.src.startsWith('http://') || img.src.startsWith('https://');

      if (isHttpImage && !img.crossOrigin) {
        img.crossOrigin = 'anonymous';
        // Reload image with CORS enabled
        const tempSrc = img.src;
        img.src = '';
        img.src = tempSrc;

        // Wait for reload
        await new Promise((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 2000); // Timeout after 2 seconds
          }
        });
      }

      // Detect faces in image
      let detections;
      try {
        detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
      } catch (detectionError) {
        // Handle WebGL/CORS errors silently
        if (detectionError.message && (
          detectionError.message.includes('texImage2D') ||
          detectionError.message.includes('Tainted canvas') ||
          detectionError.message.includes('cross-origin')
        )) {
          console.debug('Face Block Chromium Extension: CORS-restricted image, skipping:', img.src.substring(0, 100));
          // Restore visibility for CORS-restricted images
          if (img.dataset.wasHidden) {
            img.setAttribute('data-face-block-processed', 'true');
            img.style.opacity = '';
            delete img.dataset.wasHidden;
          }
          processedImages.add(img);
          return;
        }
        throw detectionError; // Re-throw other errors
      }

      console.log(`Face Block Chromium Extension: Detected ${detections.length} face(s) in image`);

      if (detections && detections.length > 0) {
        try {
          // Match detected faces against reference descriptors
          const matches = detections.map(d => {
            // Validate descriptor before matching
            if (!d.descriptor || d.descriptor.length !== 128) {
              console.error('Face Block Chromium Extension: Invalid detected descriptor length:', d.descriptor?.length);
              return null;
            }
            return faceMatcher.findBestMatch(d.descriptor);
          }).filter(m => m !== null);

          if (matches.length === 0) {
            console.log('Face Block Chromium Extension: No valid matches (descriptor validation failed)');
            processedImages.add(img);
            return;
          }

          // Log all matches with distances
          matches.forEach((match, idx) => {
            console.log(`Face Block Chromium Extension: Face ${idx + 1}: ${match.label} (distance: ${match.distance.toFixed(3)}, threshold: ${config.matchThreshold})`);
          });

          // Check if any match is not "unknown"
          const shouldBlur = matches.some(match => {
            return match.label !== 'unknown' && match.distance < config.matchThreshold;
          });

          if (shouldBlur) {
            // Match found - replace image with blank
            blurImage(img, bgRgb);
            const matchedPerson = matches.find(m => m.label !== 'unknown');
            console.log(`Face Block Chromium Extension: ✓ BLOCKED image (matched: ${matchedPerson.label}, distance: ${matchedPerson.distance.toFixed(3)})`);
          } else {
            // No match - restore visibility by marking as processed
            img.setAttribute('data-face-block-processed', 'true');
            img.style.opacity = '';
            delete img.dataset.wasHidden;
            console.log('Face Block Chromium Extension: No match - faces detected but distances too high or all unknown');
          }
        } catch (matchError) {
          console.error('Face Block Chromium Extension: Error matching faces:', matchError.message);
          // Restore visibility on error
          if (img.dataset.wasHidden) {
            img.setAttribute('data-face-block-processed', 'true');
            img.style.opacity = '';
            delete img.dataset.wasHidden;
          }
          processedImages.add(img);
          return;
        }
      } else {
        // No faces detected - restore visibility
        if (img.dataset.wasHidden) {
          img.setAttribute('data-face-block-processed', 'true');
            img.style.opacity = '';
          delete img.dataset.wasHidden;
        }
        console.log('Face Block Chromium Extension: No faces detected in image');
      }

      // Mark as processed
      processedImages.add(img);
    } catch (error) {
      // Log all errors for debugging
      console.warn('Face Block Chromium Extension: Error processing image:', error.name, error.message, 'URL:', img.src.substring(0, 100));
      // Restore visibility on error
      if (img.dataset.wasHidden) {
        img.setAttribute('data-face-block-processed', 'true');
            img.style.opacity = '';
        delete img.dataset.wasHidden;
      }
      processedImages.add(img); // Mark as processed to avoid retry
    }
  }

  // Get the background color of an element, traversing up if transparent
  function getBackgroundColor(element) {
    let current = element;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (current && depth < maxDepth) {
      const style = window.getComputedStyle(current);
      const bgColor = style.backgroundColor;

      // Check if background color is not transparent
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        return bgColor;
      }

      current = current.parentElement;
      depth++;
    }

    // Default to white if we can't find a background color
    return 'rgb(255, 255, 255)';
  }

  // Convert RGB string to array of numbers
  function parseRgb(rgbString) {
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    return [255, 255, 255]; // Default to white
  }

  // Calculate border color (slightly different from background)
  function getBorderColor(bgRgb) {
    const [r, g, b] = bgRgb;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // If background is dark, make border lighter; if light, make border darker
    if (brightness < 128) {
      // Dark background - lighten by 30%
      return [
        Math.min(255, Math.floor(r * 1.3)),
        Math.min(255, Math.floor(g * 1.3)),
        Math.min(255, Math.floor(b * 1.3))
      ];
    } else {
      // Light background - darken by 15%
      return [
        Math.floor(r * 0.85),
        Math.floor(g * 0.85),
        Math.floor(b * 0.85)
      ];
    }
  }

  // Replace image with color-matched blank SVG
  function blurImage(img, bgRgb) {
    img.classList.add('face-blurred');

    const width = img.naturalWidth || img.width || 100;
    const height = img.naturalHeight || img.height || 100;

    console.log(`Face Block Chromium Extension: Replacing image (${width}x${height}):`, img.src.substring(0, 100));

    // Use pre-detected background color
    const borderRgb = getBorderColor(bgRgb);

    const bgColorStr = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`;
    const borderColorStr = `rgb(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]})`;

    console.log(`Face Block Chromium Extension: Background color: ${bgColorStr}, Border color: ${borderColorStr}`);

    // Create SVG with matching background color and subtle border
    const borderWidth = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) * 0.02))); // 2% of smallest dimension, min 2px, max 8px
    const blankSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='100%25' height='100%25' fill='${encodeURIComponent(bgColorStr)}'/%3E%3Crect x='0' y='0' width='100%25' height='100%25' fill='none' stroke='${encodeURIComponent(borderColorStr)}' stroke-width='${borderWidth}'/%3E%3C/svg%3E`;

    // Store original attributes in case user wants to restore later
    img.dataset.originalSrc = img.src;
    if (img.srcset) {
      img.dataset.originalSrcset = img.srcset;
    }

    // Replace the image source and clear srcset (important for responsive images)
    img.src = blankSvg;
    img.removeAttribute('srcset');
    img.alt = 'Image blocked by Face Block Chromium Extension';

    // Restore visibility now that we have the replacement
    if (img.dataset.wasHidden) {
      img.setAttribute('data-face-block-processed', 'true');
            img.style.opacity = '';
      delete img.dataset.wasHidden;
    }

    console.log(`Face Block Chromium Extension: Image replaced with color-matched SVG`);
  }

  // Set up MutationObserver for dynamic content
  function setupMutationObserver() {
    if (observer) return;

    // Debounce function to limit processing frequency
    let debounceTimer;
    const debounceDelay = 500;

    const callback = (mutations) => {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        if (!faceMatcher || !config.enabled) return;

        const newImages = [];

        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            // Check if node is an image
            if (node.nodeName === 'IMG' && !processedImages.has(node)) {
              newImages.push(node);
            }
            // Check for images in added subtrees
            else if (node.querySelectorAll) {
              const imgs = node.querySelectorAll('img');
              imgs.forEach(img => {
                if (!processedImages.has(img)) {
                  newImages.push(img);
                }
              });
            }
          });
        });

        if (newImages.length > 0) {
          console.log(`Face Block Chromium Extension: Processing ${newImages.length} new image(s)`);

          // Process new images
          for (const img of newImages) {
            // Wait for image to load if not loaded yet
            if (!img.complete) {
              await new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
                // Timeout after 5 seconds
                setTimeout(resolve, 5000);
              });
            }

            await processImage(img);
          }
        }
      }, debounceDelay);
    };

    observer = new MutationObserver(callback);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('Face Block Chromium Extension: MutationObserver started');
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_CHANGED') {
      if (message.settings.blurIntensity !== undefined) {
        config.blurIntensity = message.settings.blurIntensity;
        // Note: blur intensity no longer applies since we replace images
        // Kept for backward compatibility in case user switches back to CSS blur
      }

      if (message.settings.matchThreshold !== undefined) {
        config.matchThreshold = message.settings.matchThreshold;

        // Reload reference descriptors with new threshold
        loadReferenceDescriptors().then(() => {
          // Clear processed images and reprocess
          processedImages.clear();

          // Restore replaced images to their original sources
          document.querySelectorAll('.face-blurred').forEach(img => {
            img.classList.remove('face-blurred');
            if (img.dataset.originalSrc) {
              img.src = img.dataset.originalSrc;
              delete img.dataset.originalSrc;
            }
            if (img.dataset.originalSrcset) {
              img.srcset = img.dataset.originalSrcset;
              delete img.dataset.originalSrcset;
            }
            img.style.filter = '';
            img.style.webkitFilter = '';
          });

          processExistingImages();
        });
      }

      sendResponse({ success: true });
    }

    return true;
  });

  // Handle page visibility changes to pause/resume processing
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('Face Block Chromium Extension: Page hidden, pausing');
    } else {
      console.log('Face Block Chromium Extension: Page visible, resuming');
    }
  });

  // Start initialization
  initialize();
})();
