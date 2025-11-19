// Firefox-specific face detection implementation
// Runs directly in the background page which has DOM access in Firefox

import * as faceapi from 'face-api.js';

// State management
let modelsLoaded = false;
let ssdMobilenetLoaded = false;
let faceMatcher: faceapi.FaceMatcher | null = null;
let config = {
  matchThreshold: 0.6,
  enabled: true,
  detector: 'hybrid',
  detectorMode: 'selective',
  similarityThreshold: 0.6
};

// Logging utilities
const DEBUG_MODE = false;

function debugLog(...args: any[]) {
  if (DEBUG_MODE) {
    console.log('[Face Block Firefox Debug]', ...args);
  }
}

function infoLog(...args: any[]) {
  console.info('[Face Block Firefox]', ...args);
}

function warnLog(...args: any[]) {
  console.warn('[Face Block Firefox Warning]', ...args);
}

function errorLog(...args: any[]) {
  console.error('[Face Block Firefox Error]', ...args);
}

// Initialize face detection for Firefox
export async function initializeFirefoxFaceDetection() {
  try {
    debugLog('Initializing Firefox face detection in background...');

    // Load models from extension URL
    const baseUrl = chrome.runtime.getURL('');
    const MODEL_URL = `${baseUrl}models`;

    debugLog('Model URL:', MODEL_URL);

    // Always load TinyFaceDetector (fast, primary detector)
    debugLog('Loading TinyFaceDetector...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    // Load shared models for face recognition
    debugLog('Loading shared models...');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    modelsLoaded = true;
    infoLog('Firefox face detection models loaded successfully');

    // Lazy-load SsdMobilenet for hybrid/thorough modes
    debugLog('Loading SsdMobilenetv1 in background...');
    faceapi.nets.ssdMobilenetv1
      .loadFromUri(MODEL_URL)
      .then(() => {
        ssdMobilenetLoaded = true;
        debugLog('SsdMobilenetv1 loaded (available for fallback)');
      })
      .catch(error => {
        warnLog('SsdMobilenet loading failed:', error);
      });

    return true;
  } catch (error) {
    errorLog('Error initializing Firefox face detection:', error);
    return false;
  }
}

// Handle face detection request for Firefox
export async function handleFirefoxFaceDetection(data: any): Promise<any> {
  try {
    // Wait for models to be loaded
    if (!modelsLoaded) {
      debugLog('Waiting for models to load...');
      for (let i = 0; i < 100; i++) {
        if (modelsLoaded) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!modelsLoaded) {
        throw new Error('Models not loaded');
      }
    }

    const imageUrl = data.imageDataUrl || data.imageUrl;
    const imgId = data.imgId || data.imageId;
    const detector = data.detector || config.detector;

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    // Create image element
    const img = new Image();

    // Only set crossOrigin for HTTP/HTTPS URLs
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });

    debugLog(`[${imgId}] Firefox detecting faces with ${detector} mode...`);

    // Check if detector is off
    if (config.detectorMode === 'off') {
      return {
        success: true,
        blocked: false,
        reason: 'Detector is off',
        facesDetected: 0,
        matches: []
      };
    }

    let detections = null;
    const detectorMode = detector || config.detector;

    if (detectorMode === 'hybrid') {
      // Try TinyFaceDetector first
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.3,
      });

      detections = await faceapi
        .detectAllFaces(img, tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        // Try SsdMobilenet as fallback
        if (ssdMobilenetLoaded) {
          debugLog(`[${imgId}] TinyFace found nothing, trying SsdMobilenet...`);
          const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });

          detections = await faceapi
            .detectAllFaces(img, ssdOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();
        }
      }
    } else if (detectorMode === 'ssdMobilenetv1' || detectorMode === 'thorough') {
      // Use SsdMobilenet
      if (ssdMobilenetLoaded) {
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
        detections = await faceapi
          .detectAllFaces(img, ssdOptions)
          .withFaceLandmarks()
          .withFaceDescriptors();
      }
    } else {
      // Default to TinyFaceDetector
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
      return {
        success: true,
        blocked: false,
        reason: 'No faces detected',
        facesDetected: 0,
        matches: []
      };
    }

    debugLog(`[${imgId}] Found ${detections.length} face(s)`);

    // Check detector mode for blocking decision
    if (config.detectorMode === 'all') {
      return {
        success: true,
        blocked: true,
        reason: 'All faces mode - blocking all detected faces',
        facesDetected: detections.length,
        matches: detections.map((_, index) => ({
          label: 'all_faces',
          distance: 0,
          faceIndex: index
        }))
      };
    }

    // Selective mode - match against reference faces
    const matches: any[] = [];
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

    return {
      success: true,
      blocked: shouldBlock,
      reason: shouldBlock ? `Matched reference face` : 'No matching faces',
      facesDetected: detections.length,
      matches: matches,
    };
  } catch (error: any) {
    errorLog('Firefox detection error:', error);
    return {
      success: false,
      blocked: false,
      error: error.message
    };
  }
}

