// =====================================
// FIREBASE
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue,
    runTransaction
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
// =====================================
// QUICK MATCH
// =====================================
let quickMatchActive = false;
let quickMatchRef = null;

let quickMatchListener = null;
let quickMatchFindListener = null;
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
// QUICK MATCH
// =====================================

async function quickMatch(){

    if(quickMatchActive) return;

    quickMatchActive = true;

setQuickMatchUI(true);

showQuickMatchWaiting();
    try{

        await firebaseReady;

        if(!currentUser){

            throw new Error(
                "Firebase user not ready."
            );

        }

        lobbyMessage.textContent =
            "🔎 Searching for an opponent...";

        console.log(
            "🔎 Quick Match started."
        );

        // =====================================
        // QUICK MATCH QUEUE
        // =====================================

        quickMatchRef =
            ref(
                database,
                "quickMatch/" +
                currentUser.uid
            );

        await set(
            quickMatchRef,
            {
                uid: currentUser.uid,
                status: "waiting",
                createdAt: Date.now()
            }
        );

        console.log(
            "✅ Added to Quick Match queue."
        );

        // =====================================
        // LOOK FOR ANOTHER PLAYER
        // =====================================

        watchQuickMatch();
findQuickMatch();

    }catch(error){

        console.error(
            "❌ Quick Match failed:",
            error
        );

        lobbyMessage.textContent =
            "Could not start Quick Match.";

        quickMatchActive = false;

    }

}
// =====================================
// QUICK MATCH WAITING UI
// =====================================

function showQuickMatchWaiting(){

    const quickButton =
        document.getElementById(
            "quickMatchButton"
        );

    const cancelButton =
        document.getElementById(
            "cancelQuickMatchButton"
        );

    if(quickButton){

        quickButton.disabled = true;

        quickButton.textContent =
            "🔎 SEARCHING...";

    }

    if(cancelButton){

        cancelButton.style.display =
            "block";

    }

    if(lobbyMessage){

        lobbyMessage.textContent =
            "🔎 Searching for an opponent...\nPlease wait...";

    }

}


// =====================================
// WATCH QUICK MATCH
// =====================================

function watchQuickMatch(){

    if(!currentUser){
        console.error("❌ Firebase user not ready.");
        return;
    }

    const playerQueueRef =
        ref(database, "quickMatch/" + currentUser.uid);

    quickMatchListener = onValue(
        playerQueueRef,
        (snapshot) => {

            if(!quickMatchActive){
                return;
            }

            if(!snapshot.exists()){
                return;
            }

            const match = snapshot.val();

            if(
                match.status !== "matched" ||
                !match.roomCode ||
                !match.playerNumber
            ){
                return;
            }

            console.log(
                "🎯 Quick Match connected!",
                match.roomCode,
                "PLAYER",
                match.playerNumber
            );

            onlinePlayerNumber =
                Number(match.playerNumber);

            onlineMode = true;

            currentRoomCode =
                match.roomCode;

            onlineGameRef =
                ref(
                    database,
                    "rooms/" +
                    match.roomCode +
                    "/game"
                );

            if(onlinePlayerNumber === 1){

                playerNameText.textContent =
                    "PLAYER 1";

                opponentNameText.textContent =
                    "PLAYER 2";

            }else{

                playerNameText.textContent =
                    "PLAYER 2";

                opponentNameText.textContent =
                    "PLAYER 1";
            }

            lobbyMessage.textContent =
                "🎮 Opponent found! Starting game...";

            stopQuickMatch();

            startQuickMatchGame();
        }
    );
}
// =====================================
// FIND QUICK MATCH
// =====================================

