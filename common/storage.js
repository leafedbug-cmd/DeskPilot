// Storage helper
const StorageHelper = {
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, resolve);
    });
  },
  
  async set(items) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(items, resolve);
    });
  },
  
  async getSettings() {
    return this.get(null);
  }
};