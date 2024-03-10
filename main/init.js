/**
 * Canvas server
 */


// CLI Parser
const argv = require('minimist')(process.argv.slice(2));

// Canvas
const Canvas = require('./main')
const canvas = new Canvas();

// Start
canvas.start()

// Event
canvas.on('running', () => {
  console.log('Canvas server started successfully.')
})