async function findQuickMatch(){

    if(!currentUser){
        console.error("❌ Firebase user not ready.");
        return;
    }

    const queueRef =
        ref(database, "quickMatch");

    quickMatchFindListener =
        onValue(
            queueRef,
            async (snapshot) => {

                if(!quickMatchActive){
                    return;
                }

                if(!snapshot.exists()){
                    return;
                }

                const players =
                    snapshot.val() || {};

                // =================================
                // GET WAITING PLAYERS
                // =================================

                const waitingPlayers =
                    Object.values(players)
                        .filter(
                            player =>
                                player &&
                                player.status === "waiting"
                        )
                        .sort(
                            (a, b) => {

                                const timeA =
                                    Number(a.createdAt || 0);

                                const timeB =
                                    Number(b.createdAt || 0);

                                if(timeA !== timeB){
                                    return timeA - timeB;
                                }

                                return String(a.uid)
                                    .localeCompare(
                                        String(b.uid)
                                    );
                            }
                        );

                // =================================
                // NEED TWO PLAYERS
                // =================================

                if(waitingPlayers.length < 2){
                    return;
                }

                const player1 =
                    waitingPlayers[0];

                const player2 =
                    waitingPlayers[1];

                // =================================
                // ONLY PLAYER 2 CREATES THE MATCH
                // =================================

                if(
                    player2.uid !==
                    currentUser.uid
                ){
                    return;
                }

                console.log(
                    "🎯 Possible opponent found:",
                    player1.uid
                );

                const roomCode =
                    generateRoomCode();

                // =================================
                // ATOMICALLY MATCH BOTH PLAYERS
                // =================================

                try{

                    const result =
                        await runTransaction(
                            queueRef,
                            (currentData) => {

                                if(!currentData){
                                    return;
                                }

                                const currentPlayers =
                                    Object.values(
                                        currentData
                                    )
                                    .filter(
                                        player =>
                                            player &&
                                            player.status ===
                                            "waiting"
                                    )
                                    .sort(
                                        (a, b) => {

                                            const timeA =
                                                Number(
                                                    a.createdAt ||
                                                    0
                                                );

                                            const timeB =
                                                Number(
                                                    b.createdAt ||
                                                    0
                                                );

                                            if(
                                                timeA !==
                                                timeB
                                            ){
                                                return (
                                                    timeA -
                                                    timeB
                                                );
                                            }

                                            return String(
                                                a.uid
                                            ).localeCompare(
                                                String(
                                                    b.uid
                                                )
                                            );
                                        }
                                    );

                                if(
                                    currentPlayers.length <
                                    2
                                ){
                                    return;
                                }

                                const first =
                                    currentPlayers[0];

                                const second =
                                    currentPlayers[1];

                                // Make sure these are
                                // still the same two players

                                if(
                                    first.uid !==
                                    player1.uid ||
                                    second.uid !==
                                    player2.uid
                                ){
                                    return;
                                }

                                // =================================
                                // MATCH PLAYER 1
                                // =================================

                                currentData[first.uid] = {

                                    ...currentData[first.uid],

                                    status: "matched",

                                    roomCode:
                                        roomCode,

                                    playerNumber: 1

                                };

                                // =================================
                                // MATCH PLAYER 2
                                // =================================

                                currentData[second.uid] = {

                                    ...currentData[second.uid],

                                    status: "matched",

                                    roomCode:
                                        roomCode,

                                    playerNumber: 2

                                };

                                return currentData;
                            }
                        );

                    if(result.committed){

                        console.log(
                            "✅ Quick Match created:",
                            roomCode
                        );

                        // =================================
                        // CREATE THE GAME ROOM
                        // =================================

                        const roomRef =
                            ref(
                                database,
                                "rooms/" +
                                roomCode
                            );

                        await set(
                            roomRef,
                            {
                                host:
                                    player1.uid,

                                guest:
                                    player2.uid,

                                status:
                                    "playing",

                                quickMatch:
                                    true,

                                createdAt:
                                    Date.now()
                            }
                        );

                        console.log(
                            "🏠 Quick Match room created:",
                            roomCode
                        );

                    }else{

                        console.log(
                            "ℹ️ Another player already matched them."
                        );

                    }

                }catch(error){

                    console.error(
                        "❌ Quick Match transaction failed:",
                        error
                    );

                }

            }
        );
}
// =====================================
// STICKER PANEL
// =====================================

function toggleStickerPanel(){

    const stickerPanel =
        document.getElementById(
            "stickerPanel"
        );

    if(!stickerPanel){

        console.error(
            "❌ Sticker panel not found."
        );

        return;

    }

    if(
        stickerPanel.style.display ===
        "none" ||
        stickerPanel.style.display === ""
    ){

        stickerPanel.style.display =
            "flex";

    }else{

        stickerPanel.style.display =
            "none";

    }

}
// =====================================
// STICKER BUTTON
// =====================================

