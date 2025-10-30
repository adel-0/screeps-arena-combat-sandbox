/**
 * Simple HTTP server for the visualizer
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Default to index.html
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - File Not Found');
            } else {
                res.writeHead(500);
                res.end('500 - Internal Server Error');
            }
            return;
        }

        res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║  SCREEPS ARENA COMBAT VISUALIZER             ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server running at http://localhost:${PORT}/`);
    console.log('');
    console.log('📋 Usage:');
    console.log('   1. Open http://localhost:3000/ in your browser');
    console.log('   2. Click "LOAD BATTLE RECORDING"');
    console.log('   3. Select a .json recording file');
    console.log('   4. Use controls to play/pause/scrub the battle');
    console.log('');
    console.log('💡 To create a recording:');
    console.log('   node ../runner.mjs --mode quick --record sample-battle.json');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});
