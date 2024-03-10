# Canvas Server

Server component for the Canvas project

## Installation

### Linux

```bash
$ git clone https://github.com/idncsk/canvas-server /path/to/canvas-server
$ cd /path/to/canvas-server/main
$ npm install
# Edit canvas-server configuration before starting the server
$ cd ../config
$ cp roles.example.json roles.json
$ cp transports.example.json transports.json
# Start canvas-server
$ cd ../main 
$ npm start # or npm pm2:start
```

To automatically start canvas-server as a system (or user) service, please consult https://pm2.keymetrics.io/docs/usage/startup/

### Windows

```cmd
> git clone https://github.com/idncsk/canvas-server /path/to/canvas-server
> cd /path/to/canvas-server/main
> npm install
> npm start
```

## Configuration

## Update Canvas Server

```bash
$ cd /path/to/canvas-server/main
# Fetch the latest version of canvas-server from Github
$ git pull origin main # or dev if you are feeling adventurous
# Stop the canvas server
$ npm run stop # or npm run pm2:stop
$ rm -rf ./node_modules # Ensure we have a clean plate
$ npm install
$ npm start # or npm run pm2:start
```

## Update Canvas Server Roles

```bash
# Docker
```
