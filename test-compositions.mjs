#!/usr/bin/env node

/**
 * Comprehensive Squad Composition Testing
 */

import { CombatEngine } from './core/combat-engine.mjs';
import { ScenarioGenerator } from './scenarios/scenario-generator.mjs';
import { BODYPART_COST } from './core/constants.mjs';

const BATTLES_PER_MATCHUP = 20;

const compositions = [
    'current_strategy',
    'ranged_kite',
    'ranged_4_2',
    'ranged_5_2',
    'heavy_melee',
    'melee_5_2',
    'hybrid_squad',
    'hybrid_2r_2m_2h',
    'tank_squad',
    'pure_ranged',
    'heavy_ranged'
];

function calculateCost(composition) {
    return composition.reduce((sum, unit) => {
        return sum + unit.body.reduce((s, part) => s + BODYPART_COST[part], 0);
    }, 0);
}

function printCompositionDetails(name, composition) {
    const cost = calculateCost(composition);
    const roles = {};
    composition.forEach(unit => {
        roles[unit.role] = (roles[unit.role] || 0) + 1;
    });

    const roleStr = Object.entries(roles)
        .map(([role, count]) => `${count}×${role}`)
        .join(', ');

    console.log(`${name.padEnd(20)} | ${composition.length} units | ${cost} energy | ${roleStr}`);
}

console.log('=== COMPOSITION DETAILS ===\n');
console.log('Name                 | Units | Cost    | Composition');
console.log('---------------------|-------|---------|----------------------------------');

const generator = new ScenarioGenerator();
compositions.forEach(name => {
    const comp = generator.getPredefinedComposition(name);
    if (comp) {
        printCompositionDetails(name, comp);
    }
});

console.log('\n=== RUNNING MATCHUP MATRIX ===\n');
console.log(`Testing ${compositions.length} compositions, ${BATTLES_PER_MATCHUP} battles each...\n`);

// Results matrix
const results = {};
for (const comp of compositions) {
    results[comp] = {
        wins: 0,
        losses: 0,
        draws: 0,
        totalDamage: 0,
        totalTicks: 0,
        matchups: {}
    };
}

let matchupCount = 0;
const totalMatchups = compositions.length * (compositions.length - 1) / 2;

// Run round-robin tournament
for (let i = 0; i < compositions.length; i++) {
    for (let j = i + 1; j < compositions.length; j++) {
        const compA = compositions[i];
        const compB = compositions[j];

        matchupCount++;
        process.stdout.write(`\r[${matchupCount}/${totalMatchups}] Testing ${compA} vs ${compB}...`);

        const playerComp = generator.getPredefinedComposition(compA);
        const enemyComp = generator.getPredefinedComposition(compB);

        const engine = new CombatEngine({ verbose: false });
        const battleResults = engine.runMultipleBattles(BATTLES_PER_MATCHUP, (eng) => {
            const playerSquad = generator.createSquad(playerComp, 10, 45, true);
            const enemySquad = generator.createSquad(enemyComp, 90, 54, false);

            playerSquad.forEach(c => eng.addCreep(c));
            enemySquad.forEach(c => eng.addCreep(c));
        });

        // Record results
        results[compA].wins += battleResults.wins;
        results[compA].losses += battleResults.losses;
        results[compA].draws += battleResults.draws;
        results[compA].totalTicks += battleResults.avgTicks * BATTLES_PER_MATCHUP;
        results[compA].matchups[compB] = battleResults.winRate;

        results[compB].wins += battleResults.losses;
        results[compB].losses += battleResults.wins;
        results[compB].draws += battleResults.draws;
        results[compB].totalTicks += battleResults.avgTicks * BATTLES_PER_MATCHUP;
        results[compB].matchups[compA] = 1 - battleResults.winRate;
    }
}

console.log('\n\n=== OVERALL RANKINGS ===\n');

// Calculate overall stats
const rankings = compositions.map(name => {
    const stats = results[name];
    const totalBattles = stats.wins + stats.losses + stats.draws;
    const winRate = totalBattles > 0 ? stats.wins / totalBattles : 0;
    const avgTicks = totalBattles > 0 ? stats.totalTicks / totalBattles : 0;

    return {
        name,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        winRate,
        avgTicks,
        score: winRate * 100
    };
});

// Sort by win rate
rankings.sort((a, b) => b.winRate - a.winRate);

console.log('Rank | Composition          | W-L-D          | Win%  | Avg Ticks | Score');
console.log('-----|---------------------|----------------|-------|-----------|-------');

