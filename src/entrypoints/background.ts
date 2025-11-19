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
    // In Firefox, we can load face-api.js directly since event pages have DOM access
    // This will be implemented when we migrate the face detection logic
    console.log('Firefox face detection ready (to be implemented)');
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
    // TODO: Implement direct face detection for Firefox
    sendResponse({ error: 'Firefox face detection not yet implemented' });
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
    // TODO: Implement for Firefox
    sendResponse({ error: 'Firefox face matcher update not yet implemented' });
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
    // TODO: Implement for Firefox
    sendResponse({ error: 'Firefox config update not yet implemented' });
  }
}