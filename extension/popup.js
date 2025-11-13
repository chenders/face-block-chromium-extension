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
const matchThresholdSlider = document.getElementById('matchThreshold');
const thresholdValueSpan = document.getElementById('thresholdValue');
const detectorRadios = document.querySelectorAll('input[name="detector"]');
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
    debugLog('Face-api.js models loaded in popup');
  } catch (error) {
    errorLog('Error loading models:', error);
    showStatus('Error loading face recognition models', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  personNameInput.addEventListener('input', validateForm);
  photoUploadInput.addEventListener('change', handleFileSelection);
  addPersonBtn.addEventListener('click', handleAddPerson);
  matchThresholdSlider.addEventListener('input', handleThresholdChange);
  detectorRadios.forEach(radio => {
    radio.addEventListener('change', handleDetectorChange);
  });
  exportDataBtn.addEventListener('click', handleExportData);
  importDataBtn.addEventListener('click', () => importDataInput.click());
  importDataInput.addEventListener('change', handleImportData);
  clearDataBtn.addEventListener('click', handleClearData);
}

// Store photo analyses for real-time feedback
let photoAnalyses = [];

// Handle file selection
async function handleFileSelection(e) {
  selectedFiles = Array.from(e.target.files);

  if (selectedFiles.length > 0) {
    selectedFilesDiv.textContent = `${selectedFiles.length} photo(s) selected - analyzing...`;

    // Clear previous analyses
    photoAnalyses = [];
    previewImagesDiv.innerHTML = '';

    // Ensure models are loaded before analysis
    if (!modelsLoaded) {
      await loadModels();
    }

    // Analyze each photo in real-time
    let processedCount = 0;
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const reader = new FileReader();

      reader.onload = async e => {
        const dataUrl = e.target.result;

        // Create preview container
        const container = document.createElement('div');
        container.className = 'preview-container';

        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'preview-img';
        container.appendChild(img);

        // Analyze photo quality
        try {
          const analysis = await extractFaceDescriptor(dataUrl);
          photoAnalyses.push(analysis);

          // Add quality badge
          const badge = document.createElement('div');
          badge.className = 'quality-badge';

          if (!analysis.valid) {
            badge.classList.add('invalid');
            badge.title = 'No face detected';
          } else if (analysis.score >= 80) {
            badge.classList.add('excellent');
            badge.title = `Excellent quality (${analysis.score}/100)`;
          } else if (analysis.score >= 65) {
            badge.classList.add('good');
            badge.title = `Good quality (${analysis.score}/100)`;
          } else if (analysis.score >= 50) {
            badge.classList.add('fair');
            badge.title = `Fair quality (${analysis.score}/100)`;
          } else {
            badge.classList.add('poor');
            badge.title = `Poor quality (${analysis.score}/100)`;
          }

          container.appendChild(badge);

          // Add category label (frontal, angle, profile)
          const feedback = document.createElement('div');
          feedback.className = 'photo-feedback';
          if (analysis.valid) {
            feedback.textContent = analysis.category.replace('-', ' ');
          } else {
            feedback.textContent = 'no face';
          }
          container.appendChild(feedback);
        } catch (error) {
          errorLog('Error analyzing photo:', error);
        }

        previewImagesDiv.appendChild(container);
        processedCount++;

        // Update coverage analysis when all photos are processed
        if (processedCount === selectedFiles.length) {
          selectedFilesDiv.textContent = `${selectedFiles.length} photo(s) selected`;
          updateCoverageAnalysis();
        }
      };

      reader.readAsDataURL(file);
    }
  } else {
    selectedFilesDiv.textContent = '';
    previewImagesDiv.innerHTML = '';
    photoAnalyses = [];
    document.getElementById('qualityAnalysis').style.display = 'none';
  }

  validateForm();
}

