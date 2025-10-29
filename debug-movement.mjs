import fs from 'fs';

const data = JSON.parse(fs.readFileSync('simulation/visualizer/sample-battle.json', 'utf8'));

console.log('Analyzing movement patterns for potential collision issues...\n');

// Track positions over time
for (let i = 0; i < Math.min(20, data.frames.length - 1); i++) {
    const currentFrame = data.frames[i];
    const nextFrame = data.frames[i + 1];

    console.log(`\n=== Tick ${currentFrame.tick} -> ${nextFrame.tick} ===`);

    // Build position map for current frame
    const currentPositions = new Map();
    currentFrame.creeps.forEach(c => {
        if (c.hits > 0) {
            currentPositions.set(c.id, { x: c.x, y: c.y, name: c.name, my: c.my });
        }
    });

    // Build position map for next frame
    const nextPositions = new Map();
    nextFrame.creeps.forEach(c => {
        if (c.hits > 0) {
            nextPositions.set(c.id, { x: c.x, y: c.y, name: c.name, my: c.my });
        }
    });

    // Check for movements
    for (const [id, current] of currentPositions.entries()) {
        const next = nextPositions.get(id);
        if (!next) continue;

        if (current.x !== next.x || current.y !== next.y) {
            // Creep moved - check if destination was occupied
            const destinationKey = `${next.x},${next.y}`;

            // Check if any OTHER creep was at that position in current frame
            for (const [otherId, other] of currentPositions.entries()) {
                if (otherId !== id && other.x === next.x && other.y === next.y) {
                    console.log(`⚠️  ${current.name} (${current.my ? 'player' : 'enemy'}) moved from (${current.x},${current.y}) to (${next.x},${next.y})`);
                    console.log(`   BUT ${other.name} (${other.my ? 'player' : 'enemy'}) was already at (${other.x},${other.y})!`);

                    // Check where the other creep went
                    const otherNext = nextPositions.get(otherId);
                    if (otherNext) {
                        console.log(`   -> ${other.name} moved to (${otherNext.x},${otherNext.y})`);
                    }
                }
            }
        }
    }
}
