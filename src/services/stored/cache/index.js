'use strict';


/**
 * Cache interface
 */

// Utils
const debug = require('debug')('canvas:stored:cache');

// Includes
const cacache = require('cacache');

// Default cache/cached configuration
const DEFAULT_CONFIG = {
    algorithms: ['sha1'],
};

class Cache {

    #moduleConfig;
    #cacheRoot;

    constructor(cacheRoot, options = {}) {
        debug('Initializing Canvas StoreD caching layer..');
        if (!cacheRoot || typeof cacheRoot !== 'string') {
            throw new Error('Invalid cache path. It must be a non-empty string.');
        }

        this.#moduleConfig = {
            ...DEFAULT_CONFIG,
            ...options
        };

        this.#cacheRoot = cacheRoot;
        debug(`Canvas StoreD cache initialized, cache root at "${cacheRoot}"`);
    }

    list() {
        return cacache.ls(this.#cacheRoot);
    }

    listAsStream() {
        return cacache.ls.stream(this.#cacheRoot);
    }

    has(key) {
        return cacache.get.info(this.#cacheRoot, key);
    }

    put(key, data, metadata = {}) {
        return cacache.put(this.#cacheRoot, key, data, {
            ...this.#moduleConfig,
            metadata
        });
    }

    putAsStream(key, metadata = {}) {
        return cacache.put.stream(this.#cacheRoot, key, {
            ...this.#moduleConfig,
            metadata
        });
    }

    get(key, metadataOnly = false) {
        // TODO: Cache metadata will be different to the actual object metadata
        // This can introduce problems, but hey, we can handle it in stored
        return (metadataOnly) ? cacache.get.info(this.#cacheRoot, key) : cacache.get(this.#cacheRoot, key)
    }

    getAsStream(key) {
        return cacache.get.stream(this.#cacheRoot, key);
    }

    getInfo(key) {
        return cacache.get.info(this.#cacheRoot, key);
    }

    delete(key, destroy = true) {
        return cacache.rm.entry(this.#cacheRoot, key, { removeFully: destroy });
    }

    verify() { return cacache.verify(this.#cacheRoot); }
}

module.exports = Cache;
