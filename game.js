// =====================================
// FIREBASE
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue
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
let onlineGameRef = null;
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
const onlineLobby =
    document.getElementById("onlineLobby");

const modeSelection =
    document.getElementById("modeSelection");
const joinRoomButton =
    document.getElementById("joinRoomButton");

const roomCodeInput =
    document.getElementById("roomCodeInput");
const playerNameText =
    document.getElementById("playerName");

const opponentNameText =
    document.getElementById("opponentName");
// =====================================
// GAME MODE
// =====================================

const urlParams = new URLSearchParams(window.location.search);

const gameMode = urlParams.get("mode");

let onlineMode = (gameMode === "online");
if(gameMode === "computer"){

    onlineMode = false;

}
let currentRoomCode = null;
let onlineGameStarted = false;
let onlinePlayerNumber = null;
console.log("🎮 Game Mode:", gameMode);
console.log("🌐 Online Mode:", onlineMode);
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


// =====================================
// CREATE ROOM
// =====================================

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

        // ==========================
        // HOST SETUP
        // ==========================

        onlinePlayerNumber = 1;
playerNameText.textContent = "PLAYER 1";
opponentNameText.textContent = "PLAYER 2";
        onlineMode = true;

        currentRoomCode = roomCode;

        onlineGameRef =
            ref(database, "rooms/" + roomCode + "/game");

        roomCodeText.textContent = roomCode;

        roomCodeDisplay.classList.remove("hidden");

        lobbyMessage.textContent =
            "Waiting for Player 2...";

        createRoomButton.style.display = "none";

        console.log(
            "🎮 Room created:",
            roomCode
        );

        // ==========================
        // WATCH FOR PLAYER 2
        // ==========================

        onValue(roomRef, (snapshot)=>{

            if(!snapshot.exists()) return;

            const room = snapshot.val();

            if(
                room.guest &&
                !onlineGameStarted
            ){

                onlineGameStarted = true;

                console.log(
                    "👤 Player 2 joined:",
                    room.guest
                );

                lobbyMessage.textContent =
                    "🎮 Player 2 joined! Starting game...";

                // ==========================
                // HIDE LOBBY
                // ==========================

                onlineLobby.style.display = "none";

                // ==========================
                // SHOW GAME
                // ==========================

                gameContainer.style.display = "block";

                // ==========================
                // CREATE SHARED GAME
                // ==========================

                startOnlineGame();

            }

        });

        // ==========================
        // LISTEN FOR GAME UPDATES
        // ==========================

        onValue(onlineGameRef, (snapshot)=>{

            if(!snapshot.exists()) return;

            const game = snapshot.val();

            deck =
                game.deck || [];

            topCard =
                game.topCard || null;

            requestedShape =
                game.requestedShape || null;

            gameOver =
                game.gameOver || false;

            playerHand =
                game.playerHand || [];

            opponentHand =
                game.opponentHand || [];

            playerTurn =
                game.playerTurn === 1;

            updateBoard();

            if(gameOver){

                clearInterval(timer);

                return;

            }

            if(playerTurn){

                startTimer();

            }else{

                clearInterval(timer);

            }

        });

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
// JOIN ROOM
// =====================================

