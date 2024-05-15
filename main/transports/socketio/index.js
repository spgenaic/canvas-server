// Canvas service interface
const Service = require('../../managers/service/lib/Service');

// Utils
const debug = require('debug')('canvas:transports:socketio')
const ResponseObject = require('../../utils/ResponseObject');

// Includes
const http = require('http');
const io = require('socket.io')

// Routes
// TODO: Rework, this does not make logical sense as versioning can be defined in the routes.js file
//const sessionRoutes = require('./routes/v1/session');
const contextRoutes = require('./routes/v1/context');
const documentsRoutes = require('./routes/v1/documents');

// Defaults
const DEFAULT_PROTOCOL = 'http'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8002
const DEFAULT_API_TOKEN = 'canvas-socketio-api'

// Constants
const ROUTES = require('./routes.js');

// Middleware functions
function validateApiKey(key) {
    return (req, res, next) => {
        if (req.body && req.body[key]) {
            next();
        } else {
            console.log('Unauthorized: Invalid API Key');
            res.status(401).send('Unauthorized: Invalid API Key');
        }
    };
}

class SocketIoTransport extends Service {

    #protocol;
    #host;
    #port;
    #auth;

    constructor(options = {}) {
        super(options);
        this.server = null;

        this.#protocol = options.protocol || DEFAULT_PROTOCOL;
        this.#host = options.host || DEFAULT_HOST;
        this.#port = options.port || DEFAULT_PORT;
        this.#auth = options.auth || {
            token: DEFAULT_API_TOKEN,
            disableApiKeyValidation: true
        };

        // TODO: Refactor!!!!! (this is a ugly workaround)
        if (!options.canvas) throw new Error('Canvas not defined');
        this.canvas = options.canvas;

        if (!options.db) throw new Error('DB not defined');
        this.db = options.db;

        if (!options.contextManager) throw new Error('contextManager not defined');
        this.contextManager = options.contextManager;
        if (!options.sessionManager) throw new Error('sessionManager not defined');
        this.sessionManager = options.sessionManager;
        if (!options.db) throw new Error('db not defined');
        this.db = options.db

        debug(`Socket.io Transport initialized, protocol: ${this.#protocol}, host: ${this.#host}, port: ${this.#port}`)
    }

    async start() {
        const server = http.createServer((req, res) => {
            // Add CSP headers
            res.setHeader("Content-Security-Policy", "default-src 'self'");
            // Add CORS headers
            res.setHeader("Access-Control-Allow-Origin", "*");
        });

        this.server = io(server);

        server.listen(this.#port, () => {
            console.log("Socket.io Server listening on port", this.#port);
            this.status = 'running';
        }).on('error', (err) => {
            console.error("Error in server setup:", err);
        });

        this.server.on('connection', (socket) => {
            debug(`Client connected: ${socket.id}`);
            socket.sessionManager = this.sessionManager;
            socket.session = socket.sessionManager.createSession(); // Default session
            socket.context = socket.session.getContext(); // Default context

            contextRoutes(socket);
            documentsRoutes(socket, this.db); // Maybe this is a more readable => better way

            socket.on(ROUTES.SESSION_LIST, async (data, callback) => {
                debug(`${ROUTES.SESSION_LIST} event`);
                debug(`Data: ${JSON.stringify(data)}`);
                if (typeof data === 'function') { callback = data; }
                const sessions = await socket.sessionManager.listSessions();
                const response = new ResponseObject();
                callback(response.success(sessions).getResponse());
            });

            socket.on(ROUTES.SESSION_CREATE, (sessionId, sessionOptions, callback) => {
                debug(`${ROUTES.SESSION_CREATE} event`);
                debug(`Session ID: ${sessionId}, Options: ${JSON.stringify(sessionOptions)}`)
                socket.session = socket.sessionManager.createSession(sessionId, sessionOptions);
                socket.context = socket.session.getContext(); // Returns default session context
                contextRoutes(socket)
                const response = new ResponseObject();
                callback(response.success(socket.session.id).getResponse());
            });

            socket.on(ROUTES.SESSION_CONTEXT_GET, (contextId, callback) => {
                debug(`${ROUTES.SESSION_CONTEXT_GET} event`);
                debug(`Context ID: ${contextId}`);
                socket.context = socket.session.getContext(contextId);
                // Rebind routes to new context
                contextRoutes(socket);
                const response = new ResponseObject();
                callback(response.success(socket.context.id).getResponse());
            });

            socket.on(ROUTES.SESSION_CONTEXT_CREATE, (contextUrl, contextOptions, callback) => {
                debug(`${ROUTES.SESSION_CONTEXT_CREATE} event`);
                debug(`Context URL: ${contextUrl}, Options: ${JSON.stringify(contextOptions)}`);
                socket.context = socket.session.createContext(contextUrl, contextOptions);
                // Rebind routes to new context
                contextRoutes(socket);
                const response = new ResponseObject();
                callback(response.success(socket.context.id).getResponse());
            });

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });

        });
    }


    async stop() {
        if(this.server) {
            this.server.close();
            this.server = null;
        }
        this.status = 'stopped';
    }

    async restart(context, index) {
        await this.stop();
        await this.start(context, index);
    }

    status() {
        if (!this.server) { return { listening: false }; }

        let clientsCount = 0;
        for (const [id, socket] of this.server.sockets.sockets) {
            if (socket.connected) {
                clientsCount++;
            }
        }

        return {
            protocol: this.#protocol,
            host: this.#host,
            port: this.#port,
            listening: true,
            connectedClients: clientsCount
        };
    }

}

module.exports = SocketIoTransport;
