import { browser } from 'wxt/browser';
import { generateAugmentedDescriptors, AugmentationOptions } from '../../utils/face-augmentation';

// DOM elements
let personNameInput: HTMLInputElement;
let photoUploadInput: HTMLInputElement;
let selectedFilesDiv: HTMLDivElement;
let previewImagesDiv: HTMLDivElement;
let addPersonBtn: HTMLButtonElement;
let peopleListDiv: HTMLDivElement;
let matchThresholdSlider: HTMLInputElement;
let thresholdValueSpan: HTMLSpanElement;
let detectorRadios: NodeListOf<HTMLInputElement>;
let detectorModeRadios: NodeListOf<HTMLInputElement>;
let exportDataBtn: HTMLButtonElement;
let importDataBtn: HTMLButtonElement;
let importDataInput: HTMLInputElement;
let clearDataBtn: HTMLButtonElement;
let statusMessage: HTMLDivElement;

// State
let pendingFiles: File[] = [];
let modelsLoaded = false;

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  console.log('Face Block Extension - Popup initialized');

  // Get DOM elements
  personNameInput = document.getElementById('personName') as HTMLInputElement;
  photoUploadInput = document.getElementById('photoUpload') as HTMLInputElement;
  selectedFilesDiv = document.getElementById('selectedFiles') as HTMLDivElement;
  previewImagesDiv = document.getElementById('previewImages') as HTMLDivElement;
  addPersonBtn = document.getElementById('addPersonBtn') as HTMLButtonElement;
  peopleListDiv = document.getElementById('peopleList') as HTMLDivElement;
  matchThresholdSlider = document.getElementById('matchThreshold') as HTMLInputElement;
  thresholdValueSpan = document.getElementById('thresholdValue') as HTMLSpanElement;
  detectorRadios = document.querySelectorAll('input[name="detector"]');
  detectorModeRadios = document.querySelectorAll('input[name="detectorMode"]');
  exportDataBtn = document.getElementById('exportDataBtn') as HTMLButtonElement;
  importDataBtn = document.getElementById('importDataBtn') as HTMLButtonElement;
  importDataInput = document.getElementById('importDataInput') as HTMLInputElement;
  clearDataBtn = document.getElementById('clearDataBtn') as HTMLButtonElement;
  statusMessage = document.getElementById('statusMessage') as HTMLDivElement;

  // Setup event listeners
  setupEventListeners();

  // Load initial data
  await Promise.all([loadPeopleList(), loadSettings()]);

  // Load face detection models in background
  loadModels();
}

// Load face-api.js models
async function loadModels() {
  try {
    console.log('Loading face-api models...');

    // Models are loaded in the offscreen document or Firefox background
    // We just need to verify they're ready
    const response = await browser.runtime
      .sendMessage({
        type: 'CHECK_MODELS_LOADED',
      })
      .catch(() => ({ loaded: false }));

    modelsLoaded = response?.loaded || false;

    if (modelsLoaded) {
      console.log('Face detection models ready');
    } else {
      console.log('Face detection models not yet loaded');
      // Models will load when needed
    }
  } catch (error) {
    console.error('Error checking model status:', error);
  }
}

function setupEventListeners() {
  // Person name input
  personNameInput?.addEventListener('input', validateForm);

  // Photo upload
  photoUploadInput?.addEventListener('change', handleFileSelection);

  // Add person button
  addPersonBtn?.addEventListener('click', handleAddPerson);

  // Threshold slider
  matchThresholdSlider?.addEventListener('input', handleThresholdChange);

  // Detector mode radios
  detectorRadios?.forEach(radio => {
    radio.addEventListener('change', handleDetectorChange);
  });

  // Detector mode radios (off/selective/all)
  detectorModeRadios?.forEach(radio => {
    radio.addEventListener('change', handleDetectorModeChange);
  });

  // Import/Export buttons
  exportDataBtn?.addEventListener('click', handleExportData);
  importDataBtn?.addEventListener('click', () => importDataInput?.click());
  importDataInput?.addEventListener('change', handleImportData);
  clearDataBtn?.addEventListener('click', handleClearData);
}

async function handleFileSelection(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);

  if (files.length === 0) return;

  // Filter for image files
  const imageFiles = files.filter(file => file.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    showStatus('Please select image files', 'error');
    return;
  }

  pendingFiles = imageFiles;

  // Update UI
  if (selectedFilesDiv) {
    selectedFilesDiv.innerHTML = `<strong>${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''} selected</strong>`;
  }

  // Show previews
  if (previewImagesDiv) {
    previewImagesDiv.innerHTML = '';
    previewImagesDiv.style.display = 'grid';

    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.src = e.target?.result as string;
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        previewImagesDiv.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  }

  // Update coverage analysis
  updateCoverageAnalysis();
  validateForm();
}

