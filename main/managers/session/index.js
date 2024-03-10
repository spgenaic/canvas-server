// Utils
const EventEmitter = require("eventemitter2");


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
            console.log("No database provided, using in-memory storage.");
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
