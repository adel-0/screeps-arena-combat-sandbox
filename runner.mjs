#!/usr/bin/env node

/**
 * Test Runner - Execute combat simulations and generate reports
 */

import fs from 'fs';
import { runSimulation } from './core/simulation-runner.mjs';

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
            config.battles = parseInt(args[++i], 10);
            break;
        case '--compositions':
            config.compositions = parseInt(args[++i], 10);
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
Screeps Combat Simulator

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

function printRunSummary(run) {
    console.log(`\n--- ${run.label} ---`);

    if (typeof run.playerCost === 'number' && typeof run.enemyCost === 'number') {
        console.log(`Player Energy: ${run.playerCost}`);
        console.log(`Enemy Energy: ${run.enemyCost}`);
    }

    const summary = run.summary;
    console.log(`Results over ${summary.iterations} battles:`);
    console.log(`  Wins: ${summary.wins} (${(summary.winRate * 100).toFixed(1)}%)`);
    console.log(`  Losses: ${summary.losses} (${((summary.losses / summary.iterations) * 100).toFixed(1)}%)`);
    console.log(`  Draws: ${summary.draws} (${((summary.draws / summary.iterations) * 100).toFixed(1)}%)`);
    console.log(`  Avg Duration: ${summary.avgTicks.toFixed(1)} ticks`);
    console.log(`  Player Avg Damage: ${summary.player.avgDamage.toFixed(1)} | Avg Healing: ${summary.player.avgHealing.toFixed(1)} | Avg Survivors: ${summary.player.avgSurvivors.toFixed(1)}`);
    console.log(`  Enemy Avg Damage: ${summary.enemy.avgDamage.toFixed(1)} | Avg Healing: ${summary.enemy.avgHealing.toFixed(1)} | Avg Survivors: ${summary.enemy.avgSurvivors.toFixed(1)}`);
}

function printLeaderboard(leaderboard) {
    console.log('\n=== ELO LEADERBOARD ===\n');
    console.log('Rank | Composition        | Rating | W-L-D      | Win%  | Avg Dmg | Avg Heal | Avg Ticks');
    console.log('-----|-------------------|--------|------------|-------|---------|----------|-----------');

    leaderboard.forEach((entry, index) => {
        const rank = (index + 1).toString().padStart(4);
        const name = entry.id.padEnd(18);
        const rating = entry.rating.toString().padStart(6);
        const record = `${entry.wins}-${entry.losses}-${entry.draws}`.padEnd(11);
        const winRate = `${entry.winRate}%`.padStart(6);
        const avgDmg = entry.avgDamage.toString().padStart(8);
        const avgHeal = entry.avgHealing.toString().padStart(9);
        const avgTicks = entry.avgTicks.toString().padStart(9);

        console.log(`${rank} | ${name} | ${rating} | ${record} | ${winRate} | ${avgDmg} | ${avgHeal} | ${avgTicks}`);
    });
}

function saveRecording(recording, filename) {
    if (!recording) {
        console.warn('\nWarning: Recording requested but no battle data was captured.');
        return;
    }

    fs.writeFileSync(filename, JSON.stringify(recording, null, 2));
    console.log(`\nRecording saved to ${filename}`);
}

try {
    const result = runSimulation({
        mode: config.mode,
        battles: config.battles,
        compositions: config.compositions,
        scenario: config.scenario,
        verbose: config.verbose,
        entropy: config.entropy,
        record: Boolean(config.record),
        heatmap: false
    });

    switch (result.mode) {
        case 'elo':
            console.log('=== ELO RATING TOURNAMENT ===\n');
            console.log(`Generated ${config.compositions} compositions.`);
            console.log(`Completed ${result.matchups} matchups.\n`);
            printLeaderboard(result.leaderboard);
            break;
        case 'predefined':
            console.log(`=== PREDEFINED SCENARIO: ${result.scenario} ===`);
            result.runs.forEach(printRunSummary);
            break;
        case 'random':
            console.log('=== RANDOM COMPOSITION TEST ===');
            console.log(`Running ${config.battles} battles with random compositions...`);
            result.runs.forEach(printRunSummary);
            break;
        case 'quick':
        default:
            console.log('=== QUICK TEST MODE ===');
            result.runs.forEach(printRunSummary);
            break;
    }

    if (config.record) {
        saveRecording(result.recording, config.record);
    }
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}