function updateCoverageAnalysis() {
  const fileCount = pendingFiles.length;

  if (fileCount === 0) {
    if (selectedFilesDiv) {
      selectedFilesDiv.innerHTML = '';
    }
    return;
  }

  let message = '';
  let quality = '';

  if (fileCount === 1) {
    message = '⚠️ <strong>Limited coverage:</strong> Single photo may miss some angles';
    quality = 'basic';
  } else if (fileCount === 2) {
    message = '⚠️ <strong>Basic coverage:</strong> Consider adding 1-3 more photos';
    quality = 'fair';
  } else if (fileCount >= 3 && fileCount <= 5) {
    message = '✅ <strong>Good coverage:</strong> Multiple angles captured';
    quality = 'good';
  } else if (fileCount > 5 && fileCount <= 10) {
    message = '✅ <strong>Excellent coverage:</strong> Comprehensive face data';
    quality = 'excellent';
  } else {
    message = '⚠️ <strong>Too many photos:</strong> 5-10 photos is optimal';
    quality = 'excessive';
  }

  if (selectedFilesDiv) {
    selectedFilesDiv.innerHTML = `
      <div class="coverage-analysis ${quality}">
        <div>${fileCount} photo${fileCount > 1 ? 's' : ''} selected</div>
        <div class="coverage-message">${message}</div>
      </div>
    `;
  }
}

function validateForm() {
  if (addPersonBtn) {
    const hasName = personNameInput?.value?.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    addPersonBtn.disabled = !hasName || !hasFiles;
  }
}

async function handleAddPerson() {
  const personName = personNameInput?.value?.trim();

  if (!personName) {
    showStatus('Please enter a person name', 'error');
    return;
  }

  if (pendingFiles.length === 0) {
    showStatus('Please select at least one photo', 'error');
    return;
  }

  // Disable form during processing
  if (addPersonBtn) addPersonBtn.disabled = true;
  if (personNameInput) personNameInput.disabled = true;
  if (photoUploadInput) photoUploadInput.disabled = true;

  showStatus('Processing photos...', 'info');

  try {
    // Get existing data
    const result = await browser.storage.local.get('referenceFaces');
    const referenceFaces = result.referenceFaces || [];

    // Check if person already exists
    let person = referenceFaces.find((p: any) => p.name === personName || p.label === personName);

    if (!person) {
      person = {
        name: personName,
        label: personName,
        descriptors: [],
        thumbnail: null,
      };
      referenceFaces.push(person);
    }

    // Process each photo with augmentation
    let successCount = 0;
    let failCount = 0;
    let totalDescriptors = 0;

    // Augmentation options for reference faces
    const augmentOptions: AugmentationOptions = {
      enableMirror: true,
      enableBrightness: true,
      enableContrast: true,
      enableRotation: false, // Disabled to avoid detection issues with rotated faces
      brightnessLevels: [-20, 20],
      contrastLevels: [0.85, 1.15],
      rotationAngles: [],
    };

    for (let i = 0; i < pendingFiles.length; i++) {
      showStatus(
        `Processing photo ${i + 1} of ${pendingFiles.length} (with augmentation)...`,
        'info'
      );

      const file = pendingFiles[i];
      const imageDataUrl = await fileToDataURL(file);

      try {
        // Generate augmented versions and extract descriptors
        const augmentedDescriptors = await generateAugmentedDescriptors(
          imageDataUrl,
          extractFaceDescriptor,
          augmentOptions
        );

        if (augmentedDescriptors.length > 0) {
          // Add all valid descriptors
          person.descriptors.push(...augmentedDescriptors);
          totalDescriptors += augmentedDescriptors.length;

          // Use first successful image as thumbnail
          if (!person.thumbnail && imageDataUrl.startsWith('data:')) {
            // Create a smaller thumbnail
            person.thumbnail = await createThumbnail(imageDataUrl);
          }

          successCount++;
          console.log(`Photo ${i + 1}: Generated ${augmentedDescriptors.length} descriptors`);
        } else {
          failCount++;
          console.warn(`No face detected in photo ${i + 1}`);
        }
      } catch (error) {
        console.error(`Error processing photo ${i + 1}:`, error);
        failCount++;
      }
    }

    if (successCount === 0) {
      throw new Error('No faces were detected in any of the photos');
    }

    // Save updated data
    await browser.storage.local.set({ referenceFaces });

    // Update face matcher in background
    await browser.runtime.sendMessage({
      type: 'UPDATE_FACE_MATCHER',
      data: referenceFaces,
    });

    // Show success message with descriptor count
    let message = `Added ${personName} with ${successCount} photo${successCount > 1 ? 's' : ''} (${totalDescriptors} total descriptors)`;
    if (failCount > 0) {
      message += ` (${failCount} photo${failCount > 1 ? 's' : ''} had no detectable face)`;
    }
    showStatus(message, 'success');

    // Reset form
    resetForm();

    // Reload people list
    await loadPeopleList();
  } catch (error: any) {
    console.error('Error adding person:', error);
    showStatus(error.message || 'Failed to add person', 'error');
  } finally {
    // Re-enable form
    if (addPersonBtn) addPersonBtn.disabled = false;
    if (personNameInput) personNameInput.disabled = false;
    if (photoUploadInput) photoUploadInput.disabled = false;
    validateForm();
  }
}

