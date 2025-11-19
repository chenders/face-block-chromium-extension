// Offscreen document for Chrome - handles face detection with face-api.js
// This runs in a separate context with DOM/Canvas access

// Configuration and logging utilities
const DEBUG_MODE = false;

function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log('[Face Block Debug]', ...args);
  }
}

function infoLog(...args) {
  console.info('[Face Block]', ...args);
}

function warnLog(...args) {
  console.warn('[Face Block Warning]', ...args);
}

function errorLog(...args) {
  console.error('[Face Block Error]', ...args);
}

// State management
let modelsLoaded = false;
let ssdMobilenetLoaded = false;
let faceMatcher = null;
let config = {
  matchThreshold: 0.6,
  enabled: true,
  detector: 'hybrid',
  detectorMode: 'selective',
  similarityThreshold: 0.6
};

debugLog('Offscreen document loaded');

// Load models immediately when offscreen document loads
(async function initializeModels() {
  try {
    debugLog('Loading face-api.js models in offscreen document...');
    // Use relative path from offscreen document
    const MODEL_URL = './models';
    debugLog('Model URL:', MODEL_URL);

    // Always load TinyFaceDetector (fast, primary detector)
    debugLog('Loading TinyFaceDetector...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    // Load shared models for face recognition
    debugLog('Loading shared models...');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    modelsLoaded = true;
    infoLog('TinyFaceDetector and shared models loaded');

    // Lazy-load SsdMobilenet for hybrid/thorough modes
    // This is loaded in background to be ready when needed
    debugLog('Loading SsdMobilenetv1 in background...');
    faceapi.nets.ssdMobilenetv1
      .loadFromUri('./models')
      .then(() => {
        ssdMobilenetLoaded = true;
        debugLog('SsdMobilenetv1 loaded (available for fallback)');
      })
      .catch(error => {
        warnLog('SsdMobilenet loading failed:', error);
      });
  } catch (error) {
    errorLog('Error loading models in offscreen document:', error);
  }
})();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages intended for offscreen
  if (message.target !== 'offscreen') {
    return false;
  }

  debugLog('Offscreen received message:', message.type);

  switch (message.type) {
    case 'DETECT_FACES':
      handleDetectFaces(message.data, sendResponse);
      return true; // Keep channel open for async response

    case 'UPDATE_FACE_MATCHER':
      handleUpdateFaceMatcher(message.data, sendResponse);
      return true;

    case 'UPDATE_CONFIG':
      handleUpdateConfig(message.data, sendResponse);
      return true;

    default:
      return false;
  }
});

// Update configuration
async function handleUpdateConfig(data, sendResponse) {
  // Update old-style config keys
  if (data.matchThreshold !== undefined) config.matchThreshold = data.matchThreshold;
  if (data.enabled !== undefined) config.enabled = data.enabled;
  if (data.detector !== undefined) config.detector = data.detector;

  // Update new-style config keys
  if (data.detectorMode !== undefined) config.detectorMode = data.detectorMode;
  if (data.similarityThreshold !== undefined) {
    config.similarityThreshold = data.similarityThreshold;
    config.matchThreshold = data.similarityThreshold; // Keep both in sync

    // Update face matcher threshold if it exists
    if (faceMatcher) {
      const labeledDescriptors = faceMatcher.labeledDescriptors;
      faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.similarityThreshold);
    }
  }

  debugLog('Config updated:', config);
  sendResponse({ success: true });
}

