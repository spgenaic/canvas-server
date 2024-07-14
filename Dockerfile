# Official Node.js 20.x image as base
FROM node:20-alpine

# Working directory
WORKDIR /opt

# Install git
RUN apk update && apk add --no-cache git curl

# Clone the repository (dev for now as its more up-to-date)
RUN git clone --branch dev https://github.com/canvas-ai/canvas-server canvas-server

# Lets switch the workdir to our beloved src
WORKDIR /opt/canvas-server

# Install application dependencies
RUN npm install

# Expose port 8000
EXPOSE 8000

# Start the application using npm/node
CMD ["npm", "run", "start"]
