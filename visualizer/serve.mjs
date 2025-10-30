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
const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings');

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

function saveRecording(recording) {
    if (!recording) {
        return null;
    }

    // Ensure recordings directory exists
    if (!fs.existsSync(RECORDINGS_DIR)) {
        fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }

    // Generate timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    const filename = `recording_${timestamp}.json`;
    const filepath = path.join(RECORDINGS_DIR, filename);

    // Save recording
    fs.writeFileSync(filepath, JSON.stringify(recording, null, 2));
    console.log(`Recording saved to: ${filename}`);

    return filename;
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

            // Auto-save recording if requested
            let savedFilename = null;
            if (payload.record && result.recording) {
                savedFilename = saveRecording(result.recording);
                // Remove recording from response to save bandwidth
                delete result.recording;
            }

            sendJson(res, 200, {
                ok: true,
                result,
                savedRecording: savedFilename
            });
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

function handleRecordingsListRequest(req, res) {
    try {
        // Ensure recordings directory exists
        if (!fs.existsSync(RECORDINGS_DIR)) {
            sendJson(res, 200, { ok: true, recordings: [] });
            return;
        }

        // Read directory
        const files = fs.readdirSync(RECORDINGS_DIR);
        const recordings = files
            .filter(f => f.endsWith('.json'))
            .map(filename => {
                const filepath = path.join(RECORDINGS_DIR, filename);
                const stats = fs.statSync(filepath);
                return {
                    filename,
                    size: stats.size,
                    created: stats.birthtime.toISOString(),
                    modified: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Newest first

        sendJson(res, 200, { ok: true, recordings });
    } catch (error) {
        console.error('Error listing recordings:', error);
        sendJson(res, 500, { ok: false, error: error.message });
    }
}

function generateHeatmapFromRecording(recording) {
    if (!recording || !recording.frames) {
        return null;
    }

    const width = recording.metadata?.gridSize || 100;
    const height = recording.metadata?.gridSize || 100;

    const createMatrix = () => Array.from({ length: height }, () => Array(width).fill(0));
    const playerMatrix = createMatrix();
    const enemyMatrix = createMatrix();

    let playerMax = 0;
    let enemyMax = 0;

    // Iterate through all frames and accumulate creep positions
    for (const frame of recording.frames) {
        for (const creep of frame.creeps || []) {
            const x = Math.max(0, Math.min(width - 1, Math.floor(creep.x ?? 0)));
            const y = Math.max(0, Math.min(height - 1, Math.floor(creep.y ?? 0)));

            if (creep.my) {
                const value = playerMatrix[y][x] + 1;
                playerMatrix[y][x] = value;
                if (value > playerMax) playerMax = value;
            } else {
                const value = enemyMatrix[y][x] + 1;
                enemyMatrix[y][x] = value;
                if (value > enemyMax) enemyMax = value;
            }
        }
    }

    return {
        width,
        height,
        player: { matrix: playerMatrix, max: playerMax },
        enemy: { matrix: enemyMatrix, max: enemyMax }
    };
}

function handleRecordingFileRequest(req, res, filename) {
    try {
        // Security: prevent directory traversal
        const safeName = path.basename(filename);
        const filepath = path.join(RECORDINGS_DIR, safeName);

        // Check if file is within recordings directory
        if (!filepath.startsWith(RECORDINGS_DIR)) {
            sendJson(res, 403, { ok: false, error: 'Forbidden' });
            return;
        }

        // Check if file exists
        if (!fs.existsSync(filepath)) {
            sendJson(res, 404, { ok: false, error: 'Recording not found' });
            return;
        }

        // Read and send file
        const data = fs.readFileSync(filepath, 'utf8');
        const recording = JSON.parse(data);
        sendJson(res, 200, { ok: true, recording });
    } catch (error) {
        console.error('Error loading recording:', error);
        sendJson(res, 500, { ok: false, error: error.message });
    }
}

function handleHeatmapRequest(req, res, filename) {
    try {
        // Security: prevent directory traversal
        const safeName = path.basename(filename);
        const filepath = path.join(RECORDINGS_DIR, safeName);

        // Check if file is within recordings directory
        if (!filepath.startsWith(RECORDINGS_DIR)) {
            sendJson(res, 403, { ok: false, error: 'Forbidden' });
            return;
        }

        // Check if file exists
        if (!fs.existsSync(filepath)) {
            sendJson(res, 404, { ok: false, error: 'Recording not found' });
            return;
        }

        // Read recording and generate heatmap
        const data = fs.readFileSync(filepath, 'utf8');
        const recording = JSON.parse(data);
        const heatmap = generateHeatmapFromRecording(recording);

        if (!heatmap) {
            sendJson(res, 400, { ok: false, error: 'Failed to generate heatmap' });
            return;
        }

        sendJson(res, 200, { ok: true, heatmap });
    } catch (error) {
        console.error('Error generating heatmap:', error);
        sendJson(res, 500, { ok: false, error: error.message });
    }
}

function handleDeleteRecordingRequest(req, res, filename) {
    try {
        // Security: prevent directory traversal
        const safeName = path.basename(filename);
        const filepath = path.join(RECORDINGS_DIR, safeName);

        // Check if file is within recordings directory
        if (!filepath.startsWith(RECORDINGS_DIR)) {
            sendJson(res, 403, { ok: false, error: 'Forbidden' });
            return;
        }

        // Check if file exists
        if (!fs.existsSync(filepath)) {
            sendJson(res, 404, { ok: false, error: 'Recording not found' });
            return;
        }

        // Delete the file
        fs.unlinkSync(filepath);
        console.log(`Deleted recording: ${safeName}`);

        sendJson(res, 200, { ok: true, message: 'Recording deleted successfully' });
    } catch (error) {
        console.error('Error deleting recording:', error);
        sendJson(res, 500, { ok: false, error: error.message });
    }
}

function handleAggregatedHeatmapRequest(req, res) {
    try {
        // Ensure recordings directory exists
        if (!fs.existsSync(RECORDINGS_DIR)) {
            sendJson(res, 400, { ok: false, error: 'No recordings available' });
            return;
        }

        // Read all recording files
        const files = fs.readdirSync(RECORDINGS_DIR)
            .filter(f => f.endsWith('.json'));

        if (files.length === 0) {
            sendJson(res, 400, { ok: false, error: 'No recordings available' });
            return;
        }

        // Determine grid size from first recording
        const firstFilepath = path.join(RECORDINGS_DIR, files[0]);
        const firstData = fs.readFileSync(firstFilepath, 'utf8');
        const firstRecording = JSON.parse(firstData);
        const width = firstRecording.metadata?.gridSize || 100;
        const height = firstRecording.metadata?.gridSize || 100;

        // Initialize matrices with correct size
        const playerMatrix = Array.from({ length: height }, () => Array(width).fill(0));
        const enemyMatrix = Array.from({ length: height }, () => Array(width).fill(0));
        let playerMax = 0;
        let enemyMax = 0;

        // Aggregate heatmaps from all recordings
        for (const filename of files) {
            const filepath = path.join(RECORDINGS_DIR, filename);
            const data = fs.readFileSync(filepath, 'utf8');
            const recording = JSON.parse(data);

            const heatmap = generateHeatmapFromRecording(recording);
            if (heatmap) {
                // Add to aggregate
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pValue = playerMatrix[y][x] + (heatmap.player.matrix[y]?.[x] || 0);
                        const eValue = enemyMatrix[y][x] + (heatmap.enemy.matrix[y]?.[x] || 0);
                        playerMatrix[y][x] = pValue;
                        enemyMatrix[y][x] = eValue;
                        if (pValue > playerMax) playerMax = pValue;
                        if (eValue > enemyMax) enemyMax = eValue;
                    }
                }
            }
        }

        const aggregatedHeatmap = {
            width,
            height,
            player: { matrix: playerMatrix, max: playerMax },
            enemy: { matrix: enemyMatrix, max: enemyMax },
            recordingsCount: files.length
        };

        sendJson(res, 200, { ok: true, heatmap: aggregatedHeatmap });
    } catch (error) {
        console.error('Error generating aggregated heatmap:', error);
        sendJson(res, 500, { ok: false, error: error.message });
    }
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // CORS headers for all API endpoints
    if (req.url.startsWith('/api/') && req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    if (req.url === '/api/run') {
        if (req.method !== 'POST') {
            sendJson(res, 405, { ok: false, error: 'Method not allowed' });
            return;
        }
        handleRunRequest(req, res);
        return;
    }

    if (req.url === '/api/recordings') {
        if (req.method !== 'GET') {
            sendJson(res, 405, { ok: false, error: 'Method not allowed' });
            return;
        }
        handleRecordingsListRequest(req, res);
        return;
    }

    if (req.url === '/api/heatmap/aggregated') {
        if (req.method !== 'GET') {
            sendJson(res, 405, { ok: false, error: 'Method not allowed' });
            return;
        }
        handleAggregatedHeatmapRequest(req, res);
        return;
    }

    if (req.url.startsWith('/api/heatmap/')) {
        if (req.method !== 'GET') {
            sendJson(res, 405, { ok: false, error: 'Method not allowed' });
            return;
        }
        const filename = decodeURIComponent(req.url.substring('/api/heatmap/'.length));
        handleHeatmapRequest(req, res, filename);
        return;
    }

    if (req.url.startsWith('/api/recordings/')) {
        const filename = decodeURIComponent(req.url.substring('/api/recordings/'.length));

        if (req.method === 'GET') {
            handleRecordingFileRequest(req, res, filename);
            return;
        }

        if (req.method === 'DELETE') {
            handleDeleteRecordingRequest(req, res, filename);
            return;
        }

        sendJson(res, 405, { ok: false, error: 'Method not allowed' });
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
    console.log('   node runner.mjs --mode quick --record recordings/sample-battle.json');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});
