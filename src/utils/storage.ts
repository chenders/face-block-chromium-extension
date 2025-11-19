// storage.js - IndexedDB helper functions for face descriptors
// Note: Requires config.js to be loaded first for logging functions

const DB_NAME = 'FaceBlurDB';
const DB_VERSION = 1;
const STORE_NAME = 'references';

class FaceStorage {
  constructor() {
    this.db = null;
  }

  // Initialize database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        errorLog('Database error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = event => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'personName' });
          objectStore.createIndex('personName', 'personName', { unique: true });
        }
      };
    });
  }

  // Add or update a person's face descriptors
  async addPerson(personName, descriptors, photoBlobs = [], qualityData = null) {
    debugLog(`Storage.addPerson called: ${personName}, ${descriptors.length} descriptors`);

    if (!this.db) {
      debugLog('Storage: DB not initialized, initializing...');
      await this.init();
    }

    return new Promise((resolve, reject) => {
      debugLog('Storage: Creating transaction...');

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');

      transaction.onerror = event => {
        errorLog('Storage: Transaction error:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        debugLog('Storage: Transaction completed successfully');
      };

      const objectStore = transaction.objectStore(STORE_NAME);

      // Build data structure with quality metadata if provided
      const data = {
        personName,
        descriptors: descriptors.map(d => Array.from(d)), // Convert Float32Array to regular arrays for storage
        photoCount: descriptors.length,
        dateAdded: new Date().toISOString(),
      };

      // Add quality metadata if provided
      if (qualityData && qualityData.length > 0) {
        data.quality = qualityData.map(item => ({
          score: item.quality.score,
          confidence: item.quality.confidence,
          category: item.quality.category,
          issues: item.quality.issues,
          photoIndex: item.photoIndex,
        }));

        // Calculate aggregate metrics
        const avgScore = data.quality.reduce((sum, q) => sum + q.score, 0) / data.quality.length;
        const frontalCount = data.quality.filter(q => q.category === 'frontal').length;
        const angleCount = data.quality.filter(q => q.category.includes('angle')).length;
        const profileCount = data.quality.filter(q => q.category.includes('profile')).length;

        data.aggregateMetrics = {
          averageQuality: Math.round(avgScore),
          frontalCount,
          angleCount,
          profileCount,
          totalPhotos: data.quality.length,
        };
      }

      debugLog('Storage: Data prepared:', {
        personName,
        descriptorCount: data.descriptors.length,
        photoCount: data.photoCount,
        hasQuality: !!data.quality,
      });

      const request = objectStore.put(data);

      request.onsuccess = () => {
        debugLog(`Storage: Successfully added/updated person: ${personName}`);
        resolve({ success: true });
      };

      request.onerror = event => {
        errorLog('Storage: Error adding person:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Get a specific person's data
  async getPerson(personName) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(personName);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert arrays back to Float32Array
          result.descriptors = result.descriptors.map(d => new Float32Array(d));
        }
        resolve(result);
      };

      request.onerror = () => {
        errorLog('Error getting person:', request.error);
        reject(request.error);
      };
    });
  }

  // Get all people
  async getAllPeople() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const results = request.result;
        debugLog('Storage: Retrieved from IndexedDB:', results);

        // Convert arrays back to Float32Array for each person
        results.forEach(person => {
          debugLog(`Storage: Processing ${person.personName}, descriptors:`, person.descriptors);

          person.descriptors = person.descriptors.map((d, idx) => {
            debugLog(
              `Storage: Descriptor ${idx} type:`,
              typeof d,
              'isArray:',
              Array.isArray(d),
              'length:',
              d?.length
            );

            // Handle case where d might be an object with numeric keys
            let arrayData;
            if (Array.isArray(d)) {
              arrayData = d;
            } else if (d && typeof d === 'object') {
              // Convert object to array
              arrayData = Object.values(d);
            } else {
              errorLog('Storage: Invalid descriptor format:', d);
              return new Float32Array(0);
            }

            const float32 = new Float32Array(arrayData);
            debugLog(
              `Storage: Converted descriptor ${idx} to Float32Array, length:`,
              float32.length
            );
            return float32;
          });
        });

        resolve(results);
      };

      request.onerror = () => {
        errorLog('Error getting all people:', request.error);
        reject(request.error);
      };
    });
  }

  // Delete a person
  async deletePerson(personName) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(personName);

      request.onsuccess = () => {
        debugLog(`Deleted person: ${personName}`);
        resolve({ success: true });
      };

      request.onerror = () => {
        errorLog('Error deleting person:', request.error);
        reject(request.error);
      };
    });
  }

  // Clear all data
  async clearAll() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        debugLog('Cleared all data');
        resolve({ success: true });
      };

      request.onerror = () => {
        errorLog('Error clearing data:', request.error);
        reject(request.error);
      };
    });
  }

  // Get count of stored people
  async getCount() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FaceStorage;
}
