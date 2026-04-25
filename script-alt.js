import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js";

// Verhindert, dass der Browser die Scroll-Position beim Neuladen wiederherstellt
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Erzwingt das Scrollen nach oben beim Laden der Seite
window.scrollTo(0, 0);

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

// SPIELE-LISTE AUS FIREBASE LADEN
onValue(ref(db, "spiele"), (snapshot) => {
    spieleDaten = snapshot.val() || {};
    console.log("Spiele erfolgreich geladen:", spieleDaten);
    
    // Falls die Seite schon geladen ist, Anzeigen mit den neuen Daten aktualisieren
    if (currentSpielGlobal > 0) {
        updateLiveSpiel(currentSpielGlobal);
        updateSideGames(currentSpielGlobal);
    }
});

let spieleDaten = {}; // Hier speichern wir die Daten, die wir gleich aus Firebase laden
let currentSpielGlobal = 0; // Hilfsvariable für den aktuellen Spielstand

let currentSpielGlobal = 0;
let alleErgebnisse = {}; // Hier speichern wir lokal alle Ergebnisse aus Firebase
let pastVisible = 4;
let futureVisible = 4;

// --- INITIALISIERUNG BEIM LADEN ---
window.addEventListener('load', () => {
    initPopup();
    initCountdown();
    initAdmin();
    setLiveOffset();
    handleLiveResize();
});

// --- POPUP LOGIK ---
function initPopup() {
    const popup = document.getElementById('meinPopup');
    const storage = (location.protocol === 'file:') ? sessionStorage : localStorage;
    const schonGezeigt = storage.getItem('popupSchonGezeigt');
    let besuchZaehler = Number(storage.getItem('besuchAnzahl') || 0) + 1;
    storage.setItem('besuchAnzahl', besuchZaehler);

    const sollPopup = !schonGezeigt || besuchZaehler === 1 || (besuchZaehler - 1) % 5 === 0;

    if (sollPopup) {
        popup.style.display = 'block';
        document.getElementById('popupOverlay').style.display = 'block';
        let sekunden = 5;
        const timerElement = document.getElementById('popupTimer');
        const countdown = setInterval(() => {
            sekunden--;
            timerElement.textContent = sekunden;
            if (sekunden <= 0) {
                clearInterval(countdown);
                popup.style.display = 'none';
                document.getElementById('popupOverlay').style.display = 'none';
            }
        }, 1000);
        storage.setItem('popupSchonGezeigt', 'true');
    }
}

// --- COUNTDOWN LOGIK ---
function initCountdown() {
    const turnierStart = new Date("2026-07-14T08:00:00");
    const update = () => {
        const diff = turnierStart - new Date();
        const box = document.getElementById("turnierCountdown");
        const text = document.getElementById("countdownText");
        if (diff > 0) {
            const tage = Math.floor(diff / 86400000);
            const std = Math.floor((diff / 3600000) % 24);
            const min = Math.floor((diff / 60000) % 60);
            const sek = Math.floor((diff / 1000) % 60);
            text.textContent = `Noch ${tage}T ${std}h ${min}m ${sek}s bis zum Turnierstart`;
        } else {
            box.style.display = "none";
            setLiveOffset();
        }
    };
    setInterval(update, 1000);
    update();
}

