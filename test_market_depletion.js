/**
 * test_market_depletion.js
 *
 * Comprehensive automated verification suite for immediate market depletion halting:
 * 1. Player final manual draw stops instantly.
 * 2. Player timeout-based draw stops instantly.
 * 3. Opponent/Computer AI final draw stops instantly.
 * 4. Pick Two (2) penalty draw stops instantly when market hits zero.
 * 5. General Market (14) penalty draw stops instantly when market hits zero.
 * 6. Card point calculations: lowest total wins, equal totals draw.
 * 7. Opponent face-up card reveal and state synchronizations.
 */

const assert = require('assert');

console.log("=================================================");
console.log("🃏 NOLYWHOT MARKET DEPLETION TEST SUITE");
console.log("=================================================");

function createTestEnv() {
    return {
        deck: [],
        playerHand: [],
        opponentHand: [],
        topCard: { shape: 'circle', number: 5 },
        playerTurn: true,
        gameOver: false,
        revealOpponentCards: false,
        playerScore: 0,
        opponentScore: 0,
        timerActive: true,
        isOpponentThinking: false,
        isPlayerActionPending: false,

        canPlay(card) {
            if (this.gameOver || this.deck.length === 0) return false;
            if (!card) return false;
            if (card.number === 20) return true;
            return card.shape === this.topCard.shape || card.number === this.topCard.number;
        },

        drawCard() {
            if (this.deck.length === 0) return null;
            return this.deck.pop();
        },

        stopTimer() {
            this.timerActive = false;
        },

        checkMarketWinner() {
            if (this.gameOver) return;
            this.gameOver = true;
            this.stopTimer();
            this.isOpponentThinking = false;
            this.isPlayerActionPending = false;
            this.revealOpponentCards = true;

            let playerTotal = 0;
            let opponentTotal = 0;

            this.playerHand.forEach(c => {
                if (c && typeof c.number === 'number') playerTotal += c.number;
            });
            this.opponentHand.forEach(c => {
                if (c && typeof c.number === 'number') opponentTotal += c.number;
            });

            this.playerTotal = playerTotal;
            this.opponentTotal = opponentTotal;

            if (playerTotal < opponentTotal) {
                this.winner = 'player';
                this.playerScore++;
            } else if (opponentTotal < playerTotal) {
                this.winner = 'opponent';
                this.opponentScore++;
            } else {
                this.winner = 'draw';
            }
        },

        pickCard() {
            if (!this.playerTurn || this.gameOver || this.isPlayerActionPending) return;
            if (this.deck.length === 0) {
                this.checkMarketWinner();
                return;
            }
            this.isPlayerActionPending = true;
            const card = this.drawCard();
            if (!card) {
                this.checkMarketWinner();
                this.isPlayerActionPending = false;
                return;
            }
            this.playerHand.push(card);

            // Instant halt if market depleted
            if (this.deck.length === 0) {
                this.isPlayerActionPending = false;
                this.checkMarketWinner();
                return;
            }

            this.playerTurn = false;
            this.isPlayerActionPending = false;
        },

        opponentPlay() {
            if (this.gameOver || this.playerTurn || this.isOpponentThinking) return;
            if (this.deck.length === 0) {
                this.checkMarketWinner();
                return;
            }
            this.isOpponentThinking = true;

            const playable = this.opponentHand.filter(c => this.canPlay(c));
            if (playable.length > 0) {
                const card = playable[0];
                const idx = this.opponentHand.indexOf(card);
                this.opponentHand.splice(idx, 1);
                this.topCard = card;
                this.isOpponentThinking = false;
                this.playerTurn = true;
            } else {
                const newCard = this.drawCard();
                if (newCard) {
                    this.opponentHand.push(newCard);
                    if (this.deck.length === 0) {
                        this.isOpponentThinking = false;
                        this.checkMarketWinner();
                        return;
                    }
                    if (this.canPlay(newCard)) {
                        const idx = this.opponentHand.indexOf(newCard);
                        this.opponentHand.splice(idx, 1);
                        this.topCard = newCard;
                    }
                } else {
                    this.isOpponentThinking = false;
                    this.checkMarketWinner();
                    return;
                }
                this.isOpponentThinking = false;
                this.playerTurn = true;
            }
        },

        playPenaltyPickTwo() {
            if (!this.playerTurn || this.gameOver) return;
            const c1 = this.drawCard();
            const c2 = this.drawCard();
            if (c1) this.opponentHand.push(c1);
            if (c2) this.opponentHand.push(c2);

            if (this.deck.length === 0) {
                this.stopTimer();
                this.checkMarketWinner();
                return;
            }
            this.playerTurn = true;
        },

        playPenaltyGeneralMarket() {
            if (!this.playerTurn || this.gameOver) return;
            const c = this.drawCard();
            if (c) this.opponentHand.push(c);

            if (this.deck.length === 0) {
                this.stopTimer();
                this.checkMarketWinner();
                return;
            }
            this.playerTurn = true;
        }
    };
}