joinRoomButton.onclick = async function(){

    const roomCode =
        roomCodeInput.value
        .trim()
        .toUpperCase();

    if(roomCode.length !== 6){

        lobbyMessage.textContent =
            "Please enter a valid 6-character room code.";

        return;

    }

    joinRoomButton.disabled = true;

    lobbyMessage.textContent =
        "Joining room...";

    try{

        await firebaseReady;

        if(!currentUser){

            throw new Error(
                "Firebase user not ready."
            );

        }

        const roomRef =
            ref(database, "rooms/" + roomCode);

        const snapshot =
            await new Promise((resolve,reject)=>{

                onValue(
                    roomRef,
                    resolve,
                    {
                        onlyOnce: true
                    }
                );

            });

        if(!snapshot.exists()){

            lobbyMessage.textContent =
                "Room not found.";

            joinRoomButton.disabled = false;

            return;

        }

        const room = snapshot.val();

        // ==========================
        // CHECK ROOM
        // ==========================

        if(room.guest){

            lobbyMessage.textContent =
                "Room is already full.";

            joinRoomButton.disabled = false;

            return;

        }

        // ==========================
        // PLAYER 2
        // ==========================

        onlinePlayerNumber = 2;
playerNameText.textContent = "PLAYER 2";
opponentNameText.textContent = "PLAYER 1";
        onlineMode = true;

        currentRoomCode = roomCode;

        onlineGameRef =
            ref(
                database,
                "rooms/" + roomCode + "/game"
            );

        // ==========================
        // IMPORTANT:
        // REGISTER PLAYER 2
        // ==========================

        await set(
            ref(
                database,
                "rooms/" +
                roomCode +
                "/guest"
            ),
            currentUser.uid
        );

        // ==========================
        // UPDATE ROOM STATUS
        // ==========================

        await set(
            ref(
                database,
                "rooms/" +
                roomCode +
                "/status"
            ),
            "playing"
        );

        onlineGameStarted = true;

        lobbyMessage.textContent =
            "🎮 Joined! Waiting for Player 1...";

        // ==========================
        // HIDE LOBBY
        // ==========================

        onlineLobby.style.display = "none";

        // ==========================
        // SHOW GAME
        // ==========================

        gameContainer.style.display = "block";

        console.log(
            "🎮 Player 2 joined room:",
            roomCode
        );

        // ==========================
        // RECEIVE PLAYER 1 GAME
        // ==========================

        onValue(onlineGameRef, (snapshot)=>{

            if(!snapshot.exists()){

                return;

            }

            const game = snapshot.val();

            // ==========================
            // SHARED DECK
            // ==========================

            deck =
                game.deck || [];

            // ==========================
            // TOP CARD
            // ==========================

            topCard =
                game.topCard || null;

            // ==========================
            // REQUESTED SHAPE
            // ==========================

            requestedShape =
                game.requestedShape || null;

            // ==========================
            // GAME OVER
            // ==========================

            gameOver =
                game.gameOver || false;

            // ==========================
            // PLAYER 2 OWN HAND
            // ==========================

            playerHand =
                game.opponentHand || [];

            // ==========================
            // PLAYER 1 HAND
            // ==========================

            opponentHand =
                game.playerHand || [];

            // ==========================
            // PLAYER 2 TURN
            // ==========================

            playerTurn =
                game.playerTurn === 2;

            // ==========================
            // UPDATE BOARD
            // ==========================

            updateBoard();

            // ==========================
            // GAME OVER
            // ==========================

            if(gameOver){

                clearInterval(timer);

                return;

            }

            // ==========================
            // TIMER
            // ==========================

            if(playerTurn){

                startTimer();

            }else{

                clearInterval(timer);

            }

            console.log(
                "✅ Player 2 received game update."
            );

        });

    }catch(error){

        console.error(
            "❌ Join room failed:",
            error
        );

        lobbyMessage.textContent =
            "Could not join room. Try again.";

        joinRoomButton.disabled = false;

    }

};

// =====================================
// NOLYWHOT V3 PROFESSIONAL
// PART 1
// =====================================
// ---------- DOM ----------

const playerHandDiv =
    document.getElementById("playerHand");

const opponentHandDiv =
    document.getElementById("opponentHand");
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
// ONLINE GAME SYNCHRONIZATION
// =====================================

function syncOnlineGame(){

    if(!onlineMode) return;

    if(!onlineGameRef) return;

    const gameState = {

        deck: deck,

        playerHand: playerHand,

        opponentHand: opponentHand,

        topCard: topCard,

        playerTurn: onlinePlayerNumber === 1
            ? (playerTurn ? 1 : 2)
            : (playerTurn ? 2 : 1),

        requestedShape: requestedShape,

        gameOver: gameOver

    };

    set(onlineGameRef, gameState);

    console.log(
        "🔥 Game synchronized with Firebase."
    );

}
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
// START ONLINE GAME
// =====================================