// --- ADMIN LOGIK ---
function initAdmin() {
    const ball = document.getElementById("adminBall");
    const pwBox = document.getElementById("adminPasswordBox");
    const pwInput = document.getElementById("adminPassword");
    const adminPanel = document.getElementById("adminPanel");
    const adminButtons = document.getElementById("adminButtons");
    let pwTimeout = null;

    ball.addEventListener("click", () => {
        pwBox.style.display = "block";
        pwInput.value = "";
        pwInput.focus();
        if (pwTimeout) clearTimeout(pwTimeout);
        pwTimeout = setTimeout(() => { pwBox.style.display = "none"; }, 2000);
    });

    pwInput.addEventListener("input", () => { if (pwTimeout) { clearTimeout(pwTimeout); pwTimeout = null; } });

    pwInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            if (pwInput.value === "Admin123") {
                pwBox.style.display = "none";
                adminPanel.style.display = "block";
            } else { pwInput.value = ""; }
        }
    });

    for (let i = 1; i <= 100; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = "admin-button";
        btn.onclick = () => setSpiel(i);
        adminButtons.appendChild(btn);
    }
    const leerBtn = document.createElement("button");
    leerBtn.textContent = "Leer";
    leerBtn.className = "admin-button";
    leerBtn.onclick = () => setSpiel(0);
    adminButtons.appendChild(leerBtn);

    document.getElementById("saveResultsBtn").onclick = () => {
    const nr = currentSpielGlobal;
    const resA = (document.getElementById("resA1").value || "0") + ":" + (document.getElementById("resA2").value || "0");
    const resB = (document.getElementById("resB1").value || "0") + ":" + (document.getElementById("resB2").value || "0");

    if (nr > 0) {
        // 1. Ergebnisse speichern
        set(ref(db, "ergebnisse/" + nr), { a: resA, b: resB });

        // 2. Zum nächsten Spiel springen
        set(ref(db, "aktuellesSpiel"), nr + 1);
        
        // 3. Felder leeren
        document.getElementById("resA1").value = "";
        document.getElementById("resA2").value = "";
        document.getElementById("resB1").value = "";
        document.getElementById("resB2").value = "";

        // 4. Admin Menü schließen (Overlay ausblenden)
        document.getElementById("adminOverlay").style.display = "none";
    }
};
document.getElementById("resetResultsBtn").onclick = () => {
    if (confirm("Möchtest du wirklich ALLE Ergebnisse löschen? Dies kann nicht rückgängig gemacht werden.")) {
        set(ref(db, "ergebnisse"), null).then(() => {
            alert("Ergebnisse wurden zurückgesetzt.");
        });
    }
};
}

function setSpiel(nr) {
    set(ref(db, "aktuellesSpiel"), nr);
    document.getElementById("adminPanel").style.display = "none";
}

// --- FIREBASE & LISTENERS ---
onValue(ref(db, "aktuellesSpiel"), (snapshot) => {
    const nr = snapshot.val();
    currentSpielGlobal = nr;
    pastVisible = 2;
    futureVisible = 2;
    updateLiveSpiel(nr);
    updateSideGames(nr);
});

onValue(ref(db, "ergebnisse"), (snapshot) => {
    alleErgebnisse = snapshot.val() || {};
    updateSideGames(currentSpielGlobal); // Liste neu zeichnen, wenn Ergebnisse kommen
});

// Update der Anzeige im Admin Panel
onValue(ref(db, "aktuellesSpiel"), (snapshot) => {
    const nr = snapshot.val();
    currentSpielGlobal = nr;
    if(document.getElementById("adminCurrentNr")) {
        document.getElementById("adminCurrentNr").textContent = nr;
    }
    updateLiveSpiel(nr);
    updateSideGames(nr);
});

function updateLiveSpiel(nr) {
    const box = document.getElementById("liveText");
    const container = document.getElementById("liveSpiel");
    currentSpielGlobal = nr; // Merken, welche Nummer gerade aktuell ist

    // Wenn kein Spiel läuft oder die Daten noch nicht da sind
    if (!nr || nr === 0 || !spieleDaten[nr]) { 
        container.style.display = "none"; 
        return; 
    }

    container.style.display = "block";
    const daten = spieleDaten[nr];

    // Hier bauen wir das HTML für die Live-Box
    box.innerHTML = `
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; letter-spacing: 2px; display: flex; align-items: center; justify-content: center;">
            <span class="live-indicator"></span> AKTUELLE SPIELE
        </div>
        <div style="text-align: left; display: inline-block; font-size: 18px; line-height: 1.6; font-family: 'FranklinLight', Arial, sans-serif;">
            <div><span style="font-weight: bold; width: 80px; display: inline-block;">Platz 1:</span> ${daten.p1 || "---"}</div>
            <div><span style="font-weight: bold; width: 80px; display: inline-block;">Platz 2:</span> ${daten.p2 || "---"}</div>
        </div>
    `;
}

function updateSideGames(current) {
    if (!current || current === 0) return;
    const keys = Object.keys(spiele).map(Number);
    renderPast(keys.filter(k => k < current), current);
    renderFuture(keys.filter(k => k > current), current);
}

