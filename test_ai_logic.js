/**
 * test_ai_logic.js
 *
 * Standalone automated unit test suite verifying computer AI card removal,
 * hand count decrement, winning move execution, and smart Whot-20 shape calculation.
 */

const assert = require("assert");

console.log("=================================================");
console.log("🤖 NOLYWHOT COMPUTER AI UNIT TEST SUITE");
console.log("=================================================");

function createGameEnv() {
    const env = {
        deck: [],
        playerHand: [],
        opponentHand: [],
        topCard: { shape: "circle", number: 5 },
        requestedShape: null,
        playerTurn: false,
        gameOver: false,
        playerScore: 0,
        opponentScore: 0,
        isOpponentThinking: false,
        gameResultText: "",

        canPlay(card) {
            if (this.gameOver) return false;
            if (card.number === 20) return true;
            if (this.requestedShape) {
                return card.shape === this.requestedShape;
            }
            return card.shape === this.topCard.shape || card.number === this.topCard.number;
        },

        drawCard() {
            if (this.deck.length === 0) return null;
            return this.deck.pop();
        },

        checkWinner() {
            if (this.playerHand.length === 0) {
                this.gameOver = true;
                this.playerScore++;
                this.gameResultText = "🎉 YOU WIN!";
                return true;
            }
            if (this.opponentHand.length === 0) {
                this.gameOver = true;
                this.opponentScore++;
                this.gameResultText = "💻 COMPUTER WINS!";
                return true;
            }
            return false;
        },

        opponentPlay() {
            if (this.gameOver || this.playerTurn) {
                this.isOpponentThinking = false;
                return;
            }

            if (this.deck.length === 0) {
                this.isOpponentThinking = false;
                return;
            }

            if (this.isOpponentThinking) return;
            this.isOpponentThinking = true;

            // 1. Identify playable cards from current hand
            let playable = this.opponentHand.filter(card => this.canPlay(card));
            let chosenCard = null;

            if (playable.length > 0) {
                // Priority 1: Winning card if computer has 1 card left
                if (this.opponentHand.length === 1) {
                    chosenCard = playable[0];
                } else {
                    chosenCard =
                        playable.find(card => card.number === 2) ||
                        playable.find(card => card.number === 14) ||
                        playable.find(card => card.number === 8) ||
                        playable.find(card => card.number === 1) ||
                        playable.find(card => card.number === 20) ||
                        playable[0];
                }
            } else {
                const newCard = this.drawCard();
                if (newCard) {
                    this.opponentHand.push(newCard);
                    if (this.canPlay(newCard)) {
                        chosenCard = newCard;
                    }
                } else {
                    this.isOpponentThinking = false;
                    this.playerTurn = true;
                    return;
                }
            }

            if (!chosenCard) {
                this.isOpponentThinking = false;
                this.playerTurn = true;
                return;
            }

            const actualIndex = this.opponentHand.indexOf(chosenCard);
            if (actualIndex === -1 || this.gameOver) {
                this.isOpponentThinking = false;
                this.playerTurn = true;
                return;
            }

            // Immediately remove card from computer hand and update hand count
            const card = this.opponentHand.splice(actualIndex, 1)[0];
            this.topCard = card;

            if (card.number !== 20) {
                this.requestedShape = null;
            }

            // CHECK WINNER IMMEDIATELY IF HAND EMPTY
            if (this.opponentHand.length === 0) {
                this.checkWinner();
                this.isOpponentThinking = false;
                return;
            }

            // WHOT-20 SMART SHAPE SELECTION
            if (card.number === 20) {
                const shapeCounts = {
                    circle: 0,
                    triangle: 0,
                    cross: 0,
                    square: 0
                };

                this.opponentHand.forEach(c => {
                    if (c && c.shape && shapeCounts[c.shape] !== undefined) {
                        shapeCounts[c.shape]++;
                    }
                });

                let bestShape = "circle";
                let maxCount = -1;
                for (const [shape, count] of Object.entries(shapeCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        bestShape = shape;
                    }
                }

                const fallbackShapes = ["circle", "triangle", "cross", "square"];
                this.requestedShape = (maxCount > 0) ? bestShape : fallbackShapes[Math.floor(Math.random() * fallbackShapes.length)];
            }

            // HOLD ON (1)
            if (card.number === 1) {
                this.checkWinner();
                this.isOpponentThinking = false;
                return;
            }

            // PICK TWO (2)
            if (card.number === 2) {
                const c1 = this.drawCard();
                const c2 = this.drawCard();
                if (c1) this.playerHand.push(c1);
                if (c2) this.playerHand.push(c2);
                this.checkWinner();
                this.isOpponentThinking = false;
                return;
            }

            // SUSPENSION (8)
            if (card.number === 8) {
                this.checkWinner();
                this.isOpponentThinking = false;
                return;
            }

            // GENERAL MARKET (14)
            if (card.number === 14) {
                const newCard = this.drawCard();
                if (newCard) this.playerHand.push(newCard);
                this.checkWinner();
                this.isOpponentThinking = false;
                return;
            }

            // NORMAL CARD
            this.checkWinner();
            this.isOpponentThinking = false;
            this.playerTurn = true;
        }
    };

    return env;
}

