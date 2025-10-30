/**
 * Combat Engine - Simulates battles between squads
 */

import { MockCreep } from './creep.mjs';
import { Terrain } from './terrain.mjs';

const DEFAULT_SPAWN_JITTER = {
    radius: 2,
    attempts: 12,
    perUnitRadius: 1,
    perUnitAttempts: 4,
    allowZeroOffset: true,
    preserveFormation: true
};

const DEFAULT_RANDOM_WALLS = {
    count: 6,
    margin: 8,
    minDistance: 3,
    attempts: 30
};

const DEFAULT_ENTROPY = {
    spawnJitter: DEFAULT_SPAWN_JITTER,
    randomWalls: DEFAULT_RANDOM_WALLS
};

function copySpawnJitterConfig(cfg) {
    return {
        radius: cfg.radius,
        attempts: cfg.attempts,
        perUnitRadius: cfg.perUnitRadius,
        perUnitAttempts: cfg.perUnitAttempts,
        allowZeroOffset: cfg.allowZeroOffset,
        preserveFormation: cfg.preserveFormation
    };
}

function copyRandomWallsConfig(cfg) {
    return {
        count: cfg.count,
        margin: cfg.margin,
        minDistance: cfg.minDistance,
        attempts: cfg.attempts
    };
}

function normalizeSpawnJitter(value) {
    if (value === false || value === null) {
        return null;
    }

    if (value === undefined) {
        return copySpawnJitterConfig(DEFAULT_SPAWN_JITTER);
    }

    if (value === true) {
        return copySpawnJitterConfig(DEFAULT_SPAWN_JITTER);
    }

    if (typeof value === 'number') {
        if (value <= 0) {
            return null;
        }
        return {
            radius: value,
            attempts: DEFAULT_SPAWN_JITTER.attempts,
            perUnitRadius: DEFAULT_SPAWN_JITTER.perUnitRadius,
            perUnitAttempts: DEFAULT_SPAWN_JITTER.perUnitAttempts,
            allowZeroOffset: DEFAULT_SPAWN_JITTER.allowZeroOffset,
            preserveFormation: DEFAULT_SPAWN_JITTER.preserveFormation
        };
    }

    if (typeof value !== 'object') {
        return null;
    }

    const radius = value.radius ?? value.range ?? DEFAULT_SPAWN_JITTER.radius;
    if (radius <= 0) {
        return null;
    }

    return {
        radius,
        attempts: value.attempts ?? DEFAULT_SPAWN_JITTER.attempts,
        perUnitRadius: value.perUnitRadius ?? DEFAULT_SPAWN_JITTER.perUnitRadius,
        perUnitAttempts: value.perUnitAttempts ?? DEFAULT_SPAWN_JITTER.perUnitAttempts,
        allowZeroOffset: value.allowZeroOffset !== undefined ? value.allowZeroOffset : DEFAULT_SPAWN_JITTER.allowZeroOffset,
        preserveFormation: value.preserveFormation !== undefined ? value.preserveFormation : DEFAULT_SPAWN_JITTER.preserveFormation
    };
}

function normalizeRandomWalls(value) {
    if (value === false || value === null) {
        return null;
    }

    if (value === undefined) {
        return copyRandomWallsConfig(DEFAULT_RANDOM_WALLS);
    }

    if (value === true) {
        return copyRandomWallsConfig(DEFAULT_RANDOM_WALLS);
    }

    if (typeof value === 'number') {
        if (value <= 0) {
            return null;
        }
        return {
            count: value,
            margin: DEFAULT_RANDOM_WALLS.margin,
            minDistance: DEFAULT_RANDOM_WALLS.minDistance,
            attempts: DEFAULT_RANDOM_WALLS.attempts
        };
    }

    if (typeof value !== 'object') {
        return null;
    }

    const count = value.count ?? DEFAULT_RANDOM_WALLS.count;
    if (count <= 0) {
        return null;
    }

    return {
        count,
        margin: value.margin ?? DEFAULT_RANDOM_WALLS.margin,
        minDistance: value.minDistance ?? DEFAULT_RANDOM_WALLS.minDistance,
        attempts: value.attempts ?? DEFAULT_RANDOM_WALLS.attempts
    };
}

