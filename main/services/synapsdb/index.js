// Utils
const debug = require('debug')('canvas:db')
const EE = require('eventemitter2')

// Backend
const Db = require('./backends/lmdb')

// App includes
const Index = require('./index/index.js')

// Schemas
const documentSchemas = require('./schemas/registry.js')
const { de } = require('date-fns/locale')

// Constants
const INTERNAL_BITMAP_ID_MIN = 1000
const INTERNAL_BITMAP_ID_MAX = 1000000


/**
 * Canvas document database
 */

class SynapsDB extends EE {

    #db;

    constructor(
        options = {
            backupOnOpen: false,    // Backup database on open
            backupOnClose: false,   // Backup database on close
            compression: true,      // Enable compression
            eventEmitter: {},       // Event emitter options, probably not needed
        }
    ) {
        // Event emitter
        super(options.eventEmitter);

        // Initialize database backend
        if (!options.path) throw new Error("Database path required");
        this.#db = new Db(options);

        // Initialize internal datasets
        this.index = new Index({
            db: this.#db.createDataset("index"),
            eventEmitter: options.eventEmitter
        });

        // Initialize documents dataset
        this.documents = this.#db.createDataset("documents");

        // Initialize dataset cache
        this.datasets = new Map();
    }


    /**
     * Generic search / query interface
     */

    // Search documents based on document fields
    async search(
        query,
        contextArray,
        featureArray,
        filterArray,
        returnMetaOnly = false
    ) { debug('search() not implemented yet!'); return false; }

    // Find documents based on query
    async find(
        query,
        contextArray,
        featureArray,
        filterArray,
        returnMetaOnly = false
    ) { debug('find() not implemented yet!'); return false; }


    /**
     * Document interface
     */

    // Legacy methods
    getDocument(id) { return this.getDocumentById(id); }
    hasDocument(id) {
        debug(`hasDocument(): ID: ${id}`);
        if (!id) throw new Error("Document ID required");
        return this.documents.has(id);
    }

    getDocumentById(id) {   // TODO: add metadataOnly support for all get methods?
        debug(`getDocumentById(): ID: ${id}`)
        if (!id) throw new Error("Document ID required");
        return this.documents.get(id);
    }

    getDocumentByHash(hash) {
        debug(`getDocumentByHash(): Hash: ${hash}`);
        if (!hash) throw new Error("Document hash required");
        if (typeof hash !== "string") throw new Error("Document hash has to be a string of formant algo/hash");
        let id = this.index.hash2oid.get(hash);
        if (!id) {
            debug(`Document not found for hash: ${hash}`);
            return null;
        }
        return this.documents.get(id); // TODO: Assumption is that the document is always found when a hash is found (..)
    }

    async getDocuments(contextArray = [], featureArray = [], filterArray = [], metadataOnly = false) {
        debug(`getDocuments(): ContextArray: ${contextArray}; FeatureArray: ${featureArray}`);

        try {
            // Calculate document IDs based on supplied bitmaps
            const [contextBitmap, featureBitmap] = await Promise.all([
                this.index.contextArrayAND(contextArray),
                this.index.featureArrayAND(featureArray)
            ]);

            let bitmaps = [];
            if (contextBitmap) bitmaps.push(contextBitmap);
            if (featureBitmap) bitmaps.push(featureBitmap);

            if (bitmaps.length === 0) {
                debug("No bitmaps to AND, returning an empty array");
                return [];
            }

            const resultIds = this.index.bitmapAND(bitmaps, true);
            debug("Result IDs", resultIds);
            if (!resultIds.length) {
                debug("No documents found, returning an empty array");
                return [];
            }

            // Retrieve documents by IDs
            let documents = await this.documents.getMany(resultIds);
            debug("Documents found", documents.length);

            if (metadataOnly) {
                debug("Returning metadata only");
                documents = documents.map(doc => {
                    doc.data = null;
                    return doc;
                });
            }

            return documents;
        } catch (error) {
            debug("Error retrieving documents:", error.message);
            throw error;
        }
    }


