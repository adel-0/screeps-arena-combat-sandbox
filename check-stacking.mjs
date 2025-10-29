import fs from 'fs';

const data = JSON.parse(fs.readFileSync('simulation/visualizer/sample-battle.json', 'utf8'));

console.log('Checking for stacking across all frames...\n');

let stackingFound = false;

for (let i = 0; i < data.frames.length; i++) {
    const frame = data.frames[i];
    const positions = new Map();

    frame.creeps.forEach(c => {
        if (c.hits > 0) { // Only check alive creeps
            const key = `${c.x},${c.y}`;
            if (!positions.has(key)) {
                positions.set(key, []);
            }
            positions.get(key).push(c);
        }
    });

    // Check for stacking
    for (const [pos, creeps] of positions.entries()) {
        if (creeps.length > 1) {
            stackingFound = true;
            console.log(`❌ STACKING DETECTED at tick ${frame.tick}, position ${pos}:`);
            creeps.forEach(c => {
                console.log(`   - ${c.name} (${c.my ? 'player' : 'enemy'}): ${c.hits}/${c.hitsMax} HP`);
            });
        }
    }
}

if (!stackingFound) {
    console.log('✅ No stacking detected in any frame!');
} else {
    console.log('\n⚠️ Stacking issues found!');
}