async function extractFaceDescriptor(imageDataUrl: string) {
  try {
    // Send to background/offscreen for processing
    const response = await browser.runtime.sendMessage({
      type: 'EXTRACT_FACE_DESCRIPTOR',
      target: 'offscreen',
      data: { imageData: imageDataUrl },
    });

    if (response?.success && response?.descriptor) {
      return response.descriptor;
    }

    return null;
  } catch (error) {
    console.error('Error extracting face descriptor:', error);
    return null;
  }
}

async function createThumbnail(imageDataUrl: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Create 100x100 thumbnail
      const size = 100;
      canvas.width = size;
      canvas.height = size;

      if (ctx) {
        // Calculate crop for square aspect ratio
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve(imageDataUrl); // Fallback to original
      }
    };
    img.src = imageDataUrl;
  });
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resetForm() {
  if (personNameInput) personNameInput.value = '';
  if (photoUploadInput) photoUploadInput.value = '';
  if (selectedFilesDiv) selectedFilesDiv.innerHTML = '';
  if (previewImagesDiv) {
    previewImagesDiv.innerHTML = '';
    previewImagesDiv.style.display = 'none';
  }
  pendingFiles = [];
  validateForm();
}

async function loadPeopleList() {
  if (!peopleListDiv) return;

  try {
    const result = await browser.storage.local.get('referenceFaces');
    const people = result.referenceFaces || [];

    console.log(`Loaded ${people.length} people from storage`);
    renderPeopleList(people);
  } catch (error) {
    console.error('Error loading people list:', error);
    peopleListDiv.innerHTML = '<p>Error loading people list</p>';
  }
}

function renderPeopleList(people: any[]) {
  if (!peopleListDiv) return;

  if (people.length === 0) {
    peopleListDiv.innerHTML = '<p class="no-people">No people added yet</p>';
    return;
  }

  peopleListDiv.innerHTML = people
    .map((person, index) => {
      const name = escapeHtml(person.name || person.label);
      const descriptorCount = person.descriptors?.length || 0;
      const thumbnail =
        person.thumbnail ||
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

      // Estimate original photo count (assuming ~5-6 descriptors per photo with augmentation)
      const estimatedPhotos = Math.ceil(descriptorCount / 5);

      return `
      <div class="person-item">
        <img src="${thumbnail}" alt="${name}" class="person-thumbnail" />
        <div class="person-info">
          <div class="person-name">${name}</div>
          <div class="person-photos" title="${descriptorCount} total descriptors">${descriptorCount} descriptor${descriptorCount !== 1 ? 's' : ''}</div>
        </div>
        <button class="delete-btn" data-person="${name}" title="Delete ${name}">×</button>
      </div>
    `;
    })
    .join('');

  // Add event listeners to delete buttons
  peopleListDiv.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const personName = (e.target as HTMLElement).dataset.person;
      if (personName) {
        handleDeletePerson(personName);
      }
    });
  });
}

async function handleDeletePerson(personName: string) {
  if (!confirm(`Delete all photos of ${personName}?`)) {
    return;
  }

  try {
    const result = await browser.storage.local.get('referenceFaces');
    const referenceFaces = result.referenceFaces || [];

    // Remove the person
    const updatedFaces = referenceFaces.filter(
      (p: any) => p.name !== personName && p.label !== personName
    );

    // Save updated data
    await browser.storage.local.set({ referenceFaces: updatedFaces });

    // Update face matcher
    await browser.runtime.sendMessage({
      type: 'UPDATE_FACE_MATCHER',
      data: updatedFaces,
    });

    showStatus(`Deleted ${personName}`, 'success');

    // Reload list
    await loadPeopleList();
  } catch (error) {
    console.error('Error deleting person:', error);
    showStatus('Failed to delete person', 'error');
  }
}

