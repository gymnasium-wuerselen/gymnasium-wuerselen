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
let spiele = {};
// ganz oben im Script
let pastVisible = 2;
let futureVisible = 2;
let currentSpielGlobal = 0;
let alleErgebnisse = {}; // Hier speichern wir lokal alle Ergebnisse aus Firebase
let spieleGeladen = false;
let lastLiveUpdate = null;
let adminMessageTimeout = null;

const liveTableLinks = {
    "1_m": "LINK_INTERVAL_1_M", // Spiele 1-25, maennlich
    "1_w": "LINK_INTERVAL_1_W", // Spiele 1-25, weiblich
    "2_m": "LINK_INTERVAL_2_M", // Spiele 26-50, maennlich
    "2_w": "LINK_INTERVAL_2_W", // Spiele 26-50, weiblich
    "3_m": "LINK_INTERVAL_3_M", // Spiele 51-75, maennlich
    "3_w": "LINK_INTERVAL_3_W", // Spiele 51-75, weiblich
    "4_m": "LINK_INTERVAL_4_M", // Spiele 76-100, maennlich
    "4_w": "LINK_INTERVAL_4_W"  // Spiele 76-100, weiblich
};

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
    const adminOverlay = document.getElementById("adminOverlay");
    const closeAdminPanelBtn = document.getElementById("closeAdminPanelBtn");
    const selectGameBtn = document.getElementById("selectGameBtn");
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
                openAdminPanel();
            } else { pwInput.value = ""; }
        }
    });

    closeAdminPanelBtn.onclick = closeAdminPanel;
    adminOverlay.onclick = closeAdminPanel;

    selectGameBtn.onclick = () => {
        const eingabe = prompt("Welche Spielnummer soll live sein? 0 bedeutet: Spielpause. -1 bedeutet: kein Spiel. ");

        if (eingabe === null) return;

        const wert = eingabe.trim().toLowerCase();

        if (wert === "0" || wert === "p") {
            setSpiel("0");
            return;
        }

        const nr = Number(wert);

        if (!Number.isInteger(nr) || nr < -1 || nr > 100) {
            alert("Bitte eine ganze Zahl von -1 bis 100 eingeben.");
            return;
        }

        setSpiel(nr);
    };

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
        showAdminMessage(`Ergebnis für Spiel ${nr} gespeichert. Spiel ${nr + 1} ist jetzt live.`, "success");
    } else {
        showAdminMessage("In einer Pause oder ohne aktuelles Spiel kann kein Ergebnis gespeichert werden.", "error");
    }
};
document.getElementById("resetResultsBtn").onclick = () => {
    if (confirm("Möchtest du wirklich ALLE Ergebnisse löschen? Dies kann nicht rückgängig gemacht werden.")) {
        set(ref(db, "ergebnisse"), null).then(() => {
            showAdminMessage("Alle Ergebnisse wurden zurueckgesetzt.", "success");
        });
    }
};
}

function setSpiel(nr) {
    set(ref(db, "aktuellesSpiel"), nr);
    showAdminMessage(getAdminSpielMessage(nr), "success");
}

function getAdminSpielMessage(nr) {
    if (nr === 0) return "Spielpause ist jetzt live.";
    if (nr === -1) return "Kein Spiel ist jetzt live.";
    return `Spiel ${nr} ist jetzt live.`;
}

function openAdminPanel() {
    document.getElementById("adminOverlay").style.display = "block";
    document.getElementById("adminPanel").style.display = "block";
}

function closeAdminPanel() {
    document.getElementById("adminOverlay").style.display = "none";
    document.getElementById("adminPanel").style.display = "none";
}

function showAdminMessage(text, type = "success") {
    const message = document.getElementById("adminMessage");
    if (!message) return;

    message.textContent = text;
    message.className = `admin-message admin-message-${type}`;
    message.style.display = "block";

    if (adminMessageTimeout) clearTimeout(adminMessageTimeout);
    adminMessageTimeout = setTimeout(() => {
        message.style.display = "none";
    }, 3500);
}

