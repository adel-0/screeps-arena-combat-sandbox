/**
 * ELO Rating System - Rate squad composition effectiveness
 */

export class ELOSystem {
    /**
     * Create ELO rating system
     * @param {number} kFactor - K-factor for rating adjustments (default 32)
     * @param {number} startingRating - Initial rating for new compositions (default 1500)
     */
    constructor(kFactor = 32, startingRating = 1500) {
        this.kFactor = kFactor;
        this.startingRating = startingRating;
        this.ratings = new Map(); // compositionId -> { rating, wins, losses, draws, battles }
    }

    /**
     * Initialize composition if not exists
     * @param {string} compositionId - Unique composition identifier
     */
    initializeComposition(compositionId) {
        if (!this.ratings.has(compositionId)) {
            this.ratings.set(compositionId, {
                rating: this.startingRating,
                wins: 0,
                losses: 0,
                draws: 0,
                battles: 0,
                totalDamage: 0,
                totalHealing: 0,
                totalTicks: 0
            });
        }
    }

    /**
     * Calculate expected score
     * @param {number} ratingA - Rating of composition A
     * @param {number} ratingB - Rating of composition B
     * @returns {number} Expected score (0-1)
     */
    calculateExpectedScore(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }

    /**
     * Update ratings after battle
     * @param {string} compositionA - ID of composition A
     * @param {string} compositionB - ID of composition B
     * @param {number} scoreA - Actual score for A (1 = win, 0.5 = draw, 0 = loss)
     * @param {Object} battleResults - Detailed battle results (optional)
     */
    updateRatings(compositionA, compositionB, scoreA, battleResults = null) {
        this.initializeComposition(compositionA);
        this.initializeComposition(compositionB);

        const statsA = this.ratings.get(compositionA);
        const statsB = this.ratings.get(compositionB);

        const ratingA = statsA.rating;
        const ratingB = statsB.rating;

        // Calculate expected scores
        const expectedA = this.calculateExpectedScore(ratingA, ratingB);
        const expectedB = 1 - expectedA;

        // Actual scores
        const scoreB = 1 - scoreA;

        // Update ratings
        const newRatingA = ratingA + this.kFactor * (scoreA - expectedA);
        const newRatingB = ratingB + this.kFactor * (scoreB - expectedB);

        statsA.rating = newRatingA;
        statsB.rating = newRatingB;

        // Update battle statistics
        statsA.battles++;
        statsB.battles++;

        if (scoreA === 1) {
            statsA.wins++;
            statsB.losses++;
        } else if (scoreA === 0) {
            statsA.losses++;
            statsB.wins++;
        } else {
            statsA.draws++;
            statsB.draws++;
        }

        // Update detailed stats if provided
        if (battleResults) {
            if (battleResults.player) {
                statsA.totalDamage += battleResults.player.totalDamage || 0;
                statsA.totalHealing += battleResults.player.totalHealing || 0;
                statsA.totalTicks += battleResults.ticks || 0;
            }
            if (battleResults.enemy) {
                statsB.totalDamage += battleResults.enemy.totalDamage || 0;
                statsB.totalHealing += battleResults.enemy.totalHealing || 0;
                statsB.totalTicks += battleResults.ticks || 0;
            }
        }
    }

    /**
     * Record battle result
     * @param {string} compositionA - ID of composition A (player)
     * @param {string} compositionB - ID of composition B (enemy)
     * @param {string} winner - Winner ('player', 'enemy', or 'draw')
     * @param {Object} battleResults - Detailed battle results
     */
    recordBattle(compositionA, compositionB, winner, battleResults = null) {
        let scoreA;

        if (winner === 'player') {
            scoreA = 1;
        } else if (winner === 'enemy') {
            scoreA = 0;
        } else {
            scoreA = 0.5; // Draw
        }

        this.updateRatings(compositionA, compositionB, scoreA, battleResults);
    }

    /**
     * Get rating for composition
     * @param {string} compositionId - Composition ID
     * @returns {number} Current rating
     */
    getRating(compositionId) {
        const stats = this.ratings.get(compositionId);
        return stats ? stats.rating : this.startingRating;
    }

    /**
     * Get full statistics for composition
     * @param {string} compositionId - Composition ID
     * @returns {Object} Statistics object
     */
    getStats(compositionId) {
        return this.ratings.get(compositionId) || null;
    }

    /**
     * Get leaderboard sorted by rating
     * @param {number} limit - Maximum entries to return (0 = all)
     * @returns {Object[]} Sorted leaderboard
     */
    getLeaderboard(limit = 0) {
        const leaderboard = [];

        for (const [id, stats] of this.ratings.entries()) {
            leaderboard.push({
                id,
                rating: Math.round(stats.rating),
                wins: stats.wins,
                losses: stats.losses,
                draws: stats.draws,
                battles: stats.battles,
                winRate: stats.battles > 0 ? (stats.wins / stats.battles * 100).toFixed(1) : 0,
                avgDamage: stats.battles > 0 ? Math.round(stats.totalDamage / stats.battles) : 0,
                avgHealing: stats.battles > 0 ? Math.round(stats.totalHealing / stats.battles) : 0,
                avgTicks: stats.battles > 0 ? Math.round(stats.totalTicks / stats.battles) : 0
            });
        }

        // Sort by rating descending
        leaderboard.sort((a, b) => b.rating - a.rating);

        return limit > 0 ? leaderboard.slice(0, limit) : leaderboard;
    }

    /**
     * Find best matchup for a composition (close rating)
     * @param {string} compositionId - Composition to match
     * @param {string[]} candidates - Array of candidate composition IDs
     * @returns {string|null} Best match ID
     */
    findBestMatchup(compositionId, candidates) {
        const rating = this.getRating(compositionId);
        let bestMatch = null;
        let smallestDiff = Infinity;

        for (const candidateId of candidates) {
            if (candidateId === compositionId) continue;

            const candidateRating = this.getRating(candidateId);
            const diff = Math.abs(rating - candidateRating);

            if (diff < smallestDiff) {
                smallestDiff = diff;
                bestMatch = candidateId;
            }
        }

        return bestMatch;
    }

    /**
     * Export ratings to JSON
     * @returns {string} JSON string of all ratings
     */
    exportRatings() {
        const data = {};
        for (const [id, stats] of this.ratings.entries()) {
            data[id] = stats;
        }
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import ratings from JSON
     * @param {string} json - JSON string of ratings
     */
    importRatings(json) {
        const data = JSON.parse(json);
        for (const [id, stats] of Object.entries(data)) {
            this.ratings.set(id, stats);
        }
    }

    /**
     * Reset all ratings
     */
    reset() {
        this.ratings.clear();
    }
}
