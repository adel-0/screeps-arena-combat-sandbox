/**
 * Screeps Combat Simulator Visualizer
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

        // Heatmap overlay state
        this.heatmapOverlay = null;
        this.heatmapLabel = '';
        this.heatmapStatusElement = null;

        this.setupEventListeners();
    }

    attachHeatmapStatusElement(element) {
        this.heatmapStatusElement = element || null;
        this.updateHeatmapStatus();
    }

    updateHeatmapStatus() {
        if (!this.heatmapStatusElement) {
            return;
        }

        if (this.heatmapOverlay) {
            this.heatmapStatusElement.hidden = false;
            const label = this.heatmapLabel ? `Heatmap overlay: ${this.heatmapLabel}` : 'Heatmap overlay active.';
            this.heatmapStatusElement.textContent = label;
        } else {
            this.heatmapStatusElement.hidden = true;
            this.heatmapStatusElement.textContent = 'Heatmap overlay off.';
        }
    }

    setHeatmapOverlay(overlay, label = '') {
        this.heatmapOverlay = overlay || null;
        this.heatmapLabel = overlay ? (label || 'Heatmap') : '';
        this.updateHeatmapStatus();

        // Update gridSize when showing heatmap without battle data
        if (overlay && !this.battleData) {
            this.gridSize = overlay.width || overlay.height || 100;
            this.cellSize = Math.max(1, Math.floor(this.canvas.width / this.gridSize));
        }

        if (!this.battleData && !this.heatmapOverlay) {
            this.clearCanvas();
            this.updateOverlayUI();
            return;
        }

        this.render();
    }

    clearCanvas() {
        this.ctx.fillStyle = '#2a2a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setupEventListeners() {
        // Playback controls
        document.getElementById('playBtn').addEventListener('click', () => this.play());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());

        // Speed control
        const speedSlider = document.getElementById('speedSlider');
        const speeds = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20];

        // Set initial speed from slider value
        this.playbackSpeed = speeds[speedSlider.value - 1];
        document.getElementById('speedValue').textContent = this.playbackSpeed.toFixed(2);

        speedSlider.addEventListener('input', (e) => {
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

            if (this.battleData.metadata && this.battleData.metadata.gridSize) {
                this.gridSize = this.battleData.metadata.gridSize;
            } else if (this.battleData.terrain && this.battleData.terrain.length > 0) {
                this.gridSize = this.battleData.terrain.length;
            }

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

    loadBattleData(data) {
        if (!data) {
            return;
        }

        try {
            this.battleData = data;

            if (this.battleData.metadata && this.battleData.metadata.gridSize) {
                this.gridSize = this.battleData.metadata.gridSize;
            } else if (this.battleData.terrain && this.battleData.terrain.length > 0) {
                this.gridSize = this.battleData.terrain.length;
            }

            this.cellSize = Math.max(1, Math.floor(this.canvas.width / this.gridSize));
            this.currentTick = 0;
            this.enableControls();
            this.render();
            console.log('Loaded battle data from simulation result');
        } catch (error) {
            console.error('Failed to load battle data:', error);
        }
    }
    enableControls() {
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('resetBtn').disabled = false;
    }

    disableControls() {
        document.getElementById('playBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('resetBtn').disabled = true;
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
        const hasBattle = Boolean(this.battleData && Array.isArray(this.battleData.frames));
        const hasHeatmap = Boolean(this.heatmapOverlay);

        if (!hasBattle && !hasHeatmap) {
            this.clearCanvas();
            this.updateOverlayUI();
            return;
        }

        const tickData = hasBattle ? this.battleData.frames[this.currentTick] : null;
        if (hasBattle && !tickData) {
            return;
        }

        this.clearCanvas();

        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);

        const overlayWidth = this.heatmapOverlay?.width || this.gridSize;
        const overlayHeight = this.heatmapOverlay?.height || this.gridSize;
        const activeWidth = hasBattle ? this.gridSize : overlayWidth;
        const activeHeight = hasBattle ? this.gridSize : overlayHeight;
        const effectiveWidth = Math.max(1, activeWidth);
        const effectiveHeight = Math.max(1, activeHeight);
        const baseCellSize = hasBattle
            ? this.cellSize
            : Math.max(1, Math.floor(this.canvas.width / effectiveWidth));

        if (hasBattle) {
            this.drawTerrain();
        } else {
            this.drawBaseGrid(effectiveWidth, effectiveHeight, baseCellSize);
        }

        if (hasHeatmap) {
            this.drawHeatmapOverlay(effectiveWidth, effectiveHeight, baseCellSize);
        }

        if (hasBattle && tickData) {
            this.drawCreeps(tickData.creeps);
            this.drawActionEffects(tickData.actions);
        }

        this.ctx.restore();

        if (hasBattle && tickData) {
            this.updateUI(tickData);
        } else {
            this.updateOverlayUI();
        }
    }

    drawBaseGrid(width, height, cellSize) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.ctx.fillStyle = '#33333a';
                this.ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

                this.ctx.strokeStyle = '#2a2a2e';
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    drawHeatmapOverlay(activeWidth, activeHeight, baseCellSize) {
        if (!this.heatmapOverlay) {
            return;
        }

        const overlayWidth = Math.max(1, this.heatmapOverlay.width || activeWidth);
        const overlayHeight = Math.max(1, this.heatmapOverlay.height || activeHeight);
        const totalWidth = baseCellSize * activeWidth;
        const totalHeight = baseCellSize * activeHeight;
        const cellWidth = totalWidth / overlayWidth;
        const cellHeight = totalHeight / overlayHeight;

        const playerMatrix = this.heatmapOverlay.player?.matrix || [];
        const enemyMatrix = this.heatmapOverlay.enemy?.matrix || [];
        const playerMax = this.heatmapOverlay.player?.max || 0;
        const enemyMax = this.heatmapOverlay.enemy?.max || 0;

        const playerColor = [103, 194, 161];
        const enemyColor = [226, 124, 121];
        const maxAlpha = 0.65;

        for (let y = 0; y < overlayHeight; y++) {
            for (let x = 0; x < overlayWidth; x++) {
                const playerValue = playerMatrix[y]?.[x] || 0;
                const enemyValue = enemyMatrix[y]?.[x] || 0;

                const playerIntensity = playerMax > 0 ? playerValue / playerMax : 0;
                const enemyIntensity = enemyMax > 0 ? enemyValue / enemyMax : 0;

                if (playerIntensity <= 0 && enemyIntensity <= 0) {
                    continue;
                }

                const rectX = x * cellWidth;
                const rectY = y * cellHeight;

                if (playerIntensity > 0) {
                    const alpha = Math.min(1, playerIntensity) * maxAlpha;
                    this.ctx.fillStyle = `rgba(${playerColor[0]}, ${playerColor[1]}, ${playerColor[2]}, ${alpha})`;
                    this.ctx.fillRect(rectX, rectY, cellWidth, cellHeight);
                }

                if (enemyIntensity > 0) {
                    const alpha = Math.min(1, enemyIntensity) * maxAlpha;
                    this.ctx.fillStyle = `rgba(${enemyColor[0]}, ${enemyColor[1]}, ${enemyColor[2]}, ${alpha})`;
                    this.ctx.fillRect(rectX, rectY, cellWidth, cellHeight);
                }
            }
        }
    }

    drawTerrain() {
        if (!this.battleData.terrain) return;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const terrainType = this.battleData.terrain[y]?.[x] || 0;

                if (terrainType === 1) { // Wall
                    this.ctx.fillStyle = '#555555';
                } else if (terrainType === 2) { // Swamp
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
        // Dead creeps are not included in the recording (they disappear in Screeps Arena)
        for (const creep of creeps) {
            const x = creep.x * this.cellSize;
            const y = creep.y * this.cellSize;

            // Creep body
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

    updateOverlayUI() {
        const progressBar = document.getElementById('timelineProgress');
        if (progressBar) {
            progressBar.style.width = '0%';
        }

        const timelineText = document.getElementById('timelineText');
        if (timelineText) {
            if (this.heatmapOverlay) {
                const label = this.heatmapLabel ? `Heatmap overlay: ${this.heatmapLabel}` : 'Heatmap overlay active';
                timelineText.textContent = label;
            } else {
                timelineText.textContent = 'No playback loaded';
            }
        }

        const statIds = ['playerAlive', 'playerDamage', 'playerHealing', 'enemyAlive', 'enemyDamage', 'enemyHealing'];
        statIds.forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '-';
            }
        });
    }
}

function setupSimulationUI(visualizer) {
    const form = document.getElementById('simulationForm');
    if (!form) {
        return;
    }

    const modeSelect = document.getElementById('simMode');
    const battlesInput = document.getElementById('simBattles');
    const compositionsInput = document.getElementById('simCompositions');
    const scenarioSelect = document.getElementById('simScenario');
    const entropyCheckbox = document.getElementById('simEntropy');
    const recordCheckbox = document.getElementById('simRecord');
    const statusText = document.getElementById('simStatus');
    const heatmapStatus = document.getElementById('heatmapStatus');
    const scenarioRow = document.getElementById('scenarioRow');
    const compositionsRow = document.getElementById('compositionsRow');

    visualizer.attachHeatmapStatusElement(heatmapStatus);

    const baseStatusColor = statusText ? window.getComputedStyle(statusText).color : '#8bb8e8';

    const setStatus = (message, isError = false) => {
        if (!statusText) {
            return;
        }
        statusText.textContent = message || '';
        statusText.style.color = isError ? '#e27c79' : baseStatusColor;
    };

    const updateVisibility = () => {
        const mode = modeSelect.value;

        if (scenarioRow) {
            scenarioRow.style.display = mode === 'predefined' ? 'flex' : 'none';
        }

        if (compositionsRow) {
            compositionsRow.style.display = mode === 'elo' ? 'flex' : 'none';
        }
    };

    if (modeSelect) {
        modeSelect.addEventListener('change', updateVisibility);
    }
    updateVisibility();

    const highlightSelection = (selectedIndex) => {
        if (!resultsSummary) {
            return;
        }
        const nodes = resultsSummary.querySelectorAll('.results-run');
        nodes.forEach((node, index) => {
            const isSelected = index === selectedIndex;
            node.classList.toggle('selected', isSelected);
        });
    };

    const renderResults = (result) => {
        // Simplified: we only show recordings now, not simulation results
        return;

        const fragments = [];
        let availableRuns = [];

        if (result.mode === 'elo') {
            const leaderboard = result.leaderboard || [];
            if (leaderboard.length === 0) {
                fragments.push('<span>No leaderboard data returned.</span>');
            } else {
                let table = '<div class="results-run"><h4>ELO Leaderboard</h4>';
                table += '<table class="results-table"><thead><tr><th>Rank</th><th>Composition</th><th>Rating</th><th>W-L-D</th><th>Win%</th><th>Avg Dmg</th><th>Avg Heal</th><th>Avg Ticks</th></tr></thead><tbody>';
                leaderboard.forEach((entry, index) => {
                    table += `<tr><td>${index + 1}</td><td>${entry.id}</td><td>${entry.rating}</td><td>${entry.wins}-${entry.losses}-${entry.draws}</td><td>${entry.winRate}</td><td>${entry.avgDamage}</td><td>${entry.avgHealing}</td><td>${entry.avgTicks}</td></tr>`;
                });
                table += '</tbody></table>';
                if (typeof result.matchups === 'number') {
                    table += `<p>Matchups simulated: ${result.matchups}</p>`;
                }
                table += '</div>';
                fragments.push(table);
            }
        } else if (Array.isArray(result.runs) && result.runs.length > 0) {
            result.runs.forEach((run, index) => {
                const summary = run.summary;
                const iterations = summary.iterations || 0;
                const winPercent = (summary.winRate * 100).toFixed(1);
                const lossPercent = iterations > 0 ? ((summary.losses / iterations) * 100).toFixed(1) : '0.0';
                const drawPercent = iterations > 0 ? ((summary.draws / iterations) * 100).toFixed(1) : '0.0';

                let block = `<div class="results-run" data-index="${index}">`;
                block += `<h4>${run.label}</h4>`;
                if (typeof run.playerCost === 'number' && typeof run.enemyCost === 'number') {
                    block += `<p><strong>Energy:</strong> Player ${run.playerCost} • Enemy ${run.enemyCost}</p>`;
                }
                block += `<p><strong>Wins:</strong> ${summary.wins} (${winPercent}%) • Losses: ${summary.losses} (${lossPercent}%) • Draws: ${summary.draws} (${drawPercent}%)</p>`;
                block += `<p><strong>Avg Ticks:</strong> ${summary.avgTicks.toFixed(1)}</p>`;
                block += `<p><strong>Player</strong> dmg ${summary.player.avgDamage.toFixed(1)} | heal ${summary.player.avgHealing.toFixed(1)} | survivors ${summary.player.avgSurvivors.toFixed(1)}</p>`;
                block += `<p><strong>Enemy</strong> dmg ${summary.enemy.avgDamage.toFixed(1)} | heal ${summary.enemy.avgHealing.toFixed(1)} | survivors ${summary.enemy.avgSurvivors.toFixed(1)}</p>`;
                if (run.heatmap) {
                    block += '<p class="results-note">Heatmap overlay available; click to activate.</p>';
                }
                block += '</div>';
                fragments.push(block);
            });
            availableRuns = result.runs;
        } else {
            fragments.push('<span>No runs returned.</span>');
        }

        resultsSummary.innerHTML = fragments.join('');

        if (availableRuns.length === 0) {
            visualizer.setHeatmapOverlay(null);
            highlightSelection(-1);
            return;
        }

        const nodes = resultsSummary.querySelectorAll('.results-run');

        availableRuns.forEach((run, index) => {
            const node = nodes[index];
            if (!node) {
                return;
            }

            node.classList.add('interactive');
            node.classList.toggle('has-heatmap', Boolean(run.heatmap));

            node.addEventListener('click', () => {
                highlightSelection(index);

                if (run.heatmap) {
                    // Clear battle data when showing heatmap
                    visualizer.battleData = null;
                    visualizer.disableControls();
                    visualizer.setHeatmapOverlay(run.heatmap, run.label);
                } else {
                    visualizer.setHeatmapOverlay(null);
                }

                if (run.recording) {
                    visualizer.setHeatmapOverlay(null);
                    visualizer.loadBattleData(run.recording);
                }
            });
        });

        // Don't auto-select any result - user must click to view
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }

        setStatus('Running simulation...');

        const payload = {
            mode: modeSelect.value,
            battles: battlesInput.value ? Number(battlesInput.value) : undefined,
            compositions: compositionsInput.value ? Number(compositionsInput.value) : undefined,
            scenario: modeSelect.value === 'predefined' ? scenarioSelect.value : undefined,
            entropy: entropyCheckbox.checked,
            record: recordCheckbox.checked,
            heatmap: false  // Heatmaps are now generated from recordings
        };

        if (payload.mode !== 'elo') {
            delete payload.compositions;
        }

        if (payload.mode !== 'predefined') {
            delete payload.scenario;
        }

        try {
            const response = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await response.json();

            if (!response.ok || !json.ok) {
                throw new Error(json.error || 'Simulation failed');
            }

            const result = json.result;
            renderResults(result);

            // If recording was saved, refresh the recordings list
            if (recordCheckbox.checked && json.savedRecording) {
                setStatus(`Simulation complete. Recording saved as: ${json.savedRecording}`);
                // Refresh recordings list after a short delay to ensure file is written
                setTimeout(() => {
                    const refreshBtn = document.getElementById('refreshRecordingsBtn');
                    if (refreshBtn) refreshBtn.click();
                }, 100);
            } else {
                setStatus('Simulation complete.');
            }
        } catch (error) {
            console.error('Simulation request failed:', error);
            setStatus(`Error: ${error.message}`, true);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}

// Recordings management
async function loadRecordingsList() {
    try {
        const response = await fetch('/api/recordings');
        const json = await response.json();

        if (!response.ok || !json.ok) {
            throw new Error(json.error || 'Failed to load recordings');
        }

        return json.recordings || [];
    } catch (error) {
        console.error('Failed to load recordings list:', error);
        return [];
    }
}

function renderRecordingsList(recordings, visualizer) {
    const container = document.getElementById('recordingsList');

    if (!recordings || recordings.length === 0) {
        container.innerHTML = '<span>No recordings available.</span>';
        return;
    }

    container.innerHTML = '';

    recordings.forEach(recording => {
        const item = document.createElement('div');
        item.className = 'recording-item';

        const date = new Date(recording.modified);
        const dateStr = date.toLocaleString();

        item.innerHTML = `
            <h4>${recording.filename}</h4>
            <p>${dateStr} • ${(recording.size / 1024).toFixed(1)} KB</p>
            <div class="button-group">
                <button class="load-recording-btn" data-filename="${recording.filename}">Load</button>
                <button class="view-heatmap-btn" data-filename="${recording.filename}">Per-Battle</button>
                <button class="view-agg-heatmap-btn" data-filename="${recording.filename}">Aggregated</button>
                <button class="delete-btn" data-filename="${recording.filename}">Delete</button>
            </div>
        `;

        container.appendChild(item);
    });

    // Add event listeners for load buttons
    container.querySelectorAll('.load-recording-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const filename = e.target.dataset.filename;
            await loadRecordingFromFile(filename, visualizer, 0);
        });
    });

    // Add event listeners for per-battle heatmap buttons
    container.querySelectorAll('.view-heatmap-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const filename = e.target.dataset.filename;
            await loadHeatmapFromFile(filename, visualizer, 0, false);
        });
    });

    // Add event listeners for aggregated heatmap buttons
    container.querySelectorAll('.view-agg-heatmap-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const filename = e.target.dataset.filename;
            await loadHeatmapFromFile(filename, visualizer, null, true);
        });
    });

    // Add event listeners for delete buttons
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const filename = e.target.dataset.filename;
            await deleteRecording(filename, visualizer);
        });
    });
}

let currentRecordingFile = null;
let currentRecordingTotalBattles = 0;

async function loadRecordingFromFile(filename, visualizer, battleIndex = 0) {
    try {
        const url = `/api/recordings/${encodeURIComponent(filename)}${battleIndex ? `?battle=${battleIndex}` : ''}`;
        const response = await fetch(url);
        const json = await response.json();

        if (!response.ok || !json.ok) {
            throw new Error(json.error || 'Failed to load recording');
        }

        // Store current recording info
        currentRecordingFile = filename;
        currentRecordingTotalBattles = json.totalBattles || 1;

        // Clear heatmap overlay when loading a recording
        visualizer.setHeatmapOverlay(null);
        visualizer.loadBattleData(json.recording);

        // Show battle selector if there are multiple battles
        if (currentRecordingTotalBattles > 1) {
            showBattleSelector(visualizer, json.battleIndex || 0);
        } else {
            hideBattleSelector();
        }

        console.log(`Loaded recording: ${filename} (Battle ${(json.battleIndex || 0) + 1}/${currentRecordingTotalBattles})`);
    } catch (error) {
        console.error('Failed to load recording:', error);
        alert(`Failed to load recording: ${error.message}`);
    }
}

function showBattleSelector(visualizer, currentIndex) {
    let selector = document.getElementById('battleSelector');
    if (!selector) {
        // Create battle selector
        const timeline = document.querySelector('.timeline');
        selector = document.createElement('div');
        selector.id = 'battleSelector';
        selector.style.marginTop = '12px';
        selector.innerHTML = `
            <label style="font-size: 12px; color: #b8bbbf; display: block; margin-bottom: 6px;">
                Select Battle:
            </label>
            <select id="battleSelect" style="width: 100%; background: #2a2a2e; border: 1px solid #4a4a52; border-radius: 4px; padding: 8px; color: #c5c8c6; font-size: 13px;">
            </select>
        `;
        timeline.appendChild(selector);

        // Add change listener
        document.getElementById('battleSelect').addEventListener('change', (e) => {
            const newIndex = parseInt(e.target.value, 10);
            loadRecordingFromFile(currentRecordingFile, visualizer, newIndex);
        });
    }

    // Update options
    const select = document.getElementById('battleSelect');
    select.innerHTML = '';
    for (let i = 0; i < currentRecordingTotalBattles; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Battle ${i + 1}`;
        option.selected = i === currentIndex;
        select.appendChild(option);
    }

    selector.style.display = 'block';
}

function hideBattleSelector() {
    const selector = document.getElementById('battleSelector');
    if (selector) {
        selector.style.display = 'none';
    }
}

async function loadHeatmapFromFile(filename, visualizer, battleIndex = 0, aggregated = false) {
    try {
        let url = `/api/heatmap/${encodeURIComponent(filename)}`;
        const params = [];

        if (aggregated) {
            params.push('aggregated=true');
        } else if (battleIndex !== null) {
            params.push(`battle=${battleIndex}`);
        }

        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        const response = await fetch(url);
        const json = await response.json();

        if (!response.ok || !json.ok) {
            throw new Error(json.error || 'Failed to load heatmap');
        }

        // Clear battle data and show heatmap only
        visualizer.battleData = null;
        visualizer.disableControls();
        hideBattleSelector();

        const label = aggregated
            ? `Aggregated Heatmap: ${filename}`
            : `Battle ${battleIndex + 1} Heatmap: ${filename}`;

        visualizer.setHeatmapOverlay(json.heatmap, label);
        console.log(`Loaded heatmap for: ${filename} (${aggregated ? 'aggregated' : `battle ${battleIndex + 1}`})`);
    } catch (error) {
        console.error('Failed to load heatmap:', error);
        alert(`Failed to load heatmap: ${error.message}`);
    }
}

async function loadAggregatedHeatmap(visualizer) {
    try {
        const response = await fetch('/api/heatmap/aggregated');
        const json = await response.json();

        if (!response.ok || !json.ok) {
            throw new Error(json.error || 'Failed to load aggregated heatmap');
        }

        // Clear battle data and show heatmap only
        visualizer.battleData = null;
        visualizer.disableControls();
        visualizer.setHeatmapOverlay(json.heatmap, `Aggregated Heatmap (${json.heatmap.recordingsCount} recordings)`);
        console.log('Loaded aggregated heatmap');
    } catch (error) {
        console.error('Failed to load aggregated heatmap:', error);
        alert(`Failed to load aggregated heatmap: ${error.message}`);
    }
}

async function deleteRecording(filename, visualizer) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/recordings/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        const json = await response.json();

        if (!response.ok || !json.ok) {
            throw new Error(json.error || 'Failed to delete recording');
        }

        console.log(`Deleted recording: ${filename}`);

        // Refresh the recordings list
        const recordings = await loadRecordingsList();
        renderRecordingsList(recordings, visualizer);

        // Clear visualizer if the deleted recording was being displayed
        if (visualizer.battleData) {
            visualizer.battleData = null;
            visualizer.disableControls();
            visualizer.clearCanvas();
        }
    } catch (error) {
        console.error('Failed to delete recording:', error);
        alert(`Failed to delete recording: ${error.message}`);
    }
}

function setupRecordingsUI(visualizer) {
    const refreshBtn = document.getElementById('refreshRecordingsBtn');
    const aggregatedBtn = document.getElementById('viewAggregatedHeatmapBtn');

    // Initial load
    loadRecordingsList().then(recordings => {
        renderRecordingsList(recordings, visualizer);
    });

    // Refresh button
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Loading...';

        const recordings = await loadRecordingsList();
        renderRecordingsList(recordings, visualizer);

        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Recordings';
    });

    // Aggregated heatmap button
    if (aggregatedBtn) {
        aggregatedBtn.addEventListener('click', async () => {
            aggregatedBtn.disabled = true;
            aggregatedBtn.textContent = 'Loading...';

            await loadAggregatedHeatmap(visualizer);

            aggregatedBtn.disabled = false;
            aggregatedBtn.textContent = 'View Aggregated Heatmap';
        });
    }
}

// Initialize visualizer when page loads
window.addEventListener('DOMContentLoaded', () => {
    const visualizer = new BattleVisualizer('battleCanvas');
    setupSimulationUI(visualizer);
    setupRecordingsUI(visualizer);
    console.log('Battle Visualizer initialized');
});
