import { browser } from 'wxt/browser';

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  console.log('Initializing Face Block popup...');

  // Detect browser type
  const browserType = detectBrowser();
  const browserInfo = document.getElementById('browser-type');
  if (browserInfo) {
    browserInfo.textContent = `Running on ${browserType}`;
  }

  // Load current settings
  await loadSettings();

  // Setup event listeners
  setupEventListeners();

  // Load reference faces
  await loadReferenceFaces();
}

function detectBrowser(): string {
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    return 'Chrome';
  } else if (typeof browser !== 'undefined') {
    return 'Firefox';
  } else {
    return 'Unknown Browser';
  }
}

async function loadSettings() {
  const settings = await browser.storage.sync.get({
    enabled: true,
    detectorMode: 'selective',
    similarityThreshold: 0.6
  });

  // Update UI elements
  const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement;
  if (enabledCheckbox) {
    enabledCheckbox.checked = settings.enabled;
  }

  const modeSelect = document.getElementById('detector-mode') as HTMLSelectElement;
  if (modeSelect) {
    modeSelect.value = settings.detectorMode;
  }

  const thresholdSlider = document.getElementById('similarity-threshold') as HTMLInputElement;
  if (thresholdSlider) {
    thresholdSlider.value = settings.similarityThreshold.toString();
  }

  const thresholdValue = document.getElementById('threshold-value');
  if (thresholdValue) {
    thresholdValue.textContent = settings.similarityThreshold.toString();
  }
}

function setupEventListeners() {
  // Enable/disable toggle
  const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement;
  enabledCheckbox?.addEventListener('change', async (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    await browser.storage.sync.set({ enabled });
    console.log(`Extension ${enabled ? 'enabled' : 'disabled'}`);

    // Notify content scripts
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      browser.tabs.sendMessage(tabs[0].id, {
        type: 'EXTENSION_STATUS_CHANGED',
        enabled
      });
    }
  });

  // Detection mode change
  const modeSelect = document.getElementById('detector-mode') as HTMLSelectElement;
  modeSelect?.addEventListener('change', async (e) => {
    const detectorMode = (e.target as HTMLSelectElement).value;
    await browser.storage.sync.set({ detectorMode });
    console.log(`Detection mode changed to: ${detectorMode}`);

    // Update background/offscreen
    browser.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      data: { detectorMode }
    });
  });

  // Similarity threshold change
  const thresholdSlider = document.getElementById('similarity-threshold') as HTMLInputElement;
  thresholdSlider?.addEventListener('input', async (e) => {
    const similarityThreshold = parseFloat((e.target as HTMLInputElement).value);
    const thresholdValue = document.getElementById('threshold-value');
    if (thresholdValue) {
      thresholdValue.textContent = similarityThreshold.toString();
    }

    await browser.storage.sync.set({ similarityThreshold });
    console.log(`Similarity threshold changed to: ${similarityThreshold}`);

    // Update background/offscreen
    browser.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      data: { similarityThreshold }
    });
  });

  // Add face button
  const addFaceBtn = document.getElementById('add-face-btn');
  const faceUpload = document.getElementById('face-upload') as HTMLInputElement;

  addFaceBtn?.addEventListener('click', () => {
    faceUpload?.click();
  });

  faceUpload?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await addReferenceFace(file);
      faceUpload.value = ''; // Reset input
    }
  });
}

async function loadReferenceFaces() {
  const facesList = document.getElementById('faces-list');
  if (!facesList) return;

  // Clear current list
  facesList.innerHTML = '';

  // Load faces from storage
  const result = await browser.storage.local.get('referenceFaces');
  const faces = result.referenceFaces || [];

  if (faces.length === 0) {
    facesList.innerHTML = '<p>No reference faces added yet</p>';
    return;
  }

  // Display each face
  faces.forEach((face: any, index: number) => {
    const faceElement = createFaceElement(face, index);
    facesList.appendChild(faceElement);
  });
}

function createFaceElement(face: any, index: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'face-item';

  const img = document.createElement('img');
  img.src = face.thumbnail || '';
  img.alt = face.label || `Face ${index + 1}`;

  const label = document.createElement('span');
  label.textContent = face.label || `Face ${index + 1}`;

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '×';
  deleteBtn.onclick = () => deleteReferenceFace(index);

  container.appendChild(img);
  container.appendChild(label);
  container.appendChild(deleteBtn);

  return container;
}

async function addReferenceFace(file: File) {
  console.log('Adding reference face:', file.name);

  // Convert to base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target?.result as string;

    // Send to background for processing
    const response = await browser.runtime.sendMessage({
      type: 'ADD_REFERENCE_FACE',
      data: {
        imageData: dataUrl,
        label: file.name
      }
    });

    if (response.success) {
      console.log('Reference face added successfully');
      await loadReferenceFaces(); // Refresh the list
    } else {
      console.error('Failed to add reference face:', response.error);
      alert('Failed to add reference face. Please try again.');
    }
  };

  reader.readAsDataURL(file);
}

async function deleteReferenceFace(index: number) {
  console.log('Deleting reference face at index:', index);

  const result = await browser.storage.local.get('referenceFaces');
  const faces = result.referenceFaces || [];

  if (index >= 0 && index < faces.length) {
    faces.splice(index, 1);
    await browser.storage.local.set({ referenceFaces: faces });

    // Update face matcher
    await browser.runtime.sendMessage({
      type: 'UPDATE_FACE_MATCHER',
      data: { faces }
    });

    // Refresh the list
    await loadReferenceFaces();
  }
}