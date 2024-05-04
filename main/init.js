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

//const session1 = canvas.createSession()
//console.log(session1.toJSON())

//const session2 = canvas.createSession('work', { baseUrl: '/work' })
//const session3 = canvas.createSession('home', { baseUrl: '/home' })
//const session4 = canvas.openSession('work')



// Event
canvas.on('running', () => {
  console.log('Canvas server started successfully.')
})