function renderPast(current) {
    const container = document.getElementById("pastGames");
    container.innerHTML = "";
    
    // Wir filtern alle Spielnummern, die kleiner als die aktuelle sind
    const past = Object.keys(spieleDaten)
        .map(Number)
        .filter(nr => nr < current && nr > 0)
        .sort((a, b) => b - a); // Neueste beendete Spiele zuerst

    if (past.length === 0) {
        container.innerHTML = '<div class="game-line" style="opacity:0.5;">Noch keine Spiele beendet.</div>';
        return;
    }

    past.slice(0, pastVisible).forEach(nr => {
        const daten = spieleDaten[nr] || { p1: "Spiel", p2: "Spiel" };
        const res = alleErgebnisse[nr] || { a: "-", b: "-" };
        
        const div = document.createElement("div");
        div.className = "game-line";
        div.style.textAlign = "left"; // Linksbündig für die Platz-Anzeige
        
        div.innerHTML = `
            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 5px; font-family: Arial;">RUNDE ${nr}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span><b style="width:65px; display:inline-block;">Platz 1:</b> ${daten.p1}</span>
                <span class="game-res">${res.a}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><b style="width:65px; display:inline-block;">Platz 2:</b> ${daten.p2}</span>
                <span class="game-res">${res.b}</span>
            </div>
        `;
        container.appendChild(div);
    });

    // Button-Logik (Mehr anzeigen)
    const moreBtn = document.getElementById("pastMoreBtn");
    moreBtn.style.display = past.length > pastVisible ? "inline-block" : "none";
    moreBtn.onclick = () => { pastVisible += 5; updateSideGames(current); };

    // "Weniger anzeigen" Button falls nötig
    if (pastVisible > 5) {
        let lessBtn = document.getElementById("pastLessBtn") || createLessBtn("pastLessBtn", moreBtn, true);
        lessBtn.style.display = "inline-block";
        lessBtn.onclick = () => { pastVisible = 2; updateSideGames(current); scrollToLive(); };
    } else if (document.getElementById("pastLessBtn")) {
        document.getElementById("pastLessBtn").style.display = "none";
    }
}

function renderFuture(current) {
    const container = document.getElementById("futureGames");
    container.innerHTML = "";
    
    // Wir filtern alle Spielnummern, die größer als die aktuelle sind
    const future = Object.keys(spieleDaten)
        .map(Number)
        .filter(nr => nr > current)
        .sort((a, b) => a - b); // Nächstes Spiel zuerst

    if (future.length === 0) {
        container.innerHTML = '<div class="game-line" style="opacity:0.5;">Keine weiteren Spiele geplant.</div>';
        return;
    }

    future.slice(0, futureVisible).forEach(nr => {
        const daten = spieleDaten[nr] || { p1: "TBA", p2: "TBA" };
        const div = document.createElement("div");
        div.className = "game-line";
        div.style.textAlign = "left";
        
        div.innerHTML = `
            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 5px; font-family: Arial;">RUNDE ${nr}</div>
            <div style="margin-bottom: 4px;"><b style="width:65px; display:inline-block;">Platz 1:</b> ${daten.p1}</div>
            <div><b style="width:65px; display:inline-block;">Platz 2:</b> ${daten.p2}</div>
        `;
        container.appendChild(div);
    });

    // Button-Logik
    const moreBtn = document.getElementById("futureMoreBtn");
    moreBtn.style.display = future.length > futureVisible ? "inline-block" : "none";
    moreBtn.onclick = () => { futureVisible += 5; updateSideGames(current); };

    // "Weniger anzeigen" Button
    let lessBtn = document.getElementById("futureLessBtn");
    if (futureVisible > 5) {
        if (!lessBtn) lessBtn = createLessBtn("futureLessBtn", moreBtn);
        lessBtn.style.display = "inline-block";
        lessBtn.onclick = () => { futureVisible = 2; updateSideGames(current); scrollToLive(); };
    } else if (lessBtn) {
        lessBtn.style.display = "none";
    }
}

function createLessBtn(id, target, before = false) {
    const btn = document.createElement("button");
    btn.id = id; btn.className = "show-more"; btn.textContent = "Weniger anzeigen";
    if (before) target.parentNode.insertBefore(btn, target);
    else target.parentNode.insertBefore(btn, target.nextSibling);
    return btn;
}

// --- UTILS (SCROLL & STICKY) ---
function scrollToLive() {
    const live = document.getElementById("liveSpiel");
    const oldPosition = live.style.position;
    live.style.position = "static";
    const y = live.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y - (window.innerHeight / 2) + (live.offsetHeight / 2), behavior: "smooth" });
    setTimeout(() => { live.style.position = oldPosition || "sticky"; }, 400);
}

function setLiveOffset() {
    const countdown = document.getElementById("turnierCountdown");
    const live = document.getElementById("liveSpiel");
    live.style.top = countdown.offsetHeight + "px";
}

function handleLiveResize() {
    const live = document.getElementById("liveSpiel");
    const isSticky = live.getBoundingClientRect().top <= parseInt(live.style.top || 0) + 1;
    if (isSticky) live.classList.add("full-width");
    else live.classList.remove("full-width");
}

window.addEventListener("resize", setLiveOffset);
window.addEventListener("scroll", handleLiveResize);
