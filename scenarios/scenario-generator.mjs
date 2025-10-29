/**
 * Scenario Generator - Creates random squad compositions
 */

import {
    MOVE, ATTACK, RANGED_ATTACK, HEAL, TOUGH, CARRY, WORK,
    BODYPART_COST, MAX_CREEP_SIZE
} from '../core/constants.mjs';
import { MockCreep } from '../core/creep.mjs';

export class ScenarioGenerator {
    /**
     * Create scenario generator
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
        this.maxEnergy = config.maxEnergy || 5000;
        this.minUnitsPerSquad = config.minUnitsPerSquad || 2;
        this.maxUnitsPerSquad = config.maxUnitsPerSquad || 6;
        this.allowedParts = config.allowedParts || [MOVE, ATTACK, RANGED_ATTACK, HEAL, TOUGH];
    }

    /**
     * Generate random body composition
     * @param {number} maxCost - Maximum energy cost
     * @returns {string[]} Array of body part types
     */
    generateRandomBody(maxCost) {
        const body = [];
        let remainingEnergy = maxCost;
        let bodySize = 0;

        // Strategy: pick random valid compositions
        const strategies = [
            this.generateMeleeBody.bind(this),
            this.generateRangedBody.bind(this),
            this.generateHealerBody.bind(this),
            this.generateHybridBody.bind(this),
            this.generateTankBody.bind(this)
        ];

        const strategy = strategies[Math.floor(Math.random() * strategies.length)];
        return strategy(maxCost);
    }

    /**
     * Generate melee attacker body
     * @param {number} maxCost - Maximum energy cost
     * @returns {string[]} Body composition
     */
    generateMeleeBody(maxCost) {
        const body = [];
        let cost = 0;

        // Pattern: MOVE, ATTACK alternating (swamp optimized)
        while (cost + BODYPART_COST[MOVE] + BODYPART_COST[ATTACK] <= maxCost && body.length < MAX_CREEP_SIZE - 1) {
            body.push(MOVE);
            body.push(ATTACK);
            cost += BODYPART_COST[MOVE] + BODYPART_COST[ATTACK];
        }

        // Add extra MOVE if space and budget
        if (cost + BODYPART_COST[MOVE] <= maxCost && body.length < MAX_CREEP_SIZE) {
            body.unshift(MOVE); // Front-load MOVE for damage absorption
        }

        return body;
    }

    /**
     * Generate ranged attacker body
     * @param {number} maxCost - Maximum energy cost
     * @returns {string[]} Body composition
     */
    generateRangedBody(maxCost) {
        const body = [];
        let cost = 0;

        // Pattern: MOVE, RANGED_ATTACK alternating
        while (cost + BODYPART_COST[MOVE] + BODYPART_COST[RANGED_ATTACK] <= maxCost && body.length < MAX_CREEP_SIZE - 1) {
            body.push(MOVE);
            body.push(RANGED_ATTACK);
            cost += BODYPART_COST[MOVE] + BODYPART_COST[RANGED_ATTACK];
        }

        return body;
    }

    /**
     * Generate healer body
     * @param {number} maxCost - Maximum energy cost
     * @returns {string[]} Body composition
     */
    generateHealerBody(maxCost) {
        const body = [];
        let cost = 0;

        // Pattern: MOVE, HEAL alternating
        while (cost + BODYPART_COST[MOVE] + BODYPART_COST[HEAL] <= maxCost && body.length < MAX_CREEP_SIZE - 1) {
            body.push(MOVE);
            body.push(HEAL);
            cost += BODYPART_COST[MOVE] + BODYPART_COST[HEAL];
        }

        return body;
    }

    /**
     * Generate hybrid body (melee + ranged)
     * @param {number} maxCost - Maximum energy cost
     * @returns {string[]} Body composition
     */
    generateHybridBody(maxCost) {
        const body = [];
        let cost = 0;

        // Mix of ATTACK and RANGED_ATTACK
        let useRanged = Math.random() > 0.5;

        while (cost < maxCost && body.length < MAX_CREEP_SIZE - 2) {
            const attackType = useRanged ? RANGED_ATTACK : ATTACK;
            const attackCost = BODYPART_COST[attackType];

            if (cost + BODYPART_COST[MOVE] + attackCost <= maxCost) {
                body.push(MOVE);
                body.push(attackType);
                cost += BODYPART_COST[MOVE] + attackCost;

                // Alternate for next iteration
                useRanged = !useRanged;
            } else {
                break;
            }
        }

        return body;
    }