// --- FIREBASE & LISTENERS ---
onValue(ref(db, "aktuellesSpiel"), (snapshot) => {
    const nr = snapshot.val();
    currentSpielGlobal = nr;
    lastLiveUpdate = new Date();
    if(document.getElementById("adminCurrentNr")) {
        document.getElementById("adminCurrentNr").textContent = nr === "0" ? "0" : nr;
    }
    updateAdminResultLabels(nr);
    updateLiveSpiel(nr);
    updateSideGames(nr);
});

onValue(ref(db, "ergebnisse"), (snapshot) => {
    alleErgebnisse = snapshot.val() || {};
    updateSideGames(currentSpielGlobal); // Liste neu zeichnen, wenn Ergebnisse kommen
});

onValue(ref(db, "spiele"), (snapshot) => {
    spiele = snapshot.val() || {};
    spieleGeladen = true;
    lastLiveUpdate = new Date();
    updateAdminResultLabels(currentSpielGlobal);
    updateSideGames(currentSpielGlobal);
    updateLiveSpiel(currentSpielGlobal);
});

function updateLiveSpiel(nr) {
    console.log("LIVE NR:", nr);
    console.log("SPIEL EXISTIERT?", spiele[nr.toString()]);
    console.log("ALLE SPIELE:", spiele);
    
    const box = document.getElementById("liveText");
    const container = document.getElementById("liveSpiel");
    const updateText = getLastUpdatedText();

    if (nr === "0") {
        container.style.display = "block";
        box.innerHTML = `
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; letter-spacing: 2px; display: flex; align-items: center; justify-content: center;">
                <span class="live-indicator"></span> SPIELPAUSE
            </div>
            <div style="font-size: 18px; font-weight: bold;">
                Gerade gibt es kein aktuelles Spiel.
            </div>
            <div class="live-updated">${updateText}</div>
        `;
        return;
    }

    // 1. Wenn kein Spiel aktiv ist
    if (!nr || nr === -1) { 
        container.style.display = "none"; 
        return; 
    }

    container.style.display = "block";

    // 2. Inhalt setzen mit pulsierendem Punkt und Profi-Layout
    const game = spiele[nr.toString()];

if (game) {
    box.innerHTML = `
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px; letter-spacing: 2px; display: flex; align-items: center; justify-content: center;">
            <span class="live-indicator"></span> AKTUELLE SPIELE
        </div>

        <div style="font-size: 18px; font-weight: bold; line-height: 1.6;">
            
            <div class="game-row">
                <span class="platz">Platz 1:</span>
                <span class="teams">${game.a}</span>
                <span class="result"></span>
            </div>

            <div class="game-row">
                <span class="platz">Platz 2:</span>
                <span class="teams">${game.b}</span>
                <span class="result"></span>
            </div>

        </div>

        <div class="live-button-container">
            <span class="live-table-arrow">&rArr;</span>
            <button id="liveTableBtn">Zur Live-Tabelle</button>
            <span class="live-table-arrow">&lArr;</span>
        </div>
        <div class="live-updated">${updateText}</div>
        `;

     const btn = document.getElementById("liveTableBtn");
        if (btn) {
            btn.onclick = () => {
                const liveTableLink = getLiveTableLink(nr, game);

                if (!liveTableLink) {
                    alert("Fuer dieses Spiel konnte noch keine passende Live-Tabelle gefunden werden.");
                    return;
                }

                window.location.href = liveTableLink;
            };
        }
} else {
            // Fallback-Text, falls für die Nummer kein Spiel im Objekt 'spiele' ist
            box.innerHTML = `
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; letter-spacing: 2px; display: flex; align-items: center; justify-content: center;">
                    <span class="live-indicator"></span> AKTUELLE SPIELE
                </div>
                <div style="font-size: 18px; font-weight: bold;">
                    ${spieleGeladen ? `Keine Spieldaten fuer Spiel ${nr} gefunden.` : "Spielplan wird geladen..."}
                </div>
                <div class="live-hint">${spieleGeladen ? "Bitte pruefe die Spielnummer oder die Firebase-Daten." : "Die aktuellen Daten werden gleich angezeigt."}</div>
                <div class="live-updated">${updateText}</div>
            `;
        }
}