const stickerButton =
    document.getElementById(
        "stickerButton"
    );

if(stickerButton){

    stickerButton.addEventListener(
        "click",
        function(){

            toggleStickerPanel();

        }
    );

}
// =====================================
// SEND STICKER
// =====================================

function sendSticker(sticker){

    if(!onlineMode){

        console.log(
            "⚠️ Stickers are available in Online Mode."
        );

        return;

    }
if(!onlineGameStarted){

    console.log(
        "⚠️ Online game has not started yet."
    );

    return;

}
    if(!onlineGameRef){

        console.error(
            "❌ Online game reference is missing."
        );

        return;

    }

    currentSticker = {
    text: sticker,
    id: Date.now()
};
// =================================
// SHOW STICKER TO SENDER
// =================================

displaySticker(sticker);
    console.log(
        "😀 Sending sticker:",
        sticker
    );

    // Close sticker panel
    const stickerPanel =
        document.getElementById(
            "stickerPanel"
        );

    if(stickerPanel){

        stickerPanel.style.display =
            "none";

    }

    // Save sticker to Firebase
    syncOnlineGame();

}
// =====================================
// DISPLAY STICKER
// =====================================

function displaySticker(sticker){

    if(!sticker){

        return;

    }

    const stickerDisplay =
        document.getElementById(
            "stickerDisplay"
        );

    if(!stickerDisplay){

        console.error(
            "❌ Sticker display not found."
        );

        return;

    }

    stickerDisplay.textContent =
        sticker;

    stickerDisplay.style.display =
        "flex";

    // Clear previous timer
    clearTimeout(
        stickerDisplay.hideTimer
    );

    // Hide after 3 seconds
    stickerDisplay.hideTimer =
        setTimeout(function(){

            stickerDisplay.style.display =
                "none";

        },3000);

}
// =====================================
// STICKER OPTIONS
// =====================================

const stickerOptions =
    document.querySelectorAll(
        ".stickerOption"
    );

stickerOptions.forEach(
    function(button){

        button.addEventListener(
            "click",
            function(){

                sendSticker(
                    button.textContent.trim()
                );

            }
        );

    }
);
// =====================================
// LISTEN TO ONLINE GAME
// =====================================

function listenToOnlineGame(){

    if(!onlineGameRef){

        console.error(
            "❌ Online game reference is missing."
        );

        return;

    }

    onValue(
        onlineGameRef,
        (snapshot)=>{

            if(!snapshot.exists()){

                return;

            }

            const game =
                snapshot.val();


            // =================================
            // SHARED GAME DATA
            // =================================

            deck =
                game.deck || [];

            topCard =
                game.topCard || null;

            requestedShape =
                game.requestedShape || null;

            gameOver =
                game.gameOver || false;


            // =================================
            // SYNC ONLINE SCORES
            // =================================

            if(onlinePlayerNumber === 1){

                playerScore =
                    game.player1Score || 0;

                opponentScore =
                    game.player2Score || 0;

            }

            else if(onlinePlayerNumber === 2){

                playerScore =
                    game.player2Score || 0;

                opponentScore =
                    game.player1Score || 0;

            }

            updateScores();


            // =================================
            // IMPORTANT:
            // EACH PLAYER GETS THEIR OWN HAND
            // =================================

            if(onlinePlayerNumber === 1){

                // PLAYER 1 PHONE

                playerHand =
                    game.playerHand || [];

                opponentHand =
                    game.opponentHand || [];

                playerTurn =
                    game.playerTurn === 1;

            }

            else if(onlinePlayerNumber === 2){

                // PLAYER 2 PHONE

                playerHand =
                    game.opponentHand || [];

                opponentHand =
                    game.playerHand || [];

                playerTurn =
                    game.playerTurn === 2;

            }

            else{

                console.error(
                    "❌ Online player number is missing."
                );

                return;

            }


            // =================================
            // RECEIVE STICKER
            // =================================

            if(game.sticker){

                const receivedSticker =
                    game.sticker;

                if(
                    receivedSticker.id !==
                    lastStickerId
                ){

                    lastStickerId =
                        receivedSticker.id;

                    displaySticker(
                        receivedSticker.text
                    );

                }

            }


            // =================================
            // UPDATE GAME BOARD
            // =================================

            updateBoard();

// =================================
// GAME OVER
// =================================

if(gameOver){

    clearInterval(timer);

    // ==============================
    // ONLINE WIN / LOSS RESULT
    // ==============================

    if(onlineMode){

        if(playerHand.length === 0){

            gameResult.textContent =
                "🎉 YOU WIN!";

        }

        else if(opponentHand.length === 0){

            gameResult.textContent =
                "😢 YOU LOSE!";

        }

    }

    // ==============================
    // SHOW RESULT
    // ==============================

    gameOverScreen.classList.remove(
        "hidden"
    );

}
            // =================================
            // START TIMER
            // =================================

            else if(playerTurn){

                startTurnTimer();

            }

            else{

                clearInterval(timer);

            }

        }
    );

}
// =====================================
// CANCEL QUICK MATCH
// =====================================

