import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

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

// Helper function to prevent HTML Injection (XSS)
function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// DOM Elements
const authOverlay = document.getElementById("authOverlay");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const authLoginBtn = document.getElementById("authLoginBtn");
const authError = document.getElementById("authError");
const dashboardContent = document.getElementById("dashboardContent");

// -------------------------------------------------------------
// FIREBASE AUTHENTICATION (EMAIL & PASSWORD)
// Anonymous users are strictly denied administrator access.
// -------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (user && !user.isAnonymous) {
        isAuthenticated = true;
        authOverlay.style.display = "none";
        dashboardContent.style.display = "block";
        initDashboardListeners();
    } else {
        isAuthenticated = false;
        authOverlay.style.display = "flex";
        dashboardContent.style.display = "none";
    }
});

async function authenticateAdmin() {
    authError.style.display = "none";
    const email = adminEmail ? adminEmail.value.trim() : "";
    const password = adminPassword ? adminPassword.value.trim() : "";

    if (!email || !password) {
        authError.style.display = "block";
        authError.textContent = "Please enter both admin email and password.";
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user.isAnonymous) {
            authError.style.display = "block";
            authError.textContent = "Anonymous users are denied administrator privileges.";
            return;
        }

        isAuthenticated = true;
        authOverlay.style.display = "none";
        dashboardContent.style.display = "block";
        initDashboardListeners();
    } catch (error) {
        console.error("Admin Login Failure:", error);
        authError.style.display = "block";
        authError.textContent = "Authentication failed: " + (error.message || "Invalid credentials.");
    }
}

if (authLoginBtn) {
    authLoginBtn.addEventListener("click", authenticateAdmin);
}
if (adminPassword) {
    adminPassword.addEventListener("keypress", (e) => {
        if (e.key === "Enter") authenticateAdmin();
    });
}

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
// FIREBASE DATABASE LISTENERS WITH ERROR BOUNDARIES
// -------------------------------------------------------------
function initDashboardListeners() {
    if (!isAuthenticated) return;

    const roomsRef = ref(database, "rooms");
    const quickMatchRef = ref(database, "quickMatch");

    // Listen to Rooms with error handling callback
    onValue(roomsRef, (snapshot) => {
        if (!snapshot.exists()) {
            renderEmptyRooms();
            return;
        }

        const roomsData = snapshot.val();
        processRoomsData(roomsData);
    }, (error) => {
        console.error("Firebase Rooms Read Error:", error);
        const overviewRoomList = document.getElementById("overviewRoomList");
        if (overviewRoomList) {
            overviewRoomList.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ff6b6b;">Permission Denied or Error Loading Rooms: ${escapeHTML(error.message)}</td></tr>`;
        }
    });

    // Listen to Quick Match Queue with error handling callback
    onValue(quickMatchRef, (snapshot) => {
        const metricQueue = document.getElementById("metricQuickMatchQueue");
        if (!snapshot.exists()) {
            if (metricQueue) metricQueue.textContent = "0";
            return;
        }

        const queueData = snapshot.val();
        const waitingCount = Object.values(queueData).filter(p => p && p.status === "waiting").length;
        if (metricQueue) metricQueue.textContent = String(waitingCount);
    }, (error) => {
        console.error("Firebase QuickMatch Read Error:", error);
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

        const safeCode = escapeHTML(code);
        const safeHost = room.host ? escapeHTML(room.host) : "N/A";
        const safeGuest = room.guest ? escapeHTML(room.guest) : "Waiting...";

        // Overview Room Table (XSS Safe)
        overviewRowsHTML += `
            <tr>
                <td><strong>${safeCode}</strong></td>
                <td>${safeHost}</td>
                <td>${safeGuest}</td>
                <td>${statusBadge}</td>
                <td>${escapeHTML(createdAtStr)}</td>
            </tr>
        `;

        // Match Explorer Table (XSS Safe)
        const deckLeft = room.game && room.game.deck ? room.game.deck.length : "N/A";
        const playerTurn = room.game ? `Player ${room.game.playerTurn || 1}` : "N/A";

        matchRowsHTML += `
            <tr>
                <td><strong>${safeCode}</strong></td>
                <td>${statusBadge}</td>
                <td>${escapeHTML(playerTurn)}</td>
                <td>${escapeHTML(deckLeft)} cards</td>
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
                <td><code>${escapeHTML(uid)}</code></td>
                <td>Room ${escapeHTML(info.room)}</td>
                <td>${escapeHTML(info.role)}</td>
                <td><span class="status-badge status-active">Active</span></td>
            </tr>
        `;
    });

    if (uniquePlayers.size === 0) {
        playerRowsHTML = '<tr><td colspan="4" style="text-align: center; color: #a8c0b0;">No online players detected.</td></tr>';
    }

    // Update Metrics
    const metricRoomsEl = document.getElementById("metricActiveRooms");
    const metricCompletedEl = document.getElementById("metricCompletedMatches");
    if (metricRoomsEl) metricRoomsEl.textContent = String(activeRoomsCount);
    if (metricCompletedEl) metricCompletedEl.textContent = String(completedMatchesCount);

    if (overviewRoomList) overviewRoomList.innerHTML = overviewRowsHTML || '<tr><td colspan="5" style="text-align: center;">No active rooms.</td></tr>';
    if (matchList) matchList.innerHTML = matchRowsHTML || '<tr><td colspan="5" style="text-align: center;">No active matches.</td></tr>';
    if (playerList) playerList.innerHTML = playerRowsHTML;
}

function renderEmptyRooms() {
    const metricRoomsEl = document.getElementById("metricActiveRooms");
    const metricCompletedEl = document.getElementById("metricCompletedMatches");
    if (metricRoomsEl) metricRoomsEl.textContent = "0";
    if (metricCompletedEl) metricCompletedEl.textContent = "0";

    const overviewRoomList = document.getElementById("overviewRoomList");
    if (overviewRoomList) {
        overviewRoomList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #a8c0b0;">No live game rooms found in database.</td></tr>';
    }
}
