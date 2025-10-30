/**
 * MockCreep - Simulated Screeps Arena Creep
 */

import {
    ATTACK, RANGED_ATTACK, HEAL, MOVE, TOUGH, CARRY, WORK,
    ATTACK_POWER, RANGED_ATTACK_POWER, HEAL_POWER, RANGED_HEAL_POWER,
    RANGED_ATTACK_DISTANCE_RATE, BODYPART_HITS,
    OK, ERR_NOT_IN_RANGE, ERR_INVALID_TARGET, ERR_NO_BODYPART,
    ATTACK_RANGE, RANGED_ATTACK_RANGE, HEAL_RANGE, RANGED_HEAL_RANGE
} from './constants.mjs';

export class MockCreep {
    /**
     * Create a mock creep
     * @param {string} id - Unique identifier
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string[]} bodyArray - Array of body part types
     * @param {boolean} my - Whether this is a friendly creep
     * @param {string} name - Creep name (optional)
     */
    constructor(id, x, y, bodyArray, my = true, name = null) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.my = my;
        this.name = name || id;

        // Body parts: array of { type, hits }
        this.body = bodyArray.map(type => ({
            type,
            hits: BODYPART_HITS
        }));

        this.hitsMax = this.body.length * BODYPART_HITS;
        this.hits = this.hitsMax;

        // Store system (simplified)
        this.store = {
            energy: 0
        };

        // Movement
        this.fatigue = 0;

