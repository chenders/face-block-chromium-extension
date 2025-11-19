// Offscreen document for Chrome - handles face detection with face-api.js
// This runs in a separate context with DOM/Canvas access

// Simplified logger for offscreen context
class OffscreenLogger {
  constructor(context) {
    this.context = context;
    this.level = this.getLogLevel();
  }

  getLogLevel() {
    const stored = localStorage.getItem('faceblock-loglevel');
    if (stored) return parseInt(stored);
    // Default to INFO level
    return 2;
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString().split('T')[1];
    return `[${timestamp}][${level}][${this.context}] ${message}`;
  }

  debug(message, data) {
    if (this.level <= 1) {
      console.log(this.formatMessage('DEBUG', message), data || '');
    }
  }

  info(message, data) {
    if (this.level <= 2) {
      console.info(this.formatMessage('INFO', message), data || '');
    }
  }

  warn(message, data) {
    if (this.level <= 3) {
      console.warn(this.formatMessage('WARN', message), data || '');
    }
  }

  error(message, error, data) {
    if (this.level <= 4) {
      console.error(this.formatMessage('ERROR', message), error || '', data || '');
    }
  }

  time(label) {
    if (this.level <= 1) {
      console.time(`[${this.context}] ${label}`);
    }
  }

  timeEnd(label) {
    if (this.level <= 1) {
      console.timeEnd(`[${this.context}] ${label}`);
    }
  }
}

// Create logger instance
const logger = new OffscreenLogger('Offscreen');

// Compatibility wrappers
const debugLog = (...args) => logger.debug(args.join(' '));
const infoLog = (...args) => logger.info(args.join(' '));
const warnLog = (...args) => logger.warn(args.join(' '));
const errorLog = (...args) => logger.error(args.join(' '));

// State management
let modelsLoaded = false;
let ssdMobilenetLoaded = false;
let faceMatcher = null;
let adaptiveThresholds = new Map(); // Person-specific adaptive thresholds
let config = {
  matchThreshold: 0.6,
  enabled: true,
  detector: 'hybrid',
  detectorMode: 'selective',
  similarityThreshold: 0.6,
  useAdaptiveThresholds: true // Enable adaptive thresholds by default
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

    case 'EXTRACT_FACE_DESCRIPTOR':
      handleExtractFaceDescriptor(message.data, sendResponse);
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
// Calculate variance between face descriptors
function calculateDescriptorVariance(descriptors) {
  if (descriptors.length < 2) return 0;

  const dimension = descriptors[0].length;
  const mean = new Float32Array(dimension);

  // Calculate mean descriptor
  for (const descriptor of descriptors) {
    for (let i = 0; i < dimension; i++) {
      mean[i] += descriptor[i];
    }
  }
  for (let i = 0; i < dimension; i++) {
    mean[i] /= descriptors.length;
  }

  // Calculate variance
  let totalVariance = 0;
  for (const descriptor of descriptors) {
    let distance = 0;
    for (let i = 0; i < dimension; i++) {
      const diff = descriptor[i] - mean[i];
      distance += diff * diff;
    }
    totalVariance += Math.sqrt(distance);
  }

  return totalVariance / descriptors.length;
}

// Calculate adaptive threshold for a person
function calculateAdaptiveThreshold(descriptors, baseThreshold = 0.6) {
  if (descriptors.length < 2) return baseThreshold;

  const variance = calculateDescriptorVariance(descriptors);
  const normalizedVariance = Math.min(1, variance / 0.8);

  // High variance -> increase threshold (more lenient)
  // Low variance -> decrease threshold (more strict)
  const adjustment = (normalizedVariance - 0.5) * 0.2;
  const adaptiveThreshold = baseThreshold + adjustment;

  // Clamp to reasonable bounds
  return Math.max(0.4, Math.min(0.8, adaptiveThreshold));
}

async function handleUpdateFaceMatcher(data, sendResponse) {
  try {
    // Handle both data formats
    const referenceData = data.faces || data;

    if (!referenceData || referenceData.length === 0) {
      faceMatcher = null;
      adaptiveThresholds.clear();
      debugLog('No reference data, matcher cleared');
      sendResponse({ success: true });
      return;
    }

    debugLog('Creating face matcher with', referenceData.length, 'person(s)');

    // Clear and recalculate adaptive thresholds
    adaptiveThresholds.clear();

    const labeledDescriptors = referenceData.map(person => {
      // Handle both property names for compatibility
      const name = person.name || person.label;
      const descriptors = person.descriptors.map(d => new Float32Array(d));

      // Calculate adaptive threshold for this person
      if (config.useAdaptiveThresholds) {
        const adaptiveThreshold = calculateAdaptiveThreshold(descriptors, config.similarityThreshold);
        const variance = calculateDescriptorVariance(descriptors);
        adaptiveThresholds.set(name, {
          threshold: adaptiveThreshold,
          variance: variance,
          descriptorCount: descriptors.length,
          baseThreshold: config.similarityThreshold
        });
        debugLog(`Adaptive threshold for ${name}: ${adaptiveThreshold.toFixed(3)} (variance: ${variance.toFixed(3)}, ${descriptors.length} descriptors)`);
      }

      return new faceapi.LabeledFaceDescriptors(name, descriptors);
    });

    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, config.similarityThreshold);
    infoLog(`Face matcher created successfully${config.useAdaptiveThresholds ? ' with adaptive thresholds' : ''}`);

    sendResponse({ success: true });
  } catch (error) {
    errorLog('Error creating face matcher:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Image preprocessing pipeline to improve detection accuracy
async function preprocessImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;

  // Original image
  ctx.drawImage(img, 0, 0);
  const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Generate multiple variants for better detection
  const variants = [];

  // 1. Original (normalized)
  const normalized = normalizeHistogram(originalData);
  variants.push(imageDataToImage(normalized, canvas));

  // 2. Brightened version (for dark/underexposed images)
  const brightened = adjustBrightness(originalData, 1.2);
  variants.push(imageDataToImage(brightened, canvas));

  // 3. Darkened version (for overexposed images)
  const darkened = adjustBrightness(originalData, 0.8);
  variants.push(imageDataToImage(darkened, canvas));

  // 4. Enhanced contrast (for low contrast images)
  const enhanced = enhanceContrast(originalData, 1.3);
  variants.push(imageDataToImage(enhanced, canvas));

  // Wait for all images to load
  const loadedImages = await Promise.all(variants);
  return loadedImages;
}

// Histogram equalization for better lighting normalization
function normalizeHistogram(imageData) {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);

  // Calculate histogram for luminance
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    histogram[Math.floor(luminance)]++;
  }

  // Calculate cumulative distribution
  const cdf = histogram.slice();
  for (let i = 1; i < 256; i++) {
    cdf[i] += cdf[i - 1];
  }

  // Normalize CDF
  const total = data.length / 4;
  const normalized = cdf.map(val => Math.round(val * 255 / total));

  // Apply equalization
  const result = new ImageData(imageData.width, imageData.height);
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const factor = normalized[Math.floor(luminance)] / luminance;

    result.data[i] = Math.min(255, data[i] * factor);
    result.data[i + 1] = Math.min(255, data[i + 1] * factor);
    result.data[i + 2] = Math.min(255, data[i + 2] * factor);
    result.data[i + 3] = data[i + 3];
  }

  return result;
}

