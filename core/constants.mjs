/**
 * Screeps Arena Game Constants
 * All values sourced from official documentation
 */

// Body Part Types
export const MOVE = 'move';
export const WORK = 'work';
export const CARRY = 'carry';
export const ATTACK = 'attack';
export const RANGED_ATTACK = 'ranged_attack';
export const TOUGH = 'tough';
export const HEAL = 'heal';

// Body Part Costs (energy)
export const BODYPART_COST = {
    [MOVE]: 50,
    [WORK]: 100,
    [CARRY]: 50,
    [ATTACK]: 80,
    [RANGED_ATTACK]: 150,
    [TOUGH]: 10,
    [HEAL]: 250
};

// Combat Constants
export const ATTACK_POWER = 30;                    // Damage per ATTACK part per tick
export const RANGED_ATTACK_POWER = 10;             // Base damage per RANGED_ATTACK part
export const HEAL_POWER = 12;                      // Healing per HEAL part (adjacent)
export const RANGED_HEAL_POWER = 4;                // Healing per HEAL part (range 1-3)

// Ranged Attack Distance Falloff
export const RANGED_ATTACK_DISTANCE_RATE = {
    0: 1.0,    // Point blank (100% damage)
    1: 1.0,    // Adjacent (100% damage)
    2: 0.4,    // Range 2 (40% damage)
    3: 0.1     // Range 3 (10% damage)
};

// Body Part Health
export const BODYPART_HITS = 100;                  // HP per body part
export const MAX_CREEP_SIZE = 50;                  // Maximum body parts per creep

// Movement and Fatigue
export const TERRAIN_PLAIN = 0;
export const TERRAIN_SWAMP = 2;
export const TERRAIN_WALL = 1;

export const FATIGUE_COST_PLAIN = 2;               // Fatigue generated per move on plains
export const FATIGUE_COST_SWAMP = 10;              // Fatigue generated per move on swamp
export const MOVE_POWER = 2;                       // Fatigue reduced per MOVE part per tick

// Spawning
export const CREEP_SPAWN_TIME = 3;                 // Ticks per body part to spawn
export const SPAWN_ENERGY_CAPACITY = 1000;
export const EXTENSION_ENERGY_CAPACITY = 100;

// Tower (for future expansion)
export const TOWER_POWER_ATTACK = 150;
export const TOWER_POWER_HEAL = 100;
export const TOWER_RANGE = 50;
export const TOWER_OPTIMAL_RANGE = 5;
export const TOWER_FALLOFF_RANGE = 20;
export const TOWER_FALLOFF = 0.75;
export const TOWER_COOLDOWN = 10;

// Error Codes
export const OK = 0;
export const ERR_NOT_IN_RANGE = -9;
export const ERR_INVALID_TARGET = -7;
export const ERR_NO_BODYPART = -12;

// Range Constants
export const ATTACK_RANGE = 1;                     // Melee attack range (adjacent only)
export const RANGED_ATTACK_RANGE = 3;              // Maximum ranged attack range
export const HEAL_RANGE = 1;                       // Close-range heal (adjacent only)
export const RANGED_HEAL_RANGE = 3;                // Maximum ranged heal range
