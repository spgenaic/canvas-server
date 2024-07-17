/**
 * Canvas server
 */




// CLI Parser
// TODO: Implement CLI parser in ./cli
const argv = require('minimist')(process.argv.slice(2));

// Canvas
const Canvas = require('./main');
const canvas = new Canvas();

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

