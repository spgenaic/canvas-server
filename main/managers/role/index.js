'use strict'


/**
 * Canvas Role manager
 */

// Environment
const { SERVER, USER, DEVICE } = require('../../env.js')

// Utils
const EventEmitter = require("eventemitter2");
const debug = require("debug")("canvas-server:roleManager");
const path = require('path');

// Backends
process.env['PM2_HOME'] = path.join(SERVER.paths.var, 'pm2')
const pm2 = require('pm2');
const Docker = require('dockerode');


/**
 * Role manager
 */
class RoleManager extends EventEmitter {

    constructor(options = {}) {

        debug('Initializing Canvas Role Manager')
        super();

        this.loadedRoles = new Map();
        this.initializedRoles = new Map();

        // Initialize backends
        this.docker = new Docker();
        this.pm2 = pm2 //TODO: Fix
    }

    /**
     * RoleManager API
     */

    async startRole(role, options = {}) {
        if (role.type === 'docker') {
           await this.startContainer(role.identifier);
        } else if (role.type === 'pm2') {
            await this.startProcess(role.identifier);
        }
    }

    async stopRole(role) {
        if (role.type === 'docker') {
            await this.stopContainer(role.identifier);
        } else if (role.type === 'pm2') {
            await this.stopProcess(role.identifier);
        }
    }

    async restartRole() {}

    getRoleStatus() {}


    /**
     * pm2 backend
     */

    startProcess(processName) {
        return new Promise((resolve, reject) => {
            this.pm2.start(processName, (err, apps) => {
                if (err) reject(err);
                resolve(apps);
            });
        });
    }

    stopProcess(processName) {
        return new Promise((resolve, reject) => {
            this.pm2.stop(processName, (err, proc) => {
                if (err) reject(err);
                resolve(proc);
            });
        });
    }


    /**
     * Docker backend
     */

    async startContainer(containerName) {
        let container = this.docker.getContainer(containerName);
        await container.start();
    }

    async stopContainer(containerName) {
        let container = this.docker.getContainer(containerName);
        await container.stop();
    }

}

module.exports = RoleManager;
