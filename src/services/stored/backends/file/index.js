const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('canvas:stored:backend:files');

// Default config
const DEFAULT_HASH_ALGO = 'sha1';
const DEFAULT_METADATA_EXTENSION = 'meta.json';


class FileBackend {
    constructor(config) {
        debug('Initializing StoreD file backend..');
        debug('Config:', config);
        if (!config.rootPath || typeof config.rootPath !== 'string') {
            throw new Error('No or Invalid rootPath configuration');
        }

        this.name = 'file';
        this.description = 'Simple Canvas StoreD file backend module';
        this.rootPath = config.rootPath;
        this.hashAlgorithm = config?.hashAlgorithm || DEFAULT_HASH_ALGO;
        this.metadataExtension = config?.metadataExtension || DEFAULT_METADATA_EXTENSION;
    }

    async get(objectHash, options = {}) {
        const { abstraction, metaOnly } = options;
        if (!abstraction) {
            throw new Error('Abstraction is required for FileBackend');
        }

        const filePath = await this.findFilePath(abstraction, objectHash);
        if (!filePath) {
            throw new Error(`Object not found: ${objectHash}`);
        }

        const metaFilePath = `${filePath}.${this.metadataExtension}`;
        const meta = JSON.parse(await fs.readFile(metaFilePath, 'utf8'));

        if (metaOnly) { return { meta }; }

        let data = await fs.readFile(filePath);

        // Check if the file contains JSON data
        if (path.extname(filePath) === '.json') {
            data = JSON.parse(data);
        }

        return { data, meta };
    }

    async put(object, objectMetadata, options = {}) {
        let metadata = objectMetadata;

        if (!metadata || Object.keys(metadata).length === 0) {
            if (typeof object === 'object' && !Buffer.isBuffer(object) && object.metadata) {
                metadata = object.metadata;
            } else {
                throw new Error('Metadata is required. Provide it either as a second argument or as object.metadata');
            }
        }

        const { abstraction, dataContentType, dataContentEncoding, checksums, extension } = metadata;

        if (!abstraction || typeof abstraction !== 'string') {
            throw new Error('Abstraction is required for FileBackend');
        }
        if (!dataContentType || typeof dataContentType !== 'string') {
            throw new Error('Data content type is required for FileBackend');
        }
        if (!checksums || !checksums[this.hashAlgorithm]) {
            throw new Error(`Checksum ${this.hashAlgorithm} is required for FileBackend`);
        }

        const fileHash = checksums[this.hashAlgorithm];
        const fileExtension = extension || 'blob';
        const fileName = this.generateFileName(fileHash, fileExtension);
        const filePath = this.getFilePath(abstraction, fileName);

        await fs.mkdir(path.dirname(filePath), { recursive: true });

        const fileData = (typeof object === 'object' && !Buffer.isBuffer(object))
            ? JSON.stringify(object)
            : object;

        await fs.writeFile(filePath, fileData);

        const metaFilePath = `${filePath}.${this.metadataExtension}`;
        await fs.writeFile(metaFilePath, JSON.stringify(metadata));

        return { filePath, metaFilePath };
    }

    async has(objectHash) {
        const abstractions = await fs.readdir(this.rootPath);
        for (const abstraction of abstractions) {
            const filePath = await this.findFilePath(abstraction, objectHash);
            if (filePath) { return true; }
        }
        return false;
    }

    async stat(objectHash) {
        const abstractions = await fs.readdir(this.rootPath);
        for (const abstraction of abstractions) {
            const filePath = await this.findFilePath(abstraction, objectHash);
            if (filePath) {
                const stats = await fs.stat(filePath);
                const metaFilePath = `${filePath}.${this.metadataExtension}`;

                let metadata;
                try {
                    metadata = JSON.parse(await fs.readFile(metaFilePath, 'utf8'));
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        debug(`Warning: Error reading metadata file: ${error.message}`);
                    }
                    // If metadata file doesn't exist or can't be read, we'll return file stats only
                }

                return {
                    stats,
                    metadata,
                    filePath,
                    metaFilePath: metadata ? metaFilePath : undefined
                };
            }
        }
        throw new Error(`Object not found: ${objectHash}`);
    }

    async delete(objectHash, options = {}) {
        const { abstraction } = options;
        if (!abstraction) {
            throw new Error('Abstraction is required for FileBackend');
        }

        const filePath = await this.findFilePath(abstraction, objectHash);
        if (!filePath) {
            throw new Error(`Object not found: ${objectHash}`);
        }

        const metaFilePath = `${filePath}.${this.metadataExtension}`;

        try {
            await fs.unlink(filePath);
            debug(`Deleted file: ${filePath}`);

            try {
                await fs.unlink(metaFilePath);
                debug(`Deleted metadata file: ${metaFilePath}`);
            } catch (metaError) {
                if (metaError.code !== 'ENOENT') {
                    debug(`Warning: Could not delete metadata file: ${metaError.message}`);
                }
                // If the metadata file doesn't exist, we don't consider it an error
            }

            return true;
        } catch (error) {
            debug(`Error deleting file: ${error.message}`);
            throw error; // Propagate the error instead of returning false
        }
    }

    async list(optionalDataAbstraction) {
        const results = [];
        let abstractions;

        if (optionalDataAbstraction) {
            abstractions = [optionalDataAbstraction];
        } else {
            abstractions = await fs.readdir(this.rootPath);
        }

        for (const abstraction of abstractions) {
            const abstractionPath = path.join(this.rootPath, abstraction);
            try {
                const files = await fs.readdir(abstractionPath);
                for (const file of files) {
                    if (!file.endsWith(this.metadataExtension)) {
                        const filePath = path.join(abstractionPath, file);
                        const stats = await fs.stat(filePath);
                        const hash = this.extractHashFromFileName(file);
                        results.push({
                            abstraction,
                            hash,
                            filePath,
                            stats
                        });
                    }
                }
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    debug(`Warning: Error reading directory ${abstractionPath}: ${error.message}`);
                }
                // If the directory doesn't exist, we just skip it
            }
        }
        return results;
    }

    getFilePath(abstraction, fileName) {
        const folderName = abstraction.split('/').pop() + 's'; // Convert 'data/abstraction/file' to 'files'
        return path.join(this.rootPath, folderName, fileName);
    }

    generateFileName(hash, extension) {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        return `${timestamp}.${hash.slice(0, 12)}.${extension}`;
    }

    async findFilePath(abstraction, hash) {
        const folderName = abstraction.split('/').pop() + 's';
        const abstractionPath = path.join(this.rootPath, folderName);
        const files = await fs.readdir(abstractionPath);
        const matchingFile = files.find(file => file.includes(hash.slice(0, 12)) && !file.endsWith('.meta'));
        return matchingFile ? path.join(abstractionPath, matchingFile) : null;
    }

    getConfiguration() {
        return {
            name: this.name,
            description: this.description,
            dataHome: this.rootPath,
            hashAlgo: this.hashAlgorithm,
            metadataExtension: this.metadataExtension
        }
    }
}

module.exports = FileBackend;
