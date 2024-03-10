module.exports = {
    apps: [{
        name: "canvas-server",
        script: "./init.js",
        env_production: {
            NODE_ENV: "production"
        },
        env_development: {
            DEBUG: "*",
            NODE_ENV: "development"
        }
    }]
}
