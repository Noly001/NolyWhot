// =====================================
// FIREBASE
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAI6i5KtbiXbI1nbq3FejALTKCQ1EADvP8",
    authDomain: "nolywhot.firebaseapp.com",
    databaseURL: "https://nolywhot-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "nolywhot",
    storageBucket: "nolywhot.firebasestorage.app",
    messagingSenderId: "543801656851",
    appId: "1:543801656851:web:6d04824d5610304c80a1e6",
    measurementId: "G-HGS0F2TMRF"
};

const firebaseApp = initializeApp(firebaseConfig);

const database = getDatabase(firebaseApp);

const auth = getAuth(firebaseApp);

let currentUser = null;

const firebaseReady = signInAnonymously(auth)
    .then((result) => {

        currentUser = result.user;

        console.log("🔥 Anonymous Firebase login successful!");
        console.log("👤 Player UID:", currentUser.uid);
        console.log("🔥 Realtime Database ready!");

    })
    .catch((error) => {

        console.error("❌ Firebase anonymous login failed:", error);

    });


// =====================================
// ONLINE ROOM SYSTEM
// =====================================

const createRoomButton =
    document.getElementById("createRoomButton");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const roomCodeText =
    document.getElementById("roomCodeText");

const lobbyMessage =
    document.getElementById("lobbyMessage");

const gameContainer =
    document.getElementById("gameContainer");


// Generate a 6-character room code
function generateRoomCode(){

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for(let i = 0; i < 6; i++){

        code += characters[
            Math.floor(Math.random() * characters.length)
        ];

    }

    return code;

}


// CREATE ROOM
createRoomButton.onclick = async function(){

    createRoomButton.disabled = true;

    lobbyMessage.textContent =
        "Creating room...";

    try{

        await firebaseReady;

        if(!currentUser){

            throw new Error("Firebase user not ready.");

        }

        const roomCode = generateRoomCode();

        const roomRef =
            ref(database, "rooms/" + roomCode);

        await set(roomRef, {

            host: currentUser.uid,

            guest: null,

            status: "waiting",

            createdAt: Date.now()

        });

        roomCodeText.textContent = roomCode;

        roomCodeDisplay.classList.remove("hidden");

        lobbyMessage.textContent =
            "Waiting for Player 2...";

        createRoomButton.style.display = "none";

        console.log(
            "🎮 Room created:",
            roomCode
        );

        // Hide the actual card game while waiting
        gameContainer.style.display = "none";

    }catch(error){

        console.error(
            "❌ Room creation failed:",
            error
        );

        lobbyMessage.textContent =
            "Could not create room. Try again.";

        createRoomButton.disabled = false;

    }

};
// =====================================
// NOLYWHOT V3 PROFESSIONAL
// PART 1
// =====================================

// ---------- DOM ----------

const playerHandDiv = document.getElementById("playerHand");
const opponentHandDiv = document.getElementById("opponentHand");

const marketCardDiv = document.getElementById("marketCard");
const playedCardDiv = document.getElementById("playedCard");

const marketCount = document.getElementById("marketCount");

const playerScoreText = document.getElementById("playerScore");
const opponentScoreText = document.getElementById("opponentScore");

const timerText = document.getElementById("turnTimer");
const messageText = document.getElementById("message");

const shapeChooser = document.getElementById("shapeChooser");
const shapeButtons = document.querySelectorAll(".shapeButton");

const gameOverScreen = document.getElementById("gameOverScreen");
const gameResult = document.getElementById("gameResult");

const restartButton = document.getElementById("restartButton");
const homeButton = document.getElementById("homeButton");

// ---------- GAME DATA ----------

const playSound = new Audio("assets/sounds/play.mp3");
const shuffleSound = new Audio("assets/sounds/Shuffle.mp3");
const specialSound = new Audio("assets/sounds/spacial.mp3");
const winSound = new Audio("assets/sounds/Win.mp3");
const loseSound = new Audio("assets/sounds/Lose.mp3");

const SHAPES = [
    "circle",
    "triangle",
    "cross",
    "square",
    "star"
];

const NUMBERS = [
    1,2,3,4,5,7,8,10,11,12,13,14
];

let deck = [];

let playerHand = [];
let opponentHand = [];

let topCard = null;

let playerTurn = true;

let gameOver = false;

let requestedShape = null;
let pickTwoActive = false;
let generalMarketActive = false;
let timer = null;
let timeLeft = 20;

let playerScore = 0;
let opponentScore = 0;
// =====================================
// CREATE DECK (OFFICIAL NIGERIAN WHOT)
// =====================================

