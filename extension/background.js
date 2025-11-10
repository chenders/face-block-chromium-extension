// background.js - Service worker for CORS handling and message processing

// Import storage helper
importScripts('storage.js');

const storage = new FaceStorage();

// Initialize storage
async function initialize() {
  try {
    await storage.init();
    console.log('Storage initialized');
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Set up CORS handling for images
chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        {
          header: 'access-control-allow-origin',
          operation: 'set',
          value: '*'
        },
        {
          header: 'access-control-allow-methods',
          operation: 'set',
          value: 'GET, POST, PUT, DELETE, OPTIONS'
        }
      ]
    },
    condition: {
      urlFilter: '*',
      resourceTypes: ['image']
    }
  }],
  removeRuleIds: [1] // Remove existing rule if any
}).catch(error => {
  console.log('CORS rule setup:', error.message);
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

// Handle messages
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'ADD_PERSON':
        await handleAddPerson(message.data, sendResponse);
        break;

      case 'GET_PEOPLE':
        await handleGetPeople(sendResponse);
        break;

      case 'DELETE_PERSON':
        await handleDeletePerson(message.data, sendResponse);
        break;

      case 'CLEAR_ALL_DATA':
        await handleClearAllData(sendResponse);
        break;

      case 'GET_REFERENCE_DESCRIPTORS':
        await handleGetReferenceDescriptors(sendResponse);
        break;

      case 'EXPORT_DATA':
        await handleExportData(sendResponse);
        break;

      case 'IMPORT_DATA':
        await handleImportData(message.data, sendResponse);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Message handling error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle adding a person
async function handleAddPerson(data, sendResponse) {
  console.log('Background: Received ADD_PERSON message', data);

  // Support both old format (descriptors) and new format (descriptorData)
  const { personName, descriptors, descriptorData, photoCount } = data;
  const dataToStore = descriptorData || descriptors; // Backward compatibility

  if (!personName || !dataToStore || dataToStore.length === 0) {
    console.error('Background: Invalid data received');
    sendResponse({ success: false, error: 'Invalid data' });
    return;
  }

  console.log(`Background: Adding ${personName} with ${dataToStore.length} descriptors`);

  try {
    // Ensure storage is initialized
    if (!storage.db) {
      console.log('Background: Initializing storage...');
      await storage.init();
    }

    // Handle new format with quality data
    if (descriptorData) {
      // Extract descriptors and convert to Float32Array
      const float32Descriptors = descriptorData.map(item => new Float32Array(item.descriptor));

      console.log(`Background: Converted to Float32Array, storing in IndexedDB with quality data...`);

      // Store descriptors with quality metadata in IndexedDB
      const result = await storage.addPerson(personName, float32Descriptors, [], descriptorData);

      console.log('Background: Storage result:', result);

      // Verify it was stored
      const verification = await storage.getPerson(personName);
      console.log('Background: Verification - person retrieved:', verification ? 'YES' : 'NO');

      sendResponse({
        success: true,
        message: `Added ${personName} with ${descriptorData.length} face descriptor(s)`
      });
    } else {
      // Old format - just descriptors (backward compatibility)
      const float32Descriptors = descriptors.map(d => new Float32Array(d));

      console.log(`Background: Converted to Float32Array, storing in IndexedDB...`);

      // Store descriptors in IndexedDB
      const result = await storage.addPerson(personName, float32Descriptors, []);

      console.log('Background: Storage result:', result);

      // Verify it was stored
      const verification = await storage.getPerson(personName);
      console.log('Background: Verification - person retrieved:', verification ? 'YES' : 'NO');

      sendResponse({
        success: true,
        message: `Added ${personName} with ${descriptors.length} face descriptor(s)`
      });
    }
  } catch (error) {
    console.error('Background: Error adding person:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle getting all people
async function handleGetPeople(sendResponse) {
  try {
    const people = await storage.getAllPeople();

    const peopleList = people.map(person => ({
      name: person.personName,
      photoCount: person.photoCount || person.descriptors.length,
      dateAdded: person.dateAdded
    }));

    sendResponse({ success: true, people: peopleList });
  } catch (error) {
    console.error('Error getting people:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle deleting a person
async function handleDeletePerson(data, sendResponse) {
  const { personName } = data;

  try {
    await storage.deletePerson(personName);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle clearing all data
async function handleClearAllData(sendResponse) {
  try {
    await storage.clearAll();
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error clearing data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle getting reference descriptors for content script
async function handleGetReferenceDescriptors(sendResponse) {
  try {
    const people = await storage.getAllPeople();

    console.log('Background: handleGetReferenceDescriptors - people:', people);

    const referenceData = people.map(person => {
      console.log(`Background: Converting ${person.personName} descriptors for message passing`);

      // Convert Float32Arrays to regular arrays for Chrome message passing
      const descriptorArrays = person.descriptors.map((d, idx) => {
        const arr = Array.from(d);
        console.log(`Background: Descriptor ${idx} - Float32Array length: ${d.length}, Array length: ${arr.length}`);
        return arr;
      });

      return {
        name: person.personName,
        descriptors: descriptorArrays
      };
    });

    console.log('Background: Sending reference data:', referenceData);
    sendResponse({ success: true, referenceData });
  } catch (error) {
    console.error('Error getting reference descriptors:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle exporting data
async function handleExportData(sendResponse) {
  try {
    const people = await storage.getAllPeople();

    // Convert descriptors to arrays for JSON serialization
    const exportData = people.map(person => ({
      personName: person.personName,
      descriptors: person.descriptors.map(d => Array.from(d)),
      photoCount: person.photoCount || person.descriptors.length,
      dateAdded: person.dateAdded
    }));

    sendResponse({ success: true, data: exportData });
  } catch (error) {
    console.error('Error exporting data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle importing data
async function handleImportData(people, sendResponse) {
  try {
    if (!Array.isArray(people) || people.length === 0) {
      sendResponse({ success: false, error: 'Invalid import data' });
      return;
    }

    // Import each person
    let importedCount = 0;
    for (const person of people) {
      try {
        // Convert array descriptors back to Float32Array
        const descriptors = person.descriptors.map(d => new Float32Array(d));

        await storage.addPerson(
          person.personName,
          descriptors,
          [] // We don't import the actual photo blobs, just descriptors
        );

        importedCount++;
      } catch (error) {
        console.error(`Error importing person ${person.personName}:`, error);
      }
    }

    sendResponse({
      success: true,
      message: `Imported ${importedCount} of ${people.length} person(s)`
    });
  } catch (error) {
    console.error('Error importing data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Initialize when service worker starts
initialize();

console.log('Face Block Chromium Extension background service worker loaded');
