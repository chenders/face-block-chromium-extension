// content.js - Main content script for face detection and blurring

(async function () {
  'use strict';

  // Configuration
  let config = {
    matchThreshold: 0.6,
    enabled: true,
    detector: 'hybrid', // 'tinyFaceDetector', 'ssdMobilenetv1', or 'hybrid'
  };

  let hasReferenceData = false;
  let processing = false;
  // Store processed images with their src to detect src changes
  const processedImages = new WeakMap();
  let observer = null;

  debugLog('Face Block Chromium Extension: Content script loaded');

  // Detect if page uses React (check for React-specific attributes and globals)
  function isReactSite() {
    // Check for React dev tools markers
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return true;

    // Check for React root attributes
    const hasReactRoot = document.querySelector(
      '[data-reactroot], [data-reactid], #__next, [id^="__react"]'
    );
    if (hasReactRoot) return true;

    // Check for Next.js or other React frameworks
    if (window.__NEXT_DATA__ || window.next) return true;

    return false;
  }

  // Initialize
  async function initialize() {
    try {
      // Load settings
      await loadSettings();

      // Send config to offscreen document
      await updateOffscreenConfig();

      // Get reference descriptors and send to offscreen document
      await loadReferenceDescriptors();

      // Check if this is a React site that needs hydration time
      const reactSite = isReactSite();
      if (reactSite) {
        debugLog(
          'Face Block Chromium Extension: React site detected, delaying processing for hydration'
        );
      }

      // Process existing images after hydration on React sites
      if (reactSite) {
        // Use requestIdleCallback to wait for React hydration to complete
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(
            async () => {
              await processExistingImages();
            },
            { timeout: 2000 }
          ); // Fallback timeout of 2s
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(async () => {
            await processExistingImages();
          }, 1000);
        }
      } else {
        // Process immediately on non-React sites
        await processExistingImages();
      }

      // Set up dynamic content monitoring
      setupMutationObserver();

      if (hasReferenceData) {
        debugLog('Face Block Chromium Extension: Initialized successfully');
      } else {
        debugLog(
          'Face Block Chromium Extension: No reference faces stored yet - images will be shown normally'
        );
      }
    } catch (error) {
      errorLog('Face Block Chromium Extension: Initialization error:', error);
    }
  }

  // Send config to offscreen document
  async function updateOffscreenConfig() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'UPDATE_CONFIG',
          data: {
            matchThreshold: config.matchThreshold,
            enabled: config.enabled,
            detector: config.detector,
          },
        },
        response => {
          if (response && response.success) {
            debugLog('Face Block Chromium Extension: Config sent to offscreen document');
          }
          resolve();
        }
      );
    });
  }

  // Load settings from chrome.storage
  async function loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get(['matchThreshold', 'enabled', 'detector'], result => {
        if (result.matchThreshold) config.matchThreshold = result.matchThreshold;
        if (result.enabled !== undefined) config.enabled = result.enabled;
        if (result.detector) config.detector = result.detector;
        resolve();
      });
    });
  }

  // Load reference descriptors from background and send to offscreen document
  async function loadReferenceDescriptors() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_REFERENCE_DESCRIPTORS' }, async response => {
        debugLog('Content: Received reference data response:', response);

        if (
          response &&
          response.success &&
          response.referenceData &&
          response.referenceData.length > 0
        ) {
          hasReferenceData = true;
          debugLog(
            `Face Block Chromium Extension: Sending ${response.referenceData.length} reference face(s) to offscreen document`
          );

          // Send reference data to offscreen document
          chrome.runtime.sendMessage(
            {
              type: 'UPDATE_FACE_MATCHER',
              data: response.referenceData,
            },
            updateResponse => {
              if (updateResponse && updateResponse.success) {
                debugLog(
                  'Face Block Chromium Extension: Reference data sent to offscreen document successfully'
                );
              } else {
                errorLog(
                  'Face Block Chromium Extension: Failed to update offscreen document face matcher'
                );
              }
              resolve();
            }
          );
        } else {
          hasReferenceData = false;
          debugLog('Face Block Chromium Extension: No reference data available');
          // Clear face matcher in offscreen document
          chrome.runtime.sendMessage(
            {
              type: 'UPDATE_FACE_MATCHER',
              data: [],
            },
            () => {
              resolve();
            }
          );
        }
      });
    });
  }

  // Detect faces using offscreen document
  async function detectFacesOffscreen(img, imgId) {
    try {
      // For data URLs, send directly
      let imageData;
      if (img.src.startsWith('data:') || img.src.startsWith('blob:')) {
        imageData = img.src;
      } else {
        // For HTTP/HTTPS URLs, try canvas conversion
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          imageData = canvas.toDataURL('image/jpeg', 0.95);
        } catch (canvasError) {
          // If canvas fails (CORS), send URL directly and let offscreen handle it
          imageData = img.src;
        }
      }

      // Send to offscreen document for detection
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'DETECT_FACES',
            data: {
              imageDataUrl: imageData,
              imgId: imgId,
              detector: config.detector,
            },
          },
          response => {
            if (response && response.success) {
              resolve(response);
            } else {
              reject(new Error(response?.error || 'Detection failed'));
            }
          }
        );
      });
    } catch (error) {
      throw error;
    }
  }

  // Process existing images on page
  // This runs even when no reference data exists to restore image visibility
  async function processExistingImages() {
    if (!config.enabled) return;

    const images = document.querySelectorAll('img');
    debugLog(`Face Block Chromium Extension: Processing ${images.length} existing images`);

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
    // Skip if manually unblocked by user
    if (img.dataset.manuallyUnblocked === 'true') {
      return;
    }

    // Skip if already processed with the same src
    // (If src has changed, we need to re-process)
    const lastProcessedSrc = processedImages.get(img);
    if (lastProcessedSrc === img.src) return;

    // If no reference data, just restore visibility
    if (!hasReferenceData) {
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      processedImages.set(img, img.src);
      return;
    }

    // Skip if image not loaded or too small
    // Check BOTH display dimensions (CSS-scaled) AND natural dimensions (actual image size)
    // Google uses 1x1 placeholders scaled to 46x46, we need to catch these
    const displayWidth = img.offsetWidth || img.width;
    const displayHeight = img.offsetHeight || img.height;
    const naturalWidth = img.naturalWidth || 0;
    const naturalHeight = img.naturalHeight || 0;

    // Minimum size threshold - lowered to 30x30 to catch Google Images thumbnails
    const MIN_SIZE = 30;

    // If image not loaded yet, don't mark as processed - we need to check it again when it loads
    if (!img.complete) {
      console.debug(
        'Face Block Chromium Extension: Skipping image (not loaded yet):',
        img.src.substring(0, 100),
        `${displayWidth}x${displayHeight}`
      );
      img.style.opacity = '';

      // Add load listener to process again when image loads
      img.addEventListener('load', () => processImage(img), { once: true });
      img.addEventListener('error', () => processImage(img), { once: true });

      return;
    }

    // If image is loaded but too small (check BOTH display and natural dimensions)
    // This catches 1x1 placeholders that are scaled up by CSS
    if (
      displayWidth < MIN_SIZE ||
      displayHeight < MIN_SIZE ||
      naturalWidth < MIN_SIZE ||
      naturalHeight < MIN_SIZE
    ) {
      console.debug(
        'Face Block Chromium Extension: Skipping image (too small):',
        img.src.substring(0, 100),
        `display:${displayWidth}x${displayHeight} natural:${naturalWidth}x${naturalHeight}`
      );
      processedImages.set(img, img.src); // Store src to detect changes
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      return;
    }

    // Additional check for invalid dimensions
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      console.debug(
        'Face Block Chromium Extension: Skipping image with 0 dimensions:',
        img.src.substring(0, 100)
      );
      processedImages.set(img, img.src);
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      return;
    }

    // Skip if this is our own replacement SVG (has face-blocked class and data/blob URI)
    if (
      (img.src.startsWith('data:') || img.src.startsWith('blob:')) &&
      img.classList.contains('face-blocked')
    ) {
      return;
    }

    // Create a short identifier for logging (last 50 chars of URL)
    const imgId = img.src.length > 50 ? '...' + img.src.slice(-50) : img.src;

    debugLog(`Face Block Chromium Extension: Processing image: ${imgId}`);

    // Detect background color (image is already hidden by preload.js)
    const bgColor = getBackgroundColor(img.parentElement || img);
    const bgRgb = parseRgb(bgColor);

    // Mark that we're processing this image (preload.js already hid it)
    img.dataset.wasHidden = 'true';

    try {
      // Log image dimensions for debugging
      debugLog(
        `Face Block Chromium Extension: [${imgId}] Image dimensions: ${img.naturalWidth}x${img.naturalHeight}, display: ${img.offsetWidth}x${img.offsetHeight}`
      );

      // Detect faces using offscreen document
      let result;
      try {
        result = await detectFacesOffscreen(img, imgId);
      } catch (detectionError) {
        // Handle CORS errors silently
        if (
          detectionError.message &&
          (detectionError.message.includes('texImage2D') ||
            detectionError.message.includes('Tainted canvas') ||
            detectionError.message.includes('cross-origin') ||
            detectionError.message.includes('Failed to load image'))
        ) {
          console.debug(
            'Face Block Chromium Extension: CORS-restricted image, skipping:',
            img.src.substring(0, 100)
          );
          // Restore visibility for CORS-restricted images
          if (img.dataset.wasHidden) {
            img.setAttribute('data-face-block-processed', 'true');
            img.style.opacity = '';
            delete img.dataset.wasHidden;
          }
          processedImages.set(img, img.src);
          return;
        }
        throw detectionError; // Re-throw other errors
      }

      // Log detection results
      debugLog(
        `Face Block Chromium Extension: [${imgId}] Detected ${result.facesDetected} face(s)`
      );

      if (result.facesDetected > 0 && result.matches && result.matches.length > 0) {
        // Log all matches
        result.matches.forEach((match, idx) => {
          debugLog(
            `Face Block Chromium Extension: [${imgId}] Face ${idx + 1}: ${match.label} (distance: ${match.distance.toFixed(3)}, threshold: ${config.matchThreshold})`
          );
        });

        // Check if should block
        const shouldBlur = result.matches.some(match => match.label !== 'unknown');

        if (shouldBlur) {
          // Match found - replace image with blank
          const matchedPerson = result.matches.find(m => m.label !== 'unknown');
          blockImage(img, bgRgb, matchedPerson);
          debugLog(
            `Face Block Chromium Extension: [${imgId}] ✓ BLOCKED (matched: ${matchedPerson.label}, distance: ${matchedPerson.distance.toFixed(3)})`
          );
        } else {
          // No match - restore visibility
          img.setAttribute('data-face-block-processed', 'true');
          img.style.opacity = '';
          delete img.dataset.wasHidden;
          debugLog(
            `Face Block Chromium Extension: [${imgId}] No match - faces detected but distances too high or all unknown`
          );
        }
      } else {
        // No faces detected - restore visibility
        if (img.dataset.wasHidden) {
          img.setAttribute('data-face-block-processed', 'true');
          img.style.opacity = '';
          delete img.dataset.wasHidden;
        }
        debugLog(`Face Block Chromium Extension: [${imgId}] No faces detected`);
      }

      // Mark as processed
      processedImages.set(img, img.src);
    } catch (error) {
      // Log all errors for debugging
      console.warn(
        `Face Block Chromium Extension: [${imgId}] Error processing image:`,
        error.name,
        error.message
      );
      // Restore visibility on error
      if (img.dataset.wasHidden) {
        img.setAttribute('data-face-block-processed', 'true');
        img.style.opacity = '';
        delete img.dataset.wasHidden;
      }
      processedImages.set(img, img.src); // Mark as processed to avoid retry
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
        Math.min(255, Math.floor(b * 1.3)),
      ];
    } else {
      // Light background - darken by 15%
      return [Math.floor(r * 0.85), Math.floor(g * 0.85), Math.floor(b * 0.85)];
    }
  }

  // Replace image with color-matched blank SVG
  function blockImage(img, bgRgb, matchedPerson) {
    img.classList.add('face-blocked');

    const width = img.naturalWidth || img.width || 100;
    const height = img.naturalHeight || img.height || 100;

    debugLog(
      `Face Block Chromium Extension: Replacing image (${width}x${height}):`,
      img.src.substring(0, 100)
    );

    // Store matched person info for tooltip
    if (matchedPerson) {
      img.dataset.blockedPerson = matchedPerson.label;
      img.dataset.blockedDistance = matchedPerson.distance.toFixed(3);
    }

    // Use pre-detected background color
    const borderRgb = getBorderColor(bgRgb);

    const bgColorStr = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`;
    const borderColorStr = `rgb(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]})`;

    debugLog(
      `Face Block Chromium Extension: Background color: ${bgColorStr}, Border color: ${borderColorStr}`
    );

    // Create SVG with matching background color, subtle border, and block indicator
    const borderWidth = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) * 0.02))); // 2% of smallest dimension, min 2px, max 8px

    // Add a small shield icon in the top-right corner to indicate blocking
    const iconSize = Math.max(20, Math.min(40, Math.floor(Math.min(width, height) * 0.15))); // 15% of smallest dimension
    const iconPadding = Math.max(8, Math.floor(iconSize * 0.2));
    const iconX = width - iconSize - iconPadding;
    const iconY = iconPadding;

    // Shield icon with eye-slash symbol
    const blockIcon = `%3Cg transform='translate(${iconX},${iconY})'%3E%3Ccircle cx='${iconSize / 2}' cy='${iconSize / 2}' r='${iconSize / 2}' fill='rgba(220,38,38,0.9)'/%3E%3Cpath d='M ${iconSize * 0.3} ${iconSize * 0.3} L ${iconSize * 0.7} ${iconSize * 0.7} M ${iconSize * 0.3} ${iconSize * 0.7} L ${iconSize * 0.7} ${iconSize * 0.3}' stroke='white' stroke-width='${Math.max(2, iconSize * 0.1)}' stroke-linecap='round'/%3E%3C/g%3E`;

    const blankSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='100%25' height='100%25' fill='${encodeURIComponent(bgColorStr)}'/%3E%3Crect x='0' y='0' width='100%25' height='100%25' fill='none' stroke='${encodeURIComponent(borderColorStr)}' stroke-width='${borderWidth}'/%3E${blockIcon}%3C/svg%3E`;

    // Store original attributes in case user wants to restore later
    img.dataset.originalSrc = img.src;
    if (img.srcset) {
      img.dataset.originalSrcset = img.srcset;
    }

    // Replace the image source and clear srcset (important for responsive images)
    img.src = blankSvg;
    img.removeAttribute('srcset');
    img.alt = `Image blocked by Face Block (matched: ${matchedPerson ? matchedPerson.label : 'unknown'})`;

    // Restore visibility now that we have the replacement
    if (img.dataset.wasHidden) {
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      delete img.dataset.wasHidden;
    }

    // Add click handler to unblock image
    img.style.cursor = 'pointer';
    img.addEventListener('click', handleUnblockImage, { once: true });

    debugLog(
      `Face Block Chromium Extension: Image replaced with color-matched SVG and block indicator`
    );
  }

  // Handle unblocking an image when clicked
  function handleUnblockImage(event) {
    const img = event.target;
    if (!img.dataset.originalSrc) return;

    debugLog('Face Block Chromium Extension: Unblocking image:', img.dataset.blockedPerson);

    // Restore original image
    img.src = img.dataset.originalSrc;
    if (img.dataset.originalSrcset) {
      img.srcset = img.dataset.originalSrcset;
      delete img.dataset.originalSrcset;
    }

    // Clean up
    img.classList.remove('face-blocked');
    img.alt = '';
    delete img.dataset.originalSrc;
    delete img.dataset.blockedPerson;
    delete img.dataset.blockedDistance;
    img.style.cursor = '';

    // Mark as unblocked so it won't be re-blocked during this session
    img.dataset.manuallyUnblocked = 'true';

    infoLog('Face Block Chromium Extension: Image unblocked by user');
  }

  // Set up MutationObserver for dynamic content
  function setupMutationObserver() {
    if (observer) return;

    // Debounce function to limit processing frequency
    // Reduced to 100ms for faster response on Google Images dynamic loading
    let debounceTimer;
    const debounceDelay = 100;

    const callback = mutations => {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        if (!hasReferenceData || !config.enabled) return;

        const newImages = [];

        mutations.forEach(mutation => {
          // Handle attribute changes on images (e.g., src/size changes)
          if (mutation.type === 'attributes' && mutation.target.nodeName === 'IMG') {
            const img = mutation.target;
            // Only care about src/srcset changes for re-processing
            if (mutation.attributeName === 'src' || mutation.attributeName === 'srcset') {
              const lastSrc = processedImages.get(img);
              // Only re-process if src has actually changed
              if (lastSrc !== img.src) {
                processedImages.delete(img);
                newImages.push(img);
              }
            }
          }
          // Handle new nodes being added
          else if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              // Check if node is an image
              if (node.nodeName === 'IMG') {
                const lastSrc = processedImages.get(node);
                // Add if never processed, or if src has changed
                if (!lastSrc || lastSrc !== node.src) {
                  newImages.push(node);
                }
              }
              // Check for images in added subtrees
              else if (node.querySelectorAll) {
                const imgs = node.querySelectorAll('img');
                imgs.forEach(img => {
                  const lastSrc = processedImages.get(img);
                  // Add if never processed, or if src has changed
                  if (!lastSrc || lastSrc !== img.src) {
                    newImages.push(img);
                  }
                });
              }
            });
          }
        });

        if (newImages.length > 0) {
          debugLog(
            `Face Block Chromium Extension: Processing ${newImages.length} new/updated image(s)`
          );

          // Process new/updated images
          for (const img of newImages) {
            // Wait for image to load if not loaded yet
            if (!img.complete) {
              await new Promise(resolve => {
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
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'style', 'class', 'width', 'height'],
      attributeOldValue: false,
    });

    debugLog('Face Block Chromium Extension: MutationObserver started (watching attributes)');
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_CHANGED') {
      if (message.settings.matchThreshold !== undefined) {
        config.matchThreshold = message.settings.matchThreshold;

        // Reload reference descriptors with new threshold
        loadReferenceDescriptors().then(() => {
          // Clear processed images and reprocess
          processedImages.clear();

          // Restore replaced images to their original sources
          document.querySelectorAll('.face-blocked').forEach(img => {
            img.classList.remove('face-blocked');
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

      if (message.settings.detector !== undefined) {
        const oldDetector = config.detector;
        config.detector = message.settings.detector;
        infoLog(
          `Face Block Chromium Extension: Detector changed from ${oldDetector} to ${config.detector}`
        );

        // Reset models to force reload with new detector
        modelsLoaded = false;

        // Reload models with new detector
        loadModels().then(() => {
          // Clear processed images and reprocess
          processedImages.clear();

          // Restore replaced images to their original sources
          document.querySelectorAll('.face-blocked').forEach(img => {
            img.classList.remove('face-blocked');
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
      debugLog('Face Block Chromium Extension: Page hidden, pausing');
    } else {
      debugLog('Face Block Chromium Extension: Page visible, resuming');
    }
  });

  // Start initialization
  initialize();
})();
