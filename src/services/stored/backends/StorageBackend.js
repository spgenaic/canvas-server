class StorageBackend {
    constructor(config) {
        if (new.target === StorageBackend) {
            throw new TypeError("Cannot construct StorageBackend instances directly");
        }
        this.config = config;
        this._status = 'uninitialized';
    }

    async putAsBinary(key, data, metadata) {
        throw new Error('putAsBinary method must be implemented');
    }

    async putAsObject(key, data, metadata) {
        throw new Error('putAsObject method must be implemented');
    }

    async putAsFile(key, filePath, metadata) {
        throw new Error('putAsFile method must be implemented');
    }

    async get(key, options = {}) {
        throw new Error('get method must be implemented');
    }

    async has(key) {
        throw new Error('has method must be implemented');
    }

    async delete(key) {
        throw new Error('delete method must be implemented');
    }

    async list(options = {}) {
        throw new Error('list method must be implemented');
    }

    async stat(key) {
        throw new Error('stat method must be implemented');
    }

    getConfiguration() {
        return this.config;
    }

    get status() {
        return this._status;
    }

    set status(value) {
        this._status = value;
    }

    get supportsLocalCache() {
        return this.config.localCacheEnabled;
    }

}

module.exports = StorageBackend;
