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
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });

    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      return;
    }

    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Face detection requires Canvas/WebGL APIs not available in service workers'
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
            value: '*'
          },
          {
            header: 'Access-Control-Allow-Methods',
            operation: 'set',
            value: 'GET, OPTIONS'
          }
        ]
      },
      condition: {
        resourceTypes: ['image'],
        urlFilter: '*'
      }
    }
  ];

  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: rules
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
        data
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

  if (isChrome) {
    // Forward to offscreen document
    try {
      const response = await browser.runtime.sendMessage({
        type: 'UPDATE_FACE_MATCHER',
        target: 'offscreen',
        data
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
      const response = await firefoxModule.updateFirefoxFaceMatcher(data);
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
        data
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