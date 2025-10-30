/**
 * Simple HTTP server for the visualizer
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSimulation } from '../core/simulation-runner.mjs';

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

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2 MB

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(payload));
}

function handleRunRequest(req, res) {
    let body = '';

    req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY_SIZE) {
            sendJson(res, 413, { ok: false, error: 'Request body too large' });
            req.destroy();
        }
    });

    req.on('end', () => {
        try {
            const payload = body ? JSON.parse(body) : {};
            const result = runSimulation({
                mode: payload.mode,
                battles: payload.battles,
                compositions: payload.compositions,
                scenario: payload.scenario,
                verbose: Boolean(payload.verbose),
                entropy: payload.entropy,
                record: payload.record,
                heatmap: Boolean(payload.heatmap)
            });

            sendJson(res, 200, { ok: true, result });
        } catch (error) {
            console.error('Simulation error:', error);
            sendJson(res, 500, { ok: false, error: error.message });
        }
    });
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    if (req.url === '/api/run') {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
            return;
        }

        if (req.method !== 'POST') {
            sendJson(res, 405, { ok: false, error: 'Method not allowed' });
            return;
        }

        handleRunRequest(req, res);
        return;
    }

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
    console.log('║  SCREEPS COMBAT SIMULATOR VISUALIZER         ║');
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
