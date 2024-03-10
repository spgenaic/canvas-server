// Utils
const EventEmitter = require("eventemitter2");
const { log } = require('console'); // TODO: Replace with logger

// App includes
const Context = require('./lib/Context')
const Tree = require('./lib/Tree')

// Constants
const MAX_CONTEXTS = 1024 // 2^10

class ContextManager extends EventEmitter {

    #db;
    #tree;
    #layers;

    constructor(options = {}) {
        super()

        this.#db = options.db;
        this.#tree = new Tree();
        this.#layers = this.#tree.layers;
        this.activeContexts = new Map()
    }

    get tree() { return this.#tree; }
    get layers() { return this.#layers; }

    createContext(url = '/', options = {}) {
        if (this.activeContexts.size >= MAX_CONTEXTS) throw new Error('Maximum number of contexts reached')

        // TODO: Tidy up
        if (options.type === 'universe') options.id = 'universe'

        // If a context with the same id already exists, return it instead of creating a new one
        if (this.activeContexts.has(options.id)) return this.activeContexts.get(options.id)

        // Create a new context
        let context = new Context(url, this.#db, this.#tree, options)
        this.activeContexts.set(context.id, context)

        return context
    }

    getContext(id = 'universe') {
        let context = this.activeContexts.get(id);
        if (!context) return null;
        return context;
    }

    listContexts() { return this.activeContexts.values(); }

    removeContext(id) {
        let context = this.activeContexts.get(id)
        if (!context.destroy()) {
            log.error(`Error destroying context ${id}`)
            return false
        }

        this.activeContexts.delete(id)
        log.info(`Context with id ${id} closed`)
        return true
    }

    lockContext(id, url) {}

    unlockContext(id) {}

}

module.exports = ContextManager;
