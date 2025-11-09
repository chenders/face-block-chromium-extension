// popup.js - UI logic for the extension popup

let selectedFiles = [];
let modelsLoaded = false;

// DOM elements
const personNameInput = document.getElementById('personName');
const photoUploadInput = document.getElementById('photoUpload');
const selectedFilesDiv = document.getElementById('selectedFiles');
const previewImagesDiv = document.getElementById('previewImages');
const addPersonBtn = document.getElementById('addPersonBtn');
const peopleListDiv = document.getElementById('peopleList');
const blurIntensitySlider = document.getElementById('blurIntensity');
const blurValueSpan = document.getElementById('blurValue');
const matchThresholdSlider = document.getElementById('matchThreshold');
const thresholdValueSpan = document.getElementById('thresholdValue');
const exportDataBtn = document.getElementById('exportDataBtn');
const importDataBtn = document.getElementById('importDataBtn');
const importDataInput = document.getElementById('importDataInput');
const clearDataBtn = document.getElementById('clearDataBtn');
const statusMessage = document.getElementById('statusMessage');

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadPeopleList();
  loadSettings();
  setupEventListeners();
  loadModels();
});

// Load face-api.js models
async function loadModels() {
  if (modelsLoaded) return;

  try {
    // Use relative path from popup.html location
    // popup.html is at extension root, models/ is also at extension root
    const MODEL_URL = './models';

    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    modelsLoaded = true;
    console.log('Face-api.js models loaded in popup');
  } catch (error) {
    console.error('Error loading models:', error);
    showStatus('Error loading face recognition models', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  personNameInput.addEventListener('input', validateForm);
  photoUploadInput.addEventListener('change', handleFileSelection);
  addPersonBtn.addEventListener('click', handleAddPerson);
  blurIntensitySlider.addEventListener('input', handleBlurIntensityChange);
  matchThresholdSlider.addEventListener('input', handleThresholdChange);
  exportDataBtn.addEventListener('click', handleExportData);
  importDataBtn.addEventListener('click', () => importDataInput.click());
  importDataInput.addEventListener('change', handleImportData);
  clearDataBtn.addEventListener('click', handleClearData);
}

// Handle file selection
function handleFileSelection(e) {
  selectedFiles = Array.from(e.target.files);

  if (selectedFiles.length > 0) {
    selectedFilesDiv.textContent = `${selectedFiles.length} photo(s) selected`;

    // Show image previews
    previewImagesDiv.innerHTML = '';
    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'preview-img';
        previewImagesDiv.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  } else {
    selectedFilesDiv.textContent = '';
    previewImagesDiv.innerHTML = '';
  }

  validateForm();
}

// Validate form
function validateForm() {
  const hasName = personNameInput.value.trim().length > 0;
  const hasPhotos = selectedFiles.length > 0;
  addPersonBtn.disabled = !(hasName && hasPhotos);
}

// Handle adding person
async function handleAddPerson() {
  const personName = personNameInput.value.trim();

  if (!personName || selectedFiles.length === 0) {
    showStatus('Please enter a name and select photos', 'error');
    return;
  }

  // Ensure models are loaded
  if (!modelsLoaded) {
    showStatus('Please wait, loading face recognition models...', 'error');
    await loadModels();
    if (!modelsLoaded) {
      showStatus('Failed to load models. Please try again.', 'error');
      return;
    }
  }

  addPersonBtn.disabled = true;
  addPersonBtn.textContent = 'Processing...';

  try {
    // Convert files to data URLs
    const photoDataUrls = await Promise.all(
      selectedFiles.map(file => fileToDataURL(file))
    );

    // Extract face descriptors from photos
    const descriptors = [];
    let processedCount = 0;

    for (const photoDataUrl of photoDataUrls) {
      try {
        addPersonBtn.textContent = `Processing photo ${processedCount + 1}/${photoDataUrls.length}...`;
        const descriptor = await extractFaceDescriptor(photoDataUrl);
        if (descriptor) {
          // Validate descriptor
          if (descriptor.length !== 128) {
            console.error('Invalid descriptor length:', descriptor.length);
            continue;
          }

          // Convert to regular array for JSON serialization
          const descriptorArray = Array.from(descriptor);

          // Double-check the array
          if (descriptorArray.length !== 128) {
            console.error('Array conversion failed:', descriptorArray.length);
            continue;
          }

          descriptors.push(descriptorArray);
          processedCount++;
          console.log(`Extracted descriptor ${processedCount}: length=${descriptorArray.length}`);
        }
      } catch (error) {
        console.error('Error processing photo:', error);
      }
    }

    if (descriptors.length === 0) {
      showStatus('No faces detected in the provided photos. Please use clear photos with visible faces.', 'error');
      addPersonBtn.disabled = false;
      addPersonBtn.textContent = 'Add Person';
      return;
    }

    // Send descriptors to background script
    console.log('Popup: Sending ADD_PERSON message to background...');

    chrome.runtime.sendMessage({
      type: 'ADD_PERSON',
      data: {
        personName,
        descriptors,
        photoCount: selectedFiles.length
      }
    }, (response) => {
      console.log('Popup: Received response from background:', response);

      if (chrome.runtime.lastError) {
        console.error('Popup: Runtime error:', chrome.runtime.lastError);
        showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
        addPersonBtn.disabled = false;
        addPersonBtn.textContent = 'Add Person';
        return;
      }

      if (response && response.success) {
        console.log('Popup: Person added successfully');
        showStatus(`Successfully added ${personName} with ${descriptors.length} face descriptor(s)!`, 'success');
        resetForm();
        loadPeopleList();
      } else {
        console.error('Popup: Failed to add person:', response);
        showStatus(`Error: ${response?.error || 'Failed to add person'}`, 'error');
      }
      addPersonBtn.disabled = false;
      addPersonBtn.textContent = 'Add Person';
    });
  } catch (error) {
    console.error('Error adding person:', error);
    showStatus('Error processing photos', 'error');
    addPersonBtn.disabled = false;
    addPersonBtn.textContent = 'Add Person';
  }
}

// Extract face descriptor from image data URL
async function extractFaceDescriptor(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          resolve(detection.descriptor);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.error('Face detection error:', error);
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
}

// Convert file to data URL
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Reset form
function resetForm() {
  personNameInput.value = '';
  photoUploadInput.value = '';
  selectedFiles = [];
  selectedFilesDiv.textContent = '';
  previewImagesDiv.innerHTML = '';
  validateForm();
}

// Load people list
async function loadPeopleList() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_PEOPLE' }, (response) => {
      if (response && response.people && response.people.length > 0) {
        renderPeopleList(response.people);
      } else {
        peopleListDiv.innerHTML = '<div class="empty-state">No people added yet</div>';
      }
    });
  } catch (error) {
    console.error('Error loading people:', error);
    peopleListDiv.innerHTML = '<div class="empty-state">Error loading data</div>';
  }
}