// --- TEST 1: Exact card removal & immediate hand count decrement ---
console.log("\n--- TEST 1: Exact card removal & immediate hand count decrement ---");
{
    const env = createGameEnv();
    env.deck = [
        { shape: "cross", number: 7 }
    ];
    env.playerHand = [
        { shape: "circle", number: 10 }
    ];

    const cardA = { shape: "circle", number: 3 };
    const cardB = { shape: "triangle", number: 8 };
    const cardC = { shape: "square", number: 12 };
    env.opponentHand = [cardA, cardB, cardC];
    env.topCard = { shape: "circle", number: 1 };

    assert.strictEqual(env.opponentHand.length, 3, "Hand must start with 3 cards");
    env.opponentPlay();

    assert.strictEqual(env.opponentHand.length, 2, "Hand count must decrease to 2 immediately");
    assert.strictEqual(env.opponentHand.includes(cardA), false, "Played card must be removed from opponent hand");
    assert.strictEqual(env.topCard.number, 3, "Played card must now be topCard");
    console.log("✅ Passed: Card removed exactly once and hand count immediately decreased.");
}

// --- TEST 2: Playing final card reduces hand to 0 and declares Computer Win ---
console.log("\n--- TEST 2: Playing final card reduces hand to 0 and declares Computer Win ---");
{
    const env = createGameEnv();
    env.deck = [
        { shape: "star", number: 4 }
    ];
    env.playerHand = [
        { shape: "circle", number: 7 },
        { shape: "square", number: 10 }
    ];

    const finalCard = { shape: "triangle", number: 5 };
    env.opponentHand = [finalCard];
    env.topCard = { shape: "triangle", number: 2 };

    env.opponentPlay();

    assert.strictEqual(env.opponentHand.length, 0, "Opponent hand must be 0");
    assert.strictEqual(env.gameOver, true, "Game must be over");
    assert.strictEqual(env.gameResultText.includes("COMPUTER WINS"), true, "Must announce Computer Win");
    assert.strictEqual(env.opponentScore, 1, "Opponent score must be incremented");
    console.log("✅ Passed: Final card played cleanly, hand became 0, and Computer Win declared.");
}

// --- TEST 3: Special attack card (Pick Two) as last card triggers win ---
console.log("\n--- TEST 3: Special attack card (Pick Two) as last card triggers win ---");
{
    const env = createGameEnv();
    env.deck = [
        { shape: "circle", number: 1 },
        { shape: "circle", number: 2 },
        { shape: "circle", number: 3 }
    ];
    env.playerHand = [
        { shape: "triangle", number: 4 }
    ];

    const winningPickTwo = { shape: "circle", number: 2 };
    env.opponentHand = [winningPickTwo];
    env.topCard = { shape: "circle", number: 7 };

    env.opponentPlay();

    assert.strictEqual(env.opponentHand.length, 0, "Opponent hand must be 0");
    assert.strictEqual(env.gameOver, true, "Game must end immediately upon playing last card");
    assert.strictEqual(env.gameResultText.includes("COMPUTER WINS"), true, "Must declare Computer Win");
    console.log("✅ Passed: Special card 2 as last card wins the match immediately.");
}

// --- TEST 4: Whot-20 selects the most frequent shape in computer's hand ---
console.log("\n--- TEST 4: Whot-20 selects the most frequent shape in computer's hand ---");
{
    const env = createGameEnv();
    env.deck = [
        { shape: "circle", number: 1 }
    ];
    env.playerHand = [
        { shape: "cross", number: 3 }
    ];

    const whotCard = { shape: "whot", number: 20 };
    env.opponentHand = [
        whotCard,
        { shape: "triangle", number: 3 },
        { shape: "triangle", number: 10 },
        { shape: "square", number: 4 }
    ];
    env.topCard = { shape: "circle", number: 5 };

    env.opponentPlay();

    assert.strictEqual(env.opponentHand.length, 3, "Hand count must decrease from 4 to 3");
    assert.strictEqual(env.requestedShape, "triangle", "AI must intelligently choose triangle (most frequent in hand)");
    console.log("✅ Passed: AI calculated most frequent shape and requested triangle.");
}

// --- TEST 5: AI Never Plays a Card Not in Hand ---
console.log("\n--- TEST 5: AI never plays cards it does not hold ---");
{
    const env = createGameEnv();
    const marketCard = { shape: "cross", number: 11 };
    env.deck = [marketCard];
    env.playerHand = [
        { shape: "circle", number: 4 }
    ];

    const card1 = { shape: "triangle", number: 7 };
    const card2 = { shape: "square", number: 8 };
    env.opponentHand = [card1, card2];
    env.topCard = { shape: "circle", number: 3 }; // None of card1, card2 match circle 3

    env.opponentPlay();

    assert.strictEqual(env.opponentHand.length, 3, "Hand must contain the drawn card");
    assert.strictEqual(env.playerTurn, true, "Turn must pass to player when no playable card exists");
    assert.strictEqual(env.topCard.number, 3, "topCard must remain unchanged");
    console.log("✅ Passed: AI did not play unheld cards and passed turn cleanly.");
}

console.log("\n=================================================");
console.log("🎉 ALL COMPUTER AI TESTS PASSED SUCCESSFULLY! ✅");
console.log("=================================================");