// Update coverage analysis display
function updateCoverageAnalysis() {
  const qualityAnalysisDiv = document.getElementById('qualityAnalysis');
  const coverageSummaryDiv = document.getElementById('coverageSummary');
  const effectivenessEstimateDiv = document.getElementById('effectivenessEstimate');

  if (photoAnalyses.length === 0) {
    qualityAnalysisDiv.style.display = 'none';
    return;
  }

  // Analyze coverage
  const coverage = analyzeCoverage(photoAnalyses);
  const effectiveness = estimateEffectiveness(photoAnalyses);

  // Build coverage summary HTML
  let coverageHTML = '<div class="coverage-item">';
  coverageHTML += '<span><strong>Photo Coverage:</strong></span>';
  coverageHTML += '</div>';

  coverage.recommendations.forEach(rec => {
    const isPositive = rec.startsWith('✓');
    const recClass = isPositive ? 'recommendation positive' : 'recommendation';
    coverageHTML += `<div class="${recClass}">${rec}</div>`;
  });

  coverageSummaryDiv.innerHTML = coverageHTML;

  // Build effectiveness estimate HTML
  let effectivenessHTML = '<div class="effectiveness-score">';
  effectivenessHTML += `${effectiveness}%`;
  effectivenessHTML += '</div>';
  effectivenessHTML += '<div class="effectiveness-label">';
  effectivenessHTML += 'Estimated Blocking Effectiveness';
  effectivenessHTML += '</div>';

  effectivenessEstimateDiv.innerHTML = effectivenessHTML;

  qualityAnalysisDiv.style.display = 'block';
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
    const photoDataUrls = await Promise.all(selectedFiles.map(file => fileToDataURL(file)));

    // Extract face descriptors and quality data from photos
    const descriptorData = [];
    let processedCount = 0;

    for (const photoDataUrl of photoDataUrls) {
      try {
        addPersonBtn.textContent = `Processing photo ${processedCount + 1}/${photoDataUrls.length}...`;
        const analysis = await extractFaceDescriptor(photoDataUrl);

        if (analysis && analysis.valid && analysis.descriptor) {
          // Validate descriptor
          if (analysis.descriptor.length !== 128) {
            errorLog('Invalid descriptor length:', analysis.descriptor.length);
            continue;
          }

          // Convert to regular array for JSON serialization and store with quality data
          const descriptorArray = Array.from(analysis.descriptor);

          // Double-check the array
          if (descriptorArray.length !== 128) {
            errorLog('Array conversion failed:', descriptorArray.length);
            continue;
          }

          descriptorData.push({
            descriptor: descriptorArray,
            quality: {
              score: analysis.score,
              confidence: analysis.metrics.confidence,
              category: analysis.category,
              issues: analysis.issues,
            },
            photoIndex: processedCount,
          });
          processedCount++;
          debugLog(`Extracted descriptor ${processedCount}: quality=${analysis.score}/100`);
        }
      } catch (error) {
        errorLog('Error processing photo:', error);
      }
    }

    if (descriptorData.length === 0) {
      showStatus(
        'No faces detected in the provided photos. Please use clear photos with visible faces.',
        'error'
      );
      addPersonBtn.disabled = false;
      addPersonBtn.textContent = 'Add Person';
      return;
    }

    // Send descriptors with quality data to background script
    debugLog('Popup: Sending ADD_PERSON message to background...');

    chrome.runtime.sendMessage(
      {
        type: 'ADD_PERSON',
        data: {
          personName,
          descriptorData,
          photoCount: selectedFiles.length,
        },
      },
      response => {
        debugLog('Popup: Received response from background:', response);

        if (chrome.runtime.lastError) {
          errorLog('Popup: Runtime error:', chrome.runtime.lastError);
          showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
          addPersonBtn.disabled = false;
          addPersonBtn.textContent = 'Add Person';
          return;
        }

        if (response && response.success) {
          debugLog('Popup: Person added successfully');
          showStatus(
            `Successfully added ${personName} with ${descriptorData.length} face descriptor(s)!`,
            'success'
          );
          resetForm();
          loadPeopleList();
        } else {
          errorLog('Popup: Failed to add person:', response);
          showStatus(`Error: ${response?.error || 'Failed to add person'}`, 'error');
        }
        addPersonBtn.disabled = false;
        addPersonBtn.textContent = 'Add Person';
      }
    );
  } catch (error) {
    errorLog('Error adding person:', error);
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
          // Analyze photo quality using the new quality module
          const qualityAnalysis = analyzePhotoQuality(detection, img);
          resolve(qualityAnalysis);
        } else {
          // Return analysis for no face detected
          resolve(analyzePhotoQuality(null, img));
        }
      } catch (error) {
        errorLog('Face detection error:', error);
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
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Reset form
function resetForm() {
  personNameInput.value = '';
  photoUploadInput.value = '';
  selectedFiles = [];
  photoAnalyses = [];
  selectedFilesDiv.textContent = '';
  previewImagesDiv.innerHTML = '';
  document.getElementById('qualityAnalysis').style.display = 'none';
  validateForm();
}

// Load people list
async function loadPeopleList() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_PEOPLE' }, response => {
      if (response && response.people && response.people.length > 0) {
        renderPeopleList(response.people);
      } else {
        peopleListDiv.innerHTML = '<div class="empty-state">No people added yet</div>';
      }
    });
  } catch (error) {
    errorLog('Error loading people:', error);
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

    personItem.querySelector('.delete-btn').addEventListener('click', e => {
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

  chrome.runtime.sendMessage(
    {
      type: 'DELETE_PERSON',
      data: { personName },
    },
    response => {
      if (response && response.success) {
        showStatus(`Removed ${personName}`, 'success');
        loadPeopleList();
      } else {
        showStatus('Error deleting person', 'error');
      }
    }
  );
}

// Load settings
function loadSettings() {
  chrome.storage.sync.get(['matchThreshold', 'detector'], result => {
    if (result.matchThreshold) {
      matchThresholdSlider.value = result.matchThreshold;
      thresholdValueSpan.textContent = result.matchThreshold.toFixed(2);
    }
    // Load detector preference (default to 'hybrid')
    const detector = result.detector || 'hybrid';
    detectorRadios.forEach(radio => {
      if (radio.value === detector) {
        radio.checked = true;
      }
    });
  });
}

// Handle threshold change
function handleThresholdChange(e) {
  const value = parseFloat(e.target.value);
  thresholdValueSpan.textContent = value.toFixed(2);

  chrome.storage.sync.set({ matchThreshold: value }, () => {
    // Notify content scripts of setting change
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        chrome.tabs
          .sendMessage(tab.id, {
            type: 'SETTINGS_CHANGED',
            settings: { matchThreshold: value },
          })
          .catch(() => {
            // Ignore errors for tabs that don't have content script
          });
      });
    });
  });
}

