// Utils
const EE = require('eventemitter2')
const debug = require('debug')('canvas:db:index')

// App includes
const BitmapManager = require('./lib/BitmapManager')
const MemCache = require('./lib/MemCache')

// Constants
//const MAX_DOCUMENTS = 4294967296 // 2^32
//const MAX_CONTEXTS = 1024 // 2^10
//const MAX_FEATURES = 65536 // 2^16
//const MAX_FILTERS = 65536 // 2^16
const INTERNAL_BITMAP_ID_MIN = 1000
const INTERNAL_BITMAP_ID_MAX = 1000000


/**
 * Main index class
 */

class Index extends EE {


    #db
    #epoch = "e0"   // 2^32 bitmap limit

    constructor(options = {}) {

        // Initialize event emitter
        super(options.eventEmitter || {})

        // Bind/initialize the database backend
        this.#db = options.db

        // Bitmaps
        this.bitmaps = this.#db.createDataset('bitmaps')
        this.bitmapCache = new MemCache() // Shared Map() to cache bitmaps in memory

        // HashMap(s)
        // To decide whether to use a single dataset with a hash type prefix
        // sha1/<hash> | oid
        // md5/<hash> | oid
        // or a separate dataset per hash type
        this.hash2oid = this.#db.createDataset('hash2oid')

        // Internal Bitmaps
        this.bmInternal = new BitmapManager(
            this.bitmaps.createDataset('internal'),
            this.bitmapCache,
            {
                rangeMin: INTERNAL_BITMAP_ID_MIN,
                rangeMax: INTERNAL_BITMAP_ID_MAX
            })

        // Contexts
        this.bmContexts = new BitmapManager(
            this.bitmaps.createDataset('contexts'),
            this.bitmapCache,
            {
                rangeMin: INTERNAL_BITMAP_ID_MIN,
            })

        // Features
        this.bmFeatures = new BitmapManager(
            this.bitmaps.createDataset('features'),
            this.bitmapCache,
            {
                rangeMin: INTERNAL_BITMAP_ID_MIN,
            })

        // Filters
        this.bmFilters = new BitmapManager(
            this.bitmaps.createDataset('filters'),
            this.bitmapCache,
            {
                rangeMin: INTERNAL_BITMAP_ID_MIN,
            })

        // Queues
        // TODO

        // Timeline
        // <timestamp> | <action> | diff {path: [bitmap IDs]}
        // Action: create, update, delete
        // TODO

    }

    /**
     * Main Index API
     */

    async clear(id, hash) {
        if (!id) throw new Error('Document ID required');
        if (!Number.isInteger(id)) throw new Error('Document ID must be an integer');

        if (!hash) throw new Error('Document hash required');
        if (typeof hash !== 'string') throw new Error('Document hash must be a string');

        // Clear hashmaps
        await this.hash2oid.remove(hash);

        // Clear all bitmaps in parallel
        const clearTasks = [
            this.bmInternal.untickAll(id),
            this.bmContexts.untickAll(id),
            this.bmFeatures.untickAll(id),
            this.bmFilters.untickAll(id)
        ];

        await Promise.all(clearTasks);
    }

    /*
    async getObject(id) { }

    async getObjectByHash(hash) { }

    async insertObject(id, contextArray, featureArray, filterArray) {}

    async updateObject(id, contextArray, featureArray, filterArray) {}

    async removeObject(id, contextArray, featureArray, filterArray) {}



    async getObjectContexts(id) { }

    async addObjectFeatures(id, feature) { }

    async removeObjectFeatures(id, feature) { }

    async getObjectFeatures(id) { } */



    /**
     * Bitmap methods
     */

    async tickContextArray(idOrArray, contextArray = []) {
        if (!idOrArray) throw new Error('Document ID required')
        if (!contextArray || !contextArray.length) throw new Error('Context array required')

        if (typeof idOrArray === 'number') {
            return this.bmContexts.tick(idOrArray, contextArray)
        }

        return this.bmContexts.tickMany(idOrArray, contextArray)
    }

    async untickContextArray(idOrArray, contextArray) {
        if (!idOrArray) throw new Error('Document ID required')
        if (!contextArray || !contextArray.length) throw new Error('Context array required')

        if (typeof idOrArray === 'number') {
            await this.bmContexts.untick(idOrArray, contextArray)
        } else {
            await this.bmContexts.untickMany(idOrArray, contextArray)
        }
    }

    async tickFeatureArray(idOrArray, featureArray = []) {
        if (!idOrArray) throw new Error('Document ID required')
        if (!featureArray || !featureArray.length) throw new Error('Feature array required')

        if (typeof idOrArray === 'number') {
            return this.bmFeatures.untick(idOrArray, featureArray)
        }

        return this.bmFeatures.untickMany(idOrArray, featureArray)
    }

    async untickFeatureArray(idOrArray, featureArray = []) {
        if (!idOrArray) throw new Error('Document ID required')
        if (!featureArray || !featureArray.length) throw new Error('Feature array required')

        if (typeof idOrArray === 'number') {
            return this.bmFeatures.untick(idOrArray, featureArray)
        }

        return this.bmFeatures.untickMany(idOrArray, featureArray)
    }


    async updateContextBitmaps(contextArray, oidOrArray) {
        debug(`updateContextBitmaps(): contextArray: ${contextArray}, oidOrArray: ${oidOrArray}`)
        await this.bmContexts.tickMany(contextArray, oidOrArray)
    }

    async updateFeatureBitmaps(featureArray, oidOrArray) {
        debug(`updateFeatureBitmaps(): featureArray: ${featureArray}, oidOrArray: ${oidOrArray}`)
        await this.bmFeatures.tickMany(featureArray, oidOrArray)
    }

    // TODO: Remove/refactor
    bitmapAND(bitmapArray, returnAsArray = false) {
        debug(`bitmapAND(): bitmapArray: ${bitmapArray}, returnAsArray: ${returnAsArray}`)
        if (!Array.isArray(bitmapArray)) throw new Error(`bitmapArray must be an array, got: ${typeof bitmapArray}`)
        if (!bitmapArray.length) throw new Error('bitmapArray array is empty')
        const result = BitmapManager.AND(bitmapArray);
        return returnAsArray ? result.toArray() : result;
    }

    // TODO: Remove/refactor
    contextArrayAND(bitmapArray, returnAsArray = false) {
        debug(`contextArrayAND(): bitmapArray: ${bitmapArray}, returnAsArray: ${returnAsArray}`)
        const result = this.bmContexts.AND(bitmapArray);
        return returnAsArray ? result.toArray() : result;
    }

    // TODO: Remove/refactor
    featureArrayAND(bitmapArray, returnAsArray = false) {
        debug(`featureArrayAND(): bitmapArray: ${bitmapArray}, returnAsArray: ${returnAsArray}`)
        const result = this.bmFeatures.AND(bitmapArray);
        return returnAsArray ? result.toArray() : result;
    }

}

module.exports = Index