function createDeck() {

    deck = [];

    const SHAPES = [
        "circle",
        "triangle",
        "cross",
        "square"
    ];

    const NUMBERS = [
        1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14
    ];

    // Add one of each numbered card
    SHAPES.forEach(shape => {
        NUMBERS.forEach(number => {
            deck.push({
                shape: shape,
                number: number
            });
        });
    });

    // Add two WHOT cards
    deck.push({
        shape: "whot",
        number: 20
    });

    deck.push({
        shape: "whot",
        number: 20
    });

}

// =====================================
// SHUFFLE
// =====================================

function shuffleDeck(){

    for(let i=deck.length-1;i>0;i--){

        const j=Math.floor(Math.random()*(i+1));

        [deck[i],deck[j]]=[deck[j],deck[i]];

    }

}

// =====================================
// DRAW CARD
// =====================================

function drawCard(){

    if(deck.length===0){

        return null;

    }

    return deck.pop();

}

// =====================================
// START GAME
// =====================================

function startGame(){

    clearInterval(timer);

    gameOver=false;

    requestedShape=null;

    playerTurn=true;

    createDeck();

    shuffleDeck();

    playerHand=[];

    opponentHand=[];

    for(let i=0;i<6;i++){

        playerHand.push(drawCard());

        opponentHand.push(drawCard());

    }

    do{

        topCard=drawCard();

    }while(topCard.number===20);

    updateBoard();

    startTimer();

}
// =====================================
// CREATE CARD
// =====================================

function createCard(card, hidden = false){

    const div = document.createElement("div");
    div.className = "card";

    const img = document.createElement("img");

    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.borderRadius = "10px";

    if(hidden){

        img.src = "assets/cards/back.png";
    }else{

        if(card.number === 20){

            img.src = "assets/cards/whot/whot20.png";

        }else{

            img.src = `assets/cards/${card.shape}/${card.shape}${card.number}.png`;

        }

    }

    img.onerror = function(){
        console.log("Image not found:", img.src);
        img.src = "assets/cards/back.png";
    };

    div.appendChild(img);

    return div;
}
// =====================================
// UPDATE SCORES
// =====================================

function updateScores(){

    playerScoreText.textContent = playerScore;

    opponentScoreText.textContent = opponentScore;

}

// =====================================
// DISPLAY PLAYER
// =====================================

function displayPlayerCards(){

    playerHandDiv.innerHTML = "";

    playerHand.forEach((card,index)=>{

        const cardDiv = createCard(card,false);

        cardDiv.onclick = ()=>playCard(index);

        playerHandDiv.appendChild(cardDiv);

    });

}

// =====================================
// DISPLAY OPPONENT
// =====================================

function displayOpponentCards(){

    opponentHandDiv.innerHTML = "";

    opponentHand.forEach(()=>{

        opponentHandDiv.appendChild(
            createCard(null,true)
        );

    });

}

// =====================================
// DISPLAY PLAYED CARD
// =====================================

function displayPlayedCard(){

    playedCardDiv.innerHTML = "";

    playedCardDiv.appendChild(

        createCard(topCard,false)

    );

}

// =====================================
// DISPLAY MARKET
// =====================================

function displayMarket(){

    marketCardDiv.innerHTML = "";

    marketCardDiv.appendChild(

        createCard(null,true)

    );

    marketCount.textContent = deck.length;

}

// =====================================
// UPDATE BOARD
// =====================================

function updateBoard(){

    displayPlayerCards();

    displayOpponentCards();

    displayPlayedCard();

    displayMarket();

    updateScores();

    if(requestedShape){

        messageText.textContent =
        "Requested Shape : " +
        requestedShape.toUpperCase();

    }else if(playerTurn){

        messageText.textContent =
        "Your Turn";

    }else{

        messageText.textContent =
        "Computer Thinking...";

    }

}
    
// =====================================
// CAN PLAY
// =====================================

function canPlay(card){

    if(card.number === 20){

        return true;

    }

    if(requestedShape){

        return card.shape === requestedShape;

    }

    return (

        card.shape === topCard.shape ||

        card.number === topCard.number

    );

}
// =====================================
// PLAY CARD
// =====================================