    async getDocumentsByIdArray(idArray, metaOnly = false) {
        debug(`getDocumentsByIdArray(): IDArray: ${idArray}, MetaOnly: ${metaOnly}`);
        if (!Array.isArray(idArray) || idArray.length < 1) {
            throw new Error("Array of document IDs required");
        }

        try {
            let documents = await this.documents.getMany(idArray);
            if (metaOnly) {
                documents = documents.map(doc => {
                    if (doc) {
                        doc.data = null;  // Ensure that doc is not undefined before modifying it
                    }
                    return doc;
                });
            }
            debug("Documents found", documents.length)
            return documents;
        } catch (error) {
            console.error("Failed to retrieve documents:", error);
            throw new Error("Error retrieving documents by ID array");
        }
    }


    async getDocumentsByHashArray(hashArray, metaOnly = false) {
        debug(`getDocumentsByHashArray(): HashArray: ${hashArray}; MetaOnly: ${metaOnly}`);
        if (!Array.isArray(hashArray) || hashArray.length < 1) {
            throw new Error("Array of document hashes required");
        }

        const idArray = hashArray
            .map(hash => this.index.hash2oid.get(hash))
            .filter(id => id !== undefined);

        return this.getDocumentsByIdArray(idArray, metaOnly);
    }

    // TODO: Refactor to use getDocuments() only, legacy method
    async listDocuments(contextArray = [], featureArray = [], filterArray = []) {
        debug(`listDocuments(): ContextArray: ${contextArray}; FeatureArray: ${featureArray}`);
        return this.getDocuments(contextArray, featureArray, filterArray, true);
    }


    /**
     * Inserts a document into the database.
     *
     * @param {Object} document - The document to be inserted.
     * @param {Array} [contextArray=[]] - An array of context values.
     * @param {Array} [featureArray=[]] - An array of feature values.
     * @param {Array} [filterArray=[]] - An array of filter values.
     * @returns {string} - The ID of the inserted document.
     * @throws {Error} - If the document is invalid or if there is an error inserting it into the database.
     */
    async insertDocument(document, contextArray = [], featureArray = [], filterArray = []) {
        debug(`insertDocument(): ContextArray: ${contextArray}; FeatureArray: ${featureArray}`);

        // Parse document
        let parsed = await this.#parseDocument(document);


        debug(`Document inserted: ${parsed.id}`)

        // Old return value
        //return parsed.id;

        // New return value
        parsed.data = null
        return parsed
    }

    async insertDocumentArray(documentArray, contextArray = [], featureArray = [], filterArray = []) {
        debug(`insertDocumentArray(): ContextArray: ${contextArray}; FeatureArray: ${featureArray}`);

        if (!Array.isArray(documentArray) || documentArray.length < 1) {
            throw new Error("Document array required");
        }

        const promises = documentArray.map(doc =>
            this.insertDocument(doc, contextArray, featureArray, filterArray)
        );

        // Await all promises to settle
        const results = await Promise.allSettled(promises);

        const successResults = [];
        const errors = [];

        // Process results
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successResults.push(result.value);
            } else {
                errors.push(`Document ${index} failed: ${result.reason}`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Errors inserting documents: ${errors.join("; ")}`);
        }

        debug(`Inserted documents: ${successResults.join(', ')} (${successResults.length})`);
        return successResults;
    }



    async updateDocument(document, contextArray = [], featureArray = [], filterArray = []) {
        return this.insertDocument(document, contextArray, featureArray, filterArray);
    }

    async updateDocumentArray(documentArray, contextArray = [], featureArray = [], filterArray = []) {
        debug(`updateDocumentArray(): ContextArray: ${contextArray}; FeatureArray: ${featureArray}`);

        if (!Array.isArray(documentArray) || documentArray.length < 1) {
            throw new Error("Document array required");
        }

        let result = [];
        let errors = [];

        // TODO: Refactor to use Promise.all() and lmdb batch operations
        for (const doc of documentArray) {
            try {
                const id = await this.updateDocument(doc, contextArray, featureArray, filterArray);
                result.push(id);
            } catch (error) {
                errors.push(error.message);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Errors updating documents: ${errors.join("; ")}`);
        }