function startOnlineGame(){

    console.log("🌐 Creating shared online game...");

    clearInterval(timer);

    gameOver = false;
    requestedShape = null;

    // Player 1 starts
    playerTurn = true;

    // ==========================
    // CREATE DECK
    // ==========================

    createDeck();

    shuffleDeck();

    // ==========================
    // CLEAR HANDS
    // ==========================

    playerHand = [];
    opponentHand = [];

    // ==========================
    // DEAL 6 CARDS EACH
    // ==========================

    for(let i = 0; i < 6; i++){

        const playerCard = drawCard();
        const opponentCard = drawCard();

        if(playerCard){
            playerHand.push(playerCard);
        }

        if(opponentCard){
            opponentHand.push(opponentCard);
        }

    }

    // ==========================
    // FIRST PLAYED CARD
    // ==========================

    do{

        topCard = drawCard();

    }while(
        topCard &&
        topCard.number === 20
    );

    // ==========================
    // SHOW CARDS IMMEDIATELY
    // ==========================

    updateBoard();

    // ==========================
    // CREATE FIREBASE STATE
    // ==========================

    const gameState = {

        deck: deck,

        playerHand: playerHand,

        opponentHand: opponentHand,

        topCard: topCard,

        playerTurn: 1,

        requestedShape: null,

        gameOver: false

    };

    // ==========================
    // SAVE GAME
    // ==========================

    if(!onlineGameRef){

        console.error(
            "❌ onlineGameRef is missing."
        );

        lobbyMessage.textContent =
            "Could not connect to online game.";

        return;

    }

    set(onlineGameRef, gameState)

        .then(()=>{

            console.log(
                "✅ Online game created."
            );

            console.log(
                "🃏 Player 1 cards:",
                playerHand.length
            );

            console.log(
                "🃏 Player 2 cards:",
                opponentHand.length
            );

            console.log(
                "🃏 Market cards:",
                deck.length
            );

            updateBoard();

            startTimer();

        })

        .catch((error)=>{

            console.error(
                "❌ Could not save online game:",
                error
            );

            lobbyMessage.textContent =
                "Could not start online game.";

        });

}
// ====================================
// CREATE CARD
// ====================================

function createCard(card, hidden = false){

    const div = document.createElement("div");

    div.className = "card";

    div.style.width = "70px";
    div.style.height = "100px";
    div.style.display = "block";
    div.style.flexShrink = "0";

    const img = document.createElement("img");

    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.display = "block";
    img.style.borderRadius = "10px";

    // ==========================
    // HIDDEN CARD
    // ==========================

    if(hidden){

        img.src = "./back.png";

    }

    // ==========================
    // WHOT 20
    // ==========================

    else if(card && card.number === 20){

        img.src = "./whot20.png";

    }

    // ==========================
    // NORMAL CARD
    // ==========================

    else if(card){

        img.src =
            `./${card.shape}${card.number}.png`;

    }

    // ==========================
    // IMAGE ERROR
    // ==========================

    img.onerror = function(){

        console.log(
            "❌ Card image not found:",
            img.src
        );

        img.style.display = "none";

        div.textContent =
            card
            ? `${card.shape} ${card.number}`
            : "CARD";

        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "center";

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
            onlineMode
            ? "Your Turn"
            : "Your Turn";

    }else{

        messageText.textContent =
            onlineMode
            ? "Opponent's Turn"
            : "Computer Thinking...";

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

    if(!card) return;

    if(!canPlay(card)){

        messageText.textContent =
            "You cannot play that card.";

        return;

    }

    clearInterval(timer);

    // ==========================
    // ANIMATE SELECTED CARD
    // ==========================

    const cardElement =
        playerHandDiv.children[index];

    if(cardElement){

        cardElement.classList.add("playing");

    }

    setTimeout(()=>{

        // ==========================
        // REMOVE CARD FROM HAND
        // ==========================

        playerHand.splice(index,1);

        // ==========================
        // PUT CARD ON CENTER
        // ==========================

        topCard = card;

        // ==========================
        // SOUND
        // ==========================

        playSound.currentTime = 0;
        playSound.play();

        // ==========================
        // WHOT (20)
        // ==========================

        if(card.number === 20){

            requestedShape = null;

            displayPlayedCard();
            displayPlayerCards();
            updateBoard();

            checkWinner();

            if(gameOver){

                syncOnlineGame();

                return;

            }

            specialSound.currentTime = 0;
            specialSound.play();

            // ==========================
            // ONLINE MODE
            // Wait for this player
            // to choose the shape.
            // ==========================

            shapeChooser.classList.remove("hidden");

            syncOnlineGame();

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
                onlineMode
                ? "Opponent picked two cards."
                : "Computer picked two cards.";

            checkWinner();

            if(gameOver){

                syncOnlineGame();

                return;

            }

            playerTurn = true;

            updateBoard();

            startTimer();

            syncOnlineGame();

            return;

        }


        // ==========================
        // SUSPENSION (8)
        // Player plays again
        // ==========================

        if(card.number === 8){

            checkWinner();

            if(gameOver){

                syncOnlineGame();

                return;

            }

            playerTurn = true;

            updateBoard();

            startTimer();

            syncOnlineGame();

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
                onlineMode
                ? "Opponent picked one card."
                : "Computer picked one card.";

            checkWinner();

            if(gameOver){

                syncOnlineGame();

                return;

            }

            playerTurn = true;

            updateBoard();

            startTimer();

            syncOnlineGame();

            return;

        }


        // ==========================
        // NORMAL CARD
        // ==========================

        checkWinner();

        if(gameOver){

            syncOnlineGame();

            return;

        }

        // ==========================
        // NEXT PLAYER
        // ==========================

        playerTurn = false;

        updateBoard();

        // ==========================
        // SAVE ONLINE GAME
        // ==========================

        syncOnlineGame();

        // ==========================
        // COMPUTER MODE ONLY
        // ==========================

        if(!onlineMode){

            setTimeout(opponentPlay,800);

        }

    },450);

}
// =====================================
// PICK FROM MARKET
// ONLINE + COMPUTER MODE
// =====================================

function pickCard(){

    if(!playerTurn) return;

    if(gameOver) return;

    clearInterval(timer);

    const card = drawCard();

    if(!card){

        checkMarketWinner();

        if(onlineMode){

            syncOnlineGame();

        }

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

        // ==========================
        // ADD CARD TO PLAYER HAND
        // ==========================

        playerHand.push(card);

        // ==========================
        // REMOVE ANIMATION
        // ==========================

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

            updateBoard();

            syncOnlineGame();

            // Computer mode only
            if(!onlineMode){

                setTimeout(opponentPlay,800);

            }

            return;

        }

        // ==========================
        // NORMAL MARKET PICK
        // ==========================

        playerTurn = false;

        clearInterval(timer);

        updateBoard();

        // ==========================
        // SAVE ONLINE GAME
        // ==========================

        syncOnlineGame();

        // ==========================
        // COMPUTER MODE ONLY
        // ==========================

        if(!onlineMode){

            setTimeout(opponentPlay,800);

        }

    },450);

}
// =====================================
// SHAPE CHOOSER
// ONLINE + COMPUTER MODE
// =====================================

