/**
 * Canvas server
 */

// Environment variables
const {
    server,
    user,
} = require('./env.js');

// Server mode
// full: server is running with a user environment
// minimal: server is only running the roleManager module and default transports
let serverMode = 'full';
const argv = require('minimist')(process.argv.slice(2));
if (argv.standalone) {
    serverMode = 'minimal';
    console.log('Minimal mode enabled, user environment won\'t be initialized');
} else {
    console.log('Full mode enabled, user environment will be initialized');
}

// Canvas
const Canvas = require('./main');
const canvas = new Canvas({
    mode: serverMode,
    app: {
        name: server.appName,
        version: server.version,
        description: server.description,
        license: server.license,
    },
    paths: {
        server: {
            config: server.paths.config,
            data: server.paths.data,
            roles: server.paths.roles,
            var: server.paths.var,
        },
        user: (serverMode === 'full') ? {
            home: user.paths.home,
            config: user.paths.config,
            data: user.paths.data,
            cache: user.paths.cache,
            db: user.paths.db,
            workspaces: user.paths.workspaces
        } : {}, // false?null
    },
});

// Start the server
canvas.start();



// Event handlers
canvas.on('running', () => {
    console.log('Canvas server started successfully.');
});

canvas.on('error', (err) => {
    console.error('Canvas server failed to start.');
    console.error(err);
});

