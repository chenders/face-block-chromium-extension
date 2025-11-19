import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { ImageProcessQueue } from '../utils/image-queue';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('Face Block Extension - Content script loaded');

    // Initialize the content script
    initializeContentScript();
  }
});

// Configuration
let config = {
  matchThreshold: 0.6,
  enabled: true,
  detector: 'hybrid',
  detectorMode: 'selective',
  similarityThreshold: 0.6
};

let hasReferenceData = false;
let processing = false;
// Store processed images with their src to detect src changes
const processedImages = new WeakMap();
let observer: MutationObserver | null = null;

// Priority queue for image processing
let imageQueue: ImageProcessQueue | null = null;

// Debug logging
const DEBUG_MODE = false;

function debugLog(...args: any[]) {
  if (DEBUG_MODE) {
    console.log('[Face Block Content]', ...args);
  }
}

function warnLog(...args: any[]) {
  console.warn('[Face Block Content Warning]', ...args);
}

function errorLog(...args: any[]) {
  console.error('[Face Block Content Error]', ...args);
}

// Initialize content script
async function initializeContentScript() {
  try {
    // Load settings
    await loadSettings();

    // Send config to background/offscreen
    await updateBackgroundConfig();

    // Get reference descriptors and send to background
    await loadReferenceDescriptors();

    // Check if this is an SSR site that needs hydration time
    const ssrSite = isSsrSite();
    if (ssrSite) {
      debugLog('SSR site detected, delaying processing for hydration');
    }

    // Process existing images after hydration on SSR sites
    if (ssrSite) {
      // Use requestIdleCallback to wait for SSR hydration to complete
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(
          async () => {
            await processExistingImages();
            removePreloadHiding();
          },
          { timeout: 2000 }
        );
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(async () => {
          await processExistingImages();
          removePreloadHiding();
        }, 1000);
      }
    } else {
      // Process immediately on non-SSR sites
      await processExistingImages();
      removePreloadHiding();
    }

    // Set up dynamic content monitoring
    setupMutationObserver();

    if (hasReferenceData) {
      debugLog('Initialized successfully with reference data');
    } else {
      debugLog('No reference faces stored yet - images will be shown normally');
    }
  } catch (error) {
    errorLog('Initialization error:', error);
  }
}

// Load settings from storage
async function loadSettings() {
  const settings = await browser.storage.sync.get({
    enabled: true,
    detectorMode: 'selective',
    similarityThreshold: 0.6,
    detector: 'hybrid'
  });

  config.enabled = settings.enabled;
  config.detectorMode = settings.detectorMode;
  config.similarityThreshold = settings.similarityThreshold;
  config.matchThreshold = settings.similarityThreshold;
  config.detector = settings.detector;

  debugLog('Settings loaded:', config);
}

// Send config to background/offscreen
async function updateBackgroundConfig() {
  return new Promise<void>(resolve => {
    browser.runtime.sendMessage(
      {
        type: 'UPDATE_CONFIG',
        data: {
          matchThreshold: config.matchThreshold,
          enabled: config.enabled,
          detector: config.detector,
          detectorMode: config.detectorMode,
          similarityThreshold: config.similarityThreshold
        }
      },
      response => {
        if (response && response.success) {
          debugLog('Config sent to background');
        }
        resolve();
      }
    );
  });
}

// Load reference descriptors from storage
async function loadReferenceDescriptors() {
  return new Promise<void>(resolve => {
    browser.storage.local.get('referenceFaces', result => {
      if (result.referenceFaces && result.referenceFaces.length > 0) {
        hasReferenceData = true;
        debugLog(`Loading ${result.referenceFaces.length} reference face(s)`);

        // Send to background/offscreen for processing
        browser.runtime.sendMessage(
          {
            type: 'UPDATE_FACE_MATCHER',
            data: result.referenceFaces
          },
          () => {
            debugLog('Reference data sent to background');
            resolve();
          }
        );
      } else {
        hasReferenceData = false;
        debugLog('No reference data available');
        // Clear face matcher in background
        browser.runtime.sendMessage(
          {
            type: 'UPDATE_FACE_MATCHER',
            data: []
          },
          () => {
            resolve();
          }
        );
      }
    });
  });
}

// Remove preload hiding after initial processing
function removePreloadHiding() {
  document.documentElement.removeAttribute('data-face-block-active');
  debugLog('Preload hiding removed - images now visible');
}

