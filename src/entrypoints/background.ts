import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  console.log('Face Block Extension - Background script loaded');

  // Browser detection
  const isChrome = typeof chrome !== 'undefined' && chrome.offscreen !== undefined;
  const isFirefox = typeof browser !== 'undefined' && !isChrome;

  console.log(`Running on: ${isChrome ? 'Chrome' : isFirefox ? 'Firefox' : 'Unknown browser'}`);

  // Initialize face detection based on browser
  initializeFaceDetection();

  // Setup CORS headers for cross-origin image access
  setupCORSHeaders();

  // Message handler
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.type);

    if (message.type === 'DETECT_FACES') {
      handleFaceDetection(message.data, sendResponse);
      return true; // Keep the message channel open for async response
    }

    if (message.type === 'UPDATE_FACE_MATCHER') {
      handleUpdateFaceMatcher(message.data, sendResponse);
      return true;
    }

    if (message.type === 'UPDATE_CONFIG') {
      handleUpdateConfig(message.data, sendResponse);
      return true;
    }

    if (message.type === 'ADD_REFERENCE_FACE') {
      handleAddReferenceFace(message.data, sendResponse);
      return true;
    }

    return false;
  });
});

// Initialize face detection based on browser capabilities
async function initializeFaceDetection() {
  const isChrome = typeof chrome !== 'undefined' && chrome.offscreen !== undefined;

  if (isChrome) {
    console.log('Initializing Chrome offscreen document for face detection');
    await setupOffscreenDocument();
  } else {
    console.log('Initializing Firefox face detection in background');
    await setupFirefoxFaceDetection();
  }
}

// Chrome: Setup offscreen document for face-api.js processing
async function setupOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')],
    });

    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      return;
    }

    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Face detection requires Canvas/WebGL APIs not available in service workers',
    });

    console.log('Offscreen document created successfully');
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
  }
}

// Firefox: Setup face detection directly in background
async function setupFirefoxFaceDetection() {
  try {
    // Dynamically import Firefox face detection module
    // This runs directly in the background page since Firefox event pages have DOM access
    const firefoxModule = await import('../utils/firefox-face-detection');
    await firefoxModule.initializeFirefoxFaceDetection();
    console.log('Firefox face detection initialized successfully');
  } catch (error) {
    console.error('Failed to setup Firefox face detection:', error);
  }
}

// Setup CORS headers for cross-origin image access
async function setupCORSHeaders() {
  const rules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {
            header: 'Access-Control-Allow-Origin',
            operation: 'set',
            value: '*',
          },
          {
            header: 'Access-Control-Allow-Methods',
            operation: 'set',
            value: 'GET, OPTIONS',
          },
        ],
      },
      condition: {
        resourceTypes: ['image'],
        urlFilter: '*',
      },
    },
  ];

  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: rules,
    });
    console.log('CORS headers configured');
  } catch (error) {
    console.error('Failed to setup CORS headers:', error);
  }
}

// Handle face detection messages
async function handleFaceDetection(data: any, sendResponse: Function) {
  const isChrome = typeof chrome !== 'undefined' && chrome.offscreen !== undefined;

  if (isChrome) {
    // Forward to offscreen document
    try {
      const response = await browser.runtime.sendMessage({
        type: 'DETECT_FACES',
        target: 'offscreen',
        data,
      });
      sendResponse(response);
    } catch (error) {
      console.error('Face detection error:', error);
      sendResponse({ error: error.message });
    }
  } else {
    // Handle directly in Firefox background
    try {
      const firefoxModule = await import('../utils/firefox-face-detection');
      const response = await firefoxModule.handleFirefoxFaceDetection(data);
      sendResponse(response);
    } catch (error: any) {
      console.error('Firefox face detection error:', error);
      sendResponse({ error: error.message });
    }
  }
}

