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
const Config = require('./utils/config/index.js');
const log = require('./utils/log/index.js')('canvas-server');
const EventEmitter = require('eventemitter2');

// Core services
const EventD = require('./services/eventd/index.js');
const SynapsDB = require('./services/synapsdb/index.js');
const NeuralD = require('./services/neurald/index.js');
const StoreD = require('./services/stored/index.js');

// Manager classes
const ServiceManager = require('./managers/service/index.js');
const SessionManager = require('./managers/session/index.js');
const ContextManager = require('./managers/context/index.js');
const RoleManager = require('./managers/role/index.js');

// Transports
const TransportRest = require('./transports/rest/index.js');
const TransportSocketIO = require('./transports/socketio/index.js');
const TransportHttp = require('./transports/http');

// App constants
const MAX_SESSIONS = 32 // 2^5
const MAX_CONTEXTS_PER_SESSION = 32 // 2^5
const CONTEXT_AUTOCREATE_LAYERS = true;
const CONTEXT_URL_PROTO = "universe";
const CONTEXT_URL_BASE = "/";
const CONTEXT_URL_BASE_ID = "universe";


/**
 * Main application
 */

class Canvas extends EventEmitter {

    constructor(options = {
        sessionEnabled: true,
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

        this.sessionEnabled = options.sessionEnabled;
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

        this.roleManager = new RoleManager();

        this.contextManager = new ContextManager({
            db: this.db
        })

        this.sessionManager = new SessionManager({
            sessionStore: (this.sessionEnabled) ? this.db.createDataset('session') : new Map(),
            contextManager: this.contextManager, // TODO: Refactor/review
            maxSessions: MAX_SESSIONS,
            maxContextsPerSession: MAX_CONTEXTS_PER_SESSION,
        });


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
    static get appName() { return SERVER.appName; }
    static get version() { return SERVER.version; }
    static get description() { return SERVER.description; }
    static get license() { return SERVER.license; }
    static get serverPaths() { return SERVER.paths; }
    static get userPaths() { return USER.paths; }
    get pid() { return this.PID; }
    get ipc() { return this.IPC; }
    get status() { return this.status; }


    /**
     * Canvas service controls
     */


    async start(url, options = {
        // Maybe we should support starting the whole canvas-server with a locked context path
        // but lets be KISS-y for now
    }) {
        if (this.status == 'running' && this.isMaster) throw new Error('Canvas Server already running')
        this.status = 'starting'
        this.emit('starting')
        try {
            this.setupProcessEventListeners()

            // Start the default session (if enabled, maybe we'll remove this)
            if (this.sessionEnabled) { this.sessionManager.createSession('default'); }

            await this.initializeServices()
            await this.initializeTransports()
            await this.initializeRoles()
        } catch (error) {
            console.error('Error during Canvas Server startup:', error);
            process.exit(1);
        }

        this.status = 'running';
        this.emit('running');
        return true;
    }

    async shutdown(exit = true) {
        debug(exit ? 'Shutting down Canvas Server...' : 'Shutting down Canvas Server for restart');
        this.emit('before-shutdown')
        this.status = 'stopping'
        try {
            if (this.sessionEnabled) { await this.sessionManager.saveSessions(); }
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

    listActiveSessions() { return this.sessionManager.listActiveSessions(); }

    async listSessions() {
        let sessions = await this.sessionManager.listSessions();
        return sessions;
    }

    getSession(id) {
        return this.sessionManager.getSession(id);
    }

    createSession(id, sessionOptions = {}) {
        return this.sessionManager.createSession(id, sessionOptions)
    }

    openSession(id) {
        return this.sessionManager.openSession(id)
    }

    closeSession(id) {
        return this.sessionManager.closeSession(id)
    }

    deleteSession(id) {
        return this.sessionManager.deleteSession(id)
    }

    // saveSession(id) { return this.sessionManager.saveSession(id) }
    // saveSessions() { return this.sessionManager.saveSessions() }


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

        const transports = [
            { name: 'http', class: TransportHttp }
            //{ name: 'rest', class: TransportRest },
            //{ name: 'socketio', class: TransportSocketIO }
        ];

        // TODO: The whole thing has to be refactored
        for (let transport of transports) {
            this.transports[transport.name] = new transport.class({
                host: config.get(`${transport.name}.host`),
                port: config.get(`${transport.name}.port`),
                canvas: this,
                db: this.db,
                contextManager: this.contextManager,
                sessionManager: this.sessionManager,
            });

            try {
                await this.transports[transport.name].start();
            } catch (error) {
                console.log(`Error initializing ${transport.name} transport:`, error);
                process.exit(1);
            }
        }

        return true;
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
