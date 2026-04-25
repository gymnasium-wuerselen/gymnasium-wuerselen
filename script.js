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

// --- SPIELE DATEN ---
const spiele = {
    1: "1 – 1<br>2 - 2", 2: "3 – 3<br>4 - 4", 3: "5 – 5<br>6 - 6", 4: "7 – 7<br>8 - 8", 5: "9 – 9<br>10 - 10",
    6: "11 – 11<br>12 - 12", 7: "13 – 13<br>14 - 14", 8: "15 – 15<br>16 - 16", 9: "17 – 17<br>18 - 18", 10: "19 – 19<br>20 - 20",
    11: "21 – 21<br>22 - 22", 12: "23 – 23<br>24 - 24", 13: "25 – 25<br>26 - 26", 14: "27 – 27<br>28 - 28", 15: "29 – 29<br>30 - 30",
    16: "31 – 31<br>32 - 32", 17: "33 – 33<br>34 - 34", 18: "35 – 35<br>36 - 36", 19: "37 – 37<br>38 - 38", 20: "39 – 39<br>40 - 40"
};

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

    // 1. Wenn kein Spiel aktiv ist
    if (!nr || nr === 0) { 
        container.style.display = "none"; 
        return; 
    }

    container.style.display = "block";

    // 2. Inhalt setzen mit pulsierendem Punkt und Profi-Layout
    if (spiele[nr]) {
        box.innerHTML = `
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px; letter-spacing: 2px; display: flex; align-items: center; justify-content: center;">
                <span class="live-indicator"></span> AKTUELLE SPIELE
            </div>
            <div style="font-size: 20px; font-weight: bold; line-height: 1.4;">
                ${spiele[nr]}
            </div>
        `;
    } else {
        // Fallback-Text, falls für die Nummer kein Spiel im Objekt 'spiele' ist
        box.innerHTML = `
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; letter-spacing: 2px; display: flex; align-items: center; justify-content: center;">
                <span class="live-indicator"></span> AKTUELLE SPIELE
            </div>
            <div style="font-size: 20px; font-weight: bold;">
                Aktuelles Spiel: Spiel ${nr}
            </div>
        `;
    }
}

function updateSideGames(current) {
    if (!current || current === 0) return;
    const keys = Object.keys(spiele).map(Number);
    renderPast(keys.filter(k => k < current), current);
    renderFuture(keys.filter(k => k > current), current);
}

function renderPast(past, current) {
    const wrapper = document.getElementById("pastWrapper");
    const container = document.getElementById("pastGames");
    const moreBtn = document.getElementById("pastMoreBtn");

    // 1. Wenn keine vergangenen Spiele → ausblenden
    if (past.length === 0) {
        wrapper.style.display = "none";
        return;
    } else {
        wrapper.style.display = "block";
    }

    container.innerHTML = "";

    // 2. Die letzten X Spiele holen (höchste Nummer bleibt unten)
    const slice = past.slice(-pastVisible);

    slice.forEach(nr => {
        const div = document.createElement("div");
        div.className = "game-line";
        
        let displayContent = spiele[nr];

        // 3. Ergebnisse integrieren (falls vorhanden)
        if (typeof alleErgebnisse !== 'undefined' && alleErgebnisse[nr]) {
            const lines = spiele[nr].split("<br>");
            const res = alleErgebnisse[nr];
            // Format: Team A - Team B [Ergebnis]
            displayContent = `${lines[0]} <span class="game-res">${res.a}</span><br>${lines[1]} <span class="game-res">${res.b}</span>`;
        }

        div.innerHTML = `Spiel ${nr}<br>${displayContent}`;
        container.appendChild(div);
    });

    // 4. "Mehr anzeigen" Logik (wie in renderFuture)
    if (pastVisible < past.length) {
        moreBtn.style.display = "inline-block";
    } else {
        moreBtn.style.display = "none";
    }

    // 5. "Weniger anzeigen" Logik (dynamisch wie in renderFuture)
    let lessBtn = document.getElementById("pastLessBtn");
    if (!lessBtn) {
        lessBtn = document.createElement("button");
        lessBtn.id = "pastLessBtn";
        lessBtn.className = "show-more";
        lessBtn.textContent = "Weniger anzeigen";
        // Button nach dem "Mehr anzeigen" Button einfügen
        moreBtn.parentNode.insertBefore(lessBtn, moreBtn.nextSibling);
    }

    // Sichtbarkeit des Weniger-Buttons (ab mehr als 3 Spielen)
    if (pastVisible > 3) {
        lessBtn.style.display = "inline-block";
    } else {
        lessBtn.style.display = "none";
    }

    // 6. Klick-Events (direkt in der Funktion definiert)
    // Klicks für Mehr anzeigen
    moreBtn.onclick = () => {
        pastVisible += 4;
        updateSideGames(current);
        
        // Kurze Verzögerung, damit das DOM Zeit hat, die neuen Elemente zu rendern
        setTimeout(() => {
            const wrapper = document.getElementById("pastWrapper");
            wrapper.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' // Scrollt so, dass der Anfang des Bereichs oben im Bild ist
            });
        }, 50);
    };

    lessBtn.onclick = () => {
        pastVisible = 3; // Zurück auf Standardwert
        updateSideGames(current);
        scrollToLive(); // Nutzt deine vorhandene Funktion
    };
}

function renderFuture(future, current) {
    const wrapper = document.getElementById("futureWrapper");
    const container = document.getElementById("futureGames");
    const moreBtn = document.getElementById("futureMoreBtn");
    if (future.length === 0) { wrapper.style.display = "none"; return; }
    wrapper.style.display = "block";
    container.innerHTML = "";
    future.slice(0, futureVisible).forEach(nr => {
        const div = document.createElement("div");
        div.className = "game-line";
        div.innerHTML = `Spiel ${nr}<br>${spiele[nr]}`;
        container.appendChild(div);
    });

    moreBtn.style.display = futureVisible < future.length ? "inline-block" : "none";
        // Klicks
    moreBtn.onclick = () => {
        futureVisible += 4;
        updateSideGames(current);

        // NEU: Wartet kurz, bis die neuen Spiele gezeichnet sind, und scrollt dann
        setTimeout(() => {
            window.scrollBy({
                top: 250, // Scrollt 250 Pixel nach unten
                behavior: 'smooth'
            });
        }, 50);
    };


    let lessBtn = document.getElementById("futureLessBtn") || createLessBtn("futureLessBtn", moreBtn, true);
    lessBtn.style.display = futureVisible > 4 ? "inline-block" : "none";
    lessBtn.onclick = () => { futureVisible = 2; updateSideGames(current); scrollToLive(); };
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