function normalizeEntropyConfig(entropy) {
    if (entropy === false) {
        return null;
    }

    if (entropy === undefined || entropy === null) {
        return {
            spawnJitter: copySpawnJitterConfig(DEFAULT_SPAWN_JITTER),
            randomWalls: copyRandomWallsConfig(DEFAULT_RANDOM_WALLS)
        };
    }

    if (entropy === true) {
        entropy = {};
    }

    if (typeof entropy !== 'object') {
        const spawnJitter = normalizeSpawnJitter(entropy);
        return spawnJitter ? { spawnJitter, randomWalls: null } : null;
    }

    const hasSpawnSetting = Object.prototype.hasOwnProperty.call(entropy, 'spawnJitter') ||
        Object.prototype.hasOwnProperty.call(entropy, 'spawnOffset') ||
        Object.prototype.hasOwnProperty.call(entropy, 'spawn');

    const hasWallSetting = Object.prototype.hasOwnProperty.call(entropy, 'randomWalls') ||
        Object.prototype.hasOwnProperty.call(entropy, 'walls');

    const useDefaults = !hasSpawnSetting && !hasWallSetting && Object.keys(entropy).length === 0;

    const spawnSource = hasSpawnSetting
        ? (entropy.spawnJitter ?? entropy.spawnOffset ?? entropy.spawn)
        : (useDefaults ? DEFAULT_SPAWN_JITTER : undefined);

    const wallSource = hasWallSetting
        ? (entropy.randomWalls ?? entropy.walls)
        : (useDefaults ? DEFAULT_RANDOM_WALLS : undefined);

    const spawnJitter = normalizeSpawnJitter(spawnSource);
    const randomWalls = normalizeRandomWalls(wallSource);

    const result = {};
    if (spawnJitter) {
        result.spawnJitter = spawnJitter;
    }
    if (randomWalls) {
        result.randomWalls = randomWalls;
    }

    return Object.keys(result).length > 0 ? result : null;
}

function cloneTerrainInstance(terrain) {
    if (!terrain) {
        return null;
    }
    if (typeof terrain.clone === 'function') {
        return terrain.clone();
    }

    const cloned = new Terrain(terrain.width, terrain.height, 'plain');
    cloned.defaultCost = terrain.defaultCost;
    cloned.terrainMap = { ...terrain.terrainMap };
    return cloned;
}

export class CombatEngine {
    /**
     * Create combat engine
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
        this.maxTicks = config.maxTicks || 1000;
        this.randomSource = typeof config.random === 'function' ? config.random : Math.random;
        const baseTerrain = config.terrain ? cloneTerrainInstance(config.terrain) : new Terrain(100, 100, 'swamp');
        this.baseTerrain = baseTerrain;
        this.terrain = cloneTerrainInstance(this.baseTerrain);
        this.verbose = config.verbose || false;
        this.recordBattle = config.recordBattle || false;
        this.entropy = normalizeEntropyConfig(config.entropy);

        this.reset();
    }

    /**
     * Reset engine state
     */
    reset(battleContext = null) {
        this.creeps = [];
        this.tick = 0;
        this.battleLog = [];
        this.occupiedTiles = new Map(); // "x,y" -> creep
        this.recording = {
            frames: [],
            terrain: null,
            metadata: {}
        };

        this.terrain = cloneTerrainInstance(this.baseTerrain);

        if (this.entropy && this.entropy.randomWalls) {
            this.applyTerrainEntropy(battleContext);
        }
    }

    /**
     * Update occupancy map (call at start of each tick)
     */
    updateOccupancy() {
        this.occupiedTiles.clear();
        for (const creep of this.creeps) {
            if (creep.isAlive()) {
                const key = `${creep.x},${creep.y}`;
                this.occupiedTiles.set(key, creep);
            }
        }
    }