    /**
     * Generate tank body (TOUGH parts for damage absorption)
     * @param {number} maxCost - Maximum energy cost
     * @returns {string[]} Body composition
     */
    generateTankBody(maxCost) {
        const body = [];
        let cost = 0;

        // Front-load TOUGH parts (cheap HP buffer)
        const toughCount = Math.min(10, Math.floor(maxCost / BODYPART_COST[TOUGH] / 5));
        for (let i = 0; i < toughCount && body.length < MAX_CREEP_SIZE; i++) {
            body.push(TOUGH);
            cost += BODYPART_COST[TOUGH];
        }

        // Add MOVE and ATTACK
        while (cost + BODYPART_COST[MOVE] + BODYPART_COST[ATTACK] <= maxCost && body.length < MAX_CREEP_SIZE - 1) {
            body.push(MOVE);
            body.push(ATTACK);
            cost += BODYPART_COST[MOVE] + BODYPART_COST[ATTACK];
        }

        return body;
    }

    /**
     * Calculate body cost
     * @param {string[]} body - Body composition
     * @returns {number} Total energy cost
     */
    calculateBodyCost(body) {
        return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
    }

    /**
     * Generate random squad composition
     * @param {number} maxEnergy - Maximum total energy for squad
     * @returns {Object[]} Array of squad member configurations
     */
    generateSquad(maxEnergy = null) {
        maxEnergy = maxEnergy || this.maxEnergy;
        const squad = [];
        let remainingEnergy = maxEnergy;

        const unitCount = Math.floor(
            Math.random() * (this.maxUnitsPerSquad - this.minUnitsPerSquad + 1)
        ) + this.minUnitsPerSquad;

        for (let i = 0; i < unitCount; i++) {
            const maxUnitCost = remainingEnergy / (unitCount - i); // Distribute remaining energy
            const body = this.generateRandomBody(maxUnitCost);
            const cost = this.calculateBodyCost(body);

            if (cost <= remainingEnergy) {
                squad.push({
                    body,
                    cost,
                    role: this.identifyRole(body)
                });

                remainingEnergy -= cost;
            }
        }

        return squad;
    }

    /**
     * Identify role based on body composition
     * @param {string[]} body - Body composition
     * @returns {string} Role name
     */
    identifyRole(body) {
        const counts = {};
        for (const part of body) {
            counts[part] = (counts[part] || 0) + 1;
        }

        if (counts[HEAL] > 0) return 'Medic';
        if (counts[RANGED_ATTACK] > 0 && !counts[ATTACK]) return 'Ranger';
        if (counts[ATTACK] > 0 && !counts[RANGED_ATTACK]) return 'Berserker';
        if (counts[ATTACK] > 0 && counts[RANGED_ATTACK] > 0) return 'Operator';
        if (counts[TOUGH] > 3) return 'Enforcer';
        return 'Conscript';
    }

    /**
     * Create squad from composition with realistic spacing
     * @param {Object[]} squadComposition - Array of body configurations
     * @param {number} startX - Starting X position
     * @param {number} startY - Starting Y position
     * @param {boolean} my - Whether this is player's squad
     * @returns {MockCreep[]} Array of creeps
     */
    createSquad(squadComposition, startX, startY, my = true) {
        const creeps = [];

        squadComposition.forEach((config, index) => {
            // Realistic spacing: 2 tiles apart in line formation
            // This prevents tight stacking and allows for more realistic combat
            const offsetX = (index % 3) * 2;  // 0, 2, 4
            const offsetY = Math.floor(index / 3) * 2;  // 0, 0, 0, 2, 2, 2, etc.

            const creep = new MockCreep(
                `${my ? 'player' : 'enemy'}_${config.role}_${index}`,
                startX + offsetX,
                startY + offsetY,
                config.body,
                my,
                `${config.role}-${index + 1}`
            );

            creeps.push(creep);
        });

        return creeps;
    }

    /**
     * Generate predefined composition by name
     * @param {string} name - Composition name
     * @returns {Object[]} Squad composition
     */
    getPredefinedComposition(name) {
        const compositions = {
            // Original compositions
            'ranged_kite': [
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'heavy_melee': [
                { body: [ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE], role: 'Berserker' },
                { body: [ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE], role: 'Berserker' },
                { body: [ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE], role: 'Berserker' },
                { body: [ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE], role: 'Berserker' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'hybrid_squad': [
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'current_strategy': [
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            // New test compositions
            'ranged_4_2': [
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'ranged_5_2': [
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'melee_5_2': [
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'hybrid_2r_2m_2h': [
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Berserker' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'tank_squad': [
                { body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Enforcer' },
                { body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Enforcer' },
                { body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK], role: 'Enforcer' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' },
                { body: [MOVE, HEAL, MOVE], role: 'Medic' }
            ],
            'pure_ranged': [
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' }
            ],
            'heavy_ranged': [
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK], role: 'Ranger' },
                { body: [MOVE, HEAL, MOVE, HEAL], role: 'Medic' }
            ]
        };

        return compositions[name] || null;
    }
}
