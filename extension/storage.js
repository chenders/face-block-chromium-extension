// storage.js - IndexedDB helper functions for face descriptors

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
        console.error('Database error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
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
    console.log(`Storage.addPerson called: ${personName}, ${descriptors.length} descriptors`);

    if (!this.db) {
      console.log('Storage: DB not initialized, initializing...');
      await this.init();
    }

    return new Promise((resolve, reject) => {
      console.log('Storage: Creating transaction...');

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');

      transaction.onerror = (event) => {
        console.error('Storage: Transaction error:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        console.log('Storage: Transaction completed successfully');
      };

      const objectStore = transaction.objectStore(STORE_NAME);

      // Build data structure with quality metadata if provided
      const data = {
        personName,
        descriptors: descriptors.map(d => Array.from(d)), // Convert Float32Array to regular arrays for storage
        photoCount: descriptors.length,
        dateAdded: new Date().toISOString()
      };

      // Add quality metadata if provided
      if (qualityData && qualityData.length > 0) {
        data.quality = qualityData.map(item => ({
          score: item.quality.score,
          confidence: item.quality.confidence,
          category: item.quality.category,
          issues: item.quality.issues,
          photoIndex: item.photoIndex
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
          totalPhotos: data.quality.length
        };
      }

      console.log('Storage: Data prepared:', {
        personName,
        descriptorCount: data.descriptors.length,
        photoCount: data.photoCount,
        hasQuality: !!data.quality
      });

      const request = objectStore.put(data);

      request.onsuccess = () => {
        console.log(`Storage: Successfully added/updated person: ${personName}`);
        resolve({ success: true });
      };

      request.onerror = (event) => {
        console.error('Storage: Error adding person:', event.target.error);
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
        console.error('Error getting person:', request.error);
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
        console.log('Storage: Retrieved from IndexedDB:', results);

        // Convert arrays back to Float32Array for each person
        results.forEach(person => {
          console.log(`Storage: Processing ${person.personName}, descriptors:`, person.descriptors);

          person.descriptors = person.descriptors.map((d, idx) => {
            console.log(`Storage: Descriptor ${idx} type:`, typeof d, 'isArray:', Array.isArray(d), 'length:', d?.length);

            // Handle case where d might be an object with numeric keys
            let arrayData;
            if (Array.isArray(d)) {
              arrayData = d;
            } else if (d && typeof d === 'object') {
              // Convert object to array
              arrayData = Object.values(d);
            } else {
              console.error('Storage: Invalid descriptor format:', d);
              return new Float32Array(0);
            }

            const float32 = new Float32Array(arrayData);
            console.log(`Storage: Converted descriptor ${idx} to Float32Array, length:`, float32.length);
            return float32;
          });
        });

        resolve(results);
      };

      request.onerror = () => {
        console.error('Error getting all people:', request.error);
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
        console.log(`Deleted person: ${personName}`);
        resolve({ success: true });
      };

      request.onerror = () => {
        console.error('Error deleting person:', request.error);
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
        console.log('Cleared all data');
        resolve({ success: true });
      };

      request.onerror = () => {
        console.error('Error clearing data:', request.error);
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