function playCard(index){

    if(!playerTurn) return;

    if(gameOver) return;

    const card = playerHand[index];

    if(!canPlay(card)){

        messageText.textContent = "You cannot play that card.";

        return;

    }

    clearInterval(timer);

    // ==========================
    // ANIMATE SELECTED CARD
    // ==========================

    const cardElement = playerHandDiv.children[index];

    cardElement.classList.add("playing");

    setTimeout(()=>{

        // Remove card from player's hand
        playerHand.splice(index,1);

        // Put card on center
        topCard = card;

        // Sound
        playSound.currentTime = 0;
        playSound.play();

        // Update display
        displayPlayedCard();
        displayPlayerCards();

        // ==========================
        // WHOT (20)
        // ==========================

        if(card.number === 20){

            checkWinner();

            if(gameOver){
                return;
            }

            requestedShape = null;

            displayPlayerCards();

            // Show shape chooser
            shapeChooser.classList.remove("hidden");

            return;
        }

        requestedShape = null;

        // ==========================
        // HOLD ON (1)
        // Player plays again
        // ==========================

        if(card.number === 1){

            updateBoard();

            checkWinner();

            if(!gameOver){

                playerTurn = true;

                startTimer();

            }

            return;
        }

        // ==========================
        // PICK TWO (2)
        // ==========================

        if(card.number === 2){

            const c1 = drawCard();
            const c2 = drawCard();

            if(c1) opponentHand.push(c1);
            if(c2) opponentHand.push(c2);

            messageText.textContent =
            "Computer picked two cards.";

            updateBoard();

            checkWinner();

            if(gameOver) return;

            playerTurn = true;

            startTimer();

            return;
        }

        // ==========================
        // SUSPENSION (8)
        // Player plays again
        // ==========================

        if(card.number === 8){

            updateBoard();

            checkWinner();

            if(!gameOver){

                playerTurn = true;

                startTimer();

            }

            return;
        }

        // ==========================
        // GENERAL MARKET (14)
        // ==========================

        if(card.number === 14){

            const cardDrawn = drawCard();

            if(cardDrawn){

                opponentHand.push(cardDrawn);

            }

            messageText.textContent =
            "Computer picked one card.";

            updateBoard();

            checkWinner();

            if(gameOver) return;

            playerTurn = true;

            startTimer();

            return;
        }

        // ==========================
        // NORMAL CARD
        // Opponent's turn
        // ==========================

        checkWinner();

        if(gameOver) return;

        updateBoard();

        playerTurn = false;

        setTimeout(opponentPlay,800);

    },450);

}
// =====================================
// PICK FROM MARKET
// =====================================

function pickCard(){

    if(!playerTurn) return;

    clearInterval(timer);

    const card = drawCard();

    if(!card){

        checkMarketWinner();

        return;

    }

    // ==========================
    // ANIMATE MARKET CARD
    // ==========================

    const marketElement = marketCardDiv;

    if(marketElement){

        marketElement.classList.add("drawing");

    }

    setTimeout(()=>{

        // Add card to player's hand
        playerHand.push(card);

        // Remove animation class
        if(marketElement){

            marketElement.classList.remove("drawing");

        }

        updateBoard();

        // ==========================
        // PICK TWO / GENERAL MARKET
        // ==========================

        if(pickTwoActive || generalMarketActive){

            pickTwoActive = false;
            generalMarketActive = false;

            playerTurn = false;

            clearInterval(timer);

            setTimeout(opponentPlay,800);

            return;

        }

        // ==========================
        // NORMAL MARKET PICK
        // ==========================

        playerTurn = false;

        clearInterval(timer);

        setTimeout(opponentPlay,800);

    },450);

}
// =====================================
// SHAPE CHOOSER
// =====================================

shapeButtons.forEach(button=>{

    button.onclick=function(){

        requestedShape=button.dataset.shape;

        shapeChooser.classList.add("hidden");

        updateBoard();

        playerTurn=false;

        setTimeout(opponentPlay,800);

    };

});

// =====================================
// COMPUTER AI
// =====================================