function getLastUpdatedText() {
    if (!lastLiveUpdate) return "Noch nicht aktualisiert";

    return `Zuletzt aktualisiert um ${lastLiveUpdate.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })} Uhr`;
}

function updateAdminResultLabels(nr) {
    const labelA = document.getElementById("adminGameALabel");
    const labelB = document.getElementById("adminGameBLabel");

    if (!labelA || !labelB) return;

    const game = spiele && nr ? spiele[String(nr)] : null;

    labelA.textContent = game ? `Platz 1: ${game.a}` : "Platz 1";
    labelB.textContent = game ? `Platz 2: ${game.b}` : "Platz 2";
}

function getLiveTableLink(nr, game) {
    const interval = getLiveTableInterval(nr);
    const gender = getGameGender(game);

    if (!interval || !gender) return null;

    return liveTableLinks[`${interval}_${gender}`] || null;
}

function getLiveTableInterval(nr) {
    const number = Number(nr);

    if (number >= 1 && number <= 25) return 1;
    if (number >= 26 && number <= 50) return 2;
    if (number >= 51 && number <= 75) return 3;
    if (number >= 76 && number <= 100) return 4;

    return null;
}

function getGameGender(game) {
    const teamNames = [game.a, game.b]
        .flatMap(matchup => String(matchup).split(/\s*(?:-|–|—|:|gegen|vs\.?)\s*/i))
        .map(team => team.trim())
        .filter(Boolean);

    if (teamNames.length < 4) return null;

    const endings = teamNames.map(team => {
        const normalizedTeam = team.toLowerCase().replace(/[^\wäöüß]+$/i, "");
        return normalizedTeam.endsWith("m") || normalizedTeam.endsWith("w")
            ? normalizedTeam.slice(-1)
            : null;
    });

    if (endings.every(ending => ending === "m")) return "m";
    if (endings.every(ending => ending === "w")) return "w";

    return null;
}

function updateSideGames(current) {
    if (!spiele || Object.keys(spiele).length === 0) {
        document.getElementById("pastWrapper").style.display = "none";
        document.getElementById("futureWrapper").style.display = "none";
        return;
    }

    const keys = Object.keys(spiele)
        .map(k => parseInt(k))
        .filter(k => !isNaN(k))
        .sort((a, b) => a - b);

    if (current === "0") {
        const nextGame = getNextGameAfterPause();
        renderPast(keys.filter(k => k < nextGame), nextGame);
        renderFuture(keys.filter(k => k >= nextGame), nextGame);
        return;
    }

    if (!current || current === -1) {
        document.getElementById("pastWrapper").style.display = "none";
        document.getElementById("futureWrapper").style.display = "none";
        return;
    }

    current = parseInt(current);

    renderPast(keys.filter(k => k < current), current);
    renderFuture(keys.filter(k => k > current), current);
}