        return result;
    }

    async deleteDocument(id) {
        // TODO: We are not removing the entry, just updating meta: {} to mark it as deleted
        // TODO: We should also clear all bitmaps, tick the "removed" bitmap and remove the data: {} part
        debug(`deleteDocument(): ID: ${id}`);
        if (!id) throw new Error("Document ID required");
        if (!Number.isInteger(id)) throw new Error('Document ID must be an integer')

        let document = this.documents.get(id);
        if (!document) return false;

        // TODO: Do not remove the document, just mark it as deleted and keep the metadata
        try {
            // Remove document from DB
            await this.documents.remove(id)
            // Clear indexes
            await this.index.clear(id, document.checksum)
        } catch(error) {
            throw new Error(`Error deleting document with ID ${id}, ${error}`)
        }

        return true
    }

    async deleteDocumentArray(idArray) {
        if (!Array.isArray(idArray) || idArray.length < 1) throw new Error("Array of document IDs required");

        let tasks = [];
        for (const id of idArray) {
            tasks.push(this.deleteDocument(id));
        }

        await Promise.all(tasks);
        return true
    }


    /**
     * Bitmap methods
     */


    async removeDocument(id, contextArray, featureArray, filterArray) {
        debug(`removeDocument(): ID: ${id}; ContextArray: ${contextArray}; FeatureArray: ${featureArray}`);
        if (!id) throw new Error("Document ID required");
        if (!contextArray || !Array.isArray(contextArray) || contextArray.length < 1 ) throw new Error("Context array required");

        let document = this.documents.get(id);
        if (!document) throw new Error("Document not found"); //return false;

        // Remove document from Context bitmaps
        await this.index.untickContextArray(contextArray, document.id);

        // Remove document from Feature bitmaps (if provided)
        if (Array.isArray(featureArray) && featureArray.length > 0) {
            await this.index.untickFeatureArray(featureArray, document.id);
        }

        return true
    }

    async removeDocumentArray(idArray, contextArray, featureArray, filterArray) {
        debug(`removeDocumentArray(): IDArray: ${idArray}; ContextArray: ${contextArray}; FeatureArray: ${featureArray}`);
        if (!Array.isArray(idArray) || idArray.length < 1) throw new Error("Array of document IDs required");

        let tasks = [];
        for (const id of idArray) {
            tasks.push(this.removeDocument(id, contextArray, featureArray, filterArray));
        }

        await Promise.all(tasks);
        return true
    }


    /**
     * Utils
     */

    listDocumentSchemas() {
        return documentSchemas.list();
    }

    getDocumentSchema(schema) {
        return documentSchemas.getSchema(schema);
    }

    // TODO: Remove or refactor
    createDataset(name) {
        if (this.datasets.has(name)) return this.datasets.get(name);
        let dataset = this.#db.createDataset(name);
        this.datasets.set(name, dataset);
        return dataset;
    }

    // TODO: Remove or refactor
    deleteDataset(name) {
        if (!this.datasets.has(name)) return false;
        return this.datasets.delete(name);
    }


    /**
     * Internal methods
     */

    async #parseDocument(doc) {
        debug("Validating document " + JSON.stringify(doc, null, 2));

        if (typeof doc !== "object") {
            debug(`Document has to be an object, got ${typeof doc}`);
            throw new Error("Document has to be an object");
        }

        if (!doc.type) {
            debug(`Missing document type`);
            throw new Error("Document type required");
        }

        const Schema = this.getDocumentSchema(doc.type);
        if (!Schema) {
            debug(`Document schema not found: ${doc.type}`);
            throw new Error(`Document schema not found: ${doc.type}`);
        }

        if (!doc.id) {
            debug('Generating document ID');
            doc.id = await this.#genDocumentID();
        }

        // Initialize document object
        const parsed = new Schema(doc);

        debug("Document is valid");
        return parsed;
    }

    #extractDocumentFeatures(doc) {
        let features = [];
        // TODO
        features.push(doc.type);
        return features;
    }

    async #genDocumentID() {
        const keyCount = await this.documents.getKeysCount() || 0;
        const nextDocumentID = INTERNAL_BITMAP_ID_MAX + keyCount + 1;
        debug(`Generating new document ID, current key count: ${keyCount}, doc ID: ${nextDocumentID}`);
        return nextDocumentID;
    }
}


module.exports = SynapsDB;