// Update face matcher for Firefox
export async function updateFirefoxFaceMatcher(data: any): Promise<any> {
  try {
    const referenceData = data.faces || data;

    if (!referenceData || referenceData.length === 0) {
      faceMatcher = null;
      debugLog('No reference data, matcher cleared');
      return { success: true };
    }

    debugLog('Creating Firefox face matcher with', referenceData.length, 'person(s)');

    const labeledDescriptors = referenceData.map((person: any) => {
      const name = person.name || person.label;
      const descriptors = person.descriptors.map((d: any) => new Float32Array(d));
      return new faceapi.LabeledFaceDescriptors(name, descriptors);
    });

    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.similarityThreshold);
    infoLog('Firefox face matcher created successfully');

    return { success: true };
  } catch (error: any) {
    errorLog('Error creating Firefox face matcher:', error);
    return { success: false, error: error.message };
  }
}

// Update configuration for Firefox
export function updateFirefoxConfig(data: any): any {
  // Update config values
  if (data.matchThreshold !== undefined) config.matchThreshold = data.matchThreshold;
  if (data.enabled !== undefined) config.enabled = data.enabled;
  if (data.detector !== undefined) config.detector = data.detector;
  if (data.detectorMode !== undefined) config.detectorMode = data.detectorMode;

  if (data.similarityThreshold !== undefined) {
    config.similarityThreshold = data.similarityThreshold;
    config.matchThreshold = data.similarityThreshold;

    // Update face matcher threshold if it exists
    if (faceMatcher) {
      const labeledDescriptors = faceMatcher.labeledDescriptors;
      faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.similarityThreshold);
    }
  }

  debugLog('Firefox config updated:', config);
  return { success: true };
}

// Extract face descriptor from an image for reference face storage
export async function extractFaceDescriptor(imageData: string): Promise<any> {
  try {
    // Wait for models to be loaded
    if (!modelsLoaded) {
      debugLog('Waiting for models to load...');
      for (let i = 0; i < 100; i++) {
        if (modelsLoaded) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!modelsLoaded) {
        throw new Error('Models not loaded');
      }
    }

    if (!imageData) {
      throw new Error('No image data provided');
    }

    // Create image element
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });

    debugLog('Firefox: Extracting face descriptor from reference image...');

    // Detect face with descriptor
    let detection = null;

    // Try SsdMobilenet first if loaded (more accurate for reference faces)
    if (ssdMobilenetLoaded) {
      const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
      const detections = await faceapi
        .detectAllFaces(img, ssdOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections && detections.length > 0) {
        detection = detections[0];
        debugLog('Firefox: Face detected with SsdMobilenet');
      }
    }

    // Fall back to TinyFaceDetector if needed
    if (!detection) {
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416, // Higher resolution for reference faces
        scoreThreshold: 0.3,
      });

      const detections = await faceapi
        .detectAllFaces(img, tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections && detections.length > 0) {
        detection = detections[0];
        debugLog('Firefox: Face detected with TinyFaceDetector');
      }
    }

    if (!detection) {
      debugLog('Firefox: No face detected in reference image');
      return {
        success: false,
        error: 'No face detected in the image'
      };
    }

    // Convert descriptor to array
    const descriptor = Array.from(detection.descriptor);

    debugLog('Firefox: Face descriptor extracted successfully');
    return {
      success: true,
      descriptor: descriptor
    };

  } catch (error: any) {
    errorLog('Firefox: Error extracting face descriptor:', error);
    return {
      success: false,
      error: error.message
    };
  }
}