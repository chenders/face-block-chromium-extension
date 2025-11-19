import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('Face Block Extension - Content script loaded');

    // Initialize the content script
    initializeContentScript();
  }
});

// Note: Preload script moved to content-preload.ts for early CSS injection

async function initializeContentScript() {
  console.log('Initializing Face Block content script...');

  // Get settings from storage
  const settings = await browser.storage.sync.get({
    enabled: true,
    detectorMode: 'selective',
    similarityThreshold: 0.6
  });

  if (!settings.enabled) {
    console.log('Face Block is disabled');
    return;
  }

  console.log(`Face Block active - Mode: ${settings.detectorMode}, Threshold: ${settings.similarityThreshold}`);

  // Start observing for images
  observeImages();
}

function observeImages() {
  // Process existing images
  const images = document.querySelectorAll('img');
  images.forEach(img => processImage(img as HTMLImageElement));

  // Observe for new images
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          if (element.tagName === 'IMG') {
            processImage(element as HTMLImageElement);
          }
          // Also check descendants
          const imgs = element.querySelectorAll('img');
          imgs.forEach(img => processImage(img as HTMLImageElement));
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function processImage(img: HTMLImageElement) {
  // Skip if already processed
  if (img.dataset.faceBlockProcessed === 'true') {
    return;
  }

  // Mark as processing
  img.dataset.faceBlockProcessed = 'true';

  // Initially hide the image
  img.style.opacity = '0';

  try {
    // Send image for face detection
    const response = await browser.runtime.sendMessage({
      type: 'DETECT_FACES',
      data: {
        imageUrl: img.src,
        imageId: generateImageId()
      }
    });

    if (response.blocked) {
      console.log(`Blocking image: ${img.src}`);
      blockImage(img);
    } else {
      // Show the image if not blocked
      img.style.opacity = '1';
    }
  } catch (error) {
    console.error('Face detection error:', error);
    // Show image on error to avoid false positives
    img.style.opacity = '1';
  }
}

function blockImage(img: HTMLImageElement) {
  // Replace with placeholder
  const placeholder = createPlaceholder(img);
  img.parentElement?.replaceChild(placeholder, img);
}

function createPlaceholder(img: HTMLImageElement) {
  const placeholder = document.createElement('div');
  placeholder.className = 'face-block-placeholder';
  placeholder.style.width = `${img.width || 100}px`;
  placeholder.style.height = `${img.height || 100}px`;
  placeholder.style.backgroundColor = '#f0f0f0';
  placeholder.style.display = 'inline-block';
  placeholder.style.position = 'relative';

  // Add blocked indicator
  const indicator = document.createElement('div');
  indicator.textContent = '🚫';
  indicator.style.position = 'absolute';
  indicator.style.top = '50%';
  indicator.style.left = '50%';
  indicator.style.transform = 'translate(-50%, -50%)';
  indicator.style.fontSize = '24px';

  placeholder.appendChild(indicator);

  return placeholder;
}

function generateImageId() {
  return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}