// Detect if page uses SSR with hydration
function isSsrSite(): boolean {
  // Check for React/Next.js
  if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) return true;
  if ((window as any).__NEXT_DATA__ || (window as any).next) return true;
  if (document.querySelector('[data-reactroot], [data-reactid], #__next, [id^="__react"]')) {
    return true;
  }

  // Check for Vue/Nuxt
  if ((window as any).__NUXT__ || (window as any).$nuxt) return true;
  if (document.querySelector('[data-v-], [data-n-head], #__nuxt')) {
    return true;
  }

  // Check for Angular Universal
  if ((window as any).ng || document.querySelector('[ng-version], [ng-state], app-root')) {
    return true;
  }

  // Check for Svelte/SvelteKit
  if ((window as any).__SVELTEKIT__) return true;
  if (document.querySelector('[data-sveltekit]')) {
    return true;
  }

  // Check for Solid.js
  if (document.querySelector('[data-hk]')) {
    return true;
  }

  // Check for Qwik
  if (document.querySelector('[q\\:id], [q\\:key]')) {
    return true;
  }

  // Check for Astro islands
  if (document.querySelector('astro-island')) {
    return true;
  }

  return false;
}

// Process existing images on page
async function processExistingImages() {
  if (!config.enabled) return;

  const images = document.querySelectorAll('img');
  debugLog(`Processing ${images.length} existing images`);

  // Initialize priority queue if not already created
  if (!imageQueue) {
    imageQueue = new ImageProcessQueue(processImage, 8);

    // Update priorities on scroll/resize
    let scrollTimeout: number | null = null;
    window.addEventListener('scroll', () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        imageQueue?.updatePriorities();
      }, 100);
    }, { passive: true });

    window.addEventListener('resize', () => {
      imageQueue?.updatePriorities();
    }, { passive: true });
  }

  // Add all images to priority queue
  // Visible images will be processed first automatically
  images.forEach(img => {
    imageQueue?.add(img);
  });

  // Log queue statistics
  const stats = imageQueue.getStats();
  debugLog(`Queue stats: ${stats.queued} queued, ${stats.processing} processing, ${stats.processed} processed`);
}

// Process a single image
async function processImage(img: HTMLImageElement) {
  // Skip if manually unblocked by user
  if (img.dataset.manuallyUnblocked === 'true') {
    return;
  }

  // Skip if already processed with the same src
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
  const displayWidth = img.offsetWidth || img.width;
  const displayHeight = img.offsetHeight || img.height;
  const naturalWidth = img.naturalWidth || 0;
  const naturalHeight = img.naturalHeight || 0;

  // Minimum size threshold
  const MIN_SIZE = 30;

  // If image not loaded yet, don't mark as processed
  if (!img.complete) {
    debugLog('Skipping image (not loaded yet):', img.src.substring(0, 100));
    img.style.opacity = '';

    // Add load listener to process again when image loads
    img.addEventListener('load', () => processImage(img), { once: true });
    img.addEventListener('error', () => processImage(img), { once: true });
    return;
  }

  // If image is too small
  if (
    displayWidth < MIN_SIZE ||
    displayHeight < MIN_SIZE ||
    naturalWidth < MIN_SIZE ||
    naturalHeight < MIN_SIZE
  ) {
    debugLog(
      'Skipping image (too small):',
      img.src.substring(0, 100),
      `display:${displayWidth}x${displayHeight} natural:${naturalWidth}x${naturalHeight}`
    );
    processedImages.set(img, img.src);
    img.setAttribute('data-face-block-processed', 'true');
    img.style.opacity = '';
    return;
  }

  // Additional check for invalid dimensions
  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    debugLog('Skipping image with 0 dimensions:', img.src.substring(0, 100));
    processedImages.set(img, img.src);
    img.setAttribute('data-face-block-processed', 'true');
    img.style.opacity = '';
    return;
  }

  // Skip if this is our own replacement SVG
  if (
    (img.src.startsWith('data:') || img.src.startsWith('blob:')) &&
    img.classList.contains('face-blocked')
  ) {
    return;
  }

  // Create a short identifier for logging
  const imgId = img.src.length > 50 ? '...' + img.src.slice(-50) : img.src;
  debugLog(`Processing image: ${imgId}`);

  // Detect background color
  const bgColor = getBackgroundColor(img.parentElement || img);
  const bgRgb = parseRgb(bgColor);

  // Mark that we're processing this image
  img.dataset.wasHidden = 'true';

  try {
    // Detect faces
    const result = await detectFaces(img, imgId);

    debugLog(`[${imgId}] Detected ${result.facesDetected || 0} face(s)`);

    if (result.blocked) {
      // Match found - replace image with blank
      blockImage(img, bgRgb, result);
      debugLog(`[${imgId}] ✓ BLOCKED`);
    } else {
      // No match - restore visibility
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      delete img.dataset.wasHidden;
      debugLog(`[${imgId}] No match - image restored`);
    }

    // Mark as processed
    processedImages.set(img, img.src);
  } catch (error: any) {
    warnLog(`[${imgId}] Error processing image:`, error.message);
    // Restore visibility on error
    if (img.dataset.wasHidden) {
      img.setAttribute('data-face-block-processed', 'true');
      img.style.opacity = '';
      delete img.dataset.wasHidden;
    }
    processedImages.set(img, img.src);
  }
}