    /**
     * Check if position is occupied by another creep
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {MockCreep} ignoredCreep - Creep to ignore (e.g., self)
     * @returns {boolean} True if occupied
     */
    isOccupied(x, y, ignoredCreep = null) {
        const key = `${x},${y}`;
        const occupant = this.occupiedTiles.get(key);
        return occupant && occupant !== ignoredCreep && occupant.isAlive();
    }

    /**
     * Add creep to simulation
     * @param {MockCreep} creep - Creep to add
     */
    addCreep(creep) {
        this.creeps.push(creep);
    }

    /**
     * Get all alive creeps
     * @param {boolean} my - Filter by team (true for friendly, false for enemy, null for all)
     * @returns {MockCreep[]} Array of alive creeps
     */
    getAliveCreeps(my = null) {
        let creeps = this.creeps.filter(c => c.isAlive());

        if (my !== null) {
            creeps = creeps.filter(c => c.my === my);
        }

        return creeps;
    }

    /**
     * Find nearest enemy to a creep
     * @param {MockCreep} creep - Reference creep
     * @returns {MockCreep|null} Nearest enemy or null
     */
    findNearestEnemy(creep) {
        const enemies = this.getAliveCreeps(!creep.my);

        if (enemies.length === 0) {
            return null;
        }

        return enemies.reduce((nearest, enemy) => {
            const distToEnemy = creep.getRangeTo(enemy);
            const distToNearest = nearest ? creep.getRangeTo(nearest) : Infinity;
            return distToEnemy < distToNearest ? enemy : nearest;
        }, null);
    }

    /**
     * Find most damaged friendly creep
     * @param {MockCreep} creep - Reference creep
     * @returns {MockCreep|null} Most damaged friendly or null
     */
    findMostDamagedFriendly(creep) {
        const friendlies = this.getAliveCreeps(creep.my).filter(c => c.hits < c.hitsMax);

        if (friendlies.length === 0) {
            return null;
        }

        return friendlies.reduce((mostDamaged, friendly) => {
            return friendly.hits < mostDamaged.hits ? friendly : mostDamaged;
        });
    }

    /**
     * Find most damaged enemy (for focus fire)
     * @param {MockCreep} creep - Reference creep
     * @returns {MockCreep|null} Most damaged enemy or null
     */
    findMostDamagedEnemy(creep) {
        const enemies = this.getAliveCreeps(!creep.my);

        if (enemies.length === 0) {
            return null;
        }

        return enemies.reduce((mostDamaged, enemy) => {
            const healthPercent = enemy.hits / enemy.hitsMax;
            const nearestPercent = mostDamaged ? mostDamaged.hits / mostDamaged.hitsMax : 1;
            return healthPercent < nearestPercent ? enemy : mostDamaged;
        }, null);
    }

