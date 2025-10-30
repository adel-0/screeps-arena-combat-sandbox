#!/usr/bin/env node

/**
 * Test Runner - Execute combat simulations and generate reports
 */

import { CombatEngine } from './core/combat-engine.mjs';
import { ScenarioGenerator } from './scenarios/scenario-generator.mjs';
import { ELOSystem } from './elo/elo-system.mjs';
import { BODYPART_COST } from './core/constants.mjs';
import fs from 'fs';

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

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
    mode: 'quick',
    battles: 100,
    compositions: 20,
    scenario: null,
    verbose: false,
    record: null,
    entropy: true
};

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--mode':
            config.mode = args[++i];
            break;
        case '--battles':
            config.battles = parseInt(args[++i]);
            break;
        case '--compositions':
            config.compositions = parseInt(args[++i]);
            break;
        case '--scenario':
            config.scenario = args[++i];
            break;
        case '--record':
            config.record = args[++i] || 'battle-recording.json';
            break;
        case '--no-entropy':
            config.entropy = false;
            break;
        case '--verbose':
        case '-v':
            config.verbose = true;
            break;
        case '--help':
        case '-h':
            printHelp();
            process.exit(0);
    }
}

function printHelp() {
    console.log(`
Screeps Arena Combat Simulator

Usage: node runner.mjs [options]

Modes:
  quick           Run quick test of predefined scenarios (default)
  random          Generate and test random compositions
  elo             Generate ELO ratings for multiple compositions
  predefined      Test specific predefined scenario

Options:
  --mode <mode>           Set execution mode
  --battles <n>           Number of battles to run (default: 100)
  --compositions <n>      Number of compositions for ELO mode (default: 20)
  --scenario <name>       Specific scenario name for predefined mode
  --record <file>         Save recording of one battle (default: battle-recording.json)
  --no-entropy            Disable randomized terrain and spawn offsets
  --verbose, -v           Enable verbose output
  --help, -h              Show this help message

Examples:
  node runner.mjs --mode quick
  node runner.mjs --mode random --battles 500
  node runner.mjs --mode elo --compositions 30 --battles 200
  node runner.mjs --mode predefined --scenario ranged_kite
  node runner.mjs --mode quick --record my-battle.json
`);
}

/**
 * Run quick test mode
 */
function runQuickTest() {
    console.log('=== QUICK TEST MODE ===\n');

    const generator = new ScenarioGenerator();
    const scenarios = [
        { name: 'Ranged Kite vs Heavy Melee', player: 'ranged_kite', enemy: 'heavy_melee' },
        { name: 'Current Strategy vs Heavy Melee', player: 'current_strategy', enemy: 'heavy_melee' },
        { name: 'Hybrid Squad vs Heavy Melee', player: 'hybrid_squad', enemy: 'heavy_melee' }
    ];

    for (const scenario of scenarios) {
        console.log(`\n--- ${scenario.name} ---`);

        const playerComp = generator.getPredefinedComposition(scenario.player);
        const enemyComp = generator.getPredefinedComposition(scenario.enemy);

        const playerCost = playerComp.reduce((sum, u) => sum + (u.cost || calculateCost(u.body)), 0);
        const enemyCost = enemyComp.reduce((sum, u) => sum + (u.cost || calculateCost(u.body)), 0);

        console.log(`Player: ${playerComp.length} units (${playerCost} energy)`);
        console.log(`Enemy: ${enemyComp.length} units (${enemyCost} energy)\n`);

        const engine = new CombatEngine({
            verbose: config.verbose,
            recordBattle: config.record !== null,
            entropy: getEngineEntropy(config.entropy)
        });
        const results = engine.runMultipleBattles(10, (eng) => {
            const playerSquad = generator.createSquad(playerComp, 10, 45, true);
            const enemySquad = generator.createSquad(enemyComp, 90, 54, false);

            playerSquad.forEach(c => eng.addCreep(c));
            enemySquad.forEach(c => eng.addCreep(c));
        });

        printBattleResults(results);

        // Save recording after first scenario if requested
        if (config.record) {
            saveRecording(engine);
            config.record = null; // Only record once
        }
    }
}

/**
 * Run random composition test
 */
function runRandomTest() {
    console.log('=== RANDOM COMPOSITION TEST ===\n');
    console.log(`Running ${config.battles} battles with random compositions...\n`);

    const generator = new ScenarioGenerator({ maxEnergy: 3000 });
    const engine = new CombatEngine({
        verbose: config.verbose,
        recordBattle: config.record !== null,
        entropy: getEngineEntropy(config.entropy)
    });

    const results = engine.runMultipleBattles(config.battles, (eng) => {
        const playerComp = generator.generateSquad(3000);
        const enemyComp = generator.generateSquad(3000);

        const playerSquad = generator.createSquad(playerComp, 10, 45, true);
        const enemySquad = generator.createSquad(enemyComp, 90, 54, false);

        playerSquad.forEach(c => eng.addCreep(c));
        enemySquad.forEach(c => eng.addCreep(c));
    });

    printBattleResults(results);

    if (config.record) {
        saveRecording(engine);
    }
}

/**
 * Run ELO rating tournament
 */
