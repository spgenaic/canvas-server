const webdav = require('webdav-server').v2;
const debug = require('debug')('canvas:transport:webdavd')

/**
 * Canvas server
 */

const Canvas = require("../../main");
const canvas = new Canvas();
canvas.start();

const session = canvas.createSession();
const context = session.getContext();

const server = new webdav.WebDAVServer({
    port: 8443,
    /*autoSave: { // Will automatically save the changes in the 'data.json' file
        treeFilePath: 'data.json'
    }*/
});

const fs = server.rootFileSystem();
const ctx = server.createExternalContext();


server.afterRequest((arg, next) => {
    // Display the method, the URI, the returned status code and the returned message
    //console.log('>>', arg.request.method, arg.requested.uri, '>', arg.response.statusCode, arg.response.statusMessage);
    // If available, display the body of the response
    //console.log(arg.responseBody);
    next();
});

// Try to load the 'data.json' file
server.autoLoad((e) => {
    if(e)
    { // Couldn't load the 'data.json' (file is not accessible or it has invalid content)
        fs.addSubTree(ctx, {
            'folder1': {                                // /folder1
                'file1.txt': webdav.ResourceType.File,  // /folder1/file1.txt
                'file2.txt': webdav.ResourceType.File   // /folder1/file2.txt
            },
            'Tabs': {

            },
            'file0.txt': webdav.ResourceType.File       // /file0.txt
        })
    }

    server.start(() => {
        updateWebdavFilesystem();
        console.log('READY')
    });
})

context.on('url', async (url) => {
    debug('URL changed:', url)
    await updateWebdavFilesystem();
})

context.on('change', async (op, result = null) => {
    debug('Context changed:', op, result)
    await updateWebdavFilesystem();
})

async function updateWebdavFilesystem() {
    let documents = await context.getDocuments();
    console.log(documents.length);

    // Clear the current folder
    fs.delete(ctx, 'Tabs', (error) => {
        if (error) {
            console.error('Error while deleting Tabs folder:', error);
        } else {
            console.log('Tabs folder deleted successfully');
        }
    });

    // Generate file-representations for each tab
    documents.forEach((document) => {
        console.log(document)

        // Generate the file content
        let content = `[Desktop Entry]\n` +
            `Name=${document.data.title}\n` +
            `Comment=Open ${document.data.title}\n` +
            `Icon=google-chrome\n` +
            `Exec=xdg-open ${document.data.url}\n` +
            `Terminal=false\n` +
            `Type=Application`;

        // Create a Path for the file
        let filePath = new webdav.Path(`/Tabs/${document.id}.desktop`);

        // Create the new file
        fs.create(ctx, filePath, webdav.ResourceType.File, true, (error) => {
            if (error) {
                console.error('Error while creating file:', error);
                return;
            }

            // If file created successfully, then open a write stream and write the data to the file
            fs.openWriteStream(ctx, filePath, {}, (error, writeStream) => {
                if (error) {
                    console.error('Error while opening write stream:', error);
                } else {
                    writeStream.end(content, 'utf8', () => {
                        console.log(`File ${document.id}.desktop written successfully`);
                    });
                }
            });

        });
    });
}