// Handle face matcher updates
async function handleUpdateFaceMatcher(data: any, sendResponse: Function) {
  const isChrome = typeof chrome !== 'undefined' && chrome.offscreen !== undefined;

  // Convert object format to array format if needed
  let formattedData = data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Convert object format { "Person Name": { descriptors: [...], images: [...] } }
    // to array format [{ name: "Person Name", descriptors: [...] }]
    formattedData = Object.entries(data).map(([name, personData]: [string, any]) => ({
      name,
      label: name,
      descriptors: personData.descriptors || [],
    }));
    console.log('Converted object format to array format:', formattedData);
  }

  if (isChrome) {
    // Forward to offscreen document
    try {
      const response = await browser.runtime.sendMessage({
        type: 'UPDATE_FACE_MATCHER',
        target: 'offscreen',
        data: formattedData,
      });
      sendResponse(response);
    } catch (error) {
      console.error('Face matcher update error:', error);
      sendResponse({ error: error.message });
    }
  } else {
    // Handle directly in Firefox background
    try {
      const firefoxModule = await import('../utils/firefox-face-detection');
      const response = await firefoxModule.updateFirefoxFaceMatcher(formattedData);
      sendResponse(response);
    } catch (error: any) {
      console.error('Firefox face matcher update error:', error);
      sendResponse({ error: error.message });
    }
  }
}

// Handle config updates
async function handleUpdateConfig(data: any, sendResponse: Function) {
  const isChrome = typeof chrome !== 'undefined' && chrome.offscreen !== undefined;

  if (isChrome) {
    // Forward to offscreen document
    try {
      const response = await browser.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        target: 'offscreen',
        data,
      });
      sendResponse(response);
    } catch (error) {
      console.error('Config update error:', error);
      sendResponse({ error: error.message });
    }
  } else {
    // Handle directly in Firefox background
    try {
      const firefoxModule = await import('../utils/firefox-face-detection');
      const response = firefoxModule.updateFirefoxConfig(data);
      sendResponse(response);
    } catch (error: any) {
      console.error('Firefox config update error:', error);
      sendResponse({ error: error.message });
    }
  }
}

// Handle adding a new reference face
async function handleAddReferenceFace(data: any, sendResponse: Function) {
  const isChrome = typeof chrome !== 'undefined' && chrome.offscreen !== undefined;

  try {
    const { imageData, label } = data;

    if (!imageData || !label) {
      sendResponse({ success: false, error: 'Missing image data or label' });
      return;
    }

    console.log(`Adding reference face for: ${label}`);

    // Detect face and get descriptors
    let faceData: any;

    if (isChrome) {
      // Use offscreen document for Chrome
      faceData = await new Promise((resolve, reject) => {
        browser.runtime.sendMessage(
          {
            type: 'EXTRACT_FACE_DESCRIPTOR',
            target: 'offscreen',
            data: { imageData },
          },
          response => {
            if (response && response.success) {
              resolve(response);
            } else {
              reject(new Error(response?.error || 'Failed to extract face descriptor'));
            }
          }
        );
      });
    } else {
      // Use Firefox direct processing
      const firefoxModule = await import('../utils/firefox-face-detection');
      faceData = await firefoxModule.extractFaceDescriptor(imageData);
    }

    if (!faceData.success || !faceData.descriptor) {
      sendResponse({ success: false, error: 'No face detected in image' });
      return;
    }

    // Get existing reference faces from storage
    const result = await browser.storage.local.get('referenceFaces');
    const referenceFaces = result.referenceFaces || [];

    // Find or create person entry
    let person = referenceFaces.find((p: any) => p.label === label || p.name === label);

    if (!person) {
      person = {
        label: label,
        name: label,
        descriptors: [],
        thumbnail: null,
      };
      referenceFaces.push(person);
    }

    // Add the new descriptor
    person.descriptors.push(faceData.descriptor);

    // Store thumbnail for the first image
    if (!person.thumbnail && imageData.startsWith('data:')) {
      // For Chrome, we can't create canvas in service worker, so just store a portion
      // For Firefox, we could create a proper thumbnail
      person.thumbnail = imageData.substring(0, 5000); // Store first part as thumbnail placeholder
    }

    // Save updated reference faces
    await browser.storage.local.set({ referenceFaces });

    // Update the face matcher
    await new Promise<void>(resolve => {
      browser.runtime.sendMessage(
        {
          type: 'UPDATE_FACE_MATCHER',
          data: referenceFaces,
        },
        () => resolve()
      );
    });

    console.log(`Reference face added successfully for ${label}`);
    sendResponse({ success: true });
  } catch (error: any) {
    console.error('Error adding reference face:', error);
    sendResponse({ success: false, error: error.message });
  }
}
