/**
 * Combat Engine - Simulates battles between squads
 */

import { MockCreep } from './creep.mjs';
import { Terrain } from './terrain.mjs';

export class CombatEngine {
    /**
     * Create combat engine
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
        this.maxTicks = config.maxTicks || 1000;
        this.terrain = config.terrain || new Terrain(100, 100, 'swamp');
        this.verbose = config.verbose || false;
        this.recordBattle = config.recordBattle || false;

        this.reset();
    }

    /**
     * Reset engine state
     */
    reset() {
        this.creeps = [];
        this.tick = 0;
        this.battleLog = [];
        this.occupiedTiles = new Map(); // "x,y" -> creep
        this.recording = {
            frames: [],
            terrain: null,
            metadata: {}
        };
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
            this.reset();
            setupFunction(this);
            results.push(this.runBattle());
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
}