function opponentPlay(){

    if(gameOver) return;

    clearInterval(timer);

    // Find all playable cards
    let playableCards = opponentHand.filter(card => canPlay(card));

    let chosenCard =
        playableCards.find(card => card.number === 2) ||
        playableCards.find(card => card.number === 8) ||
        playableCards.find(card => card.number === 20) ||
        playableCards.find(card => card.number === 14) ||
        playableCards[0];

    let index = opponentHand.indexOf(chosenCard);

    // ==========================
    // NO PLAYABLE CARD
    // ==========================

    if(index === -1){

        const newCard = drawCard();

        if(newCard){

            opponentHand.push(newCard);

            playableCards = opponentHand.filter(card => canPlay(card));

            chosenCard =
                playableCards.find(card => card.number === 2) ||
                playableCards.find(card => card.number === 8) ||
                playableCards.find(card => card.number === 20) ||
                playableCards.find(card => card.number === 14) ||
                playableCards[0];

            index = opponentHand.indexOf(chosenCard);

        }else{

            checkMarketWinner();

            updateBoard();

            playerTurn = true;

            startTimer();

            return;

        }

        if(index === -1){

            updateBoard();

            playerTurn = true;

            startTimer();

            return;

        }

    }

    // ==========================
    // ANIMATE COMPUTER CARD
    // ==========================

    const cardElement = opponentHandDiv.children[index];

    if(cardElement){

        cardElement.classList.add("playing");
    }

    setTimeout(()=>{

        // Remove selected card from computer hand
        const card = opponentHand.splice(index,1)[0];

        // Put card on center
        topCard = card;

        // Sound
        playSound.currentTime = 0;
        playSound.play();

        // Display played card
        displayPlayedCard();

        requestedShape = null;

        // ==========================
        // WHOT (20)
        // ==========================

        if(card.number === 20){

            const shapes = [
                "circle",
                "triangle",
                "cross",
                "square"
            ];

            requestedShape =
                shapes[Math.floor(Math.random()*shapes.length)];

            messageText.textContent =
                "Computer requested " +
                requestedShape.toUpperCase();

        }

        // ==========================
        // HOLD ON (1)
        // ==========================

        if(card.number === 1){

            updateBoard();

            checkWinner();

            if(!gameOver){

                setTimeout(opponentPlay,800);

            }

            return;

        }

        // ==========================
        // PICK TWO (2)
        // ==========================

        if(card.number === 2){

            const c1 = drawCard();
            const c2 = drawCard();

            if(c1) playerHand.push(c1);
            if(c2) playerHand.push(c2);

            messageText.textContent =
                "You picked two cards.";

            updateBoard();

            // Computer continues playing
            setTimeout(opponentPlay,800);

            return;

        }

        // ==========================
        // SUSPENSION (8)
        // ==========================

        if(card.number === 8){

            updateBoard();

            checkWinner();

            if(!gameOver){

                setTimeout(opponentPlay,800);

            }

            return;

        }

        // ==========================
        // GENERAL MARKET (14)
        // ==========================

        if(card.number === 14){

            const newCard = drawCard();

            if(newCard){

                playerHand.push(newCard);

            }

            messageText.textContent =
                "You picked one card.";

            updateBoard();

            // Computer continues playing
            setTimeout(opponentPlay,800);

            return;

        }

        // ==========================
        // NORMAL CARD
        // Player's turn
        // ==========================

        checkWinner();

        if(gameOver) return;

        updateBoard();

        playerTurn = true;

        startTimer();

    },450);

}
// =====================================
// TIMER
// =====================================

function startTimer(){

    clearInterval(timer);

    timeLeft=20;

    timerText.textContent=timeLeft;

    timer=setInterval(()=>{

        timeLeft--;

        timerText.textContent=timeLeft;

        if(timeLeft<=0){

            clearInterval(timer);

            if(playerTurn){

                pickCard();

            }

        }

    },1000);

}
// =====================================
// CHECK WINNER
// =====================================

function checkWinner(){

    if(playerHand.length===0){

        gameOver=true;

        clearInterval(timer);

        playerScore++;

        updateScores();

        gameResult.textContent="🎉 YOU WIN!";

        gameOverScreen.classList.remove("hidden");

        return;

    }

    if(opponentHand.length===0){

        gameOver=true;

        clearInterval(timer);

        opponentScore++;

        updateScores();

        gameResult.textContent="💻 COMPUTER WINS!";

        gameOverScreen.classList.remove("hidden");

        return;

    }

}
// =====================================
// MARKET EMPTY WINNER
// =====================================

function checkMarketWinner(){

    // If the player can still play, continue the game.
    if(playerHand.some(card => canPlay(card))){
        return;
    }

    // If the computer can still play, continue the game.
    if(opponentHand.some(card => canPlay(card))){
        return;
    }

    let playerTotal = 0;
    let opponentTotal = 0;

    playerHand.forEach(card => {
        playerTotal += card.number;
    });

    opponentHand.forEach(card => {
        opponentTotal += card.number;
    });

    gameOver = true;

    clearInterval(timer);

    if(playerTotal < opponentTotal){

        playerScore++;

        updateScores();

        gameResult.textContent =
            "🎉 YOU WIN!\nYour Total: " + playerTotal +
            " | Computer Total: " + opponentTotal;

    }else if(opponentTotal < playerTotal){

        opponentScore++;

        updateScores();

        gameResult.textContent =
            "💻 COMPUTER WINS!\nYour Total: " + playerTotal +
            " | Computer Total: " + opponentTotal;

    }else{

        gameResult.textContent =
            "🤝 DRAW!\nBoth Total: " + playerTotal;

    }

    gameOverScreen.classList.remove("hidden");

}
// =====================================
// RESTART
// =====================================

restartButton.onclick=function(){

    gameOverScreen.classList.add("hidden");

    startGame();

};

// =====================================
// HOME
// =====================================

homeButton.onclick=function(){

    window.location.href="index.html";

};

// =====================================
// START GAME
// =====================================

startGame();
marketCardDiv.addEventListener("click", pickCard);