rankings.forEach((entry, index) => {
    const rank = (index + 1).toString().padStart(4);
    const name = entry.name.padEnd(20);
    const record = `${entry.wins}-${entry.losses}-${entry.draws}`.padEnd(15);
    const winRate = `${(entry.winRate * 100).toFixed(1)}%`.padStart(6);
    const avgTicks = entry.avgTicks.toFixed(0).padStart(10);
    const score = entry.score.toFixed(1).padStart(6);

    console.log(`${rank} | ${name} | ${record} | ${winRate} | ${avgTicks} | ${score}`);
});

console.log('\n=== DETAILED MATCHUP MATRIX ===\n');
console.log('Shows win rate of row vs column\n');

// Print header
process.stdout.write('                     |');
compositions.forEach(comp => {
    process.stdout.write(` ${comp.substring(0, 6).padEnd(6)} |`);
});
console.log('');

// Print separator
process.stdout.write('---------------------|');
compositions.forEach(() => process.stdout.write('--------|'));
console.log('');

// Print rows
compositions.forEach(rowComp => {
    process.stdout.write(`${rowComp.padEnd(20)} |`);

    compositions.forEach(colComp => {
        if (rowComp === colComp) {
            process.stdout.write('   --   |');
        } else {
            const winRate = results[rowComp].matchups[colComp];
            if (winRate !== undefined) {
                const percentage = `${(winRate * 100).toFixed(0)}%`.padStart(6);
                process.stdout.write(` ${percentage} |`);
            } else {
                process.stdout.write('   --   |');
            }
        }
    });
    console.log('');
});

console.log('\n=== KEY INSIGHTS ===\n');

// Find best overall
const best = rankings[0];
console.log(`🏆 Best Overall: ${best.name}`);
console.log(`   Win Rate: ${(best.winRate * 100).toFixed(1)}% (${best.wins}W-${best.losses}L-${best.draws}D)`);
console.log(`   Avg Duration: ${best.avgTicks.toFixed(0)} ticks\n`);

// Find best vs heavy melee
if (results['heavy_melee']) {
    const vsHeavyMelee = compositions
        .filter(c => c !== 'heavy_melee')
        .map(c => ({
            name: c,
            winRate: results[c].matchups['heavy_melee'] || 0
        }))
        .sort((a, b) => b.winRate - a.winRate);

    console.log(`💪 Best vs Heavy Melee: ${vsHeavyMelee[0].name}`);
    console.log(`   Win Rate: ${(vsHeavyMelee[0].winRate * 100).toFixed(1)}%\n`);
}

// Cost efficiency
const costEfficiency = rankings.map(r => {
    const comp = generator.getPredefinedComposition(r.name);
    const cost = calculateCost(comp);
    return {
        name: r.name,
        efficiency: r.score / cost * 1000,
        cost,
        score: r.score
    };
}).sort((a, b) => b.efficiency - a.efficiency);

console.log(`💰 Most Cost Efficient: ${costEfficiency[0].name}`);
console.log(`   Score per 1000 energy: ${costEfficiency[0].efficiency.toFixed(2)}`);
console.log(`   Total cost: ${costEfficiency[0].cost} energy\n`);

// Current strategy analysis
if (results['current_strategy']) {
    const current = rankings.find(r => r.name === 'current_strategy');
    const currentRank = rankings.indexOf(current) + 1;

    console.log(`📊 Your Current Strategy: Rank #${currentRank} of ${compositions.length}`);
    console.log(`   Win Rate: ${(current.winRate * 100).toFixed(1)}%`);
    console.log(`   Best Matchups:`);

    const currentMatchups = Object.entries(results['current_strategy'].matchups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    currentMatchups.forEach(([enemy, wr]) => {
        console.log(`     - vs ${enemy}: ${(wr * 100).toFixed(1)}%`);
    });

    console.log(`   Worst Matchups:`);
    const worstMatchups = Object.entries(results['current_strategy'].matchups)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3);

    worstMatchups.forEach(([enemy, wr]) => {
        console.log(`     - vs ${enemy}: ${(wr * 100).toFixed(1)}%`);
    });
}

console.log('\n=== RECOMMENDATIONS ===\n');

const topThree = rankings.slice(0, 3);
console.log('Based on the simulations, here are the top 3 strategies:\n');

topThree.forEach((strategy, index) => {
    const comp = generator.getPredefinedComposition(strategy.name);
    const cost = calculateCost(comp);

    console.log(`${index + 1}. ${strategy.name}`);
    console.log(`   - Win Rate: ${(strategy.winRate * 100).toFixed(1)}%`);
    console.log(`   - Cost: ${cost} energy`);
    console.log(`   - Avg Battle Duration: ${strategy.avgTicks.toFixed(0)} ticks`);
    console.log(`   - Composition: ${comp.length} units`);
    console.log('');
});
