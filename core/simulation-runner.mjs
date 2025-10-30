import { CombatEngine } from './combat-engine.mjs';
import { ScenarioGenerator } from '../scenarios/scenario-generator.mjs';
import { ELOSystem } from '../elo/elo-system.mjs';
import { BODYPART_COST } from './constants.mjs';

const DEFAULT_ENGINE_ENTROPY = {
    spawnJitter: {
        radius: 3,
        attempts: 18,
        perUnitRadius: 1,
        perUnitAttempts: 4,
        allowZeroOffset: true
    },
    randomWalls: {
        count: 8,
        margin: 12,
        minDistance: 4,
        attempts: 40
    }
};

function getEngineEntropy(enabled) {
    if (!enabled) {
        return false;
    }

    return {
        spawnJitter: { ...DEFAULT_ENGINE_ENTROPY.spawnJitter },
        randomWalls: { ...DEFAULT_ENGINE_ENTROPY.randomWalls }
    };
}

function calculateCost(body) {
    return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

function summarizeBattles(results) {
    const { battles } = results;
    const iterations = battles.length || 0;

    const summary = {
        iterations: results.iterations,
        wins: results.wins,
        losses: results.losses,
        draws: results.draws,
        winRate: results.iterations > 0 ? results.wins / results.iterations : 0,
        avgTicks: results.avgTicks || 0,
        player: {
            totalDamage: 0,
            totalHealing: 0,
            avgDamage: 0,
            avgHealing: 0,
            avgSurvivors: 0
        },
        enemy: {
            totalDamage: 0,
            totalHealing: 0,
            avgDamage: 0,
            avgHealing: 0,
            avgSurvivors: 0
        }
    };

    if (iterations === 0) {
        return summary;
    }

    let playerSurvivors = 0;
    let enemySurvivors = 0;

    for (const battle of battles) {
        if (battle.player) {
            summary.player.totalDamage += battle.player.totalDamage || 0;
            summary.player.totalHealing += battle.player.totalHealing || 0;
            playerSurvivors += battle.player.survivors || 0;
        }
        if (battle.enemy) {
            summary.enemy.totalDamage += battle.enemy.totalDamage || 0;
            summary.enemy.totalHealing += battle.enemy.totalHealing || 0;
            enemySurvivors += battle.enemy.survivors || 0;
        }
    }

    summary.player.avgDamage = summary.player.totalDamage / iterations;
    summary.player.avgHealing = summary.player.totalHealing / iterations;
    summary.player.avgSurvivors = playerSurvivors / iterations;

    summary.enemy.avgDamage = summary.enemy.totalDamage / iterations;
    summary.enemy.avgHealing = summary.enemy.totalHealing / iterations;
    summary.enemy.avgSurvivors = enemySurvivors / iterations;

    return summary;
}

function buildHeatmap(battles, width, height) {
    const createMatrix = () => Array.from({ length: height }, () => Array(width).fill(0));

    const playerMatrix = createMatrix();
    const enemyMatrix = createMatrix();

    let playerMax = 0;
    let enemyMax = 0;

    for (const battle of battles) {
        for (const creep of battle.player?.creeps || []) {
            const x = Math.max(0, Math.min(width - 1, creep.x ?? 0));
            const y = Math.max(0, Math.min(height - 1, creep.y ?? 0));
            const value = playerMatrix[y][x] + 1;
            playerMatrix[y][x] = value;
            if (value > playerMax) {
                playerMax = value;
            }
        }

        for (const creep of battle.enemy?.creeps || []) {
            const x = Math.max(0, Math.min(width - 1, creep.x ?? 0));
            const y = Math.max(0, Math.min(height - 1, creep.y ?? 0));
            const value = enemyMatrix[y][x] + 1;
            enemyMatrix[y][x] = value;
            if (value > enemyMax) {
                enemyMax = value;
            }
        }
    }

    return {
        width,
        height,
        player: {
            matrix: playerMatrix,
            max: playerMax
        },
        enemy: {
            matrix: enemyMatrix,
            max: enemyMax
        }
    };
}

function createEngineConfig(config, recordBattle) {
    return {
        verbose: config.verbose || false,
        recordBattle,
        entropy: getEngineEntropy(config.entropy !== false)
    };
}

function runMatchup({
    label,
    playerComp,
    enemyComp,
    iterations,
    config,
    generator,
    recordRequest,
    includeHeatmap
}) {
    const engine = new CombatEngine(createEngineConfig(config, recordRequest.active));

    const results = engine.runMultipleBattles(iterations, (eng) => {
        const playerSquad = generator.createSquad(playerComp, 10, 45, true);
        const enemySquad = generator.createSquad(enemyComp, 90, 54, false);

        playerSquad.forEach(c => eng.addCreep(c));
        enemySquad.forEach(c => eng.addCreep(c));
    });

    const summary = summarizeBattles(results);

    const runInfo = {
        label,
        summary,
        playerCost: playerComp.reduce((sum, u) => sum + (u.cost || calculateCost(u.body)), 0),
        enemyCost: enemyComp.reduce((sum, u) => sum + (u.cost || calculateCost(u.body)), 0)
    };

    if (includeHeatmap) {
        const width = engine.baseTerrain?.width || 100;
        const height = engine.baseTerrain?.height || 100;
        runInfo.heatmap = buildHeatmap(results.battles, width, height);
    }

    if (recordRequest.active && !recordRequest.captured) {
        runInfo.recording = engine.exportRecording();
        recordRequest.captured = true;
    }

    return runInfo;
}

function runQuickMode(config) {
    const generator = new ScenarioGenerator();
    const scenarios = [
        { name: 'Ranged Kite vs Heavy Melee', player: 'ranged_kite', enemy: 'heavy_melee' },
        { name: 'Current Strategy vs Heavy Melee', player: 'current_strategy', enemy: 'heavy_melee' },
        { name: 'Hybrid Squad vs Heavy Melee', player: 'hybrid_squad', enemy: 'heavy_melee' }
    ];

    const iterations = 10;
    const recordRequest = {
        active: Boolean(config.record),
        captured: false
    };

    const runs = scenarios.map(({ name, player, enemy }) => {
        const playerComp = generator.getPredefinedComposition(player);
        const enemyComp = generator.getPredefinedComposition(enemy);

        return runMatchup({
            label: name,
            playerComp,
            enemyComp,
            iterations,
            config,
            generator,
            recordRequest,
            includeHeatmap: Boolean(config.heatmap)
        });
    });

    const result = {
        mode: 'quick',
        runs
    };

    if (recordRequest.captured) {
        result.recording = runs.find(r => r.recording)?.recording || null;
    }

    return result;
}

function runRandomMode(config) {
    const generator = new ScenarioGenerator({ maxEnergy: 3000 });
    const recordRequest = {
        active: Boolean(config.record),
        captured: false
    };

    const engine = new CombatEngine(createEngineConfig(config, recordRequest.active));
    const results = engine.runMultipleBattles(config.battles || 100, (eng) => {
        const playerComp = generator.generateSquad(3000);
        const enemyComp = generator.generateSquad(3000);

        const playerSquad = generator.createSquad(playerComp, 10, 45, true);
        const enemySquad = generator.createSquad(enemyComp, 90, 54, false);

        playerSquad.forEach(c => eng.addCreep(c));
        enemySquad.forEach(c => eng.addCreep(c));
    });

    const summary = summarizeBattles(results);

    const runInfo = {
        label: 'Random vs Random',
        summary
    };

    if (config.heatmap) {
        const width = engine.baseTerrain?.width || 100;
        const height = engine.baseTerrain?.height || 100;
        runInfo.heatmap = buildHeatmap(results.battles, width, height);
    }

    if (recordRequest.active) {
        runInfo.recording = engine.exportRecording();
    }

    const result = {
        mode: 'random',
        runs: [runInfo]
    };

    if (runInfo.recording) {
        result.recording = runInfo.recording;
    }

    return result;
}

function runPredefinedMode(config) {
    if (!config.scenario) {
        throw new Error('Scenario name required for predefined mode');
    }

    const generator = new ScenarioGenerator();
    const baseComp = generator.getPredefinedComposition(config.scenario);

    if (!baseComp) {
        throw new Error(`Unknown scenario "${config.scenario}"`);
    }

    const opponents = ['ranged_kite', 'heavy_melee', 'hybrid_squad', 'current_strategy'].filter(name => name !== config.scenario);

    const recordRequest = {
        active: Boolean(config.record),
        captured: false
    };

    const runs = opponents.map(opponent => {
        const enemyComp = generator.getPredefinedComposition(opponent);

        return runMatchup({
            label: `${config.scenario} vs ${opponent}`,
            playerComp: baseComp,
            enemyComp,
            iterations: config.battles || 100,
            config,
            generator,
            recordRequest,
            includeHeatmap: Boolean(config.heatmap)
        });
    });

    const result = {
        mode: 'predefined',
        scenario: config.scenario,
        runs
    };

    if (recordRequest.captured) {
        result.recording = runs.find(r => r.recording)?.recording || null;
    }

    return result;
}

function runEloMode(config) {
    const generator = new ScenarioGenerator({ maxEnergy: 3000 });
    const elo = new ELOSystem();

    const compositions = [];
    const predefined = ['ranged_kite', 'heavy_melee', 'hybrid_squad', 'current_strategy'];

    predefined.forEach(name => {
        const comp = generator.getPredefinedComposition(name);
        compositions.push({ id: name, composition: comp });
    });

    const neededRandom = Math.max(0, (config.compositions || 20) - compositions.length);

    for (let i = 0; i < neededRandom; i++) {
        const comp = generator.generateSquad(3000);
        compositions.push({ id: `random_${i}`, composition: comp });
    }

    let matchupCount = 0;
    const totalBattlesPerMatchup = Math.max(1, Math.floor((config.battles || 100) / 10));

    for (let i = 0; i < compositions.length; i++) {
        for (let j = i + 1; j < compositions.length; j++) {
            const compA = compositions[i];
            const compB = compositions[j];

            const engine = new CombatEngine(createEngineConfig(config, false));
            const results = engine.runMultipleBattles(totalBattlesPerMatchup, (eng) => {
                const squadA = generator.createSquad(compA.composition, 10, 45, true);
                const squadB = generator.createSquad(compB.composition, 90, 54, false);

                squadA.forEach(c => eng.addCreep(c));
                squadB.forEach(c => eng.addCreep(c));
            });

            const wins = results.wins;
            const losses = results.losses;
            const winner = wins > losses ? 'player' : (losses > wins ? 'enemy' : 'draw');

            elo.recordBattle(compA.id, compB.id, winner, results.battles[0]);
            matchupCount++;
        }
    }

    return {
        mode: 'elo',
        leaderboard: elo.getLeaderboard(15),
        matchups: matchupCount
    };
}

export function runSimulation(config) {
    const resolved = {
        mode: config.mode || 'quick',
        battles: config.battles,
        compositions: config.compositions,
        scenario: config.scenario,
        verbose: config.verbose || false,
        entropy: config.entropy !== false,
        record: config.record || false,
        heatmap: config.heatmap || false
    };

    switch (resolved.mode) {
        case 'quick':
            return runQuickMode(resolved);
        case 'random':
            return runRandomMode(resolved);
        case 'predefined':
            return runPredefinedMode(resolved);
        case 'elo':
            return runEloMode(resolved);
        default:
            throw new Error(`Unknown mode: ${resolved.mode}`);
    }
}

export {
    DEFAULT_ENGINE_ENTROPY,
    getEngineEntropy,
    calculateCost,
    runQuickMode,
    runRandomMode,
    runPredefinedMode,
    runEloMode
};
