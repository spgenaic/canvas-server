'use strict'

// Utils
//const Conf = require('conf')
const JsonMap = require('../../../utils/JsonMap')
const debug = require('debug')('canvas:context:layer-index')

const Layer = require('./Layer')
const builtInLayers = require('./layers/builtin')

class LayerIndex  { //extends Conf {

    constructor(filePath) {
        if (!filePath) throw new Error('filePath is required')
        this.index = new JsonMap(filePath);
        this.nameToLayerMap = new Map();
        this.#initBuiltInLayers();
        this.#initNameToLayerMap();
        debug(`Layer index initialized with ${this.index.size} layers`)
    }

    has(id) { return this.hasLayerID(id); }
    hasLayerID(id) { return this.index.has(id); }
    hasLayerName(name) { return this.nameToLayerMap.has(name); }

    isInternalLayerName(name) {
        const layer = this.getLayerByName(name);
        return layer && layer.internal === true;
    }

    isInternalLayerID(id) {
        const layer = this.getLayerByID(id);
        return layer && layer.internal === true;
    }

    list() {
        let result = []
        for (const [id, layer] of this.index.entries()) {
            result.push(layer)
        }

        return result
    }

    createLayer(name, options = {}) {
        // TODO: Refactor
        if (typeof name === 'string') {
            options = {
                name: name,
                ...options
            }
        } else { options = name }
        debug(`Creating layer ${JSON.stringify(options)}`)
        if (this.hasLayerName(options.name)) return false

        const layer = new Layer(options)
        if (!layer) throw new Error(`Failed to create layer with options ${options}`)

        this.#addLayerToIndex(layer)
        return layer
    }

    getLayerByID(id) {
        return this.index.get(id) || null;
    }

    getLayerByName(name) {
        let res = this.nameToLayerMap.get(name);
        return res || null
    }

    updateLayer(name, options) {
        let layer = this.getLayerByName(name)
        if (!layer) return false
        if (layer.locked) throw new Error('Layer is locked')
        Object.assign(layer, options)
        this.index.set(layer.id, layer)
        return true
    }

    renameLayer(name, newName) {
        const layer = this.getLayerByName(name);
        if (layer.setName(newName)) {
            this.nameToLayerMap.delete(name);
            this.nameToLayerMap.set(newName, layer);
            this.index.set(layer.id, layer);
        }
    }

    removeLayer(layer) {
        this.index.delete(layer.id);
        this.nameToLayerMap.delete(layer.name);
    }

    removeLayerByID(id) {
        const layer = this.getLayerByID(id);
        return layer ? this.removeLayer(layer) : false
    }

    removeLayerByName(name) {
        const layer = this.getLayerByName(name);
        return layer ? this.removeLayer(layer) : false
    }

    nameToID(name) {
        const layer = this.getLayerByName(name);
        return layer.id || null
    }

    idToName(id) {
        const layer = this.getLayerByID(id);
        return layer.name || null
    }

    #addLayerToIndex(layer) {
        this.index.setSync(layer.id, layer);
        this.nameToLayerMap.set(layer.name, layer);
    }

    #initBuiltInLayers() {
        for (const layer of builtInLayers) {
            this.createLayer(layer)
        }
    }

    #initNameToLayerMap() {
        for (const [id, layer] of this.index.entries()) {
            this.nameToLayerMap.set(layer.name, this.index.get(layer.id))
        }
    }

}


module.exports = LayerIndex
