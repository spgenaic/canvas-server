/**
 * Canvas main()
 */

// Environment variables
const {
    SERVER,
    USER,
    DEVICE,
    PID,
    IPC
} = require('./env.js');

// Utils
const path = require('path');
const debug = require('debug')('canvas-main');
const Config = require('./utils/config');
const log = require('./utils/log')('canvas-server');
const EventEmitter = require('eventemitter2');

// Core services
const EventD = require('./services/eventd');
const SynapsDB = require('./services/synapsdb');
const NeuralD = require('./services/neurald');
const StoreD = require('./services/stored');

// Manager classes
const ServiceManager = require('./managers/service');
const SessionManager = require('./managers/session');
const ContextManager = require('./managers/context');
const RoleManager = require('./managers/role');

// Transports
const TransportRest = require('./transports/rest');
const TransportSocketIO = require('./transports/socketio');


/**
 * Main application
 */

class Canvas extends EventEmitter {

    constructor(options = {
        sessionEnabled: true,
        initGlobalContext: true,
        enableUserRoles: true
    }) {

        debug('Initializing Canvas Server');


        /**
         * Utils
         */

        super() // EventEmitter2

        this.config = Config({
            serverConfigDir: SERVER.paths.config,
            userConfigDir: USER.paths.config,
            configPriority: 'server',
            versioning: false
        })

        this.logger = log;
        /* new Log({
            appName: SERVER.name,
            logLevel: process.env.LOG_LEVEL || 'debug',
            logPath: path.join(SERVER.paths.var, 'log')
        })*/

        /**
         * Runtime
         */

        this.sessionEnabled = options.sessionEnabled; // read values from config
        this.initGlobalContext = options.initGlobalContext;
        this.enableUserRoles = options.enableUserRoles;


        /**
         * Core services
         */

        this.db = new SynapsDB({
            path: USER.paths.db,
            backupPath: path.join(USER.paths.db, 'backup'),
            backupOnOpen: true,
            backupOnClose: false,
            compression: true
        })

        this.neurald = new NeuralD({
            db: this.db.createDataset('neurald'),
            config: this.config,
            logger: this.logger
        })

        this.stored = new StoreD({
            paths: {
                data: USER.paths.data,
                cache: path.join(USER.paths.var, 'cache'),
            },
            cachePolicy: 'pull-through',
        })


        /**
         * Managers
         */

        this.serviceManager = new ServiceManager({
            config: path.join(USER.paths.config, 'services.json'),
            serviceDirs: [
                path.join(SERVER.paths.home, 'services'),
                path.join(SERVER.paths.home, 'transports')
            ]
        });

        this.sessionManager = new SessionManager({
            db: this.db.createDataset('session')

        });

        this.contextManager = new ContextManager({
            db: this.db
        })

        this.roleManager = new RoleManager()


        /**
         * Transports
         */

        this.transports = {}

        // Static variables
        this.PID = PID          // Current App instance PID
        this.IPC = IPC          // Shared IPC socket

        // App State
        this.isMaster = true
        this.status = 'stopped'
    }

    // Getters
    static get name() { return SERVER.name; }
    static get version() { return SERVER.version; }
    static get description() { return SERVER.description; }
    static get license() { return SERVER.license; }
    static get paths() { return SERVER.paths; }
    get pid() { return this.PID; }
    get ipc() { return this.IPC; }
    get status() { return this.status; }


    /**
     * Canvas service controls
     */

    async start(url, options = {}) {
        if (this.status == 'running' && this.isMaster) throw new Error('Canvas Server already running')

        this.status = 'starting'
        this.emit('starting')

        this.setupProcessEventListeners()

        // Creates the default "universe" context
        if (this.initGlobalContext) {
            this.contextManager.createContext('/', {
                type: 'universe'
            })
        }

        try {
            if (this.sessionEnabled) await this.sessionManager.loadSession()
            await this.initializeServices()
            await this.initializeTransports()
            await this.initializeRoles()
        } catch (error) {
            console.error('Error during Canvas Server startup:', error);
            process.exit(1);
        }

        this.status = 'running'
        this.emit('running')
    }

