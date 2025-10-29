import fs from 'fs';

const data = JSON.parse(fs.readFileSync('simulation/visualizer/sample-battle.json', 'utf8'));

const frame20 = data.frames[20];
const frame21 = data.frames[21];

console.log('=== FRAME 20 ===');
frame20.creeps.forEach(c => {
    if (c.hits > 0) {
        console.log(`${c.name.padEnd(12)} (${c.my ? 'player' : 'enemy '}): (${c.x}, ${c.y})`);
    }
});

console.log('\n=== FRAME 21 ===');
frame21.creeps.forEach(c => {
    if (c.hits > 0) {
        console.log(`${c.name.padEnd(12)} (${c.my ? 'player' : 'enemy '}): (${c.x}, ${c.y})`);
    }
});

// Check for stacking in frame 21
console.log('\n=== CHECKING FRAME 21 FOR STACKING ===');
const positions = new Map();
frame21.creeps.forEach(c => {
    if (c.hits > 0) {
        const key = `${c.x},${c.y}`;
        if (!positions.has(key)) {
            positions.set(key, []);
        }
        positions.get(key).push(c);
    }
});

for (const [pos, creeps] of positions.entries()) {
    if (creeps.length > 1) {
        console.log(`❌ Position ${pos}:`);
        creeps.forEach(c => console.log(`   - ${c.name} (${c.my ? 'player' : 'enemy'})`));
    }
}

// Focus on Tank-1 and Brawler3
console.log('\n=== DETAILED TRACE ===');
const tank20 = frame20.creeps.find(c => c.name === 'Tank-1');
const tank21 = frame21.creeps.find(c => c.name === 'Tank-1');
const brawler20 = frame20.creeps.find(c => c.name === 'Brawler3');
const brawler21 = frame21.creeps.find(c => c.name === 'Brawler3');

console.log(`Tank-1:    (${tank20.x}, ${tank20.y}) -> (${tank21.x}, ${tank21.y})`);
console.log(`Brawler3:  (${brawler20.x}, ${brawler20.y}) -> (${brawler21.x}, ${brawler21.y})`);

if (tank21.x === brawler21.x && tank21.y === brawler21.y) {
    console.log('\n❌ THEY ARE AT THE SAME POSITION IN FRAME 21!');
}