        // Combat tracking
        this.damageTaken = 0;
        this.damageDealt = 0;
        this.healingDone = 0;
        this.healingReceived = 0;
    }

    /**
     * Calculate range to target using Chebyshev distance
     * @param {Object} target - Target with x, y coordinates
     * @returns {number} Range to target
     */
    getRangeTo(target) {
        return Math.max(Math.abs(this.x - target.x), Math.abs(this.y - target.y));
    }

    /**
     * Get linear distance to target
     * @param {Object} target - Target with x, y coordinates
     * @returns {number} Linear distance
     */
    getLinearDistance(target) {
        const dx = this.x - target.x;
        const dy = this.y - target.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Count functional body parts of a specific type
     * @param {string} type - Body part type
     * @returns {number} Number of functional parts
     */
    getActiveBodyParts(type) {
        return this.body.filter(part => part.type === type && part.hits > 0).length;
    }

    /**
     * Apply damage to creep (damages body parts from front to back)
     * @param {number} damage - Amount of damage to apply
     */
    applyDamage(damage) {
        let remainingDamage = damage;

        for (let i = 0; i < this.body.length && remainingDamage > 0; i++) {
            const part = this.body[i];

            if (part.hits > 0) {
                const damageToThisPart = Math.min(part.hits, remainingDamage);
                part.hits -= damageToThisPart;
                remainingDamage -= damageToThisPart;
            }
        }

        // Update total hits
        this.hits = this.body.reduce((sum, part) => sum + part.hits, 0);
        this.damageTaken += damage;
    }

    /**
     * Apply healing to creep (heals body parts from front to back)
     * @param {number} healing - Amount of healing to apply
     */
    applyHealing(healing) {
        let remainingHealing = healing;

        for (let i = 0; i < this.body.length && remainingHealing > 0; i++) {
            const part = this.body[i];

            if (part.hits < BODYPART_HITS) {
                const healingForThisPart = Math.min(BODYPART_HITS - part.hits, remainingHealing);
                part.hits += healingForThisPart;
                remainingHealing -= healingForThisPart;
            }
        }

        // Update total hits
        this.hits = this.body.reduce((sum, part) => sum + part.hits, 0);
        this.healingReceived += healing;
    }

    /**
     * Check if creep is alive
     * @returns {boolean} True if creep has hits remaining
     */
    isAlive() {
        return this.hits > 0;
    }

    /**
     * Melee attack target
     * @param {MockCreep} target - Target creep
     * @returns {number} OK or error code
     */
    attack(target) {
        if (!target || !target.isAlive()) {
            return ERR_INVALID_TARGET;
        }

        const range = this.getRangeTo(target);
        if (range > ATTACK_RANGE) {
            return ERR_NOT_IN_RANGE;
        }

        const attackParts = this.getActiveBodyParts(ATTACK);
        if (attackParts === 0) {
            return ERR_NO_BODYPART;
        }

        const damage = attackParts * ATTACK_POWER;
        target.applyDamage(damage);
        this.damageDealt += damage;

        return OK;
    }

    /**
     * Ranged attack target
     * @param {MockCreep} target - Target creep
     * @returns {number} OK or error code
     */
    rangedAttack(target) {
        if (!target || !target.isAlive()) {
            return ERR_INVALID_TARGET;
        }

        const range = this.getRangeTo(target);
        if (range > RANGED_ATTACK_RANGE) {
            return ERR_NOT_IN_RANGE;
        }

        const rangedParts = this.getActiveBodyParts(RANGED_ATTACK);
        if (rangedParts === 0) {
            return ERR_NO_BODYPART;
        }

        // Apply distance falloff
        const falloffMultiplier = RANGED_ATTACK_DISTANCE_RATE[range] || 0;
        const damage = rangedParts * RANGED_ATTACK_POWER * falloffMultiplier;

        target.applyDamage(damage);
        this.damageDealt += damage;

        return OK;
    }

    /**
     * Heal target (close range)
     * @param {MockCreep} target - Target creep
     * @returns {number} OK or error code
     */
    heal(target) {
        if (!target || !target.isAlive()) {
            return ERR_INVALID_TARGET;
        }

        const range = this.getRangeTo(target);
        if (range > HEAL_RANGE) {
            return ERR_NOT_IN_RANGE;
        }

        const healParts = this.getActiveBodyParts(HEAL);
        if (healParts === 0) {
            return ERR_NO_BODYPART;
        }

        const healing = healParts * HEAL_POWER;
        target.applyHealing(healing);
        this.healingDone += healing;

        return OK;
    }

    /**
     * Heal target at range
     * @param {MockCreep} target - Target creep
     * @returns {number} OK or error code
     */
    rangedHeal(target) {
        if (!target || !target.isAlive()) {
            return ERR_INVALID_TARGET;
        }

        const range = this.getRangeTo(target);
        if (range > RANGED_HEAL_RANGE) {
            return ERR_NOT_IN_RANGE;
        }

        const healParts = this.getActiveBodyParts(HEAL);
        if (healParts === 0) {
            return ERR_NO_BODYPART;
        }

        const healing = healParts * RANGED_HEAL_POWER;
        target.applyHealing(healing);
        this.healingDone += healing;

        return OK;
    }

    /**
     * Move creep toward target (improved pathfinding)
     * @param {Object} target - Target with x, y coordinates
     * @param {Object} terrain - Terrain map (optional)
     * @param {Function} collisionCheck - Optional collision checker (x, y) => boolean
     * @returns {number} OK or error code
     */
    moveTo(target, terrain = null, collisionCheck = null) {
        if (this.fatigue > 0) {
            return ERR_NOT_IN_RANGE; // Can't move when fatigued
        }

        // Calculate desired movement
        const dx = Math.sign(target.x - this.x);
        const dy = Math.sign(target.y - this.y);

        if (dx === 0 && dy === 0) {
            return OK; // Already at target
        }

        // Helper to check if position is valid
        const isValidPosition = (x, y) => {
            if (terrain && !terrain.isWalkable(x, y)) {
                return false;
            }
            if (collisionCheck && collisionCheck(x, y)) {
                return false;
            }
            return true;
        };

        // Priority-ordered movement directions
        // 1. Preferred diagonal direction
        // 2. Cardinal directions (prioritize toward target)
        // 3. Other diagonals
        // 4. Remaining cardinals
        const directions = [];

        // Primary: diagonal toward target
        if (dx !== 0 && dy !== 0) {
            directions.push({ x: this.x + dx, y: this.y + dy });
        }

        // Secondary: cardinal directions toward target
        if (dx !== 0) {
            directions.push({ x: this.x + dx, y: this.y });
        }
        if (dy !== 0) {
            directions.push({ x: this.x, y: this.y + dy });
        }

        // Tertiary: other diagonal directions (for maneuvering around obstacles)
        if (dx !== 0 && dy !== 0) {
            directions.push({ x: this.x - dx, y: this.y + dy }); // opposite x
            directions.push({ x: this.x + dx, y: this.y - dy }); // opposite y
        }

        // Quaternary: remaining cardinals (for backtracking if needed)
        if (dx !== 0) {
            directions.push({ x: this.x - dx, y: this.y });
        }
        if (dy !== 0) {
            directions.push({ x: this.x, y: this.y - dy });
        }

        // Try each direction in priority order
        for (const dir of directions) {
            if (isValidPosition(dir.x, dir.y)) {
                // Execute movement
                this.x = dir.x;
                this.y = dir.y;

                // Add fatigue based on terrain at NEW position
                const terrainCost = terrain ? terrain.getCost(this.x, this.y) : 2;
                this.fatigue += terrainCost;

                return OK;
            }
        }

        // Completely blocked - can't move anywhere
        return ERR_NOT_IN_RANGE;
    }

    /**
     * Reduce fatigue (called at start of each tick)
     */
    reduceFatigue() {
        const moveParts = this.getActiveBodyParts(MOVE);
        this.fatigue = Math.max(0, this.fatigue - (moveParts * 2));
    }

    /**
     * Get summary statistics
     * @returns {Object} Stats summary
     */
    getStats() {
        return {
            id: this.id,
            name: this.name,
            alive: this.isAlive(),
            hits: this.hits,
            hitsMax: this.hitsMax,
            damageTaken: this.damageTaken,
            damageDealt: this.damageDealt,
            healingDone: this.healingDone,
            healingReceived: this.healingReceived,
            x: this.x,
            y: this.y,
            bodyParts: this.body.map(p => ({ type: p.type, hits: p.hits }))
        };
    }

    /**
     * Clone this creep (for scenario reuse)
     * @returns {MockCreep} New creep with same configuration
     */
    clone(newId = null) {
        const bodyTypes = this.body.map(p => p.type);
        return new MockCreep(
            newId || this.id,
            this.x,
            this.y,
            bodyTypes,
            this.my,
            this.name
        );
    }
}