shapeButtons.forEach(button=>{

    button.onclick=function(){

        // ==========================
        // SELECT REQUESTED SHAPE
        // ==========================

        requestedShape =
            button.dataset.shape;

        // ==========================
        // HIDE SHAPE CHOOSER
        // ==========================

        shapeChooser.classList.add("hidden");

        // ==========================
        // PLAYER'S TURN IS OVER
        // ==========================

        playerTurn = false;

        // ==========================
        // UPDATE BOARD
        // ==========================

        updateBoard();

        // ==========================
        // SAVE ONLINE GAME
        // ==========================

        syncOnlineGame();

        // ==========================
        // COMPUTER MODE ONLY
        // ==========================

        if(!onlineMode){

            setTimeout(opponentPlay,800);

        }

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
if(gameMode === "computer"){

    console.log("🤖 Starting Computer Mode");

    onlineMode = false;

    if(onlineLobby){
        onlineLobby.style.display = "none";
    }

    if(modeSelection){
        modeSelection.style.display = "none";
    }

    if(gameContainer){
        gameContainer.style.display = "block";
    }

    startGame();

}

else if(gameMode === "online"){

    console.log("🌐 Starting Online Mode");

    onlineLobby.style.display = "block";
    gameContainer.style.display = "none";

}

else{

    console.log("⚠️ No game mode selected.");

}

marketCardDiv.addEventListener("click", pickCard);
// =====================================
// GAME MODE BUTTONS
// =====================================

const computerModeButton =
    document.getElementById("computerModeButton");

const onlineModeButton =
    document.getElementById("onlineModeButton");


// =====================================
// COMPUTER MODE
// =====================================

if (computerModeButton) {

    computerModeButton.addEventListener("click", function(){

        console.log("🤖 Computer mode selected");

        window.location.href =
            window.location.pathname +
            "?mode=computer";

    });

}


// =====================================
// ONLINE MODE
// =====================================

if (onlineModeButton) {

    onlineModeButton.addEventListener("click", function(){

        console.log("🌐 Online mode selected");

        window.location.href =
            window.location.pathname +
            "?mode=online";

    });

}

// =====================================
// HIDE MODE SELECTION
// =====================================

if (modeSelection) {

    if (gameMode === "computer" ||
        gameMode === "online") {

        modeSelection.style.display = "none";

    }

}