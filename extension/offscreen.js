// offscreen.js - Offscreen document for face detection with pre-loaded models
// This runs in a hidden document with DOM/Canvas access, allowing face-api.js to work

console.log('Face Block: Offscreen document loaded');

let modelsLoaded = false;
let ssdMobilenetLoaded = false;
let faceMatcher = null;
let config = {
  matchThreshold: 0.6,
  enabled: true,
  detector: 'hybrid'
};

// Load models immediately when offscreen document loads
(async function initializeModels() {
  try {
    console.log('Face Block: Loading face-api.js models in offscreen document...');
    const MODEL_URL = chrome.runtime.getURL('models');

    // Always load TinyFaceDetector (fast, primary detector)
    console.log('Face Block: Loading TinyFaceDetector...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    // Load shared models
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    modelsLoaded = true;
    console.log('Face Block: TinyFaceDetector and shared models loaded');

    // Lazy-load SsdMobilenet for hybrid/thorough modes
    // This is loaded in background to be ready when needed
    console.log('Face Block: Loading SsdMobilenetv1 in background...');
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).then(() => {
      ssdMobilenetLoaded = true;
      console.log('Face Block: SsdMobilenetv1 loaded (available for fallback)');
    }).catch(error => {
      console.warn('Face Block: SsdMobilenet loading failed:', error);
    });

  } catch (error) {
    console.error('Face Block: Error loading models in offscreen document:', error);
  }
})();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DETECT_FACES') {
    handleDetectFaces(message.data, sendResponse);
    return true; // Keep channel open for async response
  }
  else if (message.type === 'UPDATE_FACE_MATCHER') {
    handleUpdateFaceMatcher(message.data, sendResponse);
    return true;
  }
  else if (message.type === 'UPDATE_CONFIG') {
    handleUpdateConfig(message.data, sendResponse);
    return true;
  }
});

// Update configuration
async function handleUpdateConfig(data, sendResponse) {
  if (data.matchThreshold !== undefined) config.matchThreshold = data.matchThreshold;
  if (data.enabled !== undefined) config.enabled = data.enabled;
  if (data.detector !== undefined) config.detector = data.detector;

  console.log('Face Block: Config updated:', config);
  sendResponse({ success: true });
}

// Update face matcher with new reference data
async function handleUpdateFaceMatcher(referenceData, sendResponse) {
  try {
    if (!referenceData || referenceData.length === 0) {
      faceMatcher = null;
      console.log('Face Block: No reference data, matcher cleared');
      sendResponse({ success: true });
      return;
    }

    console.log('Face Block: Creating face matcher with', referenceData.length, 'person(s)');

    const labeledDescriptors = referenceData.map(person => {
      const descriptors = person.descriptors.map(d => new Float32Array(d));
      return new faceapi.LabeledFaceDescriptors(person.name, descriptors);
    });

    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.matchThreshold);
    console.log('Face Block: Face matcher created successfully');

    sendResponse({ success: true });
  } catch (error) {
    console.error('Face Block: Error creating face matcher:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle face detection request
async function handleDetectFaces(data, sendResponse) {
  try {
    // Wait for models to be loaded
    if (!modelsLoaded) {
      console.log('Face Block: Waiting for models to load...');
      // Wait up to 10 seconds for models
      for (let i = 0; i < 100; i++) {
        if (modelsLoaded) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!modelsLoaded) {
        throw new Error('Models not loaded');
      }
    }

    const { imageDataUrl, imgId, detector } = data;

    // Create image element from data URL
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageDataUrl;
    });

    console.log(`Face Block: [${imgId}] Detecting faces with ${detector || config.detector} mode...`);

    let detections = null;
    const detectorMode = detector || config.detector;

    if (detectorMode === 'hybrid') {
      // Try TinyFaceDetector first
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });

      detections = await faceapi
        .detectAllFaces(img, tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        // Wait for SsdMobilenet if not loaded yet
        if (!ssdMobilenetLoaded) {
          console.log(`Face Block: [${imgId}] Waiting for SsdMobilenet...`);
          for (let i = 0; i < 50; i++) {
            if (ssdMobilenetLoaded) break;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (ssdMobilenetLoaded) {
          console.log(`Face Block: [${imgId}] TinyFace found nothing, trying SsdMobilenet...`);
          const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });

          detections = await faceapi
            .detectAllFaces(img, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections && detections.length > 0) {
            console.log(`Face Block: [${imgId}] SsdMobilenet detected ${detections.length} face(s)`);
          }
        }
      } else {
        console.log(`Face Block: [${imgId}] TinyFace detected ${detections.length} face(s)`);
      }
    } else {
      // Single detector mode
      const options = detectorMode === 'ssdMobilenetv1'
        ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
        : new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });

      detections = await faceapi
        .detectAllFaces(img, options)
        .withFaceLandmarks()
        .withFaceDescriptors();
    }

    if (!detections || detections.length === 0) {
      console.log(`Face Block: [${imgId}] No faces detected`);
      sendResponse({ success: true, facesDetected: 0, matches: [] });
      return;
    }

    console.log(`Face Block: [${imgId}] Found ${detections.length} face(s)`);

    // Match against reference faces
    const matches = [];
    if (faceMatcher) {
      for (let i = 0; i < detections.length; i++) {
        const detection = detections[i];
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        if (bestMatch.label !== 'unknown') {
          matches.push({
            label: bestMatch.label,
            distance: bestMatch.distance,
            faceIndex: i
          });
          console.log(`Face Block: [${imgId}] Match found: ${bestMatch.label} (distance: ${bestMatch.distance.toFixed(3)})`);
        }
      }
    }

    sendResponse({
      success: true,
      facesDetected: detections.length,
      matches: matches
    });

  } catch (error) {
    console.error('Face Block: Detection error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