// Detect faces in image
async function detectFaces(img: HTMLImageElement, imgId: string): Promise<any> {
  try {
    // For data URLs, send directly
    let imageData: string;
    if (img.src.startsWith('data:') || img.src.startsWith('blob:')) {
      imageData = img.src;
    } else {
      // For HTTP/HTTPS URLs, try canvas conversion
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          imageData = canvas.toDataURL('image/jpeg', 0.95);
        } else {
          imageData = img.src;
        }
      } catch (canvasError) {
        // If canvas fails (CORS), send URL directly
        imageData = img.src;
      }
    }

    // Send to background for detection
    return new Promise((resolve, reject) => {
      browser.runtime.sendMessage(
        {
          type: 'DETECT_FACES',
          data: {
            imageDataUrl: imageData,
            imageUrl: imageData,
            imgId: imgId,
            imageId: imgId,
            detector: config.detector
          }
        },
        response => {
          if (response && (response.success || response.blocked !== undefined)) {
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

// Get the background color of an element
function getBackgroundColor(element: Element): string {
  let current: Element | null = element;
  let depth = 0;
  const maxDepth = 10;

  while (current && depth < maxDepth) {
    const style = window.getComputedStyle(current);
    const bgColor = style.backgroundColor;

    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      return bgColor;
    }

    current = current.parentElement;
    depth++;
  }

  return 'rgb(255, 255, 255)'; // Default to white
}

// Convert RGB string to array
function parseRgb(rgbString: string): number[] {
  const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [255, 255, 255]; // Default to white
}

// Calculate border color
function getBorderColor(bgRgb: number[]): number[] {
  const [r, g, b] = bgRgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (brightness < 128) {
    // Dark background - lighten by 30%
    return [
      Math.min(255, Math.floor(r * 1.3)),
      Math.min(255, Math.floor(g * 1.3)),
      Math.min(255, Math.floor(b * 1.3))
    ];
  } else {
    // Light background - darken by 15%
    return [Math.floor(r * 0.85), Math.floor(g * 0.85), Math.floor(b * 0.85)];
  }
}

// Replace image with color-matched blank SVG
function blockImage(img: HTMLImageElement, bgRgb: number[], result: any) {
  img.classList.add('face-blocked');

  const width = img.naturalWidth || img.width || 100;
  const height = img.naturalHeight || img.height || 100;

  debugLog(`Replacing image (${width}x${height}):`, img.src.substring(0, 100));

  // Store matched info for tooltip
  if (result.matches && result.matches.length > 0) {
    const match = result.matches[0];
    img.dataset.blockedPerson = match.label;
    img.dataset.blockedDistance = match.distance?.toFixed(3);
  }

  // Use pre-detected background color
  const borderRgb = getBorderColor(bgRgb);
  const bgColorStr = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`;
  const borderColorStr = `rgb(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]})`;

  // Create SVG with matching background color, subtle border, and block indicator
  const borderWidth = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) * 0.02)));
  const iconSize = Math.max(20, Math.min(40, Math.floor(Math.min(width, height) * 0.15)));
  const iconPadding = Math.max(8, Math.floor(iconSize * 0.2));
  const iconX = width - iconSize - iconPadding;
  const iconY = iconPadding;

  // Block icon with X symbol
  const blockIcon = `%3Cg transform='translate(${iconX},${iconY})'%3E%3Ccircle cx='${iconSize / 2}' cy='${iconSize / 2}' r='${iconSize / 2}' fill='rgba(220,38,38,0.9)'/%3E%3Cpath d='M ${iconSize * 0.3} ${iconSize * 0.3} L ${iconSize * 0.7} ${iconSize * 0.7} M ${iconSize * 0.3} ${iconSize * 0.7} L ${iconSize * 0.7} ${iconSize * 0.3}' stroke='white' stroke-width='${Math.max(2, iconSize * 0.1)}' stroke-linecap='round'/%3E%3C/g%3E`;

  const blankSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='100%25' height='100%25' fill='${encodeURIComponent(bgColorStr)}'/%3E%3Crect x='0' y='0' width='100%25' height='100%25' fill='none' stroke='${encodeURIComponent(borderColorStr)}' stroke-width='${borderWidth}'/%3E${blockIcon}%3C/svg%3E`;

  // Store original attributes
  img.dataset.originalSrc = img.src;
  if (img.srcset) {
    img.dataset.originalSrcset = img.srcset;
  }

  // Replace the image source
  img.src = blankSvg;
  img.removeAttribute('srcset');
  img.alt = `Image blocked by Face Block`;

  // Restore visibility now that we have the replacement
  if (img.dataset.wasHidden) {
    img.setAttribute('data-face-block-processed', 'true');
    img.style.opacity = '';
    delete img.dataset.wasHidden;
  }

  // Add click handler to unblock image
  img.style.cursor = 'pointer';
  img.addEventListener('click', handleUnblockImage, { once: true });

  debugLog('Image replaced with color-matched SVG and block indicator');
}

// Handle unblocking an image when clicked
function handleUnblockImage(event: Event) {
  const img = event.target as HTMLImageElement;
  if (!img.dataset.originalSrc) return;

  debugLog('Unblocking image:', img.dataset.blockedPerson);

  // Restore original image
  img.src = img.dataset.originalSrc;
  if (img.dataset.originalSrcset) {
    img.srcset = img.dataset.originalSrcset;
  }

  // Remove blocking attributes
  img.classList.remove('face-blocked');
  img.dataset.manuallyUnblocked = 'true';
  delete img.dataset.originalSrc;
  delete img.dataset.originalSrcset;
  delete img.dataset.blockedPerson;
  delete img.dataset.blockedDistance;

  // Reset cursor
  img.style.cursor = '';
  img.alt = '';
}

// Setup mutation observer for dynamic content
function setupMutationObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(mutations => {
    if (!config.enabled) return;

    for (const mutation of mutations) {
      // Process added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          // Check if it's an image
          if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            // Hide immediately to prevent flash
            if (shouldProcessImage(img)) {
              img.style.opacity = '0';
            }
            // Add to priority queue
            imageQueue?.add(img);
          }

          // Check for images in descendants
          const images = element.querySelectorAll('img');
          images.forEach(img => {
            // Hide immediately to prevent flash
            if (shouldProcessImage(img as HTMLImageElement)) {
              (img as HTMLImageElement).style.opacity = '0';
            }
            // Add to priority queue
            imageQueue?.add(img as HTMLImageElement);
          });
        }
      }

      // Check for src changes on existing images
      if (mutation.type === 'attributes' &&
          mutation.target.nodeType === Node.ELEMENT_NODE &&
          (mutation.target as Element).tagName === 'IMG' &&
          mutation.attributeName === 'src') {
        const img = mutation.target as HTMLImageElement;
        // Clear processed state to force reprocessing
        processedImages.delete(img);
        // Hide immediately to prevent flash
        if (shouldProcessImage(img)) {
          img.style.opacity = '0';
        }
        // Add to priority queue
        imageQueue?.add(img);
      }
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });

  debugLog('Mutation observer setup complete');
}

// Listen for extension status changes
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTENSION_STATUS_CHANGED') {
    config.enabled = message.enabled;
    debugLog(`Extension ${message.enabled ? 'enabled' : 'disabled'}`);

    if (message.enabled) {
      processExistingImages();
      setupMutationObserver();
    } else if (observer) {
      observer.disconnect();
    }
  }
});