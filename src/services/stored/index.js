'use strict';

// Utils
const debug = require('debug')('canvas:stored');
const { isFile, isBinary } = require('./utils/common');
const {
    calculateObjectChecksum,
    calculateBinaryChecksum,
    calculateFileChecksum
} = require('./utils/hash');

// StoreD caching layer
const Cache = require('./cache');

// StoreD backends
const BackendLoader = require('./BackendLoader');


/**
 * StoreD
 *
 * @description StoreD is a content-addressable storage service that allows to store and retrieve files, documents and binary data
 * on multiple backends, with a caching layer to improve performance.
 * Adhering to the Unix philosophy, StoreD does not support any indexing or searching, it only stores and retrieves data.
 * @class Stored
 * @param {Object} config - StoreD configuration object
 */

class Stored {
    constructor(config) {
        debug('Initializing Canvas StoreD');

        // TODO: Add config validation
        if (!config) {
            throw new Error('No configuration provided');
        }

        if (!config.backends || Object.keys(config.backends).length === 0) {
            throw new Error('No backends configured at config.backends');
        }

        if (!config.cache && !config.cache.enabled) {
            throw new Error('No cache configuration provided at config.cache');
        }

        this.config = config;

        // Initialize StoreD modules
        this.cache = new Cache(this.config.cache); // We'll use one global caching layer

        // Initialize backends
        this.backends = {};
        this.backendLoader = new BackendLoader();
        this.initializeBackends();
    }

    initializeBackends() {
        for (const [name, backendConfig] of Object.entries(this.config.backends)) {
            if (!backendConfig.driver) {
                throw new Error(`No driver specified for backend ${name} at config.backends.${name}.driver`);
            }

            if (!backendConfig.driverConfig) {
                throw new Error(`No driver configuration specified for backend ${name} at config.backends.${name}.driverConfig`);
            }

            const BackendClass = this.backendLoader.getBackendClass(backendConfig.driver);
            this.backends[name] = new BackendClass(backendConfig.driverConfig);
        }
    }

    // Test method to open a file with the default OS application
    openFile(hash, backendNameOrArray) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                return backend.openFile(hash);
            } catch (error) {
                debug(`Error opening file from backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        throw new Error(`Object not found: ${hash}`);
    }

    // Put OPs will first try to store an object in a backend of type: local, honoring the
    // backend cache configuration for write operations(cfg tbd)
    // If none is available, we will store it in cache regardless of the cache configuration
    // Once stored, it will update a syncd queue to sync with the other backends
    // Cache will be cleared or left-intact after the sync is completed based on the cache configuration

    async putFile(filePath, metadata = {}, backendNameOrArray, options = {}) {
        // Implementation for files
        if (!isFile(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];

    }

    async putDocument(document, metadata = {}, backendNameOrArray, options = {}) {
        // Implementation for JSON documents
        if (!document) {
            throw new Error('No document provided');
        }

        if (typeof document !== 'object') {
            throw new Error('Invalid document provided');
        }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }

    }

    async putBinary(data, metadata = {}, backendNameOrArray, options = {}) {
        // Implementation for binary data
        if (!isBinary(data)) {
            throw new Error('Invalid binary data provided');
        }

        if (!metadata || typeof metadata !== 'object') {
            throw new Error('Metadata is required and must be an object');
        }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }


    }

    // Could be changed in the future(try to get from multiple backends and return the first one found)

    /**
     * getFile: Get a file from the backends
     * @param {*} hash
     * @param {*} backendNameOrArray
     * @param {*} options
     * @return {  } Returns file data as a stream or a direct file path
     */
    async getFile(hash, backendNameOrArray = null, options = {
        // Return as a stream
        // stream: false
        // Return as a direct file path
        // filePath: false
    }) {
        if (!hash) { throw new Error('No hash provided'); }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }
    }

    // Returns structured data(JSON document) parsed into an object
    async getDocument(hash, backendNameOrArray = null, options = {
        // Return raw JSON string instead of parsed object
        // raw: false
        // Return only metadata
        // metadataOnly: false
    }) {
        if (!hash) { throw new Error('No hash provided'); }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }

        // Documents are not cached for now, so no cache logic here
    }

    // Returns binary data as a buffer
    async getBinary(hash, backendNameOrArray = null, options = {}) {
        if (!hash) { throw new Error('No hash provided'); }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }
    }

    async has(hash, backendNameOrArray, ) {
        if (!hash) { throw new Error('No hash provided'); }
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);

            if (this.config.backends[backendName].localCacheEnabled) {
                try {
                    const cacheInfo = await this.cache.has(hash);
                    if (cacheInfo) {
                        debug(`Cache hit for ${hash} in backend ${backendName}`);
                        // return true;
                    } else {
                        debug(`Cache miss for ${hash} in backend ${backendName}`);
                        // Log miss and update cache if found?
                    }
                } catch (error) {
                    debug(`Cache error for ${hash} in backend ${backendName}: ${error.message}`);
                }
            }

            try {
                const exists = await backend.has(hash);
                if (exists) { return true; }
            } catch (error) {
                debug(`Error checking object existence in backend ${backendName}: ${error.message}`);
                if (this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        return false;
    }

    async stat(hash, backendNameOrArray) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                return await backend.stat(hash);
            } catch (error) {
                debug(`Error getting stats for object in backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        throw new Error(`Object not found: ${hash}`);
    }

    async delete(hash, backendNameOrArray) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        const results = [];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                const result = await backend.delete(hash);
                results.push({ backend: backendName, result });

                if (this.config.backends[backendName].localCacheEnabled) {
                    await this.cache.delete(hash);
                }
            } catch (error) {
                debug(`Error deleting object from backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        return results;
    }

    async list(backendNameOrArray) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        const results = {};

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                results[backendName] = await backend.list();
            } catch (error) {
                debug(`Error listing objects from backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        return results;
    }

    /**
     * StoreD Utils
     */

    #findBackendForHash(hash, backendNames) {
        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            if (backend.status !== 'online') { continue; } // Skip offline backends
            try {
                if (backend.has(hash)) { return backendName; }
            } catch (error) {
                debug(`Error checking object existence in backend ${backendName}: ${error.message}`);
                if (this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        return null;
    }

    /**
     * Backend methods
     */

    getBackend(backendName) {
        const backend = this.backends[backendName];
        if (!backend) {
            throw new Error(`Backend not found: ${backendName}`);
        }
        return backend;
    }

    listBackends() {
        return Object.keys(this.backends);
    }

    setBackendStatus(backendName, status) {
        this.getBackend(backendName).status = status;
    }

    getBackendStatus(backendName) {
        return this.getBackend(backendName).status;
    }

    getBackendConfiguration(backendName) {
        return this.getBackend(backendName).getConfiguration();
    }
}

module.exports = Stored;