    /**
     * Run improved AI behavior for a creep
     * @param {MockCreep} creep - Creep to control
     * @returns {Array} Actions performed this tick
     */
    runSimpleAI(creep) {
        const actions = [];
        // Healers heal damaged friendlies
        if (creep.getActiveBodyParts('heal') > 0) {
            const damaged = this.findMostDamagedFriendly(creep);

            if (damaged) {
                const range = creep.getRangeTo(damaged);

                if (range <= 1) {
                    creep.heal(damaged);
                    actions.push({
                        type: 'heal',
                        from: { x: creep.x, y: creep.y },
                        to: { x: damaged.x, y: damaged.y }
                    });
                } else if (range <= 3) {
                    creep.rangedHeal(damaged);
                    actions.push({
                        type: 'rangedHeal',
                        from: { x: creep.x, y: creep.y },
                        to: { x: damaged.x, y: damaged.y }
                    });
                }

                // Move closer if not in optimal range
                if (range > 2) {
                    creep.moveTo(damaged, this.terrain, (x, y) => this.isOccupied(x, y, creep));
                }

                return actions; // Don't attack if healing
            }
        }

        // Attackers focus fire on weakest enemy
        const weakestEnemy = this.findMostDamagedEnemy(creep);
        const nearestEnemy = this.findNearestEnemy(creep);

        if (!nearestEnemy) {
            return actions; // No enemies left
        }

        // Choose target: focus weakest if in range, otherwise nearest
        let target = weakestEnemy;
        const rangeToWeak = target ? creep.getRangeTo(target) : Infinity;
        const rangeToNearest = creep.getRangeTo(nearestEnemy);

        // Switch to nearest if weakest is too far
        if (rangeToWeak > 5) {
            target = nearestEnemy;
        }

        const range = creep.getRangeTo(target);
        const hasRanged = creep.getActiveBodyParts('ranged_attack') > 0;
        const hasMelee = creep.getActiveBodyParts('attack') > 0;

        // Ranged units: improved kiting with aggression threshold
        if (hasRanged && !hasMelee) {
            if (range <= 3) {
                creep.rangedAttack(target);
                actions.push({
                    type: 'rangedAttack',
                    from: { x: creep.x, y: creep.y },
                    to: { x: target.x, y: target.y }
                });
            }

            // Kiting logic: retreat if healthy and enemy close, commit if enemy weak
            const healthPercent = creep.hits / creep.hitsMax;
            const enemyHealthPercent = target.hits / target.hitsMax;

            if (range <= 2 && healthPercent > 0.5) {
                // Flee from healthy enemies when you're healthy
                if (enemyHealthPercent > 0.3) {
                    const fleeX = creep.x + (creep.x - target.x);
                    const fleeY = creep.y + (creep.y - target.y);
                    creep.moveTo({ x: fleeX, y: fleeY }, this.terrain, (x, y) => this.isOccupied(x, y, creep));
                } else {
                    // Commit to finish weak enemies
                    creep.moveTo(target, this.terrain, (x, y) => this.isOccupied(x, y, creep));
                }
            } else if (range > 3) {
                // Close distance if too far
                creep.moveTo(target, this.terrain, (x, y) => this.isOccupied(x, y, creep));
            }
            // Stay at range 3 for optimal kiting (no movement)
        }
        // Melee units: close distance and attack
        else if (hasMelee) {
            if (range <= 1) {
                creep.attack(target);
                actions.push({
                    type: 'attack',
                    from: { x: creep.x, y: creep.y },
                    to: { x: target.x, y: target.y }
                });
            } else {
                creep.moveTo(target, this.terrain, (x, y) => this.isOccupied(x, y, creep));

                // Attack if we moved adjacent
                if (creep.getRangeTo(target) <= 1) {
                    creep.attack(target);
                    actions.push({
                        type: 'attack',
                        from: { x: creep.x, y: creep.y },
                        to: { x: target.x, y: target.y }
                    });
                }
            }
        }
        // Hybrid units: use ranged at distance, melee when close
        else if (hasRanged && hasMelee) {
            if (range <= 1) {
                creep.attack(target);
                actions.push({
                    type: 'attack',
                    from: { x: creep.x, y: creep.y },
                    to: { x: target.x, y: target.y }
                });
            } else if (range <= 3) {
                creep.rangedAttack(target);
                actions.push({
                    type: 'rangedAttack',
                    from: { x: creep.x, y: creep.y },
                    to: { x: target.x, y: target.y }
                });
                creep.moveTo(target, this.terrain, (x, y) => this.isOccupied(x, y, creep));
            } else {
                creep.moveTo(target, this.terrain, (x, y) => this.isOccupied(x, y, creep));
            }
        }

        return actions;
    }

    /**
     * Execute one simulation tick
     * @returns {boolean} True if battle continues, false if ended
     */
    executeTick() {
        this.tick++;

        // Reduce fatigue for all creeps
        for (const creep of this.creeps) {
            if (creep.isAlive()) {
                creep.reduceFatigue();
            }
        }

        // Update occupancy map before movement
        this.updateOccupancy();

        // Run AI for all alive creeps and collect actions
        const aliveCreeps = this.getAliveCreeps();
        const allActions = [];

        for (const creep of aliveCreeps) {
            const actions = this.runSimpleAI(creep);
            if (actions && actions.length > 0) {
                allActions.push(...actions);
            }
            // Update occupancy immediately after each creep acts to prevent stacking
            this.updateOccupancy();
        }

        // Final occupancy update (redundant but ensures consistency)
        this.updateOccupancy();

        // Record frame if recording is enabled
        if (this.recordBattle) {
            this.recordFrame(allActions);
        }

        // Check win conditions
        const friendliesAlive = this.getAliveCreeps(true).length;
        const enemiesAlive = this.getAliveCreeps(false).length;

        if (this.verbose && this.tick % 10 === 0) {
            console.log(`Tick ${this.tick}: Friendlies ${friendliesAlive}, Enemies ${enemiesAlive}`);
        }

        // Battle ends if one side is eliminated or max ticks reached
        return friendliesAlive > 0 && enemiesAlive > 0 && this.tick < this.maxTicks;
    }

