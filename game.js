// =====================================
// FIREBASE
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue,
    runTransaction,
    push
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

    updateBoard();

    gameOverScreen.classList.remove(
        "hidden"
    );

}
            // =================================
            // START TIMER
            // =================================

            else if(playerTurn){

                startTimer();

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
    initializeVoiceForCurrentRoom();
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
listenForRematch();

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
    listenForRematch();
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

onlineGameRef = ref(database, "rooms/" + roomCode + "/game");

initializeVoiceForCurrentRoom();

listenForRematch();
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

const gameOverScreen =
    document.getElementById("gameOverScreen");

const gameResult =
    document.getElementById("gameResult");

const rematchButton =
    document.getElementById("rematchButton");

const rematchStatus =
    document.getElementById("rematchStatus");

const rematchRequest =
    document.getElementById("rematchRequest");

const rematchRequestText =
    document.getElementById("rematchRequestText");

const acceptRematchButton =
    document.getElementById("acceptRematchButton");

const declineRematchButton =
    document.getElementById("declineRematchButton");

const homeButton =
    document.getElementById("homeButton");

// ---------- GAME DATA ----------

const playSound = new Audio("assets/sounds/play.mp3");
const shuffleSound = new Audio("assets/sounds/Shuffle.mp3");
const specialSound = new Audio("assets/sounds/spacial.mp3");
const winSound = new Audio("assets/sounds/Win.mp3");
const loseSound = new Audio("assets/sounds/Lose.mp3");

function safePlayAudio(audio) {
    if (audio && typeof audio.play === "function") {
        try {
            audio.currentTime = 0;
            const promise = audio.play();
            if (promise !== undefined) {
                promise.catch(function() {});
            }
        } catch (e) {}
    }
}

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

    for(let i=0;i<5;i++){

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
    setupVoiceSignaling();
    listenForVoiceRequest();

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
    // DEAL 5 CARDS EACH
    // ==========================

    for(let i = 0; i < 5; i++){

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

    if (gameOver) return;

    timeLeft=20;

    timerText.textContent=timeLeft;

    timer=setInterval(()=>{

        if (gameOver) {
            clearInterval(timer);
            return;
        }

        timeLeft--;

        timerText.textContent=timeLeft;

        if(timeLeft<=0){

            clearInterval(timer);

            if(playerTurn && !gameOver){

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
// HOME
// =====================================

homeButton.onclick=function(){

    if(typeof stopVoiceCall === "function"){
        try { stopVoiceCall(); } catch(e){}
    }
    if(typeof cancelQuickMatch === "function" && quickMatchActive){
        try { cancelQuickMatch(); } catch(e){}
    }
    clearInterval(timer);
    window.location.href="play.html?mode=select";

};
// =====================================
// ONLINE REMATCH SYSTEM
// =====================================

let rematchStarting = false;
let lastRematchRequestId = null;
let rematchListener = null;


// =====================================
// LISTEN FOR REMATCH REQUESTS
// =====================================

function listenForRematch(){

    if(!onlineMode){

        return;

    }

    if(!currentRoomCode){

        console.log(
            "⚠️ Rematch listener waiting for room..."
        );

        return;

    }

    // ==============================
    // REMOVE OLD LISTENER
    // ==============================

    if(rematchListener){

        rematchListener();

        rematchListener = null;

    }

    const rematchRef =
        ref(
            database,
            "rooms/" +
            currentRoomCode +
            "/rematch"
        );

    console.log(
        "🔄 Starting rematch listener for room:",
        currentRoomCode
    );

    rematchListener =
        onValue(
            rematchRef,
            (snapshot)=>{

                if(!snapshot.exists()){

                    return;

                }

                const rematch =
                    snapshot.val();

                if(!rematch){

                    return;

                }

                // =================================
                // PENDING REMATCH REQUEST
                // =================================

                if(
                    rematch.status === "pending"
                ){

                    // ==============================
                    // DON'T SHOW YOUR OWN REQUEST
                    // ==============================

                    if(
                        Number(rematch.requester) ===
                        Number(onlinePlayerNumber)
                    ){

                        console.log(
                            "🔄 This is my own rematch request."
                        );

                        return;

                    }

                    // ==============================
                    // PREVENT DUPLICATE REQUEST
                    // ==============================

                    if(
                        lastRematchRequestId ===
                        rematch.requestId
                    ){

                        return;

                    }

                    lastRematchRequestId =
                        rematch.requestId;

                    console.log(
                        "🔔 INCOMING REMATCH REQUEST:",
                        rematch
                    );

                    // ==============================
                    // SHOW GAME OVER SCREEN
                    // ==============================

                    if(gameOverScreen){

                        gameOverScreen.classList.remove(
                            "hidden"
                        );

                    }

                    // ==============================
                    // SHOW ACCEPT / DECLINE
                    // ==============================

                    if(rematchRequest){

                        rematchRequest.style.display =
                            "block";

                    }

                    if(rematchRequestText){

                        rematchRequestText.textContent =
                            "🔄 Your opponent wants a rematch.";

                    }

                    // ==============================
                    // HIDE REMATCH BUTTON
                    // ==============================

                    if(rematchButton){

                        rematchButton.style.display =
                            "none";

                    }

                    if(rematchStatus){

                        rematchStatus.textContent =
                            "";

                    }

                    console.log(
                        "✅ Rematch request displayed to opponent."
                    );

                }


                // =================================
                // REMATCH ACCEPTED
                // =================================

                if(
                    rematch.status === "accepted"
                ){

                    console.log(
                        "✅ Rematch accepted."
                    );

                    // ==============================
                    // CLOSE REQUEST
                    // ==============================

                    if(rematchRequest){

                        rematchRequest.style.display =
                            "none";

                    }

                    if(rematchButton){

                        rematchButton.style.display =
                            "block";

                        rematchButton.disabled =
                            true;

                    }

                    if(rematchStatus){

                        rematchStatus.textContent =
                            "🎮 Starting rematch...";

                    }

                    // // ==============================
// HIDE GAME OVER SCREEN
// ==============================

if(gameOverScreen){

    gameOverScreen.classList.add(
        "hidden"
    );

}

// ==============================
// RESET LOCAL GAME STATE
// ==============================

clearInterval(timer);

// ==============================
// RESET REMATCH UI
// ==============================

if(rematchButton){

    rematchButton.disabled = false;

}

if(rematchStatus){

    rematchStatus.textContent = "";

}

if(rematchRequest){

    rematchRequest.style.display = "none";

}

gameOver = false;

requestedShape = null;

pickTwoActive = false;

generalMarketActive = false;

currentSticker = null;

lastStickerId = null;
                    // ==============================
                    // PLAYER 1 CREATES NEW GAME
                    // ==============================

                    if(
                        Number(onlinePlayerNumber) === 1 &&
                        !rematchStarting
                    ){

                        rematchStarting = true;

                        console.log(
                            "🎮 Player 1 creating rematch game..."
                        );

                        startOnlineGame();

                        setTimeout(
                            ()=>{
                                rematchStarting = false;
                            },
                            1000
                        );

                    }

                }


                // =================================
                // REMATCH DECLINED
                // =================================

                if(
                    rematch.status === "declined"
                ){

                    console.log(
                        "❌ Rematch declined."
                    );

                    if(rematchRequest){

                        rematchRequest.style.display =
                            "none";

                    }

                    if(rematchButton){

                        rematchButton.style.display =
                            "block";

                        rematchButton.disabled =
                            false;

                    }

                    if(rematchStatus){

                        rematchStatus.textContent =
                            "❌ Opponent declined the rematch.";

                    }

                }

            }
        );

}


// =====================================
// SEND REMATCH REQUEST
// =====================================

if(rematchButton){

    rematchButton.onclick = async function(){

        if(!onlineMode){

            if(rematchStatus){

                rematchStatus.textContent =
                    "Rematch is available for online games.";

            }

            return;

        }

        if(!currentRoomCode){

            if(rematchStatus){

                rematchStatus.textContent =
                    "❌ Online room not found.";

            }

            return;

        }

        try{

            await firebaseReady;

            const rematchRef =
                ref(
                    database,
                    "rooms/" +
                    currentRoomCode +
                    "/rematch"
                );

            await set(
                rematchRef,
                {
                    status: "pending",

                    requester:
                        onlinePlayerNumber,

                    requestId:
                        Date.now()
                }
            );

            rematchButton.disabled =
                true;

            if(rematchStatus){

                rematchStatus.textContent =
                    "🔄 Rematch request sent...\n" +
                    "Waiting for opponent...";

            }

            console.log(
                "🔄 Rematch request sent."
            );

        }catch(error){

            console.error(
                "❌ Rematch request failed:",
                error
            );

            rematchButton.disabled =
                false;

            if(rematchStatus){

                rematchStatus.textContent =
                    "❌ Could not send rematch request.";

            }

        }

    };

}


// =====================================
// ACCEPT REMATCH
// =====================================

if(acceptRematchButton){

    acceptRematchButton.onclick =
        async function(){

            if(!onlineMode){

                return;

            }

            if(!currentRoomCode){

                return;

            }

            try{

                await firebaseReady;

                const rematchRef =
                    ref(
                        database,
                        "rooms/" +
                        currentRoomCode +
                        "/rematch"
                    );

                await set(
                    rematchRef,
                    {
                        status: "accepted",

                        acceptedBy:
                            onlinePlayerNumber,

                        requestId:
                            lastRematchRequestId
                    }
                );

                console.log(
                    "✅ Rematch accepted."
                );

            }catch(error){

                console.error(
                    "❌ Could not accept rematch:",
                    error
                );

            }

        };

}


// =====================================
// DECLINE REMATCH
// =====================================

if(declineRematchButton){

    declineRematchButton.onclick =
        async function(){

            if(!onlineMode){

                return;

            }

            if(!currentRoomCode){

                return;

            }

            try{

                await firebaseReady;

                const rematchRef =
                    ref(
                        database,
                        "rooms/" +
                        currentRoomCode +
                        "/rematch"
                    );

                await set(
                    rematchRef,
                    {
                        status: "declined",

                        declinedBy:
                            onlinePlayerNumber,

                        requestId:
                            lastRematchRequestId
                    }
                );

                if(rematchRequest){

                    rematchRequest.style.display =
                        "none";

                }

                if(rematchButton){

                    rematchButton.style.display =
                        "block";

                    rematchButton.disabled =
                        false;

                }

                if(rematchStatus){

                    rematchStatus.textContent =
                        "You declined the rematch.";

                }

                console.log(
                    "❌ Rematch declined."
                );

            }catch(error){

                console.error(
                    "❌ Could not decline rematch:",
                    error
                );

            }

        };

}

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
// ==========================================
// NOLYWHOT VOICE CHAT - WEBRTC
// Two-way voice requests, accept/decline,
// microphone permissions and restart support.
// ==========================================

let voicePeerConnection = null;
let remoteAudioStream = null;
let localAudioStream = null;
let voiceMicEnabled = false;

let voiceSignalingRef = null;
let voiceRequestRef = null;
let currentVoiceRequestId = null;
let voiceRequestAccepted = false;

let voiceRoomInitialized = null;
let voiceUnsubscribers = [];
let voiceCandidateUnsubscribe = null;

let voiceLastRequestStatus = null;
let voiceOfferStartedFor = null;
let voiceAnswerStartedFor = null;
let voiceAnswerAppliedFor = null;
let voiceOfferAppliedFor = null;

let voiceSeenCandidates = new Set();
let voicePendingCandidates = [];
let voiceEndingLocally = false;
let voiceRequestBeingSent = false;

const voiceConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

const voiceChatButton =
    document.getElementById("voiceChatButton");

const voiceChatStatus =
    document.getElementById("voiceChatStatus");

const voiceRequest =
    document.getElementById("voiceRequest");

const voiceRequestText =
    document.getElementById("voiceRequestText");

const acceptVoiceButton =
    document.getElementById("acceptVoiceButton");

const declineVoiceButton =
    document.getElementById("declineVoiceButton");

const remoteAudio =
    document.getElementById("remoteAudio");


// ------------------------------------------
// DISPLAY STATUS
// ------------------------------------------

function setVoiceStatus(message) {
    if (voiceChatStatus) {
        voiceChatStatus.textContent = message;
    }
}


// ------------------------------------------
// HIDE INCOMING REQUEST POPUP
// ------------------------------------------

function hideVoiceRequestPopup() {
    if (voiceRequest) {
        voiceRequest.style.display = "none";
    }
}


// ------------------------------------------
// SET UP FIREBASE VOICE REFERENCES
// ------------------------------------------

function setupVoiceSignaling() {
    if (!database || !currentRoomCode) {
        return null;
    }

    voiceSignalingRef = ref(
        database,
        "rooms/" + currentRoomCode + "/voiceChat"
    );

    voiceRequestRef = ref(
        database,
        "rooms/" + currentRoomCode + "/voiceChat/request"
    );

    return voiceSignalingRef;
}


// ------------------------------------------
// STOP LISTENING TO OLD ROOM CONNECTIONS
// ------------------------------------------

function clearVoiceListeners() {
    voiceUnsubscribers.forEach(function (unsubscribe) {
        try {
            unsubscribe();
        } catch (error) {
            console.warn(
                "Voice listener cleanup:",
                error
            );
        }
    });

    voiceUnsubscribers = [];

    if (voiceCandidateUnsubscribe) {
        try {
            voiceCandidateUnsubscribe();
        } catch (error) {
            console.warn(
                "Candidate listener cleanup:",
                error
            );
        }

        voiceCandidateUnsubscribe = null;
    }
}


// ------------------------------------------
// CLEAN UP THE CURRENT VOICE CONNECTION
// ------------------------------------------

function cleanupVoiceConnection() {
    voiceMicEnabled = false;

    if (voicePeerConnection) {
        try {
            voicePeerConnection.onicecandidate = null;
            voicePeerConnection.ontrack = null;
            voicePeerConnection.onconnectionstatechange = null;
            voicePeerConnection.close();
        } catch (error) {
            console.warn(
                "Voice connection cleanup:",
                error
            );
        }

        voicePeerConnection = null;
    }

    if (localAudioStream) {
        localAudioStream.getTracks().forEach(function (track) {
            track.stop();
        });

        localAudioStream = null;
    }

    remoteAudioStream = null;

    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
    }

    voiceOfferStartedFor = null;
    voiceAnswerStartedFor = null;
    voiceAnswerAppliedFor = null;
    voiceOfferAppliedFor = null;

    voiceSeenCandidates = new Set();
    voicePendingCandidates = [];
}


// ------------------------------------------
// REQUEST MICROPHONE ACCESS
// ------------------------------------------

async function getVoiceMicrophone() {
    if (localAudioStream) {
        return localAudioStream;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error(
            "Microphone access is unavailable. Open the game using HTTPS."
        );
    }

    localAudioStream =
        await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

    return localAudioStream;
}


// ------------------------------------------
// PROCESS BUFFERED ICE CANDIDATES
// ------------------------------------------

async function flushVoiceCandidates() {
    if (
        !voicePeerConnection ||
        !voicePeerConnection.remoteDescription
    ) {
        return;
    }

    const pending = voicePendingCandidates.slice();

    voicePendingCandidates = [];

    for (const candidate of pending) {
        if (!voicePeerConnection) {
            return;
        }

        try {
            await voicePeerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } catch (error) {
            console.warn(
                "Could not add buffered voice candidate:",
                error
            );
        }
    }
}


// ------------------------------------------
// CREATE WEBRTC CONNECTION
// ------------------------------------------

function createVoicePeerConnection(requestId) {
    if (voicePeerConnection) {
        return voicePeerConnection;
    }

    const pc = new RTCPeerConnection(
        voiceConfiguration
    );

    voicePeerConnection = pc;

    if (localAudioStream) {
        localAudioStream.getTracks().forEach(function (track) {
            pc.addTrack(track, localAudioStream);
        });
    }

    pc.ontrack = function (event) {
        if (voicePeerConnection !== pc) {
            return;
        }

        if (event.streams && event.streams[0]) {
            remoteAudioStream = event.streams[0];
        } else {
            if (!remoteAudioStream) {
                remoteAudioStream = new MediaStream();
            }

            event.streams.forEach(function (stream) {
                stream.getTracks().forEach(function (track) {
                    remoteAudioStream.addTrack(track);
                });
            });
        }

        if (remoteAudio && remoteAudioStream) {
            remoteAudio.srcObject = remoteAudioStream;

            remoteAudio.play().catch(function (error) {
                console.warn(
                    "Tap the page to enable remote audio:",
                    error
                );

                setVoiceStatus(
                    "Voice connected. Tap the game if you cannot hear audio."
                );
            });
        }

        voiceMicEnabled = true;

        if (voiceChatButton) {
            voiceChatButton.textContent = "🔴 STOP VOICE CHAT";
        }

        setVoiceStatus("Voice chat connected 🎤");
    };

    pc.onicecandidate = async function (event) {
        if (!event.candidate) {
            return;
        }

        if (
            !currentRoomCode ||
            currentVoiceRequestId !== requestId
        ) {
            return;
        }

        const requestSnapshot = await new Promise(
            function (resolve) {
                onValue(
                    ref(
                        database,
                        "rooms/" + currentRoomCode +
                        "/voiceChat/request"
                    ),
                    function (snapshot) {
                        resolve(snapshot.val());
                    },
                    { onlyOnce: true }
                );
            }
        );

        if (
            !requestSnapshot ||
            requestSnapshot.requestId !== requestId ||
            requestSnapshot.status !== "accepted"
        ) {
            return;
        }

        const isRequester =
            Number(requestSnapshot.requester) ===
            Number(onlinePlayerNumber);

        const branch = isRequester
            ? "offerCandidates"
            : "answerCandidates";

        try {
            await push(
                ref(
                    database,
                    "rooms/" + currentRoomCode +
                    "/voiceChat/" + branch
                ),
                {
                    requestId: requestId,
                    candidate: event.candidate.toJSON()
                }
            );
        } catch (error) {
            console.error(
                "Could not send voice candidate:",
                error
            );
        }
    };

    pc.onconnectionstatechange = function () {
        if (voicePeerConnection !== pc) {
            return;
        }

        if (pc.connectionState === "connected") {
            voiceMicEnabled = true;

            if (voiceChatButton) {
                voiceChatButton.textContent =
                    "🔴 STOP VOICE CHAT";
            }

            setVoiceStatus("Voice chat connected 🎤");
        }

        if (pc.connectionState === "failed") {
            voiceMicEnabled = false;

            setVoiceStatus(
                "Voice connection failed. Check both internet connections."
            );
        }

        if (pc.connectionState === "disconnected") {
            setVoiceStatus(
                "Voice connection interrupted. Reconnecting..."
            );
        }
    };

    return pc;
}


// ------------------------------------------
// LISTEN FOR REMOTE ICE CANDIDATES
// ------------------------------------------

function listenForVoiceCandidates(requestId, isRequester) {
    if (voiceCandidateUnsubscribe) {
        voiceCandidateUnsubscribe();
        voiceCandidateUnsubscribe = null;
    }

    voiceSeenCandidates = new Set();
    voicePendingCandidates = [];

    const branch = isRequester
        ? "answerCandidates"
        : "offerCandidates";

    const candidatesRef = ref(
        database,
        "rooms/" + currentRoomCode +
        "/voiceChat/" + branch
    );

    voiceCandidateUnsubscribe = onValue(
        candidatesRef,
        function (snapshot) {
            const candidates = snapshot.val();

            if (!candidates) {
                return;
            }

            Object.keys(candidates).forEach(function (key) {
                if (voiceSeenCandidates.has(key)) {
                    return;
                }

                const item = candidates[key];

                if (
                    !item ||
                    item.requestId !== requestId ||
                    !item.candidate
                ) {
                    return;
                }

                voiceSeenCandidates.add(key);

                if (
                    !voicePeerConnection ||
                    !voicePeerConnection.remoteDescription
                ) {
                    voicePendingCandidates.push(
                        item.candidate
                    );

                    return;
                }

                voicePeerConnection.addIceCandidate(
                    new RTCIceCandidate(item.candidate)
                ).catch(function (error) {
                    console.warn(
                        "Could not add voice candidate:",
                        error
                    );
                });
            });
        }
    );
}


// ------------------------------------------
// REQUESTER CREATES THE OFFER
// ------------------------------------------

async function startVoiceOffer(requestId) {
    if (
        !currentRoomCode ||
        currentVoiceRequestId !== requestId ||
        voiceOfferStartedFor === requestId
    ) {
        return;
    }

    voiceOfferStartedFor = requestId;

    try {
        setVoiceStatus(
            "Request accepted. Activating your microphone..."
        );

        await getVoiceMicrophone();

        if (
            currentVoiceRequestId !== requestId ||
            !currentRoomCode
        ) {
            return;
        }

        const pc = createVoicePeerConnection(requestId);

        listenForVoiceCandidates(requestId, true);

        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        await set(
            ref(
                database,
                "rooms/" + currentRoomCode +
                "/voiceChat/offer"
            ),
            {
                requestId: requestId,
                type: offer.type,
                sdp: offer.sdp
            }
        );

        setVoiceStatus(
            "Calling your opponent..."
        );
    } catch (error) {
        console.error("Voice offer failed:", error);

        setVoiceStatus(
            error.name === "NotAllowedError"
                ? "Microphone permission denied on your phone."
                : "Could not start voice chat. Check microphone permission and internet."
        );

        await endVoiceChat(true);
    }
}


// ------------------------------------------
// ANSWERER RECEIVES OFFER AND SENDS ANSWER
// ------------------------------------------

async function handleVoiceOffer(offerData, requestId) {
    if (
        !offerData ||
        offerData.requestId !== requestId ||
        currentVoiceRequestId !== requestId ||
        voiceOfferAppliedFor === requestId
    ) {
        return;
    }

    if (!voiceRequestAccepted) {
        return;
    }

    voiceOfferAppliedFor = requestId;

    try {
        await getVoiceMicrophone();

        const pc = createVoicePeerConnection(requestId);

        listenForVoiceCandidates(requestId, false);

        await pc.setRemoteDescription(
            new RTCSessionDescription({
                type: offerData.type,
                sdp: offerData.sdp
            })
        );

        await flushVoiceCandidates();

        const answer = await pc.createAnswer();

        await pc.setLocalDescription(answer);

        await set(
            ref(
                database,
                "rooms/" + currentRoomCode +
                "/voiceChat/answer"
            ),
            {
                requestId: requestId,
                type: answer.type,
                sdp: answer.sdp
            }
        );

        setVoiceStatus(
            "Connecting to your opponent..."
        );
    } catch (error) {
        console.error("Voice answer failed:", error);

        setVoiceStatus(
            error.name === "NotAllowedError"
                ? "Microphone permission denied on your phone."
                : "Could not answer the voice call. Please try again."
        );

        await endVoiceChat(true);
    }
}


// ------------------------------------------
// REQUESTER RECEIVES ANSWER
// ------------------------------------------

async function handleVoiceAnswer(answerData, requestId) {
    if (
        !answerData ||
        answerData.requestId !== requestId ||
        currentVoiceRequestId !== requestId ||
        voiceAnswerAppliedFor === requestId ||
        !voicePeerConnection
    ) {
        return;
    }

    voiceAnswerAppliedFor = requestId;

    try {
        await voicePeerConnection.setRemoteDescription(
            new RTCSessionDescription({
                type: answerData.type,
                sdp: answerData.sdp
            })
        );

        await flushVoiceCandidates();

        setVoiceStatus(
            "Connecting to your opponent..."
        );
    } catch (error) {
        console.error("Could not apply voice answer:", error);

        setVoiceStatus(
            "Could not connect the voice call. Please try again."
        );
    }
}


// ------------------------------------------
// HANDLE VOICE REQUEST UPDATES
// ------------------------------------------

function listenForVoiceRequest() {
    if (!voiceRequestRef) {
        setupVoiceSignaling();
    }

    if (!voiceRequestRef) {
        return;
    }

    // Initialization below is idempotent.
    initializeVoiceForCurrentRoom();
}


// ------------------------------------------
// INITIALIZE VOICE CHAT FOR BOTH PLAYERS
// ------------------------------------------

function initializeVoiceForCurrentRoom() {
    if (
        !database ||
        !currentRoomCode ||
        !onlinePlayerNumber ||
        !onlineMode
    ) {
        return;
    }

    const roomKey = String(currentRoomCode);

    if (voiceRoomInitialized === roomKey) {
        return;
    }

    clearVoiceListeners();
    cleanupVoiceConnection();

    voiceRoomInitialized = roomKey;

    currentVoiceRequestId = null;
    voiceRequestAccepted = false;
    voiceLastRequestStatus = null;

    setupVoiceSignaling();

    hideVoiceRequestPopup();

    const requestUnsubscribe = onValue(
        voiceRequestRef,
        async function (snapshot) {
            const requestData = snapshot.val();

            if (!requestData || !requestData.requestId) {
                return;
            }

            const isMyRequest =
                Number(requestData.requester) ===
                Number(onlinePlayerNumber);

            if (
                currentVoiceRequestId !== requestData.requestId
            ) {
                if (voicePeerConnection || localAudioStream) {
                    cleanupVoiceConnection();
                }

                currentVoiceRequestId =
                    requestData.requestId;

                voiceRequestAccepted = false;
                voiceOfferStartedFor = null;
                voiceAnswerStartedFor = null;
                voiceAnswerAppliedFor = null;
                voiceOfferAppliedFor = null;

                voiceLastRequestStatus = null;
            }

            if (
                requestData.status === "pending"
            ) {
                voiceLastRequestStatus = "pending";

                if (isMyRequest) {
                    hideVoiceRequestPopup();

                    setVoiceStatus(
                        "Voice request sent. Waiting for your opponent..."
                    );
                } else {
                    if (voiceRequestText) {
                        voiceRequestText.textContent =
                            "🎤 Your opponent wants to start a voice chat.";
                    }

                    if (voiceRequest) {
                        voiceRequest.style.display = "block";
                    }

                    setVoiceStatus(
                        "Your opponent is requesting voice chat."
                    );
                }

                return;
            }

            if (
                requestData.status === "accepted"
            ) {
                voiceLastRequestStatus = "accepted";

                hideVoiceRequestPopup();

                voiceRequestAccepted = true;

                if (isMyRequest) {
                    if (voiceOfferStartedFor !== requestData.requestId) {
                        await startVoiceOffer(
                            requestData.requestId
                        );
                    }
                } else {
                    setVoiceStatus(
                        "You accepted. Connecting to your opponent..."
                    );
                }

                return;
            }

            if (
                requestData.status === "declined"
            ) {
                voiceLastRequestStatus = "declined";

                hideVoiceRequestPopup();

                cleanupVoiceConnection();

                if (isMyRequest) {
                    setVoiceStatus(
                        "Your opponent declined the voice request."
                    );
                } else {
                    setVoiceStatus(
                        "Voice request declined."
                    );
                }

                return;
            }

            if (
                requestData.status === "ended"
            ) {
                voiceLastRequestStatus = "ended";

                hideVoiceRequestPopup();

                cleanupVoiceConnection();

                voiceRequestAccepted = false;

                setVoiceStatus("Voice chat ended.");

                if (voiceChatButton) {
                    voiceChatButton.textContent =
                        "🎤 VOICE CHAT";
                }
            }
        }
    );

    voiceUnsubscribers.push(requestUnsubscribe);

    const offerUnsubscribe = onValue(
        ref(
            database,
            "rooms/" + currentRoomCode +
            "/voiceChat/offer"
        ),
        async function (snapshot) {
            const offerData = snapshot.val();

            if (
                !offerData ||
                !currentVoiceRequestId ||
                offerData.requestId !== currentVoiceRequestId
            ) {
                return;
            }

            const requestSnapshot = await new Promise(
                function (resolve) {
                    onValue(
                        voiceRequestRef,
                        function (requestSnap) {
                            resolve(requestSnap.val());
                        },
                        { onlyOnce: true }
                    );
                }
            );

            if (
                !requestSnapshot ||
                requestSnapshot.status !== "accepted" ||
                Number(requestSnapshot.requester) ===
                Number(onlinePlayerNumber)
            ) {
                return;
            }

            await handleVoiceOffer(
                offerData,
                offerData.requestId
            );
        }
    );

    voiceUnsubscribers.push(offerUnsubscribe);

    const answerUnsubscribe = onValue(
        ref(
            database,
            "rooms/" + currentRoomCode +
            "/voiceChat/answer"
        ),
        async function (snapshot) {
            const answerData = snapshot.val();

            if (
                !answerData ||
                !currentVoiceRequestId ||
                answerData.requestId !== currentVoiceRequestId
            ) {
                return;
            }

            const requestSnapshot = await new Promise(
                function (resolve) {
                    onValue(
                        voiceRequestRef,
                        function (requestSnap) {
                            resolve(requestSnap.val());
                        },
                        { onlyOnce: true }
                    );
                }
            );

            if (
                !requestSnapshot ||
                requestSnapshot.status !== "accepted" ||
                Number(requestSnapshot.requester) !==
                Number(onlinePlayerNumber)
            ) {
                return;
            }

            await handleVoiceAnswer(
                answerData,
                answerData.requestId
            );
        }
    );

    voiceUnsubscribers.push(answerUnsubscribe);
}


// ------------------------------------------
// SEND A VOICE REQUEST
// ------------------------------------------

async function sendVoiceRequest() {
    if (
        !currentRoomCode ||
        !onlinePlayerNumber ||
        !onlineMode
    ) {
        setVoiceStatus(
            "Voice chat is available during an online game."
        );

        return;
    }

    if (voiceRequestBeingSent) {
        return;
    }

    voiceRequestBeingSent = true;

    try {
        initializeVoiceForCurrentRoom();

        const rootPath =
            "rooms/" + currentRoomCode + "/voiceChat";

        // Remove old call details so the next call
        // cannot reuse a previous offer or answer.
        await set(
            ref(database, rootPath + "/offer"),
            null
        );

        await set(
            ref(database, rootPath + "/answer"),
            null
        );

        await set(
            ref(database, rootPath + "/offerCandidates"),
            null
        );

        await set(
            ref(database, rootPath + "/answerCandidates"),
            null
        );

        const newRequestId =
            String(Date.now()) + "_" +
            String(onlinePlayerNumber) + "_" +
            Math.random().toString(36).slice(2, 10);

        currentVoiceRequestId = newRequestId;
        voiceRequestAccepted = false;

        voiceOfferStartedFor = null;
        voiceAnswerStartedFor = null;
        voiceAnswerAppliedFor = null;
        voiceOfferAppliedFor = null;

        voiceSeenCandidates = new Set();
        voicePendingCandidates = [];

        await set(
            ref(database, rootPath + "/request"),
            {
                requestId: newRequestId,
                requester: Number(onlinePlayerNumber),
                status: "pending",
                createdAt: Date.now()
            }
        );

        setVoiceStatus(
            "Voice request sent. Waiting for your opponent..."
        );
    } catch (error) {
        console.error(
            "Could not send voice request:",
            error
        );

        setVoiceStatus(
            "Could not send voice request. Check your internet connection."
        );
    } finally {
        voiceRequestBeingSent = false;
    }
}


// ------------------------------------------
// ACCEPT AN INCOMING REQUEST
// ------------------------------------------

async function acceptVoiceRequest() {
    if (
        !currentRoomCode ||
        !currentVoiceRequestId
    ) {
        return;
    }

    try {
        setVoiceStatus(
            "Request accepted. Allow microphone access when asked..."
        );

        // The accepting player must grant microphone
        // permission before the request becomes accepted.
        await getVoiceMicrophone();

        const requestSnapshot = await new Promise(
            function (resolve) {
                onValue(
                    voiceRequestRef,
                    function (snapshot) {
                        resolve(snapshot.val());
                    },
                    { onlyOnce: true }
                );
            }
        );

        if (
            !requestSnapshot ||
            requestSnapshot.requestId !== currentVoiceRequestId ||
            requestSnapshot.status !== "pending" ||
            Number(requestSnapshot.requester) ===
            Number(onlinePlayerNumber)
        ) {
            setVoiceStatus(
                "This voice request is no longer available."
            );

            return;
        }

        voiceRequestAccepted = true;

        await set(
            voiceRequestRef,
            {
                ...requestSnapshot,
                status: "accepted",
                acceptedBy: Number(onlinePlayerNumber),
                acceptedAt: Date.now()
            }
        );

        hideVoiceRequestPopup();

        setVoiceStatus(
            "Request accepted. Connecting..."
        );
    } catch (error) {
        console.error(
            "Could not accept voice request:",
            error
        );

        hideVoiceRequestPopup();

        cleanupVoiceConnection();

        setVoiceStatus(
            error.name === "NotAllowedError"
                ? "Microphone permission denied on your phone. Allow microphone access in your browser settings."
                : "Could not access the microphone. Please try again."
        );
    }
}


// ------------------------------------------
// DECLINE AN INCOMING REQUEST
// ------------------------------------------

async function declineVoiceRequest() {
    if (
        !currentRoomCode ||
        !currentVoiceRequestId
    ) {
        hideVoiceRequestPopup();
        return;
    }

    try {
        const snapshot = await new Promise(
            function (resolve) {
                onValue(
                    voiceRequestRef,
                    function (result) {
                        resolve(result.val());
                    },
                    { onlyOnce: true }
                );
            }
        );

        if (
            snapshot &&
            snapshot.requestId === currentVoiceRequestId &&
            snapshot.status === "pending" &&
            Number(snapshot.requester) !==
            Number(onlinePlayerNumber)
        ) {
            await set(
                voiceRequestRef,
                {
                    ...snapshot,
                    status: "declined",
                    declinedBy: Number(onlinePlayerNumber),
                    declinedAt: Date.now()
                }
            );
        }
    } catch (error) {
        console.error(
            "Could not decline voice request:",
            error
        );
    }

    hideVoiceRequestPopup();

    setVoiceStatus("Voice request declined.");
}


// ------------------------------------------
// END VOICE CHAT
// ------------------------------------------

async function endVoiceChat(updateFirebase) {
    if (voiceEndingLocally) {
        return;
    }

    voiceEndingLocally = true;

    const requestId = currentVoiceRequestId;
    const roomCode = currentRoomCode;

    cleanupVoiceConnection();

    voiceRequestAccepted = false;

    hideVoiceRequestPopup();

    if (voiceChatButton) {
        voiceChatButton.textContent = "🎤 VOICE CHAT";
    }

    try {
        if (
            updateFirebase &&
            roomCode &&
            requestId
        ) {
            const requestPath =
                "rooms/" + roomCode +
                "/voiceChat/request";

            const snapshot = await new Promise(
                function (resolve) {
                    onValue(
                        ref(database, requestPath),
                        function (result) {
                            resolve(result.val());
                        },
                        { onlyOnce: true }
                    );
                }
            );

            if (
                snapshot &&
                snapshot.requestId === requestId &&
                (
                    snapshot.status === "accepted" ||
                    snapshot.status === "pending"
                )
            ) {
                await set(
                    ref(database, requestPath),
                    {
                        ...snapshot,
                        status: "ended",
                        endedBy: Number(onlinePlayerNumber),
                        endedAt: Date.now()
                    }
                );
            }
        }
    } catch (error) {
        console.warn(
            "Could not update voice-chat status:",
            error
        );
    }

    setVoiceStatus("Voice chat ended.");

    voiceEndingLocally = false;
}


// ------------------------------------------
// VOICE CHAT BUTTON
// ------------------------------------------

if (voiceChatButton) {
    voiceChatButton.addEventListener(
        "click",
        async function () {
            if (!onlineMode || !currentRoomCode) {
                setVoiceStatus(
                    "Start or join an online game to use voice chat."
                );

                return;
            }

            if (
                voiceRequestAccepted ||
                voiceMicEnabled ||
                voicePeerConnection
            ) {
                await endVoiceChat(true);
                return;
            }

            if (currentVoiceRequestId) {
                const snapshot = await new Promise(
                    function (resolve) {
                        onValue(
                            voiceRequestRef,
                            function (result) {
                                resolve(result.val());
                            },
                            { onlyOnce: true }
                        );
                    }
                );

                if (
                    snapshot &&
                    snapshot.requestId === currentVoiceRequestId &&
                    snapshot.status === "pending"
                ) {
                    if (
                        Number(snapshot.requester) ===
                        Number(onlinePlayerNumber)
                    ) {
                        await endVoiceChat(true);
                        return;
                    }

                    setVoiceStatus(
                        "Please accept or decline the incoming request first."
                    );

                    return;
                }
            }

            await sendVoiceRequest();
        }
    );
}


// ------------------------------------------
// ACCEPT / DECLINE BUTTONS
// ------------------------------------------

if (acceptVoiceButton) {
    acceptVoiceButton.addEventListener(
        "click",
        acceptVoiceRequest
    );
}

if (declineVoiceButton) {
    declineVoiceButton.addEventListener(
        "click",
        declineVoiceRequest
    );
}


// ------------------------------------------
// COMPATIBILITY WITH EXISTING GAME CODE
// ------------------------------------------

function stopVoiceCall() {
    endVoiceChat(true);
}