    async shutdown(exit = true) {
        debug(exit ? 'Shutting down Canvas Server...' : 'Shutting down Canvas Server for restart');
        this.emit('before-shutdown')
        this.status = 'stopping'
        try {
            if (this.sessionEnabled) { await this.sessionManager.saveSession(); }
            await this.shutdownRoles();
            await this.shutdownTransports();
            await this.shutdownServices();
            console.log('Graceful shutdown completed successfully.');
            if (exit) process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    }

    async restart() {
        debug('Restarting Canvas Server');
        this.emit('restart')
        await this.shutdown(false)
        await this.start()
    }

    status() { return this.status; }
    stats() { return []; }


    /**
     * Session
     */

    listSessions() {
        return this.sessionManager.listSessions()
    }

    createSession(id, options = {}) {
        return this.sessionManager.createSession(id, options)
    }

    openSession(id) {
        return this.sessionManager.openSession(id)
    }

    closeSession(id) {
        return this.sessionManager.closeSession(id)
    }

    removeSession(id) {
        return this.sessionManager.removeSession(id)
    }


    /**
     * Contexts
     */

    createContext(url = '/', options = {}) {
        let context = this.contextManager.createContext(url, options)
        return context
    }

    getContext(id) { return this.contextManager.getContext(id); }

    removeContext(id) { return this.contextManager.removeContext(id); }

    listContexts() { return this.contextManager.listContexts(); }

    lockContext(id, url) { return this.contextManager.lockContext(id, url); }

    unlockContext(id) { return this.contextManager.unlockContext(id); }


    /**
     * Services
     */

    async initializeServices() {
        return true
    }

    async shutdownServices() {
        return true
    }


    /**
     * Transports
     */

    async initializeTransports() {
        // Load configuration options for transports
        let config = this.config.open('transports')

        // TODO: Refactor!

        // Initialize the express.js based REST transport
        this.transports.rest = new TransportRest({
            host: config.get('rest.host'),
            port: config.get('rest.port'),
            canvas: this,   // TODO: Refactor
            db: this.db,
            contextManager: this.contextManager
        });

        try {
            await this.transports.rest.start();
        } catch (error) {
            console.log('Error initializing REST transport:', error);
            process.exit(1);
        }

        // initialize the Socket.IO transport
        this.transports.socketio = new TransportSocketIO({
            host: config.get('socketio.host'),
            port: config.get('socketio.port'),
            canvas: this,   // TODO: Rafactor
            db: this.db,
            contextManager: this.contextManager
        });

        try {
            await this.transports.socketio.start();
        } catch (error) {
            console.log('Error initializing SocketIO transport:', error);
            process.exit(1);
        }

        return true
    }

    async shutdownTransports() {
        return true
    }


    /**
     * Roles
     */

    async initializeRoles() {
        return true
    }

    async shutdownRoles() {
        return true
    }


    /**
     * Process Event Listeners
     */

    setupProcessEventListeners() {

        process.on('uncaughtException', (error) => {
            console.error(error);
            this.shutdown().then(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('warning', (warning) => {
            console.warn(warning.name);
            console.warn(warning.message);
            console.warn(warning.stack);
        });

        process.on('SIGINT', async (signal) => {
            console.log(`Received ${signal}, gracefully shutting down`);
            await this.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async (signal) => {
            console.log(`Received ${signal}, gracefully shutting down`);
            await this.shutdown();
            process.exit(0);
        });

        process.on('beforeExit', async (code) => {
            if (code !== 0) return;
            debug('Process beforeExit: ', code);
            await this.shutdown();
        });

        process.on('exit', (code) => {
            console.log(`Bye: ${code}`);
        });
    }

}

module.exports = Canvas