    /**
     * Run complete battle simulation
     * @returns {Object} Battle results
     */
    runBattle() {
        this.tick = 0;

        while (this.executeTick()) {
            // Battle continues
        }

        return this.getBattleResults();
    }

    /**
     * Get battle results
     * @returns {Object} Results summary
     */
    getBattleResults() {
        const friendlies = this.getAliveCreeps(true);
        const enemies = this.getAliveCreeps(false);

        const winner = friendlies.length > 0 ? 'player' :
                      enemies.length > 0 ? 'enemy' : 'draw';

        const allCreeps = this.creeps;
        const friendlyStats = allCreeps.filter(c => c.my);
        const enemyStats = allCreeps.filter(c => !c.my);

        return {
            winner,
            ticks: this.tick,
            player: {
                survivors: friendlies.length,
                totalDamage: friendlyStats.reduce((sum, c) => sum + c.damageDealt, 0),
                totalHealing: friendlyStats.reduce((sum, c) => sum + c.healingDone, 0),
                creeps: friendlyStats.map(c => c.getStats())
            },
            enemy: {
                survivors: enemies.length,
                totalDamage: enemyStats.reduce((sum, c) => sum + c.damageDealt, 0),
                totalHealing: enemyStats.reduce((sum, c) => sum + c.healingDone, 0),
                creeps: enemyStats.map(c => c.getStats())
            }
        };
    }

    /**
     * Record current frame for visualization
     * @param {Array} actions - Actions performed this tick
     */
    recordFrame(actions) {
        // Initialize terrain on first frame
        if (this.recording.frames.length === 0 && this.terrain) {
            this.recording.terrain = this.terrain.toGrid();
        }

        // Record creep states
        const creepStates = this.creeps.map(creep => ({
            id: creep.id,
            name: creep.name,
            x: creep.x,
            y: creep.y,
            my: creep.my,
            hits: creep.hits,
            hitsMax: creep.hitsMax,
            damageDealt: creep.damageDealt,
            damageTaken: creep.damageTaken,
            healingDone: creep.healingDone,
            healingReceived: creep.healingReceived,
            fatigue: creep.fatigue
        }));

        this.recording.frames.push({
            tick: this.tick,
            creeps: creepStates,
            actions: actions || []
        });
    }

    /**
     * Export battle recording for visualization
     * @returns {Object} Recording data
     */
    exportRecording() {
        return {
            totalTicks: this.tick,
            terrain: this.recording.terrain,
            frames: this.recording.frames,
            metadata: {
                maxTicks: this.maxTicks,
                gridSize: this.terrain ? this.terrain.width : 100
            }
        };
    }

    /**
     * Run multiple battles and get aggregate statistics
     * @param {number} iterations - Number of battles to run
     * @param {Function} setupFunction - Function to setup creeps for each battle
     * @returns {Object} Aggregate results
     */
    runMultipleBattles(iterations, setupFunction) {
        const results = [];

        for (let i = 0; i < iterations; i++) {
            const battleContext = this.createBattleContext(i);
            this.reset(battleContext);
            const setupResult = setupFunction(this, battleContext) || {};
            this.applySpawnEntropy(battleContext, setupResult);
            const battleResult = this.runBattle();
            battleResult.context = battleContext;
            results.push(battleResult);
        }

        // Calculate aggregate statistics
        const wins = results.filter(r => r.winner === 'player').length;
        const losses = results.filter(r => r.winner === 'enemy').length;
        const draws = results.filter(r => r.winner === 'draw').length;
        const avgTicks = results.reduce((sum, r) => sum + r.ticks, 0) / iterations;

        return {
            iterations,
            wins,
            losses,
            draws,
            winRate: wins / iterations,
            avgTicks,
            battles: results
        };
    }

