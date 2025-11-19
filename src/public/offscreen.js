// Offscreen document for Chrome - handles face detection with face-api.js
// This runs in a separate context with DOM/Canvas access

// Face-api.js will be loaded from the libs directory
// We'll load it dynamically

// State management
let isModelLoaded = false;
let faceMatcher = null;
let config = {
  detectorMode: 'selective',
  similarityThreshold: 0.6,
  debugMode: false
};

// Initialize when offscreen document loads
initialize();

async function initialize() {
  console.log('Offscreen document initializing...');

  try {
    // Load face-api.js models
    await loadModels();

    // Set up message listener
    chrome.runtime.onMessage.addListener(handleMessage);

    console.log('Offscreen document ready');
  } catch (error) {
    console.error('Failed to initialize offscreen document:', error);
  }
}

async function loadModels() {
  const MODEL_URL = chrome.runtime.getURL('/models');

  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);

    isModelLoaded = true;
    console.log('Face-api.js models loaded successfully');
  } catch (error) {
    console.error('Failed to load models:', error);
    throw error;
  }
}

function handleMessage(message, sender, sendResponse) {
  if (message.target !== 'offscreen') {
    return false;
  }

  console.log('Offscreen received message:', message.type);

  switch (message.type) {
    case 'DETECT_FACES':
      detectFaces(message.data).then(sendResponse).catch(error => {
        console.error('Face detection error:', error);
        sendResponse({ error: error.message });
      });
      return true; // Keep channel open for async response

    case 'UPDATE_FACE_MATCHER':
      updateFaceMatcher(message.data).then(sendResponse).catch(error => {
        console.error('Face matcher update error:', error);
        sendResponse({ error: error.message });
      });
      return true;

    case 'UPDATE_CONFIG':
      updateConfig(message.data);
      sendResponse({ success: true });
      return false;

    default:
      return false;
  }
}

async function detectFaces(data) {
  if (!isModelLoaded) {
    throw new Error('Models not loaded yet');
  }

  const { imageUrl, imageId } = data;

  try {
    // Load image
    const img = await loadImage(imageUrl);

    // Detect faces with descriptors
    const detections = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return { blocked: false, reason: 'No faces detected' };
    }

    // Check detection mode
    if (config.detectorMode === 'off') {
      return { blocked: false, reason: 'Detector is off' };
    }

    if (config.detectorMode === 'all') {
      return { blocked: true, reason: 'All faces mode' };
    }

    // Selective mode - check against reference faces
    if (config.detectorMode === 'selective' && faceMatcher) {
      for (const detection of detections) {
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        if (bestMatch.distance <= config.similarityThreshold) {
          return {
            blocked: true,
            reason: `Matched ${bestMatch.label} with distance ${bestMatch.distance.toFixed(3)}`
          };
        }
      }
    }

    return { blocked: false, reason: 'No matching faces' };

  } catch (error) {
    console.error('Face detection error for image:', imageUrl, error);
    throw error;
  }
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));

    img.src = url;
  });
}

async function updateFaceMatcher(data) {
  const { faces } = data;

  if (!faces || faces.length === 0) {
    faceMatcher = null;
    console.log('Face matcher cleared');
    return { success: true };
  }

  try {
    // Convert face data to LabeledFaceDescriptors
    const labeledDescriptors = faces.map(face => {
      const descriptors = face.descriptors.map(d => new Float32Array(d));
      return new faceapi.LabeledFaceDescriptors(face.label, descriptors);
    });

    // Create face matcher
    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.similarityThreshold);

    console.log(`Face matcher updated with ${faces.length} reference faces`);
    return { success: true };

  } catch (error) {
    console.error('Failed to update face matcher:', error);
    throw error;
  }
}

function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  console.log('Config updated:', config);

  // Update face matcher threshold if it exists
  if (faceMatcher && config.similarityThreshold !== undefined) {
    const faces = faceMatcher.labeledDescriptors;
    faceMatcher = new faceapi.FaceMatcher(faces, config.similarityThreshold);
  }
}