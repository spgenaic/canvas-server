/**
 * Canvas Server *single-user* runtime
 */

// Utils
const path = require('path')
const fs = require('fs')
const pkg = require('./package.json')
const device = require('./managers/device').getCurrentDevice()

/**
 * System directories
 *
 * SERVER_ROOT
 * ├── main
 * ├── config
 * ├── user
 * ├── var
 * |   ├── .env
 * |   ├── log
 * |   ├── run
 */

const SERVER_ROOT = path.dirname(path.resolve(__dirname))
const SERVER_HOME = path.join(SERVER_ROOT, 'main')
const SERVER_CONFIG = process.env['CANVAS_SERVER_CONFIG'] || path.join(SERVER_ROOT, 'config')
const SERVER_ROLES = process.env['CANVAS_SERVER_ROLES'] || path.join(SERVER_ROOT, 'server/roles')
const SERVER_VAR = process.env['CANVAS_SERVER_VAR'] || path.join(SERVER_ROOT, 'var')


/**
 * User directories
 *
 * SERVER_ROOT/user
 * ├── config
 * ├── data
 * ├── db
 * ├── var
 */

// User env
const USER_HOME = process.env['CANVAS_USER_HOME'] || path.join(SERVER_ROOT, 'user')
const USER_CONFIG = process.env['CANVAS_USER_CONFIG'] || path.join(USER_HOME, 'config')
const USER_DATA = process.env['CANVAS_USER_DATA'] || path.join(USER_HOME, 'data')
const USER_DB = process.env['CANVAS_USER_DB'] || path.join(USER_HOME, 'db')
const USER_VAR = process.env['CANVAS_USER_VAR'] || path.join(USER_HOME, 'var')

// Collect all ENV constants
const env = {
    DOTENV: path.join(SERVER_VAR, '.env'),

    SERVER: {
        name: (pkg.productName) ? pkg.productName : pkg.name,
        version: pkg.version,
        description: pkg.description,
        license: pkg.license,
        paths: {
            root: SERVER_ROOT,
            home: SERVER_HOME,
            config: SERVER_CONFIG,
            roles: SERVER_ROLES,
            var: SERVER_VAR
        }
    },

    USER: {
        paths: {
            home: USER_HOME,
            config: USER_CONFIG,
            data: USER_DATA,
            db: USER_DB,
            var: USER_VAR
        }
    },

    DEVICE: {
        id: device.id,
        endianness: device.endianness,
        type: device.type,
        os: device.os,
        network: device.network
    },

    PID: path.join(SERVER_VAR, 'run', 'canvas-server.pid'),
    IPC: (process.platform === 'win32') ?
        path.join('\\\\?\\pipe', process.cwd(), pkg.name) :
        path.join(SERVER_VAR, 'run', 'canvas-server.sock')

}

// Generate ini file
const INI = {
    // Server
    CANVAS_SERVER_NAME: env.SERVER.name,
    CANVAS_SERVER_VERSION: env.SERVER.version,
    CANVAS_SERVER_DESCRIPTION: env.SERVER.description,
    CANVAS_SERVER_LICENSE: env.SERVER.license,
    CANVAS_SERVER_ROOT: env.SERVER.paths.root,
    CANVAS_SERVER_HOME: env.SERVER.paths.home,
    CANVAS_SERVER_CONFIG: env.SERVER.paths.config,
    CANVAS_SERVER_ROLES: env.SERVER.paths.roles,
    CANVAS_SERVER_VAR: env.SERVER.paths.var,

    // Server runtime
    CANVAS_SERVER_PID: env.PID,
    CANVAS_SERVER_IPC: env.IPC,

    // User
    CANVAS_USER_HOME: env.USER.paths.home,
    CANVAS_USER_CONFIG: env.USER.paths.config,
    CANVAS_USER_DATA: env.USER.paths.data,
    CANVAS_USER_DB: env.USER.paths.db,
    CANVAS_USER_VAR: env.USER.paths.var,

    // Developer settings
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug'
}

// Update .env to-be read by external server roles
generateDotenvFile(INI, path.join(SERVER_VAR, '.env'))

// Update process env vars
// We could just run require('dotenv').config() at this point
process.title = `${pkg.productName} | v${pkg.version}`
Object.assign(process.env, {...INI});


/**
 * Exports
 */

module.exports = env


/**
 * Utils
 */

function generateDotenvFile(iniVars, filePath) {

    let iniContent = '';

    Object.keys(iniVars).forEach((key) => {
        let value = iniVars[key];
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }

        iniContent += `${key}="${value}"\n`;
    });

    fs.writeFileSync(filePath, iniContent);
}