    createBattleContext(iteration) {
        return {
            iteration,
            terrainMutations: null,
            spawnOffsets: null,
            perUnitJitter: null
        };
    }

    applyTerrainEntropy(battleContext) {
        const config = this.entropy?.randomWalls;
        if (!config) {
            return;
        }

        const { count, margin, minDistance, attempts } = config;
        const placedWalls = [];

        const minX = Math.max(0, margin);
        const maxX = Math.min(this.terrain.width - 1, this.terrain.width - margin - 1);
        const minY = Math.max(0, margin);
        const maxY = Math.min(this.terrain.height - 1, this.terrain.height - margin - 1);

        if (maxX < minX || maxY < minY) {
            return;
        }

        for (let i = 0; i < count; i++) {
            let placed = false;

            for (let attempt = 0; attempt < attempts; attempt++) {
                const x = this.randomInt(minX, maxX);
                const y = this.randomInt(minY, maxY);

                if (!this.terrain.isWalkable(x, y)) {
                    continue;
                }

                let tooClose = false;
                for (const wall of placedWalls) {
                    if (Math.abs(wall.x - x) + Math.abs(wall.y - y) <= minDistance) {
                        tooClose = true;
                        break;
                    }
                }

                if (tooClose) {
                    continue;
                }

                this.terrain.setTerrain(x, y, 'wall');
                placedWalls.push({ x, y });
                placed = true;
                break;
            }

            if (!placed) {
                break;
            }
        }

        if (battleContext) {
            battleContext.terrainMutations = battleContext.terrainMutations || {};
            battleContext.terrainMutations.walls = placedWalls;
        }
    }

    applySpawnEntropy(battleContext, setupResult = {}) {
        const config = this.entropy?.spawnJitter;
        if (!config) {
            return;
        }

        const offsetsFromSetup = setupResult.spawnOffsets || {};
        const existingOffsets = battleContext?.spawnOffsets || {};

        const occupied = new Set();
        for (const creep of this.creeps) {
            occupied.add(`${creep.x},${creep.y}`);
        }

        const offsets = {
            player: { dx: 0, dy: 0 },
            enemy: { dx: 0, dy: 0 }
        };

        const applyForTeam = (teamFlag, label) => {
            const creeps = this.creeps.filter(c => c.my === teamFlag);
            if (creeps.length === 0) {
                return;
            }

            for (const creep of creeps) {
                occupied.delete(`${creep.x},${creep.y}`);
            }

            const preferred = offsetsFromSetup[label] ?? existingOffsets[label];
            const resolved = this.resolveGroupOffsetWithFallback(creeps, occupied, config, preferred);

            if (resolved.dx !== 0 || resolved.dy !== 0) {
                for (const creep of creeps) {
                    creep.x += resolved.dx;
                    creep.y += resolved.dy;
                }
            }

            for (const creep of creeps) {
                occupied.add(`${creep.x},${creep.y}`);
            }

            offsets[label] = resolved;
        };

        applyForTeam(true, 'player');
        applyForTeam(false, 'enemy');

        let perUnitLog = null;
        if (config.perUnitRadius && config.perUnitRadius > 0 && config.preserveFormation === false) {
            perUnitLog = this.applyPerUnitJitter(config, occupied);
        }

        if (battleContext) {
            battleContext.spawnOffsets = offsets;
            if (perUnitLog && perUnitLog.length > 0) {
                battleContext.perUnitJitter = perUnitLog;
            }
        }

        this.updateOccupancy();
    }