// Handle detector change
function handleDetectorChange(e) {
  const detector = e.target.value;

  chrome.storage.sync.set({ detector }, () => {
    infoLog(`Detector changed to: ${detector}`);

    // Notify all content scripts to reload models and settings
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        chrome.tabs
          .sendMessage(tab.id, {
            type: 'SETTINGS_CHANGED',
            settings: { detector },
          })
          .catch(() => {
            // Ignore errors for tabs that don't have content script
          });
      });
    });

    // Show status message
    const modeName =
      detector === 'tinyFaceDetector'
        ? 'Fast Mode'
        : detector === 'ssdMobilenetv1'
          ? 'Thorough Mode'
          : 'Hybrid Mode';
    showStatus(
      `Detector changed to ${modeName}. Reload pages for changes to take effect.`,
      'success'
    );
  });
}

// Handle clear all data
function handleClearData() {
  if (
    !confirm(
      'Are you sure you want to delete all blocked people and settings? This cannot be undone.'
    )
  ) {
    return;
  }

  chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' }, response => {
    if (response && response.success) {
      showStatus('All data cleared', 'success');
      loadPeopleList();

      // Reset settings to defaults
      matchThresholdSlider.value = 0.6;
      thresholdValueSpan.textContent = '0.60';

      // Reset detector to hybrid
      detectorRadios.forEach(radio => {
        radio.checked = radio.value === 'hybrid';
      });

      chrome.storage.sync.set({
        matchThreshold: 0.6,
        detector: 'hybrid',
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
    chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, response => {
      if (response && response.success) {
        // Get current detector setting
        let currentDetector = 'hybrid';
        detectorRadios.forEach(radio => {
          if (radio.checked) currentDetector = radio.value;
        });

        const exportData = {
          version: 1,
          exportDate: new Date().toISOString(),
          settings: {
            matchThreshold: parseFloat(matchThresholdSlider.value),
            detector: currentDetector,
          },
          people: response.data,
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
    errorLog('Export error:', error);
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
    chrome.runtime.sendMessage(
      {
        type: 'IMPORT_DATA',
        data: importData.people,
      },
      response => {
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
      }
    );
  } catch (error) {
    errorLog('Import error:', error);
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
