import fs from 'fs';

const data = JSON.parse(fs.readFileSync('simulation/visualizer/sample-battle.json', 'utf8'));

for (let i = 17; i <= 22; i++) {
    console.log(`\n=== FRAME ${i} ===`);
    const frame = data.frames[i];
    const tank = frame.creeps.find(c => c.name === 'Tank-1');
    const brawler = frame.creeps.find(c => c.name === 'Brawler3');

    if (tank) {
        console.log(`Tank-1:   (${tank.x},${tank.y}) HP:${tank.hits}/${tank.hitsMax}`);
    } else {
        console.log('Tank-1:   DEAD');
    }

    console.log(`Brawler3: (${brawler.x},${brawler.y}) HP:${brawler.hits}/${brawler.hitsMax}`);

    // Check all positions
    const positions = new Map();
    frame.creeps.forEach(c => {
        if (c.hits > 0) {
            const key = `${c.x},${c.y}`;
            if (!positions.has(key)) {
                positions.set(key, []);
            }
            positions.get(key).push(c.name);
        }
    });

    for (const [pos, names] of positions.entries()) {
        if (names.length > 1) {
            console.log(`  ⚠️  STACKING at ${pos}: ${names.join(', ')}`);
        }
    }
}