function getNextGameAfterPause() {
    const resultKeys = Object.keys(alleErgebnisse || {})
        .map(k => parseInt(k))
        .filter(k => !isNaN(k));

    if (resultKeys.length === 0) return 1;

    return Math.max(...resultKeys) + 1;
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
        const game = spiele[nr.toString()];
        if (!spiele[nr]) return;
        const div = document.createElement("div");
        div.className = "game-line";
        
        let displayContent = spiele[nr];

        // 3. Ergebnisse integrieren (falls vorhanden)
        if (alleErgebnisse[nr]) {
            const res = alleErgebnisse[nr];
            const resA = res.a ? `<span class="result">${res.a}</span>` : "";
            const resB = res.b ? `<span class="result">${res.b}</span>` : "";

            displayContent = `
            <div class="game-row">
                <span class="platz">Platz 1:</span>
                <span class="teams">${game.a}</span>
                ${resA}
            </div>

            <div class="game-row">
                <span class="platz">Platz 2:</span>
                <span class="teams">${game.b}</span>
                ${resB}
            </div>
            `;
        } else {
            displayContent = `
            <div class="game-row">
                <span class="platz">Platz 1:</span>
                <span class="teams">${game.a}</span>
            </div>

            <div class="game-row">
                <span class="platz">Platz 2:</span>
                <span class="teams">${game.b}</span>
            </div>
            `;
        }

        div.innerHTML = displayContent;
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
    if (pastVisible > 2) {
        lessBtn.style.display = "inline-block";
    } else {
        lessBtn.style.display = "none";
    }

    // 6. Klick-Events (direkt in der Funktion definiert)
    // Klicks für Mehr anzeigen
    moreBtn.onclick = () => {
        pastVisible += 4;
        updateSideGames(currentSpielGlobal);
        
        // Kurze Verzögerung, damit das DOM Zeit hat, die neuen Elemente zu rendern
        setTimeout(() => {
            keepElementInView(moreBtn.offsetParent ? moreBtn : lessBtn);
        }, 50);
    };

    lessBtn.onclick = () => {
        pastVisible = 2; // Zurück auf Standardwert
        updateSideGames(currentSpielGlobal);
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
        if (!spiele[nr]) return;
        const div = document.createElement("div");
        div.className = "game-line";
        const game = spiele[nr];
        div.innerHTML = `
        <div class="game-row">
            <span class="platz">Platz 1:</span>
            <span class="teams">${game.a}</span>
        </div>

        <div class="game-row">
            <span class="platz">Platz 2:</span>
            <span class="teams">${game.b}</span>
        </div>
        `;
        container.appendChild(div);
    });

    moreBtn.style.display = futureVisible < future.length ? "inline-block" : "none";
        // Klicks
    moreBtn.onclick = () => {
        futureVisible += 4;
        updateSideGames(currentSpielGlobal);

        // NEU: Wartet kurz, bis die neuen Spiele gezeichnet sind, und scrollt dann
        setTimeout(() => {
            keepElementInView(moreBtn.offsetParent ? moreBtn : lessBtn);
        }, 50);
    };


    let lessBtn = document.getElementById("futureLessBtn") || createLessBtn("futureLessBtn", moreBtn, true);
    lessBtn.style.display = futureVisible > 4 ? "inline-block" : "none";
    lessBtn.onclick = () => { futureVisible = 2; updateSideGames(currentSpielGlobal); scrollToLive(); };
}

function createLessBtn(id, target, before = false) {
    const btn = document.createElement("button");
    btn.id = id; btn.className = "show-more"; btn.textContent = "Weniger anzeigen";
    if (before) target.parentNode.insertBefore(btn, target);
    else target.parentNode.insertBefore(btn, target.nextSibling);
    return btn;
}

function keepElementInView(element) {
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const countdown = document.getElementById("turnierCountdown");
    const topPadding = (countdown && countdown.style.display !== "none" ? countdown.offsetHeight : 0) + 16;
    const bottomPadding = 24;

    if (rect.top < topPadding) {
        window.scrollBy({ top: rect.top - topPadding, behavior: "smooth" });
    } else if (rect.bottom > window.innerHeight - bottomPadding) {
        window.scrollBy({ top: rect.bottom - (window.innerHeight - bottomPadding), behavior: "smooth" });
    }
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

const deleteBtn = document.getElementById("deleteSingleResultBtn");

if (deleteBtn) {
    deleteBtn.onclick = deleteSingleResult;
}

function deleteSingleResult() {
    const nr = prompt("Welche Spielnummer soll gelöscht werden?");

    if (!nr) return;

    const nummer = nr.trim();

    if (!alleErgebnisse[nummer]) {
        alert("Für dieses Spiel gibt es kein gespeichertes Ergebnis.");
        return;
    }

    if (!confirm(`Ergebnis von Spiel ${nummer} wirklich löschen?`)) return;

    // Ergebnis lokal löschen
    delete alleErgebnisse[nummer];

    // In Firebase löschen
    set(ref(db, "ergebnisse/" + nummer), null);

    showAdminMessage(`Ergebnis von Spiel ${nummer} geloescht.`, "success");
}

window.addEventListener("resize", setLiveOffset);
window.addEventListener("scroll", handleLiveResize);
