/**
 * Record a sample battle for visualization
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CombatEngine } from '../core/combat-engine.mjs';
import { MockCreep } from '../core/creep.mjs';
import { Terrain } from '../core/terrain.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a sample battle scenario
 */
function setupBattle(engine) {
    // Player squad: mixed composition (left side)
    const playerUnits = [
        // 2 Ranged kiter
        new MockCreep('p-ranged-1', 8, 17,
            ['ranged_attack', 'ranged_attack', 'ranged_attack', 'move', 'move', 'move', 'heal'],
            true, 'Ranger-1'),
        new MockCreep('p-ranged-2', 8, 21,
            ['ranged_attack', 'ranged_attack', 'ranged_attack', 'move', 'move', 'move', 'heal'],
            true, 'Ranger-2'),

        // 1 Tank
        new MockCreep('p-tank-1', 10, 19,
            ['tough', 'tough', 'tough', 'tough', 'attack', 'attack', 'move', 'move', 'move', 'heal'],
            true, 'Tank-1'),

        // 1 Healer
        new MockCreep('p-heal-1', 6, 19,
            ['heal', 'heal', 'heal', 'move', 'move', 'move'],
            true, 'Medic-1'),
    ];

    // Enemy squad: heavy melee (right side)
    const enemyUnits = [
        // 3 Melee attackers
        new MockCreep('e-melee-1', 30, 19,
            ['attack', 'attack', 'attack', 'attack', 'move', 'move', 'move'],
            false, 'Brawler1'),
        new MockCreep('e-melee-2', 28, 17,
            ['attack', 'attack', 'attack', 'attack', 'move', 'move', 'move'],
            false, 'Brawler2'),
        new MockCreep('e-melee-3', 28, 21,
            ['attack', 'attack', 'attack', 'attack', 'move', 'move', 'move'],
            false, 'Brawler3'),

        // 2 Ranged support
        new MockCreep('e-ranged-1', 32, 18,
            ['ranged_attack', 'ranged_attack', 'move', 'move', 'heal'],
            false, 'Gunner-1'),
        new MockCreep('e-ranged-2', 32, 20,
            ['ranged_attack', 'ranged_attack', 'move', 'move', 'heal'],
            false, 'Gunner-2'),
    ];

    // Add all units to engine
    [...playerUnits, ...enemyUnits].forEach(creep => engine.addCreep(creep));
}

/**
 * Main function
 */
async function main() {
    console.log('🎬 Recording battle for visualization...\n');

    // Create engine with recording enabled (smaller arena for better visualization)
    const engine = new CombatEngine({
        maxTicks: 500,
        terrain: new Terrain(38, 38, 'swamp'),
        verbose: true,
        recordBattle: true
    });

    // Setup battle
    setupBattle(engine);

    console.log('Player Squad:');
    engine.getAliveCreeps(true).forEach(c => {
        console.log(`  - ${c.name}: ${c.body.map(p => p.type).join(', ')}`);
    });

    console.log('\nEnemy Squad:');
    engine.getAliveCreeps(false).forEach(c => {
        console.log(`  - ${c.name}: ${c.body.map(p => p.type).join(', ')}`);
    });

    console.log('\n⚔️  Starting battle simulation...\n');

    // Run battle
    const results = engine.runBattle();

    // Get recording
    const recording = engine.exportRecording();

    // Save to file
    const outputPath = path.join(__dirname, 'sample-battle.json');
    fs.writeFileSync(outputPath, JSON.stringify(recording, null, 2));

    console.log('\n✅ Battle complete!');
    console.log(`   Winner: ${results.winner.toUpperCase()}`);
    console.log(`   Duration: ${results.ticks} ticks`);
    console.log(`   Player survivors: ${results.player.survivors}`);
    console.log(`   Enemy survivors: ${results.enemy.survivors}`);
    console.log(`\n📁 Recording saved to: ${outputPath}`);
    console.log(`   Frames recorded: ${recording.frames.length}`);
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    console.log(`\n🎥 Open visualizer/index.html in a browser and load the recording file!`);
}

main().catch(console.error);
