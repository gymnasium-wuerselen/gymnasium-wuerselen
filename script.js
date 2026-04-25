import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js";

// --- FIREBASE KONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDbviwxqQ-SITuT-5MiqanxKGLM11oPULA",
    authDomain: "fubanatu-2026.firebaseapp.com",
    databaseURL: "https://fubanatu-2026-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fubanatu-2026",
    storageBucket: "fubanatu-2026.firebasestorage.app",
    messagingSenderId: "350065123550",
    appId: "1:350065123550:web:f2f7b412f9dadc4b4ee24f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- GLOBALE VARIABLEN ---
let spieleDaten = {}; 
let currentSpielGlobal = 0; 
let alleErgebnisse = {}; 
let pastVisible = 4;
let futureVisible = 4;

// --- INITIALISIERUNG ---
window.addEventListener('load', () => {
    initPopup();
    initCountdown();
    initAdmin();
    // Start-Anzeige
    updateSideGames(0);
});

// --- FIREBASE LISTENERS ---

// 1. Spiele-Liste laden
onValue(ref(db, "spiele"), (snapshot) => {
    spieleDaten = snapshot.val() || {};
    updateSideGames(currentSpielGlobal);
});

// 2. Aktuelles Spiel laden
onValue(ref(db, "aktuellesSpiel"), (snapshot) => {
    const nr = snapshot.val() || 0;
    currentSpielGlobal = nr;
    updateLiveSpiel(nr);
    updateSideGames(nr);
});

// 3. Ergebnisse laden
onValue(ref(db, "ergebnisse"), (snapshot) => {
    alleErgebnisse = snapshot.val() || {};
    updateSideGames(currentSpielGlobal);
});

// --- UI FUNKTIONEN ---

function updateLiveSpiel(nr) {
    const box = document.getElementById("liveText");
    const container = document.getElementById("liveSpiel");

    if (!nr || nr === 0 || !spieleDaten[nr]) { 
        container.style.display = "none"; 
        return; 
    }

    container.style.display = "block";
    const daten = spieleDaten[nr];

    box.innerHTML = `
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; letter-spacing: 2px; display: flex; align-items: center; justify-content: center;">
            <span class="live-indicator"></span> AKTUELLE SPIELE
        </div>
        <div style="text-align: left; display: inline-block; font-size: 18px; line-height: 1.6;">
            <div><span style="font-weight: bold; width: 80px; display: inline-block;">Platz 1:</span> ${daten.p1 || "---"}</div>
            <div><span style="font-weight: bold; width: 80px; display: inline-block;">Platz 2:</span> ${daten.p2 || "---"}</div>
        </div>
    `;
}

function updateSideGames(current) {
    const nr = parseInt(current) || 0;
    renderPast(nr);
    renderFuture(nr);
}

function renderPast(current) {
    const container = document.getElementById("pastGames");
    const wrapper = document.getElementById("pastWrapper");
    if (!container) return;

    const keys = Object.keys(spieleDaten).map(Number).filter(n => n < current && n > 0).sort((a,b) => b-a);
    
    if (keys.length === 0) {
        wrapper.style.display = "none";
        return;
    }
    
    wrapper.style.display = "block";
    container.innerHTML = "";

    keys.slice(0, pastVisible).forEach(nr => {
        const d = spieleDaten[nr];
        const res = alleErgebnisse[nr] || { a: "-", b: "-" };
        const div = document.createElement("div");
        div.className = "game-line";
        div.style.textAlign = "left";
        div.innerHTML = `
            <div style="font-size:11px; opacity:0.6;">RUNDE ${nr}</div>
            <div style="display:flex; justify-content:space-between;">
                <span><b>Platz 1:</b> ${d.p1}</span> <span class="game-res">${res.a}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span><b>Platz 2:</b> ${d.p2}</span> <span class="game-res">${res.b}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderFuture(current) {
    const container = document.getElementById("futureGames");
    const wrapper = document.getElementById("futureWrapper");
    if (!container) return;

    const keys = Object.keys(spieleDaten).map(Number).filter(n => n > current).sort((a,b) => a-b);

    if (keys.length === 0) {
        wrapper.style.display = "none";
        return;
    }

    wrapper.style.display = "block";
    container.innerHTML = "";

    keys.slice(0, futureVisible).forEach(nr => {
        const d = spieleDaten[nr];
        const div = document.createElement("div");
        div.className = "game-line";
        div.style.textAlign = "left";
        div.innerHTML = `
            <div style="font-size:11px; opacity:0.6;">RUNDE ${nr}</div>
            <div><b>Platz 1:</b> ${d.p1}</div>
            <div><b>Platz 2:</b> ${d.p2}</div>
        `;
        container.appendChild(div);
    });
}

// --- RESTLICHE FUNKTIONEN (ADMIN, POPUP, ETC.) ---

function initAdmin() {
    const ball = document.getElementById("adminBall");
    const pwBox = document.getElementById("adminPasswordBox");
    const pwInput = document.getElementById("adminPassword");
    const adminPanel = document.getElementById("adminPanel");
    const adminButtons = document.getElementById("adminButtons");

    ball.onclick = () => { pwBox.style.display = "block"; pwInput.focus(); };
    
    pwInput.onkeyup = (e) => {
        if (e.key === "Enter" && pwInput.value === "Admin123") {
            pwBox.style.display = "none";
            adminPanel.style.display = "block";
        }
    };

    for (let i = 1; i <= 50; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = "admin-button";
        btn.onclick = () => {
            set(ref(db, "aktuellesSpiel"), i);
            adminPanel.style.display = "none";
        };
        adminButtons.appendChild(btn);
    }

    document.getElementById("saveResultsBtn").onclick = () => {
        const nr = currentSpielGlobal;
        if (nr === 0) return;
        const resA = document.getElementById("resA1").value + ":" + document.getElementById("resA2").value;
        const resB = document.getElementById("resB1").value + ":" + document.getElementById("resB2").value;
        
        set(ref(db, "ergebnisse/" + nr), { a: resA, b: resB });
        set(ref(db, "aktuellesSpiel"), nr + 1);
        
        ["resA1", "resA2", "resB1", "resB2"].forEach(id => document.getElementById(id).value = "");
    };
}

function initPopup() {
    const popup = document.getElementById('meinPopup');
    if (!popup) return;
    if (!localStorage.getItem('popupShown')) {
        popup.style.display = 'block';
        document.getElementById('popupOverlay').style.display = 'block';
        setTimeout(() => {
            popup.style.display = 'none';
            document.getElementById('popupOverlay').style.display = 'none';
        }, 5000);
        localStorage.setItem('popupShown', 'true');
    }
}

function initCountdown() {
    const start = new Date("2026-07-14T08:00:00");
    setInterval(() => {
        const diff = start - new Date();
        const text = document.getElementById("countdownText");
        if (diff > 0) {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff / 60000) % 60);
            text.textContent = `Noch ${h}h ${m}m bis zum Start`;
        } else {
            document.getElementById("turnierCountdown").style.display = "none";
        }
    }, 1000);
}

// Hilfsfunktionen für das Design
function setLiveOffset() {
    const c = document.getElementById("turnierCountdown");
    const l = document.getElementById("liveSpiel");
    if (c && l && c.style.display !== "none") l.style.top = c.offsetHeight + "px";
}

function handleLiveResize() {
    const l = document.getElementById("liveSpiel");
    if (!l) return;
    if (l.getBoundingClientRect().top <= 10) l.classList.add("full-width");
    else l.classList.remove("full-width");
}

window.onscroll = handleLiveResize;