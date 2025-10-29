/**
 * Melee vs Ranged Kite Combat Simulation
 * Demonstrates ranged units kiting away from melee attackers
 */

import fs from 'fs';

class Position {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    distanceTo(pos) {
        return Math.sqrt((this.x - pos.x) ** 2 + (this.y - pos.y) ** 2);
    }

    getDirectionTo(target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return { x: 0, y: 0 };

        return {
            x: dx / distance,
            y: dy / distance
        };
    }

    clone() {
        return new Position(this.x, this.y);
    }
}

class Creep {
    constructor(name, x, y, type, my) {
        this.name = name;
        this.pos = new Position(x, y);
        this.type = type; // 'melee' or 'ranged'
        this.my = my;

        if (type === 'melee') {
            this.hits = 150;
            this.hitsMax = 150;
            this.damage = 15;
            this.range = 1.5;
            this.speed = 0.9;
        } else if (type === 'ranged') {
            this.hits = 80;
            this.hitsMax = 80;
            this.damage = 8;
            this.range = 4;
            this.speed = 1.1;
        }

        this.damageDealt = 0;
        this.healingDone = 0;
    }

    isAlive() {
        return this.hits > 0;
    }

    takeDamage(amount) {
        this.hits = Math.max(0, this.hits - amount);
    }

    findClosestEnemy(creeps) {
        let closest = null;
        let minDist = Infinity;

        for (const creep of creeps) {
            if (creep.my !== this.my && creep.isAlive()) {
                const dist = this.pos.distanceTo(creep.pos);
                if (dist < minDist) {
                    minDist = dist;
                    closest = creep;
                }
            }
        }

        return closest;
    }

    moveTowards(target, distance) {
        const dir = this.pos.getDirectionTo(target);
        this.pos.x = Math.max(0, Math.min(49, this.pos.x + dir.x * distance));
        this.pos.y = Math.max(0, Math.min(49, this.pos.y + dir.y * distance));
    }

    moveAwayFrom(target, distance) {
        const dir = this.pos.getDirectionTo(target);
        this.pos.x = Math.max(0, Math.min(49, this.pos.x - dir.x * distance));
        this.pos.y = Math.max(0, Math.min(49, this.pos.y - dir.y * distance));
    }

    act(creeps, actions) {
        if (!this.isAlive()) return;

        const target = this.findClosestEnemy(creeps);
        if (!target) return;

        const distance = this.pos.distanceTo(target.pos);

        if (this.type === 'melee') {
            // Melee: chase and attack
            if (distance <= this.range) {
                // Attack
                const actualDamage = Math.min(this.damage, target.hits);
                target.takeDamage(actualDamage);
                this.damageDealt += actualDamage;
                actions.push({
                    type: 'attack',
                    from: { x: Math.round(this.pos.x), y: Math.round(this.pos.y) },
                    to: { x: Math.round(target.pos.x), y: Math.round(target.pos.y) }
                });
            } else {
                // Move towards
                this.moveTowards(target.pos, this.speed);
            }
        } else if (this.type === 'ranged') {
            // Ranged: kite - maintain optimal distance
            const minDistance = 2.0;
            const maxDistance = 3.5;

            if (distance <= this.range) {
                // Attack
                const actualDamage = Math.min(this.damage, target.hits);
                target.takeDamage(actualDamage);
                this.damageDealt += actualDamage;
                actions.push({
                    type: 'rangedAttack',
                    from: { x: Math.round(this.pos.x), y: Math.round(this.pos.y) },
                    to: { x: Math.round(target.pos.x), y: Math.round(target.pos.y) }
                });
            }

            // Kiting behavior: move away if too close, approach if too far
            if (distance < minDistance) {
                this.moveAwayFrom(target.pos, this.speed);
            } else if (distance > maxDistance) {
                this.moveTowards(target.pos, this.speed * 0.6);
            }
        }
    }
}

class BattleSimulator {
    constructor() {
        this.creeps = [];
        this.frames = [];
        this.gridSize = 50;
        this.terrain = this.generateTerrain();
    }

    generateTerrain() {
        const terrain = [];
        for (let y = 0; y < this.gridSize; y++) {
            terrain[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                // Plain terrain (0) with occasional swamps (2)
                terrain[y][x] = (Math.random() < 0.1) ? 2 : 0;
            }
        }
        return terrain;
    }

    addCreep(creep) {
        this.creeps.push(creep);
    }

    recordFrame(actions) {
        const frame = {
            creeps: this.creeps.map(c => ({
                name: c.name,
                x: Math.round(c.pos.x),
                y: Math.round(c.pos.y),
                hits: Math.round(c.hits),
                hitsMax: c.hitsMax,
                my: c.my,
                damageDealt: Math.round(c.damageDealt),
                healingDone: Math.round(c.healingDone)
            })),
            actions: actions
        };
        this.frames.push(frame);
    }

    simulate(ticks) {
        console.log('Starting melee vs ranged kite simulation...');

        for (let tick = 0; tick < ticks; tick++) {
            const actions = [];

            // All creeps act
            for (const creep of this.creeps) {
                creep.act(this.creeps, actions);
            }

            // Record frame
            this.recordFrame(actions);

            // Check if battle is over
            const playerAlive = this.creeps.some(c => c.my && c.isAlive());
            const enemyAlive = this.creeps.some(c => !c.my && c.isAlive());

            if (!playerAlive || !enemyAlive) {
                console.log(`Battle ended at tick ${tick}`);
                break;
            }

            if (tick % 100 === 0) {
                console.log(`Tick ${tick}...`);
            }
        }

        console.log('Simulation complete!');
    }

    exportBattle(filename) {
        const battleData = {
            metadata: {
                title: 'Melee vs Ranged Kite Combat',
                description: 'Ranged units kiting away from melee attackers',
                gridSize: this.gridSize
            },
            terrain: this.terrain,
            totalTicks: this.frames.length,
            frames: this.frames
        };

        fs.writeFileSync(filename, JSON.stringify(battleData, null, 2));
        console.log(`Battle recording saved to ${filename}`);
    }
}

// Create simulation
const sim = new BattleSimulator();

// Player squad: 6 melee attackers in formation
sim.addCreep(new Creep('Enforcer-01', 8, 20, 'melee', true));
sim.addCreep(new Creep('Enforcer-02', 8, 25, 'melee', true));
sim.addCreep(new Creep('Enforcer-03', 8, 30, 'melee', true));
sim.addCreep(new Creep('Enforcer-04', 12, 22, 'melee', true));
sim.addCreep(new Creep('Enforcer-05', 12, 27, 'melee', true));
sim.addCreep(new Creep('Enforcer-06', 12, 32, 'melee', true));

// Enemy squad: 5 ranged kiters spread out
sim.addCreep(new Creep('Ranger-Alpha', 38, 20, 'ranged', false));
sim.addCreep(new Creep('Ranger-Beta', 38, 25, 'ranged', false));
sim.addCreep(new Creep('Ranger-Gamma', 38, 30, 'ranged', false));
sim.addCreep(new Creep('Ranger-Delta', 42, 22, 'ranged', false));
sim.addCreep(new Creep('Ranger-Echo', 42, 28, 'ranged', false));

// Run simulation
sim.simulate(500);

// Export recording
sim.exportBattle('melee-vs-ranged-kite.json');

console.log('\nTo view the recording:');
console.log('1. Run: node serve.mjs');
console.log('2. Open: http://localhost:3000');
console.log('3. Load: melee-vs-ranged-kite.json');
