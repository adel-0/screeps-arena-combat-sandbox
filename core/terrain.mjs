/**
 * Terrain - Simple terrain system for movement costs
 */

import {
    TERRAIN_PLAIN,
    TERRAIN_SWAMP,
    TERRAIN_WALL,
    FATIGUE_COST_PLAIN,
    FATIGUE_COST_SWAMP
} from './constants.mjs';

export class Terrain {
    /**
     * Create terrain map
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @param {string} defaultType - Default terrain type ('plain' or 'swamp')
     */
    constructor(width = 50, height = 50, defaultType = 'plain') {
        this.width = width;
        this.height = height;
        this.defaultCost = defaultType === 'swamp' ? FATIGUE_COST_SWAMP : FATIGUE_COST_PLAIN;

        // For now, uniform terrain. Can be extended for complex maps
        this.terrainMap = {};
    }

    /**
     * Create a deep copy of this terrain instance
     * @returns {Terrain} Cloned terrain
     */
    clone() {
        const cloned = new Terrain(this.width, this.height, this.defaultCost === FATIGUE_COST_SWAMP ? 'swamp' : 'plain');
        cloned.defaultCost = this.defaultCost;
        cloned.terrainMap = { ...this.terrainMap };
        return cloned;
    }

    /**
     * Get movement cost at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Fatigue cost
     */
    getCost(x, y) {
        const key = `${x},${y}`;
        return this.terrainMap[key] || this.defaultCost;
    }

    /**
     * Set terrain at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Terrain type ('plain', 'swamp', 'wall')
     */
    setTerrain(x, y, type) {
        const key = `${x},${y}`;

        switch (type) {
            case 'plain':
                this.terrainMap[key] = FATIGUE_COST_PLAIN;
                break;
            case 'swamp':
                this.terrainMap[key] = FATIGUE_COST_SWAMP;
                break;
            case 'wall':
                this.terrainMap[key] = Infinity; // Impassable
                break;
            default:
                this.terrainMap[key] = this.defaultCost;
        }
    }

    /**
     * Check if position is walkable
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if walkable
     */
    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        return this.getCost(x, y) !== Infinity;
    }

    /**
     * Export terrain as 2D grid for visualization
     * @returns {number[][]} 2D array of terrain types
     */
    toGrid() {
        const grid = [];
        const defaultType = this.defaultCost === FATIGUE_COST_SWAMP ? TERRAIN_SWAMP : TERRAIN_PLAIN;

        for (let y = 0; y < this.height; y++) {
            grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                const cost = this.getCost(x, y);
                if (cost === Infinity) {
                    grid[y][x] = TERRAIN_WALL;
                } else if (cost === FATIGUE_COST_SWAMP) {
                    grid[y][x] = TERRAIN_SWAMP;
                } else {
                    grid[y][x] = TERRAIN_PLAIN;
                }
            }
        }

        return grid;
    }
}