async function loadSettings() {
  try {
    const settings = await browser.storage.sync.get({
      matchThreshold: 0.6,
      detector: 'hybrid',
      detectorMode: 'selective',
    });

    // Update threshold slider
    if (matchThresholdSlider) {
      matchThresholdSlider.value = settings.matchThreshold.toString();
    }
    if (thresholdValueSpan) {
      thresholdValueSpan.textContent = settings.matchThreshold.toFixed(2);
    }

    // Update detector radio
    detectorRadios?.forEach(radio => {
      if (radio.value === settings.detector) {
        radio.checked = true;
      }
    });

    // Update detector mode radio
    detectorModeRadios?.forEach(radio => {
      if (radio.value === settings.detectorMode) {
        radio.checked = true;
      }
    });
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function handleThresholdChange(e: Event) {
  const value = parseFloat((e.target as HTMLInputElement).value);

  if (thresholdValueSpan) {
    thresholdValueSpan.textContent = value.toFixed(2);
  }

  // Save to storage
  await browser.storage.sync.set({
    matchThreshold: value,
    similarityThreshold: value,
  });

  // Update background/offscreen
  browser.runtime.sendMessage({
    type: 'UPDATE_CONFIG',
    data: {
      matchThreshold: value,
      similarityThreshold: value,
    },
  });
}

async function handleDetectorChange(e: Event) {
  const value = (e.target as HTMLInputElement).value;

  // Save to storage
  await browser.storage.sync.set({ detector: value });

  // Update background/offscreen
  browser.runtime.sendMessage({
    type: 'UPDATE_CONFIG',
    data: { detector: value },
  });

  showStatus(`Detector changed to ${value}`, 'info');
}

async function handleDetectorModeChange(e: Event) {
  const value = (e.target as HTMLInputElement).value;

  // Save to storage
  await browser.storage.sync.set({ detectorMode: value });

  // Update background/offscreen
  browser.runtime.sendMessage({
    type: 'UPDATE_CONFIG',
    data: { detectorMode: value },
  });

  let modeDescription = '';
  switch (value) {
    case 'off':
      modeDescription = 'Detection disabled';
      break;
    case 'selective':
      modeDescription = 'Blocking specific people';
      break;
    case 'all':
      modeDescription = 'Blocking all faces';
      break;
  }

  showStatus(modeDescription, 'info');
}

async function handleClearData() {
  if (!confirm('This will delete ALL stored faces and reset all settings. Continue?')) {
    return;
  }

  if (!confirm('Are you absolutely sure? This cannot be undone.')) {
    return;
  }

  try {
    // Clear all data
    await browser.storage.local.clear();
    await browser.storage.sync.clear();

    // Reset face matcher
    await browser.runtime.sendMessage({
      type: 'UPDATE_FACE_MATCHER',
      data: [],
    });

    showStatus('All data cleared', 'success');

    // Reset UI
    resetForm();
    await loadPeopleList();
    await loadSettings();
  } catch (error) {
    console.error('Error clearing data:', error);
    showStatus('Failed to clear data', 'error');
  }
}

async function handleExportData() {
  try {
    // Get all data
    const localStorage = await browser.storage.local.get(null);
    const syncStorage = await browser.storage.sync.get(null);

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      local: localStorage,
      sync: syncStorage,
    };

    // Create blob and download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `face-block-export-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    showStatus('Data exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting data:', error);
    showStatus('Failed to export data', 'error');
  }
}

async function handleImportData(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    // Validate format
    if (!importData.version || !importData.local) {
      throw new Error('Invalid export file format');
    }

    if (!confirm('This will replace ALL current data. Continue?')) {
      return;
    }

    // Import data
    if (importData.local) {
      await browser.storage.local.set(importData.local);
    }
    if (importData.sync) {
      await browser.storage.sync.set(importData.sync);
    }

    // Update face matcher
    const faces = importData.local?.referenceFaces || [];
    await browser.runtime.sendMessage({
      type: 'UPDATE_FACE_MATCHER',
      data: faces,
    });

    showStatus('Data imported successfully', 'success');

    // Reload UI
    await loadPeopleList();
    await loadSettings();
  } catch (error) {
    console.error('Error importing data:', error);
    showStatus('Failed to import data. Please check the file format.', 'error');
  } finally {
    // Reset input
    if (importDataInput) importDataInput.value = '';
  }
}

function showStatus(message: string, type: 'info' | 'success' | 'error') {
  if (!statusMessage) return;

  statusMessage.innerHTML = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    if (statusMessage) {
      statusMessage.style.display = 'none';
    }
  }, 3000);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