async function cancelQuickMatch(){

    if(!quickMatchActive){

        console.log("⚠️ Quick Match is not active.");

        return;

    }

    console.log("🛑 Cancelling Quick Match...");

    try{

        // =================================
        // REMOVE PLAYER FROM QUEUE
        // =================================

        if(quickMatchRef){

            await set(
                quickMatchRef,
                null
            );

        }

        // =================================
        // STOP MATCHMAKING LISTENER
        // =================================

        if(quickMatchListener){

            quickMatchListener();

            quickMatchListener = null;

        }
// =================================
// RESET QUICK MATCH
// =================================

stopQuickMatch();

lobbyMessage.textContent =
    "Choose how you want to play";

        console.log(
            "✅ Quick Match cancelled."
        );

    }catch(error){

        console.error(
            "❌ Could not cancel Quick Match:",
            error
        );

        lobbyMessage.textContent =
            "Could not cancel search.";

    }

}
// =====================================
// QUICK MATCH UI
// =====================================

function setQuickMatchUI(searching){

    const quickButton =
        document.getElementById(
            "quickMatchButton"
        );

    const cancelButton =
        document.getElementById(
            "cancelQuickMatchButton"
        );

    if(quickButton){

        quickButton.disabled =
            searching;

    }

    if(cancelButton){

        cancelButton.style.display =
            searching
            ? "block"
            : "none";

    }

}
// =====================================
// START QUICK MATCH GAME
// =====================================

function startQuickMatchGame(){

    console.log(
        "🎮 Starting Quick Match game..."
    );

    onlineMode = true;

    onlineGameStarted = true;

    // ==========================
    // HIDE LOBBY
    // ==========================

    if(onlineLobby){

        onlineLobby.style.display =
            "none";

    }

    // ==========================
    // SHOW GAME
    // ==========================

    if(gameContainer){

        gameContainer.style.display =
            "block";

    }

    // ==========================
    // PLAYER NAMES
    // ==========================

    if(onlinePlayerNumber === 1){

        playerNameText.textContent =
            "PLAYER 1";

        opponentNameText.textContent =
            "PLAYER 2";

    }else{

        playerNameText.textContent =
            "PLAYER 2";

        opponentNameText.textContent =
            "PLAYER 1";

    }

// ==========================
// BOTH PLAYERS LISTEN
// ==========================

listenToOnlineGame();

// ==========================
// PLAYER 1 CREATES GAME
// ==========================

if(onlinePlayerNumber === 1){

    startOnlineGame();

}
}
// =====================================
// STOP QUICK MATCH
// =====================================

function stopQuickMatch(){

    if(quickMatchListener){
        quickMatchListener();
        quickMatchListener = null;
    }

    if(quickMatchFindListener){
        quickMatchFindListener();
        quickMatchFindListener = null;
    }

    quickMatchActive = false;

    quickMatchRef = null;

    setQuickMatchUI(false);

    const quickButton =
        document.getElementById(
            "quickMatchButton"
        );

    if(quickButton){

        quickButton.disabled = false;

        quickButton.textContent =
            "⚡ ONLINE QUICK MATCH";
    }

    console.log(
        "🛑 Quick Match stopped."
    );
}
// =====================================
// CREATE ROOM
// =====================================