// Adjust image brightness
function adjustBrightness(imageData, factor) {
  const data = imageData.data;
  const result = new ImageData(imageData.width, imageData.height);

  for (let i = 0; i < data.length; i += 4) {
    result.data[i] = Math.min(255, data[i] * factor);
    result.data[i + 1] = Math.min(255, data[i + 1] * factor);
    result.data[i + 2] = Math.min(255, data[i + 2] * factor);
    result.data[i + 3] = data[i + 3];
  }

  return result;
}

// Enhance contrast for better feature detection
function enhanceContrast(imageData, factor) {
  const data = imageData.data;
  const result = new ImageData(imageData.width, imageData.height);

  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast formula: (value - 128) * factor + 128
    result.data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
    result.data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
    result.data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
    result.data[i + 3] = data[i + 3];
  }

  return result;
}

// Convert ImageData back to Image element
async function imageDataToImage(imageData, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);

  const img = new Image();
  const dataUrl = canvas.toDataURL();

  return new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
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

    // Apply preprocessing to improve detection accuracy
    const preprocessedImages = await preprocessImage(img);
    debugLog(`[${imgId}] Generated ${preprocessedImages.length} preprocessed variants`);

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
    let bestDetection = null;
    const detectorMode = detector || config.detector;

    // Enhanced detection with ensemble approach when in hybrid mode
    if (detectorMode === 'hybrid' || detectorMode === 'ensemble') {
      debugLog(`[${imgId}] Using ensemble detection with multiple models`);
      const ensembleDetections = [];

      // Try detection on all preprocessed variants with multiple models
      for (let variantIndex = 0; variantIndex < preprocessedImages.length; variantIndex++) {
        const variantImg = preprocessedImages[variantIndex];

        // Run both models in parallel for each variant
        const detectionPromises = [];

        // TinyFaceDetector
        const tinyOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.3,
        });
        detectionPromises.push(
          faceapi
            .detectAllFaces(variantImg, tinyOptions)
            .withFaceLandmarks()
            .withFaceDescriptors()
            .then(faces => ({ model: 'TinyFaceDetector', faces, variant: variantIndex }))
        );

        // SsdMobilenetv1 (if loaded)
        if (ssdMobilenetLoaded) {
          const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
          detectionPromises.push(
            faceapi
              .detectAllFaces(variantImg, ssdOptions)
              .withFaceLandmarks()
              .withFaceDescriptors()
              .then(faces => ({ model: 'SsdMobilenetv1', faces, variant: variantIndex }))
          );
        }

        // Wait for all models to complete
        const results = await Promise.allSettled(detectionPromises);

        // Collect successful detections
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.faces && result.value.faces.length > 0) {
            ensembleDetections.push(result.value);
            debugLog(`[${imgId}] Variant ${variantIndex} - ${result.value.model}: ${result.value.faces.length} face(s)`);
          }
        }
      }

      // Combine ensemble detections using voting strategy
      if (ensembleDetections.length > 0) {
        // Find the detection with most faces and highest combined confidence
        let bestScore = -1;
        for (const detection of ensembleDetections) {
          const faceCount = detection.faces.length;
          const avgConfidence = detection.faces.reduce((sum, face) => sum + face.detection.score, 0) / faceCount;
          // Score based on face count and confidence, with model weight
          const modelWeight = detection.model === 'SsdMobilenetv1' ? 1.2 : 1.0;
          const score = (faceCount * 1000 + avgConfidence * 100) * modelWeight;

          if (score > bestScore) {
            bestScore = score;
            bestDetection = detection.faces;
            debugLog(`[${imgId}] Best ensemble detection: ${detection.model} variant ${detection.variant} (score: ${score.toFixed(2)})`);
          }
        }
      }
    } else {
      // Original single-model detection logic for backward compatibility
      for (let variantIndex = 0; variantIndex < preprocessedImages.length; variantIndex++) {
        const variantImg = preprocessedImages[variantIndex];
        let variantDetections = null;

        if (detectorMode === 'ssdMobilenetv1' || detectorMode === 'thorough') {
          // Use SsdMobilenet (more thorough but slower)
          if (!ssdMobilenetLoaded && variantIndex === 0) {
            debugLog(`[${imgId}] Waiting for SsdMobilenet to load...`);
            for (let i = 0; i < 50; i++) {
              if (ssdMobilenetLoaded) break;
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          if (ssdMobilenetLoaded) {
            const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
            variantDetections = await faceapi
              .detectAllFaces(variantImg, ssdOptions)
              .withFaceLandmarks()
              .withFaceDescriptors();
          } else if (variantIndex === 0) {
            throw new Error('SsdMobilenet model not available');
          }
        } else {
          // Default to TinyFaceDetector (fast mode)
          const tinyOptions = new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.3,
          });

          variantDetections = await faceapi
            .detectAllFaces(variantImg, tinyOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();
        }

        // Keep the best detection (most faces or highest confidence)
        if (variantDetections && variantDetections.length > 0) {
          if (!bestDetection || variantDetections.length > bestDetection.length) {
            bestDetection = variantDetections;
            debugLog(`[${imgId}] Variant ${variantIndex} has best detection: ${variantDetections.length} faces`);
          }
        }
      }
    }

    // Use the best detection from all variants and models
    detections = bestDetection;

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
          // Get person-specific adaptive threshold if available
          let threshold = config.similarityThreshold;
          if (config.useAdaptiveThresholds && adaptiveThresholds.has(bestMatch.label)) {
            const thresholdData = adaptiveThresholds.get(bestMatch.label);
            threshold = thresholdData.threshold;
            debugLog(
              `[${imgId}] Using adaptive threshold for ${bestMatch.label}: ${threshold.toFixed(3)} (base: ${config.similarityThreshold})`
            );
          }

          matches.push({
            label: bestMatch.label,
            distance: bestMatch.distance,
            faceIndex: i,
            threshold: threshold,
            isAdaptive: config.useAdaptiveThresholds && adaptiveThresholds.has(bestMatch.label)
          });

          // Block if face matches using person-specific threshold
          if (bestMatch.distance <= threshold) {
            shouldBlock = true;
            debugLog(
              `[${imgId}] Match found: ${bestMatch.label} (distance: ${bestMatch.distance.toFixed(3)}, threshold: ${threshold.toFixed(3)})`
            );
          } else {
            debugLog(
              `[${imgId}] Near miss: ${bestMatch.label} (distance: ${bestMatch.distance.toFixed(3)} > threshold: ${threshold.toFixed(3)})`
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

// Extract face descriptor from an image for reference face storage
async function handleExtractFaceDescriptor(data, sendResponse) {
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

    const { imageData } = data;

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

    debugLog('Extracting face descriptor from reference image...');

    // Detect face with descriptor
    // Use SsdMobilenet for better accuracy when adding reference faces
    let detection = null;

    // Try SsdMobilenet first if loaded (more accurate for reference faces)
    if (ssdMobilenetLoaded) {
      const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
      const detections = await faceapi
        .detectAllFaces(img, ssdOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections && detections.length > 0) {
        detection = detections[0]; // Take the first face
        debugLog('Face detected with SsdMobilenet');
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
        debugLog('Face detected with TinyFaceDetector');
      }
    }

    if (!detection) {
      debugLog('No face detected in reference image');
      sendResponse({
        success: false,
        error: 'No face detected in the image'
      });
      return;
    }

    // Convert descriptor to array
    const descriptor = Array.from(detection.descriptor);

    debugLog('Face descriptor extracted successfully');
    sendResponse({
      success: true,
      descriptor: descriptor
    });

  } catch (error) {
    errorLog('Error extracting face descriptor:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}