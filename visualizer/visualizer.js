/**
 * Screeps Arena Combat Visualizer
 * Renders and replays battle recordings
 */

class BattleVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.battleData = null;
        this.currentTick = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        this.animationFrame = null;
        this.lastFrameTime = 0;

        this.gridSize = 50;  // Default grid size, will be updated from battle data
        this.cellSize = 16;  // Cell size, will be recalculated based on grid size

        // Zoom and pan state
        this.zoom = 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 4.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Action effects for visualization
        this.effects = [];

        this.setupEventListeners();
    }

    setupEventListeners() {
        // File upload
        document.getElementById('battleFile').addEventListener('change', (e) => {
            this.loadBattleFile(e.target.files[0]);
        });

        // Playback controls
        document.getElementById('playBtn').addEventListener('click', () => this.play());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());

        // Speed control
        document.getElementById('speedSlider').addEventListener('input', (e) => {
            const speeds = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20];
            this.playbackSpeed = speeds[e.target.value - 1];
            document.getElementById('speedValue').textContent = this.playbackSpeed.toFixed(2);
        });

        // Timeline scrubbing
        document.getElementById('timelineBar').addEventListener('click', (e) => {
            if (!this.battleData) return;

            const rect = e.target.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = clickX / rect.width;
            const targetTick = Math.floor(percent * this.battleData.totalTicks);

            this.currentTick = Math.max(0, Math.min(targetTick, this.battleData.totalTicks - 1));
            this.render();
        });

        // Zoom controls
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const oldZoom = this.zoom;
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomDelta));

            // Adjust pan to zoom towards mouse position
            const zoomRatio = this.zoom / oldZoom;
            this.panX = mouseX - (mouseX - this.panX) * zoomRatio;
            this.panY = mouseY - (mouseY - this.panY) * zoomRatio;

            this.render();
        }, { passive: false });

        // Pan controls
        this.canvas.addEventListener('mousedown', (e) => {
            this.isPanning = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;

            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;

            this.panX += deltaX;
            this.panY += deltaY;

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            this.render();
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isPanning = false;
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isPanning = false;
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.style.cursor = 'grab';

        // Reset zoom button
        document.getElementById('resetZoomBtn').addEventListener('click', () => {
            this.zoom = 1.0;
            this.panX = 0;
            this.panY = 0;
            this.render();
        });
    }

    async loadBattleFile(file) {
        if (!file) return;

        try {
            const text = await file.text();
            this.battleData = JSON.parse(text);

            console.log('Loaded battle:', this.battleData);

            // Update grid size from battle data
            if (this.battleData.metadata && this.battleData.metadata.gridSize) {
                this.gridSize = this.battleData.metadata.gridSize;
            } else if (this.battleData.terrain && this.battleData.terrain.length > 0) {
                // Infer grid size from terrain dimensions
                this.gridSize = this.battleData.terrain.length;
            }

            // Recalculate cell size to fit canvas (800x800)
            this.cellSize = Math.floor(this.canvas.width / this.gridSize);

            console.log(`Grid size: ${this.gridSize}x${this.gridSize}, Cell size: ${this.cellSize}px`);

            this.currentTick = 0;
            this.enableControls();
            this.render();
        } catch (error) {
            console.error('Failed to load battle file:', error);
            alert('Error loading battle file: ' + error.message);
        }
    }

    enableControls() {
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('resetBtn').disabled = false;
    }

    play() {
        if (!this.battleData || this.isPlaying) return;

        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.animate();
    }

    pause() {
        this.isPlaying = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    reset() {
        this.pause();
        this.currentTick = 0;
        this.effects = [];
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.render();
    }

    animate() {
        if (!this.isPlaying) return;

        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;

        // Advance ticks based on speed (aim for ~10 ticks per second at 1x speed)
        const ticksPerSecond = 10 * this.playbackSpeed;
        const msPerTick = 1000 / ticksPerSecond;

        if (deltaTime >= msPerTick) {
            this.lastFrameTime = now;

            if (this.currentTick < this.battleData.totalTicks - 1) {
                this.currentTick++;
                this.render();
            } else {
                this.pause();
            }
        }

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    render() {
        if (!this.battleData) return;

        const tickData = this.battleData.frames[this.currentTick];
        if (!tickData) return;

        // Clear canvas
        this.ctx.fillStyle = '#2a2a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Save context state
        this.ctx.save();

        // Apply zoom and pan transformations
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);

        // Draw terrain
        this.drawTerrain();

        // Draw creeps
        this.drawCreeps(tickData.creeps);

        // Draw action effects
        this.drawActionEffects(tickData.actions);

        // Restore context state
        this.ctx.restore();

        // Update UI
        this.updateUI(tickData);
    }

    drawTerrain() {
        if (!this.battleData.terrain) return;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const terrainType = this.battleData.terrain[y]?.[x] || 0;

                if (terrainType === 2) { // Swamp
                    this.ctx.fillStyle = '#3a4a3f';
                } else { // Plain
                    this.ctx.fillStyle = '#33333a';
                }

                this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);

                // Grid lines
                this.ctx.strokeStyle = '#2a2a2e';
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            }
        }
    }

    drawCreeps(creeps) {
        for (const creep of creeps) {
            const x = creep.x * this.cellSize;
            const y = creep.y * this.cellSize;
            const isDead = creep.hits <= 0;

            if (isDead) {
                // Dead creep - dark gray with X marker
                this.ctx.fillStyle = '#2a2a2e';
                this.ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);

                // Dark border
                this.ctx.strokeStyle = '#1e1e22';
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);

                // Draw X symbol if cell is large enough
                if (this.cellSize >= 16) {
                    this.ctx.fillStyle = '#555';
                    this.ctx.font = 'bold 14px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('✕', x + this.cellSize / 2, y + this.cellSize / 2);
                }
            } else {
                // Alive creep - normal colors
                this.ctx.fillStyle = creep.my ? '#67c2a1' : '#e27c79';
                this.ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);

                // Border
                this.ctx.strokeStyle = creep.my ? '#4f9f81' : '#c45f5c';
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);

                // Health bar
                const healthPercent = creep.hits / creep.hitsMax;
                const barWidth = this.cellSize - 4;
                const barHeight = 3;

                // Background
                this.ctx.fillStyle = '#1e1e22';
                this.ctx.fillRect(x + 2, y + this.cellSize - barHeight - 2, barWidth, barHeight);

                // Health
                if (healthPercent > 0.6) {
                    this.ctx.fillStyle = '#67c2a1';
                } else if (healthPercent > 0.3) {
                    this.ctx.fillStyle = '#e8c770';
                } else {
                    this.ctx.fillStyle = '#e27c79';
                }
                this.ctx.fillRect(x + 2, y + this.cellSize - barHeight - 2, barWidth * healthPercent, barHeight);

                // Creep name
                if (this.cellSize >= 16) {
                    this.ctx.fillStyle = '#1e1e22';
                    this.ctx.font = 'bold 8px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    const displayName = creep.name.length > 8 ? creep.name.slice(0, 8) : creep.name;
                    this.ctx.fillText(displayName, x + this.cellSize / 2, y + this.cellSize / 2);
                }
            }
        }
    }

    drawActionEffects(actions) {
        if (!actions) return;

        for (const action of actions) {
            if (action.type === 'attack' || action.type === 'rangedAttack') {
                this.drawAttackLine(action.from, action.to);
            } else if (action.type === 'heal' || action.type === 'rangedHeal') {
                this.drawHealLine(action.from, action.to);
            }
        }
    }

    drawAttackLine(from, to) {
        const x1 = from.x * this.cellSize + this.cellSize / 2;
        const y1 = from.y * this.cellSize + this.cellSize / 2;
        const x2 = to.x * this.cellSize + this.cellSize / 2;
        const y2 = to.y * this.cellSize + this.cellSize / 2;

        this.ctx.strokeStyle = '#e8c770';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.6;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    drawHealLine(from, to) {
        const x1 = from.x * this.cellSize + this.cellSize / 2;
        const y1 = from.y * this.cellSize + this.cellSize / 2;
        const x2 = to.x * this.cellSize + this.cellSize / 2;
        const y2 = to.y * this.cellSize + this.cellSize / 2;

        this.ctx.strokeStyle = '#8bb8e8';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.6;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    updateUI(tickData) {
        // Timeline
        const progress = (this.currentTick / (this.battleData.totalTicks - 1)) * 100;
        document.getElementById('timelineProgress').style.width = progress + '%';
        document.getElementById('timelineText').textContent =
            `Tick ${this.currentTick} / ${this.battleData.totalTicks}`;

        // Player stats
        const playerCreeps = tickData.creeps.filter(c => c.my);
        const playerAlive = playerCreeps.filter(c => c.hits > 0).length;
        const playerDamage = playerCreeps.reduce((sum, c) => sum + c.damageDealt, 0);
        const playerHealing = playerCreeps.reduce((sum, c) => sum + c.healingDone, 0);

        document.getElementById('playerAlive').textContent = playerAlive;
        document.getElementById('playerDamage').textContent = Math.round(playerDamage);
        document.getElementById('playerHealing').textContent = Math.round(playerHealing);

        // Enemy stats
        const enemyCreeps = tickData.creeps.filter(c => !c.my);
        const enemyAlive = enemyCreeps.filter(c => c.hits > 0).length;
        const enemyDamage = enemyCreeps.reduce((sum, c) => sum + c.damageDealt, 0);
        const enemyHealing = enemyCreeps.reduce((sum, c) => sum + c.healingDone, 0);

        document.getElementById('enemyAlive').textContent = enemyAlive;
        document.getElementById('enemyDamage').textContent = Math.round(enemyDamage);
        document.getElementById('enemyHealing').textContent = Math.round(enemyHealing);
    }
}

// Initialize visualizer when page loads
window.addEventListener('DOMContentLoaded', () => {
    const visualizer = new BattleVisualizer('battleCanvas');
    console.log('Battle Visualizer initialized');
});