    resolveGroupOffsetWithFallback(creeps, occupied, config, preferredOffset) {
        if (preferredOffset && this.isGroupOffsetValid(creeps, occupied, preferredOffset)) {
            return {
                dx: preferredOffset.dx || 0,
                dy: preferredOffset.dy || 0
            };
        }

        return this.findGroupOffset(creeps, occupied, config);
    }

    findGroupOffset(creeps, occupied, config) {
        const radius = Math.max(0, config.radius || 0);
        const attempts = Math.max(1, config.attempts || 1);

        if (radius === 0) {
            return { dx: 0, dy: 0 };
        }

        for (let i = 0; i < attempts; i++) {
            const dx = this.randomInt(-radius, radius);
            const dy = this.randomInt(-radius, radius);

            if (dx === 0 && dy === 0) {
                continue;
            }

            if (this.isGroupOffsetValid(creeps, occupied, { dx, dy })) {
                return { dx, dy };
            }
        }

        if (config.allowZeroOffset === false) {
            for (let distance = radius; distance > 0; distance--) {
                const fallbacks = [
                    { dx: distance, dy: 0 },
                    { dx: -distance, dy: 0 },
                    { dx: 0, dy: distance },
                    { dx: 0, dy: -distance }
                ];

                for (const fallback of fallbacks) {
                    if (this.isGroupOffsetValid(creeps, occupied, fallback)) {
                        return fallback;
                    }
                }
            }
        }

        return { dx: 0, dy: 0 };
    }

    isGroupOffsetValid(creeps, occupied, offset) {
        const dx = offset?.dx || 0;
        const dy = offset?.dy || 0;

        for (const creep of creeps) {
            const nx = creep.x + dx;
            const ny = creep.y + dy;

            if (!this.isValidSpawnPosition(nx, ny, occupied)) {
                return false;
            }
        }

        return true;
    }

    applyPerUnitJitter(config, occupied) {
        const radius = Math.max(0, config.perUnitRadius || 0);
        const attempts = Math.max(1, config.perUnitAttempts || 1);
        const log = [];

        if (radius === 0) {
            return log;
        }

        const creeps = [...this.creeps];

        for (const creep of creeps) {
            if (!creep.isAlive()) {
                continue;
            }

            const originalKey = `${creep.x},${creep.y}`;
            occupied.delete(originalKey);

            let moved = false;

            for (let attempt = 0; attempt < attempts; attempt++) {
                const dx = this.randomInt(-radius, radius);
                const dy = this.randomInt(-radius, radius);

                if (dx === 0 && dy === 0) {
                    continue;
                }

                const nx = creep.x + dx;
                const ny = creep.y + dy;

                if (!this.isValidSpawnPosition(nx, ny, occupied)) {
                    continue;
                }

                creep.x = nx;
                creep.y = ny;
                log.push({ id: creep.id, dx, dy });
                moved = true;
                break;
            }

            if (!moved && config.allowZeroOffset === false) {
                const fallbackOffsets = [
                    { dx: 1, dy: 0 },
                    { dx: -1, dy: 0 },
                    { dx: 0, dy: 1 },
                    { dx: 0, dy: -1 }
                ];

                for (const fallback of fallbackOffsets) {
                    const nx = creep.x + fallback.dx;
                    const ny = creep.y + fallback.dy;

                    if (this.isValidSpawnPosition(nx, ny, occupied)) {
                        creep.x = nx;
                        creep.y = ny;
                        log.push({ id: creep.id, dx: fallback.dx, dy: fallback.dy });
                        moved = true;
                        break;
                    }
                }
            }

            occupied.add(`${creep.x},${creep.y}`);
        }

        return log;
    }

    isValidSpawnPosition(x, y, occupied) {
        if (x < 0 || y < 0 || x >= this.terrain.width || y >= this.terrain.height) {
            return false;
        }

        if (!this.terrain.isWalkable(x, y)) {
            return false;
        }

        const key = `${x},${y}`;
        return !occupied.has(key);
    }

    randomInt(min, max) {
        if (max < min) {
            const tmp = min;
            min = max;
            max = tmp;
        }

        if (max === min) {
            return min;
        }

        return Math.floor(this.randomSource() * (max - min + 1)) + min;
    }
}
