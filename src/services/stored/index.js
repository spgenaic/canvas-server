'use strict';

// Utils
const debug = require('debug')('canvas:stored');

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

        if (!config.cache.rootPath) {
            throw new Error('No cache root path provided at config.cache.rootPath');
        }

        this.config = config;
        this.cacheRootPath = this.config.cache.rootPath;

        // Initialize StoreD modules
        this.cache = new Cache(this.cacheRootPath, this.config.cache); // We'll use one global caching layer

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

    async get(backendName, objectHash, metadataOnly = false) {
        const backend = this.getBackend(backendName);

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

    async put(backendNameOrArray, object, metadata = {}, options = {}) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        const results = [];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                const result = await backend.put(object, metadata, options);
                results.push({ backend: backendName, result });

                // put implies having the data already in cache or locally available
                // so the below is not really needed
                /*if (this.config.backends[backendName].localCacheEnabled) {
                    await this.cache.put(result.hash, object, { metadata });
                }*/
            } catch (error) {
                debug(`Error putting object in backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    throw error;
                }
            }
        }

        return results;
    }

    async has(backendNameOrArray, objectHash) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);

            if (this.config.backends[backendName].localCacheEnabled) {
                try {
                    const cacheInfo = await this.cache.has(objectHash);
                    if (cacheInfo) {
                        debug(`Cache hit for ${objectHash} in backend ${backendName}`);
                        return true;
                    } else {
                        debug(`Cache miss for ${objectHash} in backend ${backendName}`);
                    }
                } catch (error) {
                    debug(`Cache error for ${objectHash} in backend ${backendName}: ${error.message}`);
                }
            }

            try {
                const exists = await backend.has(objectHash);
                if (exists) {
                    return true;
                }
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

    async stat(backendNameOrArray, objectHash) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                return await backend.stat(objectHash);
            } catch (error) {
                debug(`Error getting stats for object in backend ${backendName}: ${error.message}`);
                if (!this.config.backends[backendName].ignoreBackendErrors) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        throw new Error(`Object not found: ${objectHash}`);
    }

    async delete(backendNameOrArray, objectHash) {
        const backendNames = Array.isArray(backendNameOrArray) ? backendNameOrArray : [backendNameOrArray];
        const results = [];

        for (const backendName of backendNames) {
            const backend = this.getBackend(backendName);
            try {
                const result = await backend.delete(objectHash);
                results.push({ backend: backendName, result });

                if (this.config.backends[backendName].localCacheEnabled) {
                    await this.cache.delete(objectHash);
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

    getBackendConfiguration(backendName) {
        return this.getBackend(backendName).getConfiguration();
    }
}

module.exports = Stored;
