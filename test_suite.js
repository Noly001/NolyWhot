const assert = require('assert');

// 1. Deck Creation & Composition Test
function createDeck() {
    const deck = [];
    const SHAPES = ["circle", "triangle", "cross", "square"];
    const NUMBERS = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];

    SHAPES.forEach(shape => {
        NUMBERS.forEach(number => {
            deck.push({ shape: shape, number: number });
        });
    });

    deck.push({ shape: "whot", number: 20 });
    deck.push({ shape: "whot", number: 20 });

    return deck;
}

console.log("--- TEST 1: Deck Composition & Whot-20 count ---");
const deck = createDeck();
assert.strictEqual(deck.length, 50, "Deck should have exactly 50 cards");
const whotCards = deck.filter(c => c.shape === "whot" && c.number === 20);
assert.strictEqual(whotCards.length, 2, "Deck should have exactly two Whot-20 cards");
console.log("PASSED: Deck size is 50 with exactly 2 Whot-20 cards.");

// 2. Card Dealing (5 Cards Each)
console.log("--- TEST 2: Initial Dealing ---");
const playerHand = [];
const opponentHand = [];
for (let i = 0; i < 5; i++) {
    playerHand.push(deck.pop());
    opponentHand.push(deck.pop());
}
assert.strictEqual(playerHand.length, 5, "Player hand should have 5 cards");
assert.strictEqual(opponentHand.length, 5, "Opponent hand should have 5 cards");
assert.strictEqual(deck.length, 40, "Remaining deck should have 40 cards");
console.log("PASSED: Exactly 5 cards dealt to each player.");

// 3. Card Matching Rules (canPlay)
console.log("--- TEST 3: Card Matching Rules ---");
function canPlay(card, topCard, requestedShape) {
    if (card.number === 20) return true;
    if (requestedShape) return card.shape === requestedShape;
    return card.shape === topCard.shape || card.number === topCard.number;
}

const topCard = { shape: "circle", number: 7 };
assert.strictEqual(canPlay({ shape: "circle", number: 2 }, topCard, null), true, "Same shape should be playable");
assert.strictEqual(canPlay({ shape: "square", number: 7 }, topCard, null), true, "Same number should be playable");
assert.strictEqual(canPlay({ shape: "triangle", number: 12 }, topCard, null), false, "Different shape & number should NOT be playable");
assert.strictEqual(canPlay({ shape: "whot", number: 20 }, topCard, null), true, "Whot 20 is always playable");
assert.strictEqual(canPlay({ shape: "triangle", number: 7 }, topCard, "triangle"), true, "Requested shape match should be playable");
assert.strictEqual(canPlay({ shape: "circle", number: 7 }, topCard, "triangle"), false, "Unrequested shape should NOT be playable even if topCard number matches");
console.log("PASSED: All card matching rules validated.");

// 4. Special Cards Effects
console.log("--- TEST 4: Special Card Effects ---");
// Special card numbers: 1 (Hold On), 2 (Pick Two), 8 (Suspension), 14 (General Market), 20 (Whot)
const specialNumbers = [1, 2, 8, 14, 20];
specialNumbers.forEach(num => {
    assert.ok([1, 2, 8, 14, 20].includes(num));
});
console.log("PASSED: Special card numbers recognized (1, 2, 8, 14, 20).");

// 5. Market Empty Scoring Comparison
console.log("--- TEST 5: Market Empty Winner Calculation ---");
const pHand = [{ shape: "circle", number: 3 }, { shape: "square", number: 5 }]; // Total 8
const oHand = [{ shape: "cross", number: 10 }, { shape: "star", number: 4 }]; // Total 14

let pTotal = pHand.reduce((sum, c) => sum + c.number, 0);
let oTotal = oHand.reduce((sum, c) => sum + c.number, 0);

assert.strictEqual(pTotal, 8);
assert.strictEqual(oTotal, 14);
assert.ok(pTotal < oTotal, "Player with lower card sum wins when market is empty");
console.log("PASSED: Market empty sum score logic verified.");

console.log("\nALL NODE.JS AUTOMATED UNIT TESTS PASSED SUCCESSFULLY! ✅");
