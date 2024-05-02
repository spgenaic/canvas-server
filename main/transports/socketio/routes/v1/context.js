// Utils
const debug = require('debug')('canvas:transports:socketio:route:context')
const ResponseObject = require('../../../../utils/ResponseObject');


/**
 * Constants
 */

const ROUTES = require('../../routes.js')


/**
 * Context routes
 * @param {*} socket
 * @param {*} context
 */

module.exports = function(socket, context) {


    /**
     * Getters
     */

    socket.on(ROUTES.CONTEXT_GET_ID, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_ID} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.id).getResponse());
    });

    socket.on(ROUTES.CONTEXT_GET_URL, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_URL} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.url).getResponse());
    });

    socket.on(ROUTES.CONTEXT_GET_TREE, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_TREE} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.tree).getResponse());
    });

    socket.on(ROUTES.CONTEXT_GET_PATH, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_PATH} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.path).getResponse());
    });

    socket.on(ROUTES.CONTEXT_GET_BITMAPS, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_BITMAPS} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.bitmaps).getResponse());
    });

    socket.on(ROUTES.CONTEXT_GET_CONTEXT_ARRAY, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_CONTEXT_ARRAY} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.contextArray).getResponse());
    });

    socket.on(ROUTES.CONTEXT_GET_FEATURE_ARRAY, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_FEATURE_ARRAY} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.featureArray).getResponse());
    });

    socket.on(ROUTES.CONTEXT_GET_FILTER_ARRAY, (data, callback) => {
        debug(`${ROUTES.CONTEXT_GET_FILTER_ARRAY} event`);
        if (typeof data === 'function') { callback = data; }
        const response = new ResponseObject();
        callback(response.success(context.filterArray).getResponse());
    });


    /**
     * Setters
     */

    socket.on(ROUTES.CONTEXT_SET_URL, (url, /* autocreateLayers, */ callback) => {
        debug(`${ROUTES.CONTEXT_SET_URL} event with url "${url}"`);

        const response = new ResponseObject();
        try {
            const result = context.setUrl(url, true);
            (typeof callback === 'function') ?
                callback(response.success(result).getResponse()) :
                socket.emit(ROUTES.EVENT_CONTEXT_URL, response.success(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_PATH_INSERT, (path, /* autocreateLayers, */ callback) => {
        debug(`${ROUTES.CONTEXT_PATH_INSERT} event with path "${path}"`)

        const response = new ResponseObject();
        try {
            const result = context.insertPath(path, true);
            // TODO: Implement additional return statuses
            callback(response.created(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_PATH_REMOVE, (path, recursive = false, callback) => {
        debug(`${ROUTES.CONTEXT_PATH_REMOVE} event with path "${path}", recursive "${recursive}"`)
        const response = new ResponseObject();

        try {
            const result = context.removePath(path, recursive);
            callback(response.deleted(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_PATH_MOVE, async (pathFrom, pathTo, recursive, callback) => {
        debug(`${ROUTES.CONTEXT_PATH_MOVE} event with pathFrom "${pathFrom}", pathTo "${pathTo}", recursive "${recursive}"`)
        const response = new ResponseObject();

        try {
            const result = await context.movePath(pathFrom, pathTo, recursive);
            callback(response.updated(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });


    /**
     * Context document routes
     */

    socket.on(ROUTES.CONTEXT_DOCUMENT_LIST, async (featureArray, /* filterArray,*/ callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_LIST} event`);
        debug(`featureArray: ${featureArray}`)
        const response = new ResponseObject();
        try {
            const result = await context.listDocuments(featureArray);
            callback(response.success(result).getResponse());
        } catch (err) {
            callback(response.error(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_GET, (id, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_GET} event`);
        const response = new ResponseObject();
        try {
            const result = context.getDocument(id);
            callback(response.success(result).getResponse());
        } catch (err) {
            callback(response.error(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_GET_BY_HASH, (hash, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_GET_BY_HASH} event`);
        const response = new ResponseObject();
        try {
            const result = context.getDocumentByHash(hash);
            callback(response.success(result).getResponse());
        } catch (err) {
            callback(response.error(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_GET_ARRAY, async (featureArray, /* filterArray,*/ callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_GET_ARRAY} event`);
        debug(`featureArray: ${featureArray}`)
        const response = new ResponseObject();
        try {
            const result = await context.getDocuments(featureArray);
            callback(response.success(result).getResponse());
        } catch (err) {
            callback(response.error(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_INSERT, async (data, featureArray, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_INSERT} event`);
        const response = new ResponseObject();
        const document = data; // Ensure validation here

        if (typeof featureArray === 'function') {
            callback = featureArray;
            featureArray = [];
        }

        if (typeof callback !== 'function') {
            debug('Error: No callback function provided.');
            throw new Error('No callback function provided.');
        }

        try {
            const result = await context.insertDocument(document, featureArray);
            callback(response.success(result).getResponse());
        } catch (err) {
            callback(response.error(err).getResponse());
        }
    });


    socket.on(ROUTES.CONTEXT_DOCUMENT_INSERT_ARRAY, async (data, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_INSERT_ARRAY} event`);
        const response = new ResponseObject();
        // TODO: Input validation
        // TODO: Add featureArray, filterArray, use data.documentArray
        // to be compliant with the REST API
        let documents = data;

        try {
            const result = await context.insertDocumentArray(documents);
            callback(response.success(result).getResponse());
        } catch (err) {
            callback(response.error(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_REMOVE, async (id, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_REMOVE} event for document id "${id}""`)
        const response = new ResponseObject();

        try {
            const result = await context.removeDocument(id);
            callback(response.deleted(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_REMOVE_ARRAY, async (docArray, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_REMOVE_ARRAY} event for document array "${docArray}""`)
        const response = new ResponseObject();

        try {
            const result = await context.removeDocumentArray(docArray);
            callback(response.deleted(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_DELETE, async (id, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_DELETE} event for document id "${id}""`)
        const response = new ResponseObject();

        try {
            const result = await context.deleteDocument(id);
            callback(response.deleted(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });

    socket.on(ROUTES.CONTEXT_DOCUMENT_DELETE_ARRAY, async (docArray, callback) => {
        debug(`${ROUTES.CONTEXT_DOCUMENT_DELETE_ARRAY} event document array "${docArray}""`)
        const response = new ResponseObject();

        try {
            const result = await context.deleteDocumentArray(docArray);
            callback(response.deleted(result).getResponse());
        } catch (err) {
            callback(response.serverError(err).getResponse());
        }
    });


    /**
     * Event listeners
     */

    context.on('url', (url) => {
        debug(`Emitting event ${ROUTES.EVENT_CONTEXT_URL}`)
        const response = new ResponseObject().success(url).getResponse();
        socket.emit(ROUTES.EVENT_CONTEXT_URL, response);
    });

};