// Render people list
function renderPeopleList(people) {
  peopleListDiv.innerHTML = '';

  people.forEach(person => {
    const personItem = document.createElement('div');
    personItem.className = 'person-item';

    personItem.innerHTML = `
      <div class="person-info">
        <div class="person-name">${escapeHtml(person.name)}</div>
        <div class="person-photos">${person.photoCount} reference photo(s)</div>
      </div>
      <button class="delete-btn" data-name="${escapeHtml(person.name)}">Delete</button>
    `;

    personItem.querySelector('.delete-btn').addEventListener('click', (e) => {
      handleDeletePerson(person.name);
    });

    peopleListDiv.appendChild(personItem);
  });
}

// Handle delete person
function handleDeletePerson(personName) {
  if (!confirm(`Are you sure you want to remove ${personName}?`)) {
    return;
  }

  chrome.runtime.sendMessage({
    type: 'DELETE_PERSON',
    data: { personName }
  }, (response) => {
    if (response && response.success) {
      showStatus(`Removed ${personName}`, 'success');
      loadPeopleList();
    } else {
      showStatus('Error deleting person', 'error');
    }
  });
}

// Load settings
function loadSettings() {
  chrome.storage.sync.get(['blurIntensity', 'matchThreshold'], (result) => {
    if (result.blurIntensity) {
      blurIntensitySlider.value = result.blurIntensity;
      blurValueSpan.textContent = `${result.blurIntensity}px`;
    }
    if (result.matchThreshold) {
      matchThresholdSlider.value = result.matchThreshold;
      thresholdValueSpan.textContent = result.matchThreshold.toFixed(2);
    }
  });
}

