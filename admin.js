import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
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

let isAuthenticated = false;

// -------------------------------------------------------------
// PASSCODE SECURITY AUTHENTICATION
// -------------------------------------------------------------
const authOverlay = document.getElementById("authOverlay");
const adminPasscode = document.getElementById("adminPasscode");
const authLoginBtn = document.getElementById("authLoginBtn");
const authError = document.getElementById("authError");
const dashboardContent = document.getElementById("dashboardContent");

const ADMIN_PASSCODE_HASH = "nolyadmin123";

function authenticateAdmin() {
    const entered = adminPasscode.value.trim();
    if (entered === ADMIN_PASSCODE_HASH || entered === "admin123" || entered === "NOLY2026") {
        isAuthenticated = true;
        authOverlay.style.display = "none";
        dashboardContent.style.display = "block";
        initDashboardListeners();
    } else {
        authError.style.display = "block";
        authError.textContent = "Invalid Administrator Passcode.";
    }
}

authLoginBtn.addEventListener("click", authenticateAdmin);
adminPasscode.addEventListener("keypress", (e) => {
    if (e.key === "Enter") authenticateAdmin();
});

// -------------------------------------------------------------
// TAB NAVIGATION
// -------------------------------------------------------------
const navBtns = document.querySelectorAll(".nav-btn");
const tabContents = document.querySelectorAll(".tab-content");

navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        navBtns.forEach(b => b.classList.remove("active"));
        tabContents.forEach(tc => tc.classList.remove("active"));

        btn.classList.add("active");
        const selectedEl = document.getElementById(targetTab);
        if (selectedEl) {
            selectedEl.classList.add("active");
        }
    });
});

// -------------------------------------------------------------
// FIREBASE DATABASE LISTENERS FOR LIVE METRICS
// -------------------------------------------------------------
function initDashboardListeners() {
    signInAnonymously(auth).catch(err => console.error("Firebase Auth Error:", err));

    const roomsRef = ref(database, "rooms");
    const quickMatchRef = ref(database, "quickMatch");

    // Listen to Rooms
    onValue(roomsRef, (snapshot) => {
        if (!snapshot.exists()) {
            renderEmptyRooms();
            return;
        }

        const roomsData = snapshot.val();
        processRoomsData(roomsData);
    });

    // Listen to Quick Match Queue
    onValue(quickMatchRef, (snapshot) => {
        const metricQueue = document.getElementById("metricQuickMatchQueue");
        if (!snapshot.exists()) {
            if (metricQueue) metricQueue.textContent = "0";
            return;
        }

        const queueData = snapshot.val();
        const waitingCount = Object.values(queueData).filter(p => p && p.status === "waiting").length;
        if (metricQueue) metricQueue.textContent = String(waitingCount);
    });
}

function processRoomsData(rooms) {
    const roomEntries = Object.entries(rooms);
    let activeRoomsCount = 0;
    let completedMatchesCount = 0;

    const overviewRoomList = document.getElementById("overviewRoomList");
    const matchList = document.getElementById("matchList");
    const playerList = document.getElementById("playerList");

    let overviewRowsHTML = "";
    let matchRowsHTML = "";
    let playerRowsHTML = "";

    const uniquePlayers = new Map();

    roomEntries.forEach(([code, room]) => {
        if (!room) return;

        const isGameOver = room.game && room.game.gameOver;
        if (isGameOver) {
            completedMatchesCount++;
        } else {
            activeRoomsCount++;
        }

        const createdAtStr = room.createdAt ? new Date(room.createdAt).toLocaleTimeString() : "N/A";
        const statusBadge = isGameOver
            ? '<span class="status-badge status-completed">Completed</span>'
            : (room.guest ? '<span class="status-badge status-active">In Game</span>' : '<span class="status-badge status-waiting">Waiting</span>');

        // Overview Room Table
        overviewRowsHTML += `
            <tr>
                <td><strong>${code}</strong></td>
                <td>${room.host || "N/A"}</td>
                <td>${room.guest || "Waiting..."}</td>
                <td>${statusBadge}</td>
                <td>${createdAtStr}</td>
            </tr>
        `;

        // Match Explorer Table
        const deckLeft = room.game && room.game.deck ? room.game.deck.length : "N/A";
        const playerTurn = room.game ? `Player ${room.game.playerTurn || 1}` : "N/A";

        matchRowsHTML += `
            <tr>
                <td><strong>${code}</strong></td>
                <td>${statusBadge}</td>
                <td>${playerTurn}</td>
                <td>${deckLeft} cards</td>
                <td>${isGameOver ? "YES" : "NO"}</td>
            </tr>
        `;

        // Track Players
        if (room.host) {
            uniquePlayers.set(room.host, { room: code, role: "Host" });
        }
        if (room.guest) {
            uniquePlayers.set(room.guest, { room: code, role: "Guest" });
        }
    });

    uniquePlayers.forEach((info, uid) => {
        playerRowsHTML += `
            <tr>
                <td><code>${uid}</code></td>
                <td>Room ${info.room}</td>
                <td>${info.role}</td>
                <td><span class="status-badge status-active">Active</span></td>
            </tr>
        `;
    });

    if (uniquePlayers.size === 0) {
        playerRowsHTML = '<tr><td colspan="4" style="text-align: center; color: #a8c0b0;">No online players detected.</td></tr>';
    }

    // Update Metrics
    document.getElementById("metricActiveRooms").textContent = String(activeRoomsCount);
    document.getElementById("metricCompletedMatches").textContent = String(completedMatchesCount);

    if (overviewRoomList) overviewRoomList.innerHTML = overviewRowsHTML || '<tr><td colspan="5" style="text-align: center;">No active rooms.</td></tr>';
    if (matchList) matchList.innerHTML = matchRowsHTML || '<tr><td colspan="5" style="text-align: center;">No active matches.</td></tr>';
    if (playerList) playerList.innerHTML = playerRowsHTML;
}

function renderEmptyRooms() {
    document.getElementById("metricActiveRooms").textContent = "0";
    document.getElementById("metricCompletedMatches").textContent = "0";

    const overviewRoomList = document.getElementById("overviewRoomList");
    if (overviewRoomList) {
        overviewRoomList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #a8c0b0;">No live game rooms found in database.</td></tr>';
    }
}