function runELOTournament() {
    console.log('=== ELO RATING TOURNAMENT ===\n');
    console.log(`Generating ${config.compositions} compositions...`);

    const generator = new ScenarioGenerator({ maxEnergy: 3000 });
    const elo = new ELOSystem();

    // Generate compositions
    const compositions = [];
    const predefined = ['ranged_kite', 'heavy_melee', 'hybrid_squad', 'current_strategy'];

    predefined.forEach(name => {
        const comp = generator.getPredefinedComposition(name);
        compositions.push({ id: name, composition: comp });
    });

    for (let i = 0; i < config.compositions - predefined.length; i++) {
        const comp = generator.generateSquad(3000);
        compositions.push({ id: `random_${i}`, composition: comp });
    }

    console.log(`Running ${config.battles} battles per matchup...\n`);

    // Round-robin tournament
    let battleCount = 0;
    for (let i = 0; i < compositions.length; i++) {
        for (let j = i + 1; j < compositions.length; j++) {
            const compA = compositions[i];
            const compB = compositions[j];

            const engine = new CombatEngine({
                entropy: getEngineEntropy(config.entropy)
            });
            const results = engine.runMultipleBattles(config.battles / 10, (eng) => {
                const squadA = generator.createSquad(compA.composition, 10, 45, true);
                const squadB = generator.createSquad(compB.composition, 90, 54, false);

                squadA.forEach(c => eng.addCreep(c));
                squadB.forEach(c => eng.addCreep(c));
            });

            // Record results in ELO system
            const wins = results.wins;
            const losses = results.losses;
            const draws = results.draws;

            // Update ELO based on aggregate results
            if (wins > losses) {
                elo.recordBattle(compA.id, compB.id, 'player', results.battles[0]);
            } else if (losses > wins) {
                elo.recordBattle(compA.id, compB.id, 'enemy', results.battles[0]);
            } else {
                elo.recordBattle(compA.id, compB.id, 'draw', results.battles[0]);
            }

            battleCount++;
            if (battleCount % 10 === 0) {
                process.stdout.write(`\rCompleted ${battleCount} matchups...`);
            }
        }
    }

    console.log(`\n\n=== ELO LEADERBOARD ===\n`);
    printLeaderboard(elo);
}

/**
 * Run predefined scenario
 */
function runPredefinedScenario() {
    if (!config.scenario) {
        console.error('Error: --scenario name required for predefined mode');
        process.exit(1);
    }

    console.log(`=== PREDEFINED SCENARIO: ${config.scenario} ===\n`);

    const generator = new ScenarioGenerator();
    const composition = generator.getPredefinedComposition(config.scenario);

    if (!composition) {
        console.error(`Error: Unknown scenario "${config.scenario}"`);
        console.log('\nAvailable scenarios: ranged_kite, heavy_melee, hybrid_squad, current_strategy');
        process.exit(1);
    }

    // Test against all other predefined scenarios
    const scenarios = ['ranged_kite', 'heavy_melee', 'hybrid_squad', 'current_strategy'];

    for (const enemy of scenarios) {
        if (enemy === config.scenario) continue;

        console.log(`\n--- vs ${enemy} ---`);

        const playerComp = composition;
        const enemyComp = generator.getPredefinedComposition(enemy);

        const engine = new CombatEngine({
            verbose: config.verbose,
            recordBattle: config.record !== null,
            entropy: getEngineEntropy(config.entropy)
        });
        const results = engine.runMultipleBattles(config.battles, (eng) => {
            const playerSquad = generator.createSquad(playerComp, 10, 45, true);
            const enemySquad = generator.createSquad(enemyComp, 90, 54, false);

            playerSquad.forEach(c => eng.addCreep(c));
            enemySquad.forEach(c => eng.addCreep(c));
        });

        printBattleResults(results);

        // Save recording after first matchup if requested
        if (config.record) {
            saveRecording(engine);
            config.record = null; // Only record once
        }
    }
}

/**
 * Print battle results
 */
function printBattleResults(results) {
    console.log(`Results over ${results.iterations} battles:`);
    console.log(`  Wins: ${results.wins} (${(results.winRate * 100).toFixed(1)}%)`);
    console.log(`  Losses: ${results.losses} (${((results.losses / results.iterations) * 100).toFixed(1)}%)`);
    console.log(`  Draws: ${results.draws} (${((results.draws / results.iterations) * 100).toFixed(1)}%)`);
    console.log(`  Avg Duration: ${results.avgTicks.toFixed(1)} ticks`);
}

/**
 * Print ELO leaderboard
 */
function printLeaderboard(elo) {
    const leaderboard = elo.getLeaderboard(15);

    console.log('Rank | Composition        | Rating | W-L-D      | Win%  | Avg Dmg | Avg Heal');
    console.log('-----|-------------------|--------|------------|-------|---------|----------');

    leaderboard.forEach((entry, index) => {
        const rank = (index + 1).toString().padStart(4);
        const name = entry.id.padEnd(18);
        const rating = entry.rating.toString().padStart(6);
        const record = `${entry.wins}-${entry.losses}-${entry.draws}`.padEnd(11);
        const winRate = `${entry.winRate}%`.padStart(6);
        const avgDmg = entry.avgDamage.toString().padStart(8);
        const avgHeal = entry.avgHealing.toString().padStart(9);

        console.log(`${rank} | ${name} | ${rating} | ${record} | ${winRate} | ${avgDmg} | ${avgHeal}`);
    });
}

/**
 * Calculate body cost
 */
function calculateCost(body) {
    return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

/**
 * Save battle recording to file
 */
function saveRecording(engine) {
    const recording = engine.exportRecording();
    const filename = config.record || 'battle-recording.json';
    fs.writeFileSync(filename, JSON.stringify(recording, null, 2));
    console.log(`\nRecording saved to ${filename}`);
}

// Main execution
switch (config.mode) {
    case 'quick':
        runQuickTest();
        break;
    case 'random':
        runRandomTest();
        break;
    case 'elo':
        runELOTournament();
        break;
    case 'predefined':
        runPredefinedScenario();
        break;
    default:
        console.error(`Unknown mode: ${config.mode}`);
        printHelp();
        process.exit(1);
}