createRoomButton.onclick = async function(){


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
let currentSticker = null;
let lastStickerId = null;
// =====================================
// ONLINE GAME SYNCHRONIZATION
// =====================================

function syncOnlineGame(){

    if(!onlineMode) return;

    if(!onlineGameRef) return;

    // =================================
    // FIREBASE ALWAYS STORES THE GAME
    // FROM PLAYER 1'S PERSPECTIVE
    // =================================

    const gameState = {

        // ==============================
        // SHARED DECK
        // ==============================

        deck: deck,

        // ==============================
        // PLAYER 1 HAND
        // ==============================

        playerHand:
            onlinePlayerNumber === 1
            ? playerHand
            : opponentHand,

        // ==============================
        // PLAYER 2 HAND
        // ==============================

        opponentHand:
            onlinePlayerNumber === 1
            ? opponentHand
            : playerHand,

        // ==============================
        // CENTER CARD
        // ==============================

        topCard: topCard,

        // ==============================
        // WHOSE TURN
        // ==============================

        playerTurn:
            onlinePlayerNumber === 1
            ? (playerTurn ? 1 : 2)
            : (playerTurn ? 2 : 1),

        // ==============================
        // WHOT REQUESTED SHAPE
        // ==============================

        requestedShape: requestedShape,

        // ==============================
        // STICKER
        // ==============================

        sticker: currentSticker,

        // ==============================
        // GAME OVER
        // ==============================

        gameOver: gameOver,

        // ==============================
        // SCORES
        // ==============================

        player1Score:
            onlinePlayerNumber === 1
            ? playerScore
            : opponentScore,

        player2Score:
            onlinePlayerNumber === 1
            ? opponentScore
            : playerScore

    };

    // =================================
    // SAVE TO FIREBASE
    // =================================

    set(onlineGameRef, gameState)

        .then(()=>{

            console.log(
                "🔥 Game synchronized successfully."
            );

        })

        .catch((error)=>{

            console.error(
                "❌ Game synchronization failed:",
                error
            );

        });

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
    gameOver: false,
    player1Score: playerScore,
    player2Score: opponentScore
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

        img.src = "./assets/cards/back.png";

        img.onerror = function(){

            img.onerror = null;
            img.src = "./back.png";

        };

    }


    // ==========================
    // WHOT 20
    // ==========================

    else if(card && card.number === 20){

        img.src = "./assets/cards/whot/whot20.png";

        img.onerror = function(){

            img.onerror = null;
            img.src = "./whot20.png";

        };

    }


    // ==========================
    // NORMAL CARD
    // ==========================

    else if(card){

        // First: Acode structure
        img.src =
            `./assets/cards/${card.shape}/${card.shape}${card.number}.png`;

        // If Acode path doesn't exist,
        // try GitHub structure
        img.onerror = function(){

            img.onerror = null;

            img.src =
                `./${card.shape}${card.number}.png`;

        };

    }


    // ==========================
    // FINAL IMAGE ERROR
    // ==========================

    img.onerror = function(){

        console.log(
            "❌ Card image not found:",
            card
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
// HOLD ON (1)
// Player plays again
// ==========================

if(card.number === 1){

    checkWinner();

    if(gameOver){

        syncOnlineGame();

        return;

    }

    messageText.textContent =
        onlineMode
        ? "Hold On! Play again."
        : "Hold On! Play again.";

    playerTurn = true;

    updateBoard();

    startTimer();

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

    // =================================
    // PLAYER WINS
    // =================================

    if(playerHand.length === 0){

        gameOver = true;

        clearInterval(timer);

        // ==============================
        // UPDATE LOCAL SCORE
        // ==============================

        playerScore++;

        updateScores();

        // ==============================
        // ONLINE RESULT
        // ==============================

        if(onlineMode){

            gameResult.textContent =
                "🎉 YOU WIN!";

        }else{

            gameResult.textContent =
                "🎉 YOU WIN!";

        }

        // ==============================
        // SHOW RESULT
        // ==============================

        gameOverScreen.classList.remove(
            "hidden"
        );

        // ==============================
        // SYNC RESULT
        // ==============================

        if(onlineMode){

            syncOnlineGame();

        }

        return;

    }


    // =================================
    // OPPONENT WINS
    // =================================

    if(opponentHand.length === 0){

        gameOver = true;

        clearInterval(timer);

        // ==============================
        // UPDATE LOCAL SCORE
        // ==============================

        opponentScore++;

        updateScores();

        // ==============================
        // ONLINE RESULT
        // ==============================

        if(onlineMode){

            gameResult.textContent =
                "😢 YOU LOSE!";

        }else{

            gameResult.textContent =
                "💻 COMPUTER WINS!";

        }

        // ==============================
        // SHOW RESULT
        // ==============================

        gameOverScreen.classList.remove(
            "hidden"
        );

        // ==============================
        // SYNC RESULT
        // ==============================

        if(onlineMode){

            syncOnlineGame();

        }

        return;

    }

}
// =====================================
// MARKET EMPTY WINNER
// =====================================

function checkMarketWinner(){

    // =================================
    // CHECK IF PLAYER CAN STILL PLAY
    // =================================

    if(playerHand.some(card => canPlay(card))){

        return;

    }


    // =================================
    // CHECK IF OPPONENT CAN STILL PLAY
    // =================================

    if(opponentHand.some(card => canPlay(card))){

        return;

    }


    // =================================
    // CALCULATE CARD TOTALS
    // =================================

    let playerTotal = 0;

    let opponentTotal = 0;


    playerHand.forEach(card => {

        playerTotal += card.number;

    });


    opponentHand.forEach(card => {

        opponentTotal += card.number;

    });


    // =================================
    // GAME OVER
    // =================================

    gameOver = true;

    clearInterval(timer);


    // =================================
    // PLAYER WINS
    // =================================

    if(playerTotal < opponentTotal){

        playerScore++;

        updateScores();


        if(onlineMode){

            gameResult.textContent =
                "🎉 YOU WIN!\n" +
                "Your Total: " +
                playerTotal +
                " | Opponent Total: " +
                opponentTotal;

        }else{

            gameResult.textContent =
                "🎉 YOU WIN!\n" +
                "Your Total: " +
                playerTotal +
                " | Computer Total: " +
                opponentTotal;

        }

    }


    // =================================
    // OPPONENT WINS
    // =================================

    else if(opponentTotal < playerTotal){

        opponentScore++;

        updateScores();


        if(onlineMode){

            gameResult.textContent =
                "😢 YOU LOSE!\n" +
                "Your Total: " +
                playerTotal +
                " | Opponent Total: " +
                opponentTotal;

        }else{

            gameResult.textContent =
                "💻 COMPUTER WINS!\n" +
                "Your Total: " +
                playerTotal +
                " | Computer Total: " +
                opponentTotal;

        }

    }


    // =================================
    // DRAW
    // =================================

    else{

        gameResult.textContent =
            "🤝 DRAW!\n" +
            "Both Total: " +
            playerTotal;

    }


    // =================================
    // SHOW RESULT
    // =================================

    gameOverScreen.classList.remove(
        "hidden"
    );


    // =================================
    // SYNC ONLINE RESULT
    // =================================

    if(onlineMode){

        syncOnlineGame();

    }

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
// ONLINE QUICK MATCH BUTTON
// =====================================

const quickMatchButton =
    document.getElementById("quickMatchButton");

if(quickMatchButton){

    quickMatchButton.addEventListener(
        "click",
        function(){

            console.log(
                "⚡ Quick Match selected"
            );

            onlineMode = true;

            if(onlineLobby){

                onlineLobby.style.display =
                    "block";

            }

            if(gameContainer){

                gameContainer.style.display =
                    "none";

            }

            quickMatch();

        }
    );

}


// =====================================
// CANCEL QUICK MATCH BUTTON
// =====================================

const cancelQuickMatchButton =
    document.getElementById(
        "cancelQuickMatchButton"
    );

if(cancelQuickMatchButton){

    cancelQuickMatchButton.addEventListener(
        "click",
        function(){

            cancelQuickMatch();

        }
    );

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