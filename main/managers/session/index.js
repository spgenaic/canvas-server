// Utils
const EventEmitter = require("eventemitter2");
const debug = require("debug")("canvas-session-manager");


/**
 * Session manager
 */

class SessionManager extends EventEmitter {

    #db;

    constructor(options = {}) {
        super();

        if (options.db) {
            this.#db = options.db;
        } else {
            debug("No database provided, using in-memory storage.");
            this.#db = new Map();
        }
    }

    loadSession() {
        return {};
    }

    saveSession() {
        return true;
    }

}



module.exports = SessionManager;
