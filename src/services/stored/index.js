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

    // Getters for files, documents and binary support only one backend
    // Could be changed in the future(try to get from multiple backends and return the first one found)
    async getFile(hash, backendNameOrArray = null, options = {}) {
        if (!hash) {
            throw new Error('No hash provided');
        }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }
    }

    async getDocument(hash, backendNameOrArray = null, options = {}) {
        if (!hash) {
            throw new Error('No hash provided');
        }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }

        // Documents are not cached for now, so no cache logic here
    }

    async getBinary(hash, backendNameOrArray = null, options = {}) {
        if (!hash) {
            throw new Error('No hash provided');
        }

        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        if (backendNames.length === 0) {
            throw new Error('No backend specified');
        }
    }

    async has(hash, backendNameOrArray, ) {
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

    async get(backendName, objectHash, metadataOnly = false) {
        if (this.config.backends[backendName].localCacheEnabled) {
            try {
                const cacheInfo = await this.cache.has(objectHash);
                if (cacheInfo) {
                    debug(`Cache hit for ${objectHash} in backend ${backendName}`);
                    if (metadataOnly) {
                        return { metadata: cacheInfo.metadata };
                    }
                    const cachedData = await this.cache.get(objectHash);
                    return { data: cachedData.data, metadata: cachedData.metadata };
                } else {
                    debug(`Cache miss for ${objectHash} in backend ${backendName}`);
                }
            } catch (error) {
                debug(`Cache error for ${objectHash} in backend ${backendName}: ${error.message}`);
            }
        }

        try {
            const result = await backend.get(objectHash, metadataOnly);

            if (this.config.backends[backendName].localCacheEnabled && !metadataOnly) {
                try {
                    await this.cache.put(objectHash, result.data, { metadata: result.metadata });
                } catch (cacheError) {
                    debug(`Error caching data for ${objectHash}: ${cacheError.message}`);
                }
            }

            return result;
        } catch (error) {
            debug(`Error getting object from backend ${backendName}: ${error.message}`);
            if (!this.config.backends[backendName].ignoreBackendErrors) {
                throw error;
            }
        }

        throw new Error(`Object not found: ${objectHash} in backend ${backendName}`);
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
                    continue;3
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