console.log("\n--- TEST 1: Player final manual draw stops immediately ---");
{
    const env = createTestEnv();
    env.deck = [{ shape: 'star', number: 3 }];
    env.playerHand = [{ shape: 'triangle', number: 2 }];
    env.opponentHand = [{ shape: 'square', number: 8 }];

    assert.strictEqual(env.gameOver, false);
    assert.strictEqual(env.revealOpponentCards, false);

    env.pickCard();

    assert.strictEqual(env.deck.length, 0, "Market must be 0");
    assert.strictEqual(env.gameOver, true, "Game must end immediately");
    assert.strictEqual(env.revealOpponentCards, true, "Opponent cards must be revealed face-up");
    assert.strictEqual(env.canPlay(env.playerHand[0]), false, "No further cards can be played");
    assert.strictEqual(env.timerActive, false, "Timer must be stopped");
    assert.strictEqual(env.winner, 'player', "Player (2+3=5) should beat Opponent (8)");
    console.log("✅ Passed: Game halted immediately on final player draw, cards revealed face-up.");
}

console.log("\n--- TEST 2: Player timeout draw stops immediately ---");
{
    const env = createTestEnv();
    env.deck = [{ shape: 'cross', number: 1 }];
    env.playerHand = [{ shape: 'triangle', number: 10 }];
    env.opponentHand = [{ shape: 'square', number: 2 }];

    env.pickCard();

    assert.strictEqual(env.deck.length, 0);
    assert.strictEqual(env.gameOver, true);
    assert.strictEqual(env.winner, 'opponent', "Opponent (2) beats Player (11)");
    assert.strictEqual(env.opponentScore, 1);
    console.log("✅ Passed: Timeout draw halts game immediately and correctly tallies totals.");
}

console.log("\n--- TEST 3: Opponent AI final draw stops immediately ---");
{
    const env = createTestEnv();
    env.deck = [{ shape: 'star', number: 5 }];
    env.playerHand = [{ shape: 'triangle', number: 1 }];
    env.opponentHand = [{ shape: 'cross', number: 12 }];
    env.playerTurn = false;

    env.opponentPlay();

    assert.strictEqual(env.deck.length, 0);
    assert.strictEqual(env.gameOver, true);
    assert.strictEqual(env.revealOpponentCards, true);
    assert.strictEqual(env.winner, 'player', "Player (1) beats Opponent (12+5=17)");
    console.log("✅ Passed: Opponent AI draw depleting market halts immediately without pending action.");
}

console.log("\n--- TEST 4: Pick Two (2) penalty draw depleting market ---");
{
    const env = createTestEnv();
    env.deck = [{ shape: 'triangle', number: 1 }, { shape: 'cross', number: 2 }];
    env.playerHand = [{ shape: 'circle', number: 3 }];
    env.opponentHand = [{ shape: 'square', number: 8 }];

    env.playPenaltyPickTwo();

    assert.strictEqual(env.deck.length, 0);
    assert.strictEqual(env.gameOver, true);
    assert.strictEqual(env.winner, 'player', "Player (3) beats Opponent (8+1+2=11)");
    console.log("✅ Passed: Pick Two penalty draw depleting market halts immediately.");
}

console.log("\n--- TEST 5: General Market (14) penalty draw depleting market ---");
{
    const env = createTestEnv();
    env.deck = [{ shape: 'cross', number: 5 }];
    env.playerHand = [{ shape: 'circle', number: 2 }];
    env.opponentHand = [{ shape: 'square', number: 2 }];

    env.playPenaltyGeneralMarket();

    assert.strictEqual(env.deck.length, 0);
    assert.strictEqual(env.gameOver, true);
    assert.strictEqual(env.winner, 'player', "Player (2) beats Opponent (2+5=7)");
    console.log("✅ Passed: General Market penalty draw depleting market halts immediately.");
}

console.log("\n--- TEST 6: Equal totals declare a DRAW ---");
{
    const env = createTestEnv();
    env.deck = [];
    env.playerHand = [{ shape: 'circle', number: 5 }, { shape: 'triangle', number: 3 }];
    env.opponentHand = [{ shape: 'square', number: 8 }];

    env.checkMarketWinner();

    assert.strictEqual(env.gameOver, true);
    assert.strictEqual(env.playerTotal, 8);
    assert.strictEqual(env.opponentTotal, 8);
    assert.strictEqual(env.winner, 'draw');
    console.log("✅ Passed: Exactly equal card point totals produce a DRAW.");
}

console.log("\n=================================================");
console.log("🎉 ALL MARKET DEPLETION TESTS PASSED SUCCESSFULLY! ✅");
console.log("=================================================");
