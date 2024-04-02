// Canvas service interface
const Service = require('../../managers/service/lib/Service');

// Utils
const debug = require('debug')('canvas-transport-socketio')
const ResponseObject = require('../../utils/ResponseObject');

// Includes
const http = require('http');
const io = require('socket.io')

// Routes
const contextRoutes = require('./routes/context');
const documentsRoutes = require('./routes/documents');

// Defaults
const DEFAULT_PROTOCOL = 'http'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8002
const DEFAULT_API_TOKEN = 'canvas-socketio-api'

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

        // Workaround till I implement proper multi-context routes!
        this.context = this.contextManager.getContext() // Returns the universe by default

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

            // Setup routes && event handlers
            contextRoutes(socket, this.context);
            documentsRoutes(socket, this.canvas.documents);

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