// Handle blur intensity change
function handleBlurIntensityChange(e) {
  const value = e.target.value;
  blurValueSpan.textContent = `${value}px`;

  chrome.storage.sync.set({ blurIntensity: parseInt(value) }, () => {
    // Notify content scripts of setting change
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_CHANGED',
          settings: { blurIntensity: parseInt(value) }
        }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
    });
  });
}

// Handle threshold change
function handleThresholdChange(e) {
  const value = parseFloat(e.target.value);
  thresholdValueSpan.textContent = value.toFixed(2);

  chrome.storage.sync.set({ matchThreshold: value }, () => {
    // Notify content scripts of setting change
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_CHANGED',
          settings: { matchThreshold: value }
        }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
    });
  });
}

// Handle clear all data
function handleClearData() {
  if (!confirm('Are you sure you want to delete all blocked people and settings? This cannot be undone.')) {
    return;
  }

  chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' }, (response) => {
    if (response && response.success) {
      showStatus('All data cleared', 'success');
      loadPeopleList();

      // Reset settings to defaults
      blurIntensitySlider.value = 20;
      blurValueSpan.textContent = '20px';
      matchThresholdSlider.value = 0.6;
      thresholdValueSpan.textContent = '0.60';

      chrome.storage.sync.set({
        blurIntensity: 20,
        matchThreshold: 0.6
      });
    } else {
      showStatus('Error clearing data', 'error');
    }
  });
}

// Handle export data
async function handleExportData() {
  try {
    exportDataBtn.disabled = true;
    exportDataBtn.textContent = 'Exporting...';

    // Get all data from IndexedDB via background script
    chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (response) => {
      if (response && response.success) {
        const exportData = {
          version: 1,
          exportDate: new Date().toISOString(),
          settings: {
            blurIntensity: parseInt(blurIntensitySlider.value),
            matchThreshold: parseFloat(matchThresholdSlider.value)
          },
          people: response.data
        };

        // Create blob and download
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `face-blur-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showStatus('Data exported successfully', 'success');
      } else {
        showStatus('Error exporting data', 'error');
      }

      exportDataBtn.disabled = false;
      exportDataBtn.textContent = 'Export Data';
    });
  } catch (error) {
    console.error('Export error:', error);
    showStatus('Error exporting data', 'error');
    exportDataBtn.disabled = false;
    exportDataBtn.textContent = 'Export Data';
  }
}

// Handle import data
async function handleImportData(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    // Validate import data structure
    if (!importData.version || !importData.people) {
      showStatus('Invalid import file format', 'error');
      return;
    }

    if (!confirm(`This will import ${importData.people.length} person(s). Continue?`)) {
      importDataInput.value = '';
      return;
    }

    importDataBtn.disabled = true;
    importDataBtn.textContent = 'Importing...';

    // Send import data to background script
    chrome.runtime.sendMessage({
      type: 'IMPORT_DATA',
      data: importData.people
    }, (response) => {
      if (response && response.success) {
        showStatus(`Successfully imported ${importData.people.length} person(s)`, 'success');

        // Import settings if available
        if (importData.settings) {
          chrome.storage.sync.set(importData.settings, () => {
            loadSettings();
          });
        }

        loadPeopleList();
      } else {
        showStatus(`Error: ${response?.error || 'Failed to import data'}`, 'error');
      }

      importDataBtn.disabled = false;
      importDataBtn.textContent = 'Import Data';
      importDataInput.value = '';
    });
  } catch (error) {
    console.error('Import error:', error);
    showStatus('Error importing data: Invalid file', 'error');
    importDataBtn.disabled = false;
    importDataBtn.textContent = 'Import Data';
    importDataInput.value = '';
  }
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