// Update face matcher with new reference data
async function handleUpdateFaceMatcher(data, sendResponse) {
  try {
    // Handle both data formats
    const referenceData = data.faces || data;

    if (!referenceData || referenceData.length === 0) {
      faceMatcher = null;
      debugLog('No reference data, matcher cleared');
      sendResponse({ success: true });
      return;
    }

    debugLog('Creating face matcher with', referenceData.length, 'person(s)');

    const labeledDescriptors = referenceData.map(person => {
      // Handle both property names for compatibility
      const name = person.name || person.label;
      const descriptors = person.descriptors.map(d => new Float32Array(d));
      return new faceapi.LabeledFaceDescriptors(name, descriptors);
    });

    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.similarityThreshold);
    infoLog('Face matcher created successfully');

    sendResponse({ success: true });
  } catch (error) {
    errorLog('Error creating face matcher:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle face detection request
async function handleDetectFaces(data, sendResponse) {
  try {
    // Wait for models to be loaded
    if (!modelsLoaded) {
      debugLog('Waiting for models to load...');
      // Wait up to 10 seconds for models
      for (let i = 0; i < 100; i++) {
        if (modelsLoaded) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!modelsLoaded) {
        throw new Error('Models not loaded');
      }
    }

    // Handle both old and new data formats
    const imageUrl = data.imageDataUrl || data.imageUrl;
    const imgId = data.imgId || data.imageId;
    const detector = data.detector || config.detector;

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    // Create image element from data URL or HTTP URL
    const img = new Image();

    // Only set crossOrigin for HTTP/HTTPS URLs (not for data: or blob:)
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });

    debugLog(`[${imgId}] Detecting faces with ${detector} mode...`);

    // Check if detector is off
    if (config.detectorMode === 'off') {
      sendResponse({
        success: true,
        blocked: false,
        reason: 'Detector is off',
        facesDetected: 0,
        matches: []
      });
      return;
    }

    let detections = null;
    const detectorMode = detector || config.detector;

    if (detectorMode === 'hybrid') {
      // Try TinyFaceDetector first (fast)
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.3,
      });

      detections = await faceapi
        .detectAllFaces(img, tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        // Wait for SsdMobilenet if not loaded yet
        if (!ssdMobilenetLoaded) {
          debugLog(`[${imgId}] Waiting for SsdMobilenet...`);
          for (let i = 0; i < 50; i++) {
            if (ssdMobilenetLoaded) break;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (ssdMobilenetLoaded) {
          debugLog(`[${imgId}] TinyFace found nothing, trying SsdMobilenet...`);
          const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });

          detections = await faceapi
            .detectAllFaces(img, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections && detections.length > 0) {
            debugLog(`[${imgId}] SsdMobilenet detected ${detections.length} face(s)`);
          }
        }
      } else {
        debugLog(`[${imgId}] TinyFace detected ${detections.length} face(s)`);
      }
    } else if (detectorMode === 'ssdMobilenetv1' || detectorMode === 'thorough') {
      // Use SsdMobilenet (more thorough but slower)
      if (!ssdMobilenetLoaded) {
        debugLog(`[${imgId}] Waiting for SsdMobilenet to load...`);
        for (let i = 0; i < 50; i++) {
          if (ssdMobilenetLoaded) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (ssdMobilenetLoaded) {
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
        detections = await faceapi
          .detectAllFaces(img, ssdOptions)
          .withFaceLandmarks()
          .withFaceDescriptors();
      } else {
        throw new Error('SsdMobilenet model not available');
      }
    } else {
      // Default to TinyFaceDetector (fast mode)
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.3,
      });

      detections = await faceapi
        .detectAllFaces(img, tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();
    }

    if (!detections || detections.length === 0) {
      debugLog(`[${imgId}] No faces detected`);
      sendResponse({
        success: true,
        blocked: false,
        reason: 'No faces detected',
        facesDetected: 0,
        matches: []
      });
      return;
    }

    debugLog(`[${imgId}] Found ${detections.length} face(s)`);

    // Check detector mode for blocking decision
    if (config.detectorMode === 'all') {
      // Block all faces mode
      sendResponse({
        success: true,
        blocked: true,
        reason: 'All faces mode - blocking all detected faces',
        facesDetected: detections.length,
        matches: detections.map((_, index) => ({
          label: 'all_faces',
          distance: 0,
          faceIndex: index
        }))
      });
      return;
    }

    // Selective mode - match against reference faces
    const matches = [];
    let shouldBlock = false;

    if (faceMatcher && config.detectorMode === 'selective') {
      for (let i = 0; i < detections.length; i++) {
        const detection = detections[i];
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        if (bestMatch.label !== 'unknown') {
          matches.push({
            label: bestMatch.label,
            distance: bestMatch.distance,
            faceIndex: i,
          });

          // Block if any face matches
          if (bestMatch.distance <= config.similarityThreshold) {
            shouldBlock = true;
            debugLog(
              `[${imgId}] Match found: ${bestMatch.label} (distance: ${bestMatch.distance.toFixed(3)})`
            );
          }
        }
      }
    }

    sendResponse({
      success: true,
      blocked: shouldBlock,
      reason: shouldBlock ? `Matched reference face` : 'No matching faces',
      facesDetected: detections.length,
      matches: matches,
    });
  } catch (error) {
    errorLog('Detection error:', error);
    sendResponse({
      success: false,
      blocked: false,
      error: error.message
    });
  }
}