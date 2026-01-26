import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, onSnapshot, orderBy, limit, query, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/* --- 1. CONFIGURATION FIREBASE -- */
const firebaseConfig = { 
    apiKey: "AIzaSyA7ZNlC1ILS9-W3bgxWogUA6ak4c29a4Ns", 
    authDomain: "lovetravel-35285.firebaseapp.com", 
    projectId: "lovetravel-35285", 
    storageBucket: "lovetravel-35285.firebasestorage.app", 
    messagingSenderId: "189902268760", 
    appId: "1:189902268760:web:b461ce15d8c396be479d2d" 
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* --- 2. VARIABLES GLOBALES & ETATS -- */
let currentUser = localStorage.getItem('userRole') || 'tw';
let activeEvent = null;
let candlesBlown = 0;
let eggClicks = 0;
let opponentIsSleeping = false;
let hasTriggeredHotMatch = false;

// Listes temporaires pour le cache
let allPhotos = [];
let allLetters = [];
let allTodos = [];

// Variables upload
let tempUploadFile = null;
let tempUploadRole = null;
let currentScratchId = null;

// Variables Jeux
let activePendu = null;
let activeP4 = null;
let activeUno = null; 
let pickingWild = false; 
let wildCardIndex = -1;
let activeBac = null;

/* --- 3. AUTHENTIFICATION --- */
window.loginApp = function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    setPersistence(auth, browserLocalPersistence)
        .then(() => signInWithEmailAndPassword(auth, email, pass))
        .then(() => { errorMsg.style.display = 'none'; })
        .catch((error) => {
            errorMsg.style.display = 'block';
            errorMsg.innerText = "Accès refusé 😜";
            console.error(error);
        });
}

onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const loginBox = document.getElementById('login-box');
    const loadingMsg = document.getElementById('login-loading');

    if (user) {
        loginScreen.style.opacity = '0';
        setTimeout(() => { loginScreen.style.display = 'none'; }, 500);

        if(user.email.includes('theo')) {
            localStorage.setItem('userRole', 'fr');
            currentUser = 'fr';
        } else if(user.email.includes('elise')) {
            localStorage.setItem('userRole', 'tw');
            currentUser = 'tw';
        }
        updateIdentityUI(); 
    } else {
        loadingMsg.style.display = 'none';
        loginBox.style.display = 'block';
    }
});

window.logoutApp = function() {
    if(confirm("Se déconnecter ?")) signOut(auth);
}

/* --- 4. INTERFACE UTILISATEUR BASE --- */
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

window.toggleTheme = function() { 
    document.body.classList.toggle('dark-mode'); 
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
}

window.switchUser = function() { 
    currentUser = (currentUser === 'tw') ? 'fr' : 'tw'; 
    localStorage.setItem('userRole', currentUser); 
    alert(currentUser==='fr'?"Théo 🇫🇷":"Elise 🇹🇼"); 
    updateIdentityUI(); 
    updateMailboxView(); 
}

function updateIdentityUI() { 
    document.getElementById('user-toggle-btn').innerText = currentUser === 'tw' ? '🇹🇼' : '🇫🇷';
    document.getElementById('btn-add-fr').style.display = currentUser === 'fr' ? 'block' : 'none';
    document.getElementById('btn-add-tw').style.display = currentUser === 'tw' ? 'block' : 'none';
}

window.toggleCard = function(header) {
    if(header.parentElement.id === 'card-voyage') return;
    const content = header.nextElementSibling;
    const isClosed = content.style.display === "none";
    content.style.display = isClosed ? "block" : "none";
    header.classList.toggle("closed", !isClosed);
    localStorage.setItem('card_' + header.parentElement.id, isClosed ? 'open' : 'closed');
}

// Initialisation de l'état des cartes
document.querySelectorAll('.card[id]').forEach(c => { 
    if(c.id!=='card-voyage' && localStorage.getItem('card_'+c.id)==='closed') { 
        c.querySelector('.card-content').style.display='none'; 
        c.querySelector('.card-title').classList.add('closed'); 
    }
});

window.showAlert = function(title, msg, icon="✨") {
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-msg').innerText = msg;
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('custom-alert').style.display = 'flex';
}

/* --- 5. EVENTS & OVERLAYS --- */
const events = [
    { d: 7, m: 3, type: 'bday', name: "Théo", age: 21 },
    { d: 24, m: 4, type: 'bday', name: "Elise", age: 24 },
    { d: 6, m: 4, type: 'easter' },
    { d: 14, m: 2, type: 'love' }, 
    { d: 1, m: 5, type: 'holiday', title: "Fête du travail 🌿" },
    { d: 8, m: 5, type: 'holiday', title: "Victoire 1945 🇫🇷" },
    { d: 14, m: 5, type: 'holiday', title: "Jeudi de l’Ascension ✨" },
    { d: 25, m: 5, type: 'holiday', title: "Lundi de Pentecôte 🕊️" }
];

function checkEvents() {
    const today = new Date();
    const d = today.getDate();
    const m = today.getMonth() + 1; 
    activeEvent = events.find(e => e.d === d && e.m === m);
    
    if (activeEvent) {
        if(activeEvent.type === 'holiday') {
            const sub = document.getElementById('bd-subtitle');
            sub.style.display = "block";
            sub.innerText = activeEvent.title;
        } else {
            initOverlayMode();
        }
    }
}

function initOverlayMode() {
    const overlay = document.getElementById('bd-overlay');
    overlay.style.display = "flex";
    const title = document.getElementById('bd-title-text');
    const msg = document.getElementById('overlay-msg');
    const cakeBox = document.getElementById('cake-mode-container');
    const eggBox = document.getElementById('easter-egg-container');
    const loveBox = document.getElementById('love-container');

    if (activeEvent.type === 'bday') {
        title.innerText = "Joyeux Anniversaire " + activeEvent.name + " !";
        msg.innerText = "Fais un vœu et souffle (clique) sur les bougies ! 🕯️";
        cakeBox.style.display = 'flex'; loveBox.style.display = 'none'; eggBox.style.display = 'none';
        
        const ageStr = activeEvent.age.toString(); 
        const area = document.getElementById('candles-area');
        area.innerHTML = "";
        for(let i=0; i<ageStr.length; i++) {
            const digit = ageStr[i];
            const wrapper = document.createElement('div');
            wrapper.className = 'candle-wrapper';
            wrapper.id = 'candle-' + i;
            wrapper.onclick = () => blowCandle(i);
            wrapper.innerHTML = `<div class="smoke"></div><div class="flame"></div><div class="candle-num">${digit}</div>`;
            area.appendChild(wrapper);
        }
    } else if (activeEvent.type === 'love') {
        title.innerText = "Joyeuse Saint-Valentin !";
        msg.innerText = "Touche mon cœur pour sentir mon amour... ❤️";
        cakeBox.style.display = 'none'; eggBox.style.display = 'none'; loveBox.style.display = 'flex';
    } else if (activeEvent.type === 'easter') {
        title.innerText = "Joyeuses Pâques !";
        msg.innerText = "Tapote l'œuf pour découvrir la surprise...";
        cakeBox.style.display = 'none'; loveBox.style.display = 'none'; eggBox.style.display = 'flex';
        eggClicks = 0;
    }
}

window.blowCandle = function(index) {
    const c = document.getElementById('candle-' + index);
    if(c.classList.contains('blown-out')) return;
    c.classList.add('blown-out');
    candlesBlown++;
    if(candlesBlown >= activeEvent.age.toString().length) setTimeout(celebrate, 500);
}

window.crackEgg = function() {
    const egg = document.getElementById('easter-egg');
    eggClicks++;
    if(eggClicks === 1) egg.className = "easter-egg crack-1";
    else if(eggClicks === 2) egg.className = "easter-egg crack-2";
    else if(eggClicks === 3) {
        egg.className = "easter-egg crack-3";
        setTimeout(() => {
            egg.innerText = "🐰";
            document.getElementById('overlay-msg').innerText = "Joyeuses Pâques mes amours !";
            celebrate();
        }, 300);
    }
}

window.clickHeart = function() {
    const audio = new Audio("https://actions.google.com/sounds/v1/crowds/crowd_cheering.ogg");
    audio.volume = 0.3; audio.play().catch(e=>{});
    confetti({ particleCount: 20, angle: 90, spread: 55, colors: ['#ff0000', '#ff69b4'], zIndex: 200000 });
    document.getElementById('overlay-msg').innerText = "Je t'aime !";
    document.querySelector('.btn-enter').style.display = "block";
}

function celebrate() {
    const audio = new Audio("https://actions.google.com/sounds/v1/crowds/crowd_cheering.ogg");
    audio.volume = 0.5; audio.play().catch(e=>{});
    confetti({ particleCount: 100, spread: 70, zIndex: 200000 });
    document.querySelector('.btn-enter').style.display = "block";
}

window.enterSpecialApp = function() {
    document.getElementById('bd-overlay').style.display = "none";
    document.body.classList.add('birthday-theme');
    const sub = document.getElementById('bd-subtitle');
    sub.style.display = "block";
    if (activeEvent.type === 'bday') sub.innerText = `Les ${activeEvent.age} ans de ${activeEvent.name} ❤️`;
    else if (activeEvent.type === 'love') { document.body.classList.add('love-theme'); sub.innerText = "Bonne St. Valentin 🌹"; }
    else if (activeEvent.type === 'easter') sub.innerText = "Joyeuses Pâques 🐰";
}

checkEvents();

/* --- 6. MOODS & STATUTS --- */
function getMoodImage(role, outfitId) {
    const today = new Date();
    const d = today.getDate(); const m = today.getMonth() + 1;
    let suffix = "";
    if (d === 14 && m === 2) suffix = "_love";
    else if (d === 6 && m === 4) suffix = "_easter";
    else if (d === 7 && m === 3 && role === 'fr') suffix = "_hb";
    else if (d === 24 && m === 4 && role === 'tw') suffix = "_hb";
    return `MOOD/${role === 'fr' ? 'theo' : 'elise'}_${outfitId}${suffix}.png`;
}

onSnapshot(doc(db, "status", "moods"), (doc) => {
    if (doc.exists()) {
        const d = doc.data();
        document.getElementById("mood-img-fr").src = getMoodImage('fr', d.fr_outfit || 0);
        document.getElementById("mood-img-tw").src = getMoodImage('tw', d.tw_outfit || 0);
        document.getElementById("mood-msg-fr").innerText = d.fr_text || "";
        document.getElementById("mood-msg-tw").innerText = d.tw_text || "";

        const myOutfit = currentUser === 'fr' ? d.fr_outfit : d.tw_outfit;
        const oppOutfit = currentUser === 'fr' ? d.tw_outfit : d.fr_outfit;
        
        if (myOutfit === 2) document.body.classList.add('is-sleeping');
        else document.body.classList.remove('is-sleeping');
        opponentIsSleeping = (oppOutfit === 2);

        // Mode Hot
        const isFrHot = d.fr_outfit === 4;
        const isTwHot = d.tw_outfit === 4;
        if (isFrHot && isTwHot) {
            document.body.classList.add('is-burning');
            if (!hasTriggeredHotMatch) {
                hasTriggeredHotMatch = true;
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#ff0000', '#ffa500'], scalar: 1.2 });
                if(currentUser === 'fr') showAlert("Ouh là...", "Il fait très chaud ici, Elise a la même envie que toi... 🔥", "🥵");
                else showAlert("Ouh là...", "Il fait très chaud ici, Théo a la même envie que toi... 🔥", "🥵");
                if(navigator.vibrate) navigator.vibrate([100,50,100,50,500]);
            }
        } else {
            document.body.classList.remove('is-burning');
            hasTriggeredHotMatch = false;
        }
    }
});

window.sendBisou = function() {
    if (opponentIsSleeping) {
        const targetName = currentUser === 'fr' ? 'Elise' : 'Théo';
        showAlert("Chut... 🤫", `${targetName} rêve de toi en ce moment 🌙.`, "💤");
        return;
    }
    addDoc(collection(db, "actions"), { type: 'bisou', from: currentUser, timestamp: serverTimestamp() });
    sendNtfy(`💋 Bisou envoyé ! (${getCurrentTime(currentUser)})`, "kiss,heart", "high");
    const n = document.getElementById("notif"); 
    n.innerText = "💋 Bisou envoyé !"; 
    n.classList.add("show"); 
    setTimeout(() => n.classList.remove("show"), 3000);
    if(navigator.vibrate) navigator.vibrate(200); 
}

window.updateMood = function(emoji, text, outfitId) {
    setDoc(doc(db, "status", "moods"), { [currentUser+"_emoji"]: emoji, [currentUser+"_text"]: text, [currentUser+"_outfit"]: (outfitId !== undefined ? outfitId : 5) }, { merge: true });
    sendNtfy(`${emoji} ${text} (${getCurrentTime(currentUser)})`, "partly_sunny", "low");
}

window.openCustomMood = function() { const m=document.getElementById('custom-mood-modal'), i=document.getElementById('custom-mood-input'); m.style.display='flex'; i.value=""; setTimeout(()=>i.focus(),100); i.onkeydown=(e)=>{if(e.key==='Enter')confirmCustomMood()}; }
window.closeCustomMood = function() { document.getElementById('custom-mood-modal').style.display = 'none'; }
window.confirmCustomMood = function() { const i=document.getElementById('custom-mood-input'), t=i.value.trim(); if(t){ updateMood("✨",t,5); closeCustomMood(); if(navigator.vibrate)navigator.vibrate(50); } else { i.style.border="2px solid red"; setTimeout(()=>i.style.border="2px solid var(--border)",500); } }

/* --- 7. CYCLE WIDGET --- */
let currentCycleDay = 1;
onSnapshot(doc(db, "status", "cycle"), (docSnap) => {
    const ring = document.getElementById('cycle-ring');
    const txtDay = document.getElementById('cycle-day');
    const txtIcon = document.getElementById('cycle-icon');
    if (docSnap.exists()) {
        const data = docSnap.data();
        const lastStart = data.lastStart ? data.lastStart.toDate() : new Date();
        const now = new Date();
        const diffTime = Math.abs(now - lastStart);
        const rawDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let dayInCycle = ((rawDays - 1) % 28) + 1;
        currentCycleDay = dayInCycle;
        const isPeriod = dayInCycle <= 7;

        txtDay.innerText = `J-${dayInCycle}`;
        txtIcon.innerText = isPeriod ? "🩸" : "🌸"; 
        txtDay.className = isPeriod ? "cycle-red-text" : "cycle-normal-text";

        const percentage = (dayInCycle / 28) * 100;
        let colorStart = isPeriod ? "#ff9a9e" : "#a0e7ff"; 
        let colorEnd = isPeriod ? "#ff4b6e" : "#0984e3";
        ring.style.background = `conic-gradient(${colorEnd} 0%, ${colorStart} ${percentage}%, var(--border) ${percentage}%)`;
    }
});

window.editCycle = function() {
    if (currentUser === 'fr') {
        const today = new Date().toDateString();
        const lastSent = localStorage.getItem('lastCycleNotif');
        if (lastSent === today) {
            showAlert("Doucement beau gosse !", "Tu as déjà envoyé ton message de soutien aujourd'hui. Reviens demain ! ❤️", "⏳");
            return;
        }
        if (currentCycleDay <= 7) {
            sendNtfy("Courage ma petite chérie ❤️ Je pense fort à toi.", "rose", "high");
            showAlert("Message envoyé !", "Ton message de courage est parti vers elle 💌", "🚀");
        } else {
            sendNtfy("N'oublie pas ta pilule mon cœur 🌸", "pill", "high");
            showAlert("Rappel envoyé !", "La notification pilule est bien partie 💊", "✅");
        }
        localStorage.setItem('lastCycleNotif', today);
        return;
    }
    const modal = document.getElementById('cycle-edit-modal');
    document.getElementById('cycle-input-val').value = currentCycleDay;
    modal.style.display = 'flex';
}

window.adjustCycleInput = function(amount) {
    const input = document.getElementById('cycle-input-val');
    let val = parseInt(input.value) + amount;
    if(val < 1) val = 28; if(val > 28) val = 1;
    input.value = val;
}

window.saveCycleChange = function() {
    const day = parseInt(document.getElementById('cycle-input-val').value);
    if (!isNaN(day) && day >= 1 && day <= 28) {
        const newStart = new Date();
        newStart.setDate(newStart.getDate() - (day - 1));
        setDoc(doc(db, "status", "cycle"), { lastStart: newStart, type: 'auto' }, { merge: true });
        document.getElementById('cycle-edit-modal').style.display = 'none';
        showAlert("Cycle mis à jour", `Le calendrier est maintenant calé sur J-${day} !`, "🌸");
    }
}

window.resetCycleFull = function() {
    if(confirm("Confirmer que tes règles commencent aujourd'hui ?")) {
        setDoc(doc(db, "status", "cycle"), { lastStart: serverTimestamp(), type: 'auto' }, { merge: true });
        document.getElementById('cycle-edit-modal').style.display = 'none';
        confetti({ particleCount: 50, colors: ['#ff9eb5', '#ff4b6e'] });
    }
}

/* --- 8. LOGIQUE DES JEUX (COMPLÈTE) --- */

window.toggleGame = function(game) {
    const ids = ['pendu', 'p4', 'uno', 'bac'];
    ids.forEach(id => {
        const box = document.getElementById(id + '-box');
        const btn = document.getElementById('btn-' + id);
        if (id === game) {
            const isOpen = box.style.display === 'block';
            box.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) btn.classList.add('active-game');
            else btn.classList.remove('active-game');
        } else {
            box.style.display = 'none';
            btn.classList.remove('active-game');
        }
    });
}

// --- JEU : PENDU ---
onSnapshot(doc(db, "games", "pendu_active"), (s) => { activePendu = s.exists() ? s.data() : { state:'setup' }; renderPendu(activePendu); });

// Historique Pendu
onSnapshot(query(collection(db, "games_pendu_history"), orderBy("timestamp", "desc"), limit(50)), (s) => {
    const list = document.getElementById('pendu-history-list'); 
    list.innerHTML = "";
    s.forEach(d => { 
        const h = d.data(); 
        const dateStr = h.timestamp ? new Date(h.timestamp.toDate()).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}) : ""; 
        const resClass = h.result === 'win' ? 'hist-win' : 'hist-loose'; 
        const setterName = h.setter === 'fr' ? 'Théo' : 'Elise';
        const setterColor = h.setter === 'fr' ? 'var(--blue)' : 'var(--pink)';
        list.innerHTML += `<div class="hist-row"><span>${dateStr} - <b style="color:${setterColor}">${setterName}</b> : <b>${h.word}</b></span><span class="${resClass}">${h.result==='win'?'Trouvé':'Raté'}</span></div>`; 
    });
});

function renderPendu(game) {
    document.getElementById('btn-pendu').classList.toggle('is-running', game.state === 'playing');
    const ctx = document.getElementById('pendu-canvas').getContext('2d');
    const status = document.getElementById('pendu-status');
    const mainColor = getComputedStyle(document.body).getPropertyValue('--blue-dark');
    const pinkColor = getComputedStyle(document.body).getPropertyValue('--pink-dark');

    // DESSIN DU PENDU
    ctx.clearRect(0, 0, 200, 150); ctx.lineWidth = 3; ctx.beginPath(); ctx.strokeStyle = mainColor;
    if (game.mistakes > 0) { ctx.moveTo(20, 140); ctx.lineTo(180, 140); }
    if (game.mistakes > 1) { ctx.moveTo(50, 140); ctx.lineTo(50, 20); }
    if (game.mistakes > 2) { ctx.lineTo(130, 20); }
    if (game.mistakes > 3) { ctx.moveTo(130, 20); ctx.lineTo(130, 40); }
    ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = pinkColor;
    if (game.mistakes > 4) { ctx.beginPath(); ctx.arc(130, 55, 15, 0, Math.PI * 2); ctx.stroke(); }
    if (game.mistakes > 5) { ctx.beginPath(); ctx.moveTo(130, 70); ctx.lineTo(130, 110); ctx.stroke(); }
    ctx.beginPath();
    if (game.mistakes > 6) { ctx.moveTo(130, 80); ctx.lineTo(110, 95); }
    if (game.mistakes > 7) { ctx.moveTo(130, 80); ctx.lineTo(150, 95); }
    if (game.mistakes > 8) { ctx.moveTo(130, 110); ctx.lineTo(115, 135); }
    if (game.mistakes > 9) { ctx.moveTo(130, 110); ctx.lineTo(145, 135); }
    ctx.stroke();
    if (game.mistakes > 10) { ctx.font = "14px Arial"; ctx.fillStyle = pinkColor; ctx.textAlign = "center"; ctx.fillText("x x", 130, 60); }

    // ÉLÉMENTS DOM
    const restartArea = document.getElementById('pendu-restart-area');
    const setupArea = document.getElementById('pendu-setup');
    const keyboard = document.getElementById('pendu-keyboard');
    const canvas = document.getElementById('pendu-canvas');
    const wordDisplay = document.getElementById('pendu-word-display');

    // 1. JEU OFF ou FINI
    if (!game.state || game.state === 'idle') {
        status.innerText = "Prêt pour une partie ?";
        canvas.style.display = 'none'; wordDisplay.style.display = 'none'; 
        setupArea.style.display = 'none'; 
        keyboard.style.display = 'none';
        restartArea.style.display = 'block';
        restartArea.innerHTML = `<button onclick="startPenduSetup()" class="btn-action blue-bg full-width">Lancer une partie</button>`;
        return;
    }

    canvas.style.display = 'block'; wordDisplay.style.display = 'block';

    // 2. CONFIGURATION (SETUP) -> C'est ici qu'on affiche l'input et le bouton
    if (game.state === 'setup') {
        status.innerText = "Choisis un mot secret...";
        setupArea.style.display = 'flex'; // On affiche le bloc centré
        // On injecte le HTML proprement ici
        setupArea.innerHTML = `
            <input type="text" id="pendu-secret" class="input-field" placeholder="Mot secret" style="text-align:center; width:80%;">
            <button onclick="startPendu()" class="pendu-btn-js">Valider le mot</button>
        `;
        keyboard.style.display = 'none'; restartArea.style.display = 'none'; wordDisplay.innerText = "???";
    } 
    // 3. EN JEU (PLAYING)
    else {
        setupArea.style.display = 'none'; // On cache le setup
        let d = ""; for (let c of game.word) d += (game.guessed.includes(c) ? c : "_") + " ";
        wordDisplay.innerText = d;
        const isCreator = game.creator === currentUser;

        if (game.state === 'playing') {
            status.innerText = isCreator ? "L'autre devine..." : "Devine !";
            keyboard.style.display = 'flex'; restartArea.style.display = 'none';
            let k = ""; "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').forEach(l => {
                const disabled = isCreator || game.guessed.includes(l) ? "disabled" : "";
                k += `<button class="key-btn" onclick="playPenduMove('${l}')" ${disabled}>${l}</button>`;
            });
            keyboard.innerHTML = k;
        } else {
            status.innerText = game.state === 'win' ? "GAGNÉ ! 🎉" : ("PERDU... Le mot était : " + game.word);
            keyboard.style.display = 'none'; restartArea.style.display = 'block';
            restartArea.innerHTML = `<button onclick="finishPendu()" class="btn-action action-pink full-width">Fin de partie</button>`;
        }
    }
}
    
window.startPendu = function(){ const w=document.getElementById('pendu-secret').value.toUpperCase().trim(); if(w) setDoc(doc(db,"games","pendu_active"),{state:'playing',word:w,guessed:[],mistakes:0, creator:currentUser}); }
window.startPenduSetup = function(){ setDoc(doc(db,"games","pendu_active"),{state:'setup',word:"",guessed:[],mistakes:0, creator:""}); }
window.playPenduMove = async function(l){ if(!activePendu||activePendu.state!=='playing')return; const ng=[...activePendu.guessed,l]; let nm=activePendu.mistakes; if(!activePendu.word.includes(l))nm++; let ns='playing'; let save=false; if(nm>=11) { ns='loose'; save=true; } else if(activePendu.word.split('').every(c=>ng.includes(c))) { ns='win'; save=true; } await updateDoc(doc(db,"games","pendu_active"),{guessed:ng,mistakes:nm,state:ns}); if(save) addDoc(collection(db, "games_pendu_history"), { word: activePendu.word, setter: activePendu.creator, result: ns, timestamp: serverTimestamp() }); }
window.finishPendu = function() { updateDoc(doc(db,"games","pendu_active"), { state: 'idle', word: "", guessed: [] }); }

// --- JEU : PUISSANCE 4 ---
onSnapshot(doc(db, "games", "p4_active"), (s) => { activeP4 = s.exists() ? s.data() : null; if(activeP4) renderP4(activeP4); else document.getElementById('p4-status').innerText = "Aucune partie en cours"; });

// Historique P4
onSnapshot(query(collection(db, "games_p4_history"), orderBy("timestamp", "desc"), limit(50)), (s) => { 
    const list = document.getElementById('p4-history-list'); 
    list.innerHTML = ""; 
    s.forEach(d => { 
        const h = d.data(); 
        const dateStr = h.timestamp ? new Date(h.timestamp.toDate()).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}) : ""; 
        const winName = h.winner === 'fr' ? 'Théo' : 'Elise';
        const winColor = h.winner === 'fr' ? 'var(--blue)' : 'var(--pink)';
        list.innerHTML += `<div class="hist-row"><span>${dateStr} - <b style="color:${winColor}">${winName}</b></span><span>en ${h.moves} coups</span></div>`; 
    }); 
});

window.initP4 = function() { 
    setDoc(doc(db, "games", "p4_active"), { board: Array(42).fill(0), turn: currentUser, winner: null, moves: 0, status: 'playing' }); 
}

function renderP4(game) { 
    document.getElementById('btn-p4').classList.toggle('is-running', game.status === 'playing');
    const grid = document.getElementById('p4-grid'); 
    const statusEl = document.getElementById('p4-status'); 
    const btn = document.getElementById('p4-restart-btn'); 
    
    grid.innerHTML = ""; 

    // CAS 1 : EN ATTENTE
    if (!game.status || game.status === 'idle') {
        statusEl.innerText = "Prêt pour une partie ?";
        statusEl.classList.remove('active-turn'); // Retire le style "Gros"
        statusEl.style.color = ""; 
        grid.style.display = 'none'; 
        btn.innerText = "Lancer"; btn.onclick = initP4; btn.disabled = false; btn.style.opacity = "1";
        return; 
    }

    // CAS 2 : JEU EN COURS
    statusEl.classList.add('active-turn'); // Ajoute le style "Gros"
    grid.style.display = 'grid'; 
    for(let i=0; i<42; i++) { 
        const c=document.createElement('div'); 
        c.className="p4-cell "+(game.board[i]===1?'p1':(game.board[i]===2?'p2':'')); 
        c.onclick=()=>playP4(i%7); 
        grid.appendChild(c); 
    }

    if(game.winner) { 
        statusEl.innerText = game.winner === 'fr' ? "🏆 BRAVO THÉO !" : "🏆 BRAVO ELISE !"; 
        statusEl.style.color = game.winner === 'fr' ? 'var(--blue-dark)' : 'var(--pink-dark)';
        btn.innerText = "Fin de partie"; btn.onclick = finishP4; btn.disabled = false; btn.style.opacity = "1"; 
        if(game.status !== 'finished') updateDoc(doc(db,"games","p4_active"), {status: 'finished'});
    } else { 
        statusEl.innerText = (game.turn === 'fr' ? "Au tour de Théo (Bleu)" : "Au tour d'Elise (Rose)"); 
        statusEl.style.color = game.turn === 'fr' ? 'var(--blue-dark)' : 'var(--pink-dark)'; 
        btn.innerText = "Partie en cours..."; btn.disabled = true; btn.style.opacity = "0.5"; 
    } 
}
window.playP4 = async function(col) { 
    if(!activeP4||activeP4.winner) return; 
    if(activeP4.turn !== currentUser) { alert("Attends ton tour !"); return; } 
    let board=[...activeP4.board]; let row=5; while(row>=0){ if(board[row*7+col]===0){ board[row*7+col]=(currentUser==='fr'?1:2); break; } row--; } if(row<0) return; 
    const checkWin=b=>{for(let r=0;r<6;r++)for(let c=0;c<4;c++){let i=r*7+c;if(b[i]&&b[i]==b[i+1]&&b[i]==b[i+2]&&b[i]==b[i+3])return b[i]}for(let r=0;r<3;r++)for(let c=0;c<7;c++){let i=r*7+c;if(b[i]&&b[i]==b[i+7]&&b[i]==b[i+14]&&b[i]==b[i+21])return b[i]}for(let r=3;r<6;r++)for(let c=0;c<4;c++){let i=r*7+c;if(b[i]&&b[i]==b[i-6]&&b[i]==b[i-12]&&b[i]==b[i-18])return b[i]}for(let r=0;r<3;r++)for(let c=0;c<4;c++){let i=r*7+c;if(b[i]&&b[i]==b[i+8]&&b[i]==b[i+16]&&b[i]==b[i+24])return b[i]}return 0}; 
    const winnerCode = checkWin(board); let winner = null; let moves = activeP4.moves + 1; 
    if(winnerCode !== 0) { winner = winnerCode === 1 ? 'fr' : 'tw'; addDoc(collection(db, "games_p4_history"), { winner: winner, moves: Math.ceil(moves/2), timestamp: serverTimestamp() }); } 
    updateDoc(doc(db,"games","p4_active"),{ board:board, turn:currentUser==='fr'?'tw':'fr', winner:winner, moves:moves }); 
}

window.finishP4 = function() { updateDoc(doc(db, "games", "p4_active"), { status: 'idle', winner: null, board: [] }); }

// --- JEU : UNO ---
onSnapshot(doc(db, "games", "uno_active"), (s) => { activeUno = s.exists() ? s.data() : null; if(activeUno) renderUno(activeUno); else document.getElementById('uno-status').innerText = "Aucune partie en cours"; });

// Historique Uno
onSnapshot(query(collection(db, "games_uno_history"), orderBy("timestamp", "desc"), limit(50)), (s) => { 
    const list = document.getElementById('uno-history-list'); 
    list.innerHTML = ""; 
    s.forEach(d => { 
        const h = d.data(); 
        const dateStr = h.timestamp ? new Date(h.timestamp.toDate()).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}) : ""; 
        const moves = h.moves || "?";
        const winName = h.winner === 'fr' ? 'Théo' : 'Elise';
        const winColor = h.winner === 'fr' ? 'var(--blue)' : 'var(--pink)';
        list.innerHTML += `<div class="hist-row"><span>${dateStr} - <b style="color:${winColor}">${winName}</b></span><span>en ${moves} coups</span></div>`; 
    }); 
});

window.initUno = function() {
    const colors = ['red', 'blue', 'green', 'yellow'];
    const values = ['0','1','2','3','4','5','6','7','8','9','p2','s'];
    let deck = [];
    colors.forEach(c => values.forEach(v => { deck.push(`${c}-${v}`); deck.push(`${c}-${v}`); }));
    deck.push("black-w", "black-w", "black-w", "black-w");
    deck.push("black-p4", "black-p4", "black-p4", "black-p4");
    deck.sort(() => Math.random() - 0.5);
    const hand_fr = deck.splice(0, 7); const hand_tw = deck.splice(0, 7); const discard = [deck.shift()];
    setDoc(doc(db, "games", "uno_active"), { deck: deck, discard: discard, hand_fr: hand_fr, hand_tw: hand_tw, turn: currentUser, winner: null, moves: 0, status: 'playing'});
}

function renderUno(game) {
    document.getElementById('btn-uno').classList.toggle('is-running', game.status === 'playing');
    const btn = document.getElementById('uno-restart-btn');
    const boardDiv = document.querySelector('.uno-board'); 
    const statusEl = document.getElementById('uno-status');

    // CAS 1 : EN ATTENTE
    if (!game.status || game.status === 'idle') {
        statusEl.innerText = "Prêt pour une partie ?";
        statusEl.classList.remove('active-turn'); // Retire le style "Gros"
        statusEl.style.color = "";
        boardDiv.style.display = 'none'; 
        btn.innerText = "Lancer"; btn.onclick = initUno; btn.disabled = false; btn.style.opacity = "1"; btn.style.background = "var(--blue-dark)";
        return;
    }

    // CAS 2 : JEU EN COURS
    statusEl.classList.add('active-turn'); // Ajoute le style "Gros"
    boardDiv.style.display = 'block';

    if(game.winner) {
        statusEl.innerText = `GAGNANT : ${game.winner==='fr'?'Théo':'Elise'} !`;
        statusEl.style.color = game.winner === 'fr' ? 'var(--blue-dark)' : 'var(--pink-dark)';
        btn.innerText = "Fin de partie"; btn.onclick = finishUno; btn.disabled = false; btn.style.opacity = "1"; btn.style.background = "var(--pink-dark)"; 
    } else {
        statusEl.innerText = (game.turn === currentUser ? "À toi de jouer !" : "Tour de l'adversaire...");
        statusEl.style.color = game.turn === 'fr' ? 'var(--blue-dark)' : 'var(--pink-dark)';
        btn.innerText = "Partie en cours..."; btn.disabled = true; btn.style.opacity = "0.5";
    }
    
    document.getElementById('uno-opponent-name').innerText = currentUser==='fr'?'Elise':'Théo';
    document.getElementById('uno-opponent-count').innerText = currentUser==='fr' ? game.hand_tw.length : game.hand_fr.length;
    const topCard = game.discard[game.discard.length - 1];
    const [topColor, topVal] = topCard.split('-');
    const pileEl = document.getElementById('uno-discard-pile');
    pileEl.innerHTML = `<div class="uno-card ${topColor}">${formatUnoVal(topVal)}</div>`;
    const myHand = currentUser==='fr' ? game.hand_fr : game.hand_tw;
    const handEl = document.getElementById('uno-player-hand');
    handEl.innerHTML = "";
    myHand.forEach((card, idx) => {
        const [c, v] = card.split('-');
        handEl.innerHTML += `<div class="uno-card ${c}" onclick="playUnoCard(${idx})">${formatUnoVal(v)}</div>`;
    });
}
function formatUnoVal(v) { if(v==='p2') return '+2'; if(v==='s') return '🚫'; if(v==='w') return '🌈'; if(v==='p4') return '+4'; return v; }

window.drawUnoCard = function() {
    if(!activeUno || activeUno.winner || activeUno.turn !== currentUser) return;
    if(pickingWild) return;
    let deck = [...activeUno.deck];
    if(deck.length === 0) { alert("Pioche vide !"); return; }
    const card = deck.shift();
    const myHand = currentUser==='fr' ? [...activeUno.hand_fr] : [...activeUno.hand_tw];
    myHand.push(card);
    const moves = activeUno.moves + 1;
    const nextTurn = currentUser==='fr'?'tw':'fr'; 
    updateDoc(doc(db, "games", "uno_active"), { deck: deck, [`hand_${currentUser}`]: myHand, turn: nextTurn, moves: moves });
}

window.playUnoCard = function(idx) {
    if(!activeUno || activeUno.winner || activeUno.turn !== currentUser) return;
    if(pickingWild) return;
    const myHand = currentUser==='fr' ? [...activeUno.hand_fr] : [...activeUno.hand_tw];
    const card = myHand[idx];
    const [color, val] = card.split('-');
    const topCard = activeUno.discard[activeUno.discard.length - 1];
    const [topColor, topVal] = topCard.split('-');
    let valid = false;
    if (color === 'black') { wildCardIndex = idx; pickingWild = true; document.getElementById('uno-color-modal').style.display = 'flex'; return; } else if (color === topColor || val === topVal) { valid = true; }
    if (!valid) return;
    executePlay(idx, null);
}

window.finishUno = function() { updateDoc(doc(db, "games", "uno_active"), { status: 'idle', winner: null }); }
window.chooseUnoColor = function(color) { document.getElementById('uno-color-modal').style.display = 'none'; pickingWild = false; executePlay(wildCardIndex, color); }

function executePlay(idx, chosenColor) {
    const myHand = currentUser==='fr' ? [...activeUno.hand_fr] : [...activeUno.hand_tw];
    const card = myHand[idx];
    const [color, val] = card.split('-');
    myHand.splice(idx, 1);
    let nextDiscard = card;
    if(chosenColor) nextDiscard = `${chosenColor}-${val}`;
    const newDiscard = [...activeUno.discard, nextDiscard];
    const moves = activeUno.moves + 1;
    if (myHand.length === 0) {
        updateDoc(doc(db, "games", "uno_active"), { [`hand_${currentUser}`]: myHand, discard: newDiscard, winner: currentUser, moves: moves });
        addDoc(collection(db, "games_uno_history"), { winner: currentUser, moves: Math.ceil(moves/2), timestamp: serverTimestamp() });
        return;
    }
    let nextTurn = currentUser==='fr'?'tw':'fr';
    let opponentHand = currentUser==='fr' ? [...activeUno.hand_tw] : [...activeUno.hand_fr];
    let deck = [...activeUno.deck];
    if (val === 'p2') {
        if(deck.length>=2) { opponentHand.push(deck.shift()); opponentHand.push(deck.shift()); }
        nextTurn = currentUser==='fr'?'tw':'fr'; 
    } else if (val === 'p4') {
        if(deck.length>=4) { for(let i=0;i<4;i++) opponentHand.push(deck.shift()); }
        nextTurn = currentUser==='fr'?'tw':'fr'; 
    } else if (val === 's') { nextTurn = currentUser; }
    updateDoc(doc(db, "games", "uno_active"), { deck: deck, discard: newDiscard, hand_fr: currentUser==='fr'?myHand:opponentHand, hand_tw: currentUser==='tw'?myHand:opponentHand, turn: nextTurn, moves: moves });
}

// --- JEU : PETIT BAC ---
const allBacCategories = ["Prénom Féminin", "Prénom Masculin", "Ville", "Pays", "Nourriture", "Métier", "Animal", "Sport", "Objet", "Personnage Fictif", "Personnalité Publique", "Film", "Marque", "Plante", "Vêtement", "Dessin Animé", "Série Télévisée"];

onSnapshot(doc(db, "games", "bac_active"), (s) => { activeBac = s.exists() ? s.data() : null; if (activeBac) renderBac(activeBac); });

// Historique Bac
onSnapshot(query(collection(db, "games_bac_history"), orderBy("timestamp", "desc"), limit(20)), (s) => {
    const list = document.getElementById('bac-history-list');
    list.innerHTML = "";
    s.forEach(d => {
        const h = d.data();
        const dateStr = h.timestamp ? new Date(h.timestamp.toDate()).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}) : "";
        let winName = 'Égalité'; let winColor = 'var(--text-sub)';
        if (h.winner === 'fr') { winName = 'Théo'; winColor = 'var(--blue)'; }
        else if (h.winner === 'tw') { winName = 'Elise'; winColor = 'var(--pink)'; }
        list.innerHTML += `<div class="hist-row"><span>${dateStr} - <b style="color:${winColor}">${winName}</b></span><span>Lettre <b>${h.letter}</b> (${h.score_fr}-${h.score_tw})</span></div>`;
    });
});

window.bacToggleReady = function() {
    if (!activeBac) { bacReset(); return; }
    if (activeBac.status !== 'waiting') return;
    const amIReady = activeBac[`ready_${currentUser}`];
    const opponent = currentUser === 'fr' ? 'tw' : 'fr';
    const isOppReady = activeBac[`ready_${opponent}`];

    if (!amIReady) {
        if (isOppReady) {
            const letter = "ABCDEFGHIJKLMNOPRSTUV".charAt(Math.floor(Math.random() * 21));
            const shuffled = [...allBacCategories].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 6); 
            updateDoc(doc(db, "games", "bac_active"), { [`ready_${currentUser}`]: true, status: 'playing', letter: letter, currentCategories: selected, startTime: serverTimestamp() });
        } else {
            updateDoc(doc(db, "games", "bac_active"), { [`ready_${currentUser}`]: true });
        }
    } else {
        updateDoc(doc(db, "games", "bac_active"), { [`ready_${currentUser}`]: false });
    }
};

window.bacReset = function() {
    setDoc(doc(db, "games", "bac_active"), { status: 'waiting', ready_fr: false, ready_tw: false, skip_fr: false, skip_tw: false, review_done_fr: false, review_done_tw: false, answers_fr: {}, answers_tw: {}, scores_fr: {}, scores_tw: {}, startTime: serverTimestamp() });
};

function renderBac(game) {
    const isActive = game.status === 'playing' || game.status === 'review';
    document.getElementById('btn-bac').classList.toggle('is-running', isActive);
    const lobby = document.getElementById('bac-lobby');
    const board = document.getElementById('bac-game');
    const review = document.getElementById('bac-review');
    const finished = document.getElementById('bac-finished');

    if(!lobby || !board || !review || !finished) return;

    lobby.style.display = 'none'; board.style.display = 'none'; review.style.display = 'none'; finished.style.display = 'none';
    const currentCats = game.currentCategories || [];

    if (game.status === 'waiting') {
        lobby.style.display = 'block';
        const frClass = currentUser === 'fr' ? "transform:scale(1.1); border:2px solid var(--blue); cursor:pointer;" : "opacity:0.7;";
        const twClass = currentUser === 'tw' ? "transform:scale(1.1); border:2px solid var(--pink); cursor:pointer;" : "opacity:0.7;";
        const frClick = currentUser === 'fr' ? 'onclick="bacToggleReady()"' : '';
        const twClick = currentUser === 'tw' ? 'onclick="bacToggleReady()"' : '';

        lobby.innerHTML = `
            <div style="font-size:1.1rem; font-weight:800; margin-bottom:20px; color:var(--text-main);">Touchez votre icône pour valider !</div>
            <div style="display:flex; justify-content:space-around; margin-bottom:20px; align-items:center;">
                <div style="text-align:center; padding:10px; border-radius:15px; transition:0.2s; ${frClass}" ${frClick}><div style="font-size:3.5rem;">${game.ready_fr ? '🤴🏻' : '👨🏻'}</div><div style="font-weight:bold;">Théo</div><div style="font-size:1.5rem;">${game.ready_fr ? '✅' : '⏳'}</div></div>
                <div style="text-align:center; padding:10px; border-radius:15px; transition:0.2s; ${twClass}" ${twClick}><div style="font-size:3.5rem;">${game.ready_tw ? '👸🏻' : '👩🏻'}</div><div style="font-weight:bold;">Elise</div><div style="font-size:1.5rem;">${game.ready_tw ? '✅' : '⏳'}</div></div>
            </div>`;
    } else if (game.status === 'playing') {
        board.style.display = 'block';
        document.getElementById('bac-current-letter').innerText = "Lettre : " + game.letter;
        const container = document.getElementById('bac-inputs');
        if (container.innerHTML === "" || container.children.length !== currentCats.length) {
            container.innerHTML = "";
            currentCats.forEach((cat, i) => {
                container.innerHTML += `<div class="bac-row"><span class="bac-label">${cat}</span><input type="text" class="bac-input" id="bac-in-${i}" placeholder="Commence par ${game.letter}..."></div>`;
            });
        }
        const skipBtn = document.getElementById('bac-btn-skip');
        if (game[`skip_${currentUser}`]) { skipBtn.innerText = "En attente..."; skipBtn.style.background = "#bdc3c7"; skipBtn.disabled = true; } 
        else { skipBtn.innerText = "On passe ?"; skipBtn.style.background = "#e67e22"; skipBtn.disabled = false; }

    } else if (game.status === 'review') {
        if (document.getElementById('bac-inputs').innerHTML !== "") { bacSendAnswers(); document.getElementById('bac-inputs').innerHTML = ""; }
        review.style.display = 'block';
        const opponent = currentUser === 'fr' ? 'tw' : 'fr';
        const oppName = opponent === 'fr' ? 'Théo' : 'Elise';
        const oppAnswers = game[`answers_${opponent}`] || {};
        const myGivenScores = game[`scores_${opponent}`] || {};

        const list = document.getElementById('bac-review-list');
        let html = `<div style="text-align:center;margin-bottom:15px;font-style:italic;">Note les réponses de <b style="color:var(--blue-dark)">${oppName}</b></div>`;
        
        currentCats.forEach((cat, i) => {
            const ans = oppAnswers[i] || "<i>(Rien)</i>";
            const score = myGivenScores[i];
            html += `<div class="review-item"><div class="bac-label">${cat}</div><div class="review-ans">${ans}</div>
                <div class="review-btns">
                    <button class="r-btn r-btn-0 ${score===0?'selected':''}" onclick="bacRate('${opponent}', ${i}, 0)">❌ 0</button>
                    <button class="r-btn r-btn-1 ${score===1?'selected':''}" onclick="bacRate('${opponent}', ${i}, 1)">🤝 1</button>
                    <button class="r-btn r-btn-2 ${score===2?'selected':''}" onclick="bacRate('${opponent}', ${i}, 2)">✅ 2</button>
                </div></div>`;
        });
        list.innerHTML = html;

        const actionsDiv = document.getElementById('bac-review-actions');
        const isDone = Object.keys(myGivenScores).length === currentCats.length;
        if (game[`review_done_${currentUser}`]) { actionsDiv.innerHTML = `<div style="color:green; text-align:center; font-weight:bold;">✅ Validé ! Attente de l'autre...</div>`; } 
        else if (isDone) { actionsDiv.innerHTML = `<button onclick="bacConfirmReviewEnd()" class="btn-action action-pink full-width">Fin de correction</button>`; } 
        else { actionsDiv.innerHTML = `<div style="text-align:center; font-size:0.8rem; color:#999;">Note toutes les réponses pour finir.</div>`; }

    } else if (game.status === 'finished') {
        finished.style.display = 'block';
        let sFr = 0; Object.values(game.scores_fr || {}).forEach(v => sFr += v);
        let sTw = 0; Object.values(game.scores_tw || {}).forEach(v => sTw += v);

        document.getElementById('bac-winner-text').innerText = sFr > sTw ? "Théo gagne ! 🎉" : (sTw > sFr ? "Elise gagne ! 🎉" : "Égalité ! 🤝");
        document.getElementById('bac-winner-icon').innerText = sFr > sTw ? "🤴🏻" : (sTw > sFr ? "👸🏻" : "⚖️");
        document.getElementById('bac-score-text').innerText = `Théo : ${sFr} pts • Elise : ${sTw} pts`;

        let tableHtml = `<table class="bac-res-table"><tr class="bac-res-header"><th>Catégorie</th><th>Théo</th><th>Elise</th></tr>`;
        currentCats.forEach((cat, i) => {
            const ansFr = (game.answers_fr && game.answers_fr[i]) || "-"; const ptsFr = (game.scores_fr && game.scores_fr[i]) !== undefined ? game.scores_fr[i] : "?";
            const ansTw = (game.answers_tw && game.answers_tw[i]) || "-"; const ptsTw = (game.scores_tw && game.scores_tw[i]) !== undefined ? game.scores_tw[i] : "?";
            tableHtml += `<tr class="bac-res-row"><td class="bac-res-cat">${cat}</td><td><div class="bac-res-ans">${ansFr}</div><span class="bac-badge bg-${ptsFr}">${ptsFr} pts</span></td><td><div class="bac-res-ans">${ansTw}</div><span class="bac-badge bg-${ptsTw}">${ptsTw} pts</span></td></tr>`;
        });
        tableHtml += `</table>`;
        document.getElementById('bac-results-table-container').innerHTML = tableHtml;
    }
}

window.bacTryFinish = function() {
    let answers = {};
    const cats = activeBac.currentCategories || [];
    cats.forEach((_, i) => { const el = document.getElementById(`bac-in-${i}`); answers[i] = el ? el.value.trim() : ""; });
    updateDoc(doc(db, "games", "bac_active"), { [`answers_${currentUser}`]: answers, status: 'review' });
};

window.bacSendAnswers = function() {
    let answers = {};
    const cats = activeBac.currentCategories || [];
    cats.forEach((_, i) => { const el = document.getElementById(`bac-in-${i}`); answers[i] = el ? el.value.trim() : ""; });
    updateDoc(doc(db, "games", "bac_active"), { [`answers_${currentUser}`]: answers });
};

window.bacVoteSkip = function() {
    bacSendAnswers();
    updateDoc(doc(db, "games", "bac_active"), { [`skip_${currentUser}`]: true });
    const opponent = currentUser === 'fr' ? 'tw' : 'fr';
    if (activeBac[`skip_${opponent}`]) { updateDoc(doc(db, "games", "bac_active"), { status: 'review' }); }
};

window.bacRate = function(targetUser, index, points) {
    let update = {}; update[`scores_${targetUser}.${index}`] = points;
    updateDoc(doc(db, "games", "bac_active"), update);
};

window.bacConfirmReviewEnd = function() {
    updateDoc(doc(db, "games", "bac_active"), { [`review_done_${currentUser}`]: true });
    const opponent = currentUser === 'fr' ? 'tw' : 'fr';
    if (activeBac && activeBac[`review_done_${opponent}`]) {
        updateDoc(doc(db, "games", "bac_active"), { status: 'finished' });
        let sFr = 0; Object.values(activeBac.scores_fr || {}).forEach(v => sFr += v);
        let sTw = 0; Object.values(activeBac.scores_tw || {}).forEach(v => sTw += v);
        let winner = 'draw'; if (sFr > sTw) winner = 'fr'; else if (sTw > sFr) winner = 'tw';
        addDoc(collection(db, "games_bac_history"), { letter: activeBac.letter, score_fr: sFr, score_tw: sTw, winner: winner, timestamp: serverTimestamp() });
    }
};

/* --- 9. LETTRES & PHOTOS & TODOS & LIVRES (CONTENU) --- */

// --- LETTRES ---
onSnapshot(query(collection(db, "letters"), orderBy("timestamp", "desc")), (snapshot) => {
    allLetters = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    updateMailboxView();
});

window.showTab = function(tabName) {
    const tabInbox = document.getElementById('tab-inbox'); const tabSent = document.getElementById('tab-sent');
    if(tabName === 'inbox') {
        tabInbox.classList.add('active'); tabInbox.style.background = 'var(--pink)'; tabInbox.style.color = 'white';
        tabSent.classList.remove('active'); tabSent.style.background = 'transparent'; tabSent.style.color = 'var(--text-main)';
        document.getElementById('list-inbox').style.display='block'; document.getElementById('list-sent').style.display='none';
    } else {
        tabSent.classList.add('active'); tabSent.style.background = 'var(--blue)'; tabSent.style.color = 'white';
        tabInbox.classList.remove('active'); tabInbox.style.background = 'transparent'; tabInbox.style.color = 'var(--text-main)';
        document.getElementById('list-inbox').style.display='none'; document.getElementById('list-sent').style.display='block';
    }
}

window.updateMailboxView = function() {
    const listInbox = document.getElementById("list-inbox"); 
    const listSent = document.getElementById("list-sent");
    listInbox.innerHTML = ""; listSent.innerHTML = "";
    allLetters.forEach(l => {
        const now = Date.now();
        const isLocked = (l.unlockAt && now < l.unlockAt) && l.by !== currentUser;
        let sentDateStr = "À l'instant";
        if (l.timestamp) {
            const dateObj = l.timestamp.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
            sentDateStr = dateObj.toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit', year: '2-digit'});
        }
        const div = document.createElement("div"); 
        div.className = `envelope-item ${(!l.read && l.by !== currentUser) ? 'unread' : ''}`;
        let icon = l.read ? '📩' : '✉️'; if (isLocked) icon = '🔒';
        let titleDisplay = l.title; let subText = "";
        
        if (l.by === currentUser) {
            if (l.unlockAt) subText = `🔓 Ouvre le ${new Date(l.unlockAt).toLocaleDateString('fr-FR')} • ✍️ ${sentDateStr}`;
            else subText = `✍️ Envoyé le ${sentDateStr}`;
        } else {
            if (isLocked) { titleDisplay = `À ouvrir le ${new Date(l.unlockAt).toLocaleDateString('fr-FR')}`; subText = `🔒 Secret... (Reçu le ${sentDateStr})`; }
            else { const fromName = l.by==='fr' ? 'Théo' : 'Elise'; subText = `De: ${fromName} • 📅 ${sentDateStr}`; }
        }

        div.innerHTML = `<div style="margin-right:15px; font-size:1.5rem;">${icon}</div>
            <div style="flex:1;"><div style="font-weight:bold; font-size:0.9rem;">${titleDisplay}</div>
            <div style="font-size:0.75rem; color:var(--text-sub); margin-top:2px;">${subText}</div></div>
            ${l.by === currentUser ? `<button onclick="deleteLetter('${l.id}', event)" style="border:none;background:none;color:#faa;font-weight:bold;cursor:pointer;padding:5px;">✕</button>` : ''}`;
        
        div.onclick = (e) => { 
            if(e.target.tagName === 'BUTTON') return; 
            if (isLocked) { alert(`Patience... Cette lettre s'ouvrira le ${new Date(l.unlockAt).toLocaleDateString()} 🤫`); return; }
            openLetterModal(l); 
        };
        if(l.by === currentUser) listSent.appendChild(div); else listInbox.appendChild(div);
    });
}
window.showTab('inbox');

window.addLetter = function() { 
    const t=document.getElementById("letter-title").value; 
    const c=document.getElementById("letter-content").value; 
    const d=document.getElementById("letter-unlock-date").value; 
    if(!t||!c)return; 
    let unlockTimestamp = null; if(d) unlockTimestamp = new Date(d).getTime();
    addDoc(collection(db,"letters"),{ title:t, content:c, by:currentUser, read:false, unlockAt: unlockTimestamp, timestamp:serverTimestamp() }); 
    document.getElementById("letter-title").value=""; document.getElementById("letter-content").value=""; document.getElementById("letter-unlock-date").value="";
    sendNtfy("💌 Nouvelle lettre !","email","low"); 
}
window.openLetterModal = function(l) { document.getElementById('letter-modal').style.display="flex"; document.getElementById('modal-letter-title').innerText=l.title; document.getElementById('modal-letter-content').innerText=l.content; if(l.by!==currentUser && !l.read) updateDoc(doc(db,"letters",l.id),{read:true}); }
window.closeLetter = function() { document.getElementById('letter-modal').style.display="none"; }
window.deleteLetter = function(id, e) { e.stopPropagation(); if(confirm("Supprimer ?")) deleteDoc(doc(db,"letters",id)); }

// --- PHOTOS (Upload & Scratch) ---
const GIFT_PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MDAgNTAwIj48cmVjdCB3aWR0PSI1MDAiIGhlaWdodD0iNTAwIiBmaWxsPSIjZmZmMGYzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjAwIj7wn46BPC90ZXh0Pjwvc3ZnPg==";
const compressImage = async (file) => { const bmp = await createImageBitmap(file); const cvs = document.createElement('canvas'); cvs.width=bmp.width*0.5; cvs.height=bmp.height*0.5; cvs.getContext('2d').drawImage(bmp,0,0,cvs.width,cvs.height); return cvs.toDataURL(file.type,0.6); };

window.handlePhotoUpload = function(inpt, role) { 
    if(role !== currentUser){ alert("Interdit !"); return; } 
    const f = inpt.files[0]; if(!f) return; 
    tempUploadFile = f; tempUploadRole = role; inpt.value = ""; 
    document.getElementById('upload-choice-modal').style.display = "flex";
}

window.confirmUpload = async function(isSurprise) {
    document.getElementById('upload-choice-modal').style.display = "none"; document.getElementById('gallery-modal').style.display = "none";
    if (!tempUploadFile || !tempUploadRole) return;
    const b64 = await compressImage(tempUploadFile); 
    await addDoc(collection(db, "photos"), { url: b64, by: tempUploadRole, isSurprise: isSurprise, scratched: false, timestamp: serverTimestamp() }); 
    const icon = isSurprise ? "gift" : "camera"; const msg = isSurprise ? "🎁 Photo Surprise !" : "📸 Nouvelle photo !";
    sendNtfy(`${msg} (${getCurrentTime(currentUser)})`, icon, "low");
    tempUploadFile = null; tempUploadRole = null;
}
window.cancelUpload = function() { document.getElementById('upload-choice-modal').style.display = "none"; tempUploadFile = null; tempUploadRole = null; }

onSnapshot(query(collection(db, "photos"), orderBy("timestamp", "desc")), (s) => {
    allPhotos = s.docs.map(d => ({id: d.id, ...d.data()}));
    const getPolaroidSrc = (p) => {
        const isHidden = p.isSurprise && !p.scratched && p.by !== currentUser;
        return isHidden ? GIFT_PLACEHOLDER : p.url;
    };
    const lastFr = allPhotos.find(p => p.by === 'fr');
    document.getElementById('polaroid-img-fr').src = lastFr ? getPolaroidSrc(lastFr) : "";
    const lastTw = allPhotos.find(p => p.by === 'tw');
    document.getElementById('polaroid-img-tw').src = lastTw ? getPolaroidSrc(lastTw) : "";
});

window.openGallery = function(role) { 
    const m = document.getElementById('gallery-modal'); const g = document.getElementById('modal-grid'); g.innerHTML = ""; 
    allPhotos.filter(p => p.by === role).forEach(p => { 
        const dStr = p.timestamp ? new Date(p.timestamp.toDate()).toLocaleDateString('fr-FR') : "";
        const isSurprise = p.isSurprise === true; const isRevealed = p.scratched === true; const isMine = p.by === currentUser;
        const needScratch = isSurprise && !isRevealed && !isMine;
        const imgStyle = needScratch ? "filter: blur(15px) grayscale(1);" : "";
        const clickAction = needScratch ? `startScratch('${p.id}', '${p.url}')` : `showLightbox('${p.url}')`;
        g.innerHTML += `<div id="photo-${p.id}" style="position:relative; overflow:hidden; border-radius:5px;">
            <img src="${p.url}" class="modal-img" style="${imgStyle}" onclick="${clickAction}">
            <div class="photo-date">${dStr}</div>
            ${role === currentUser ? `<div style="color:red;font-size:0.8rem;text-align:center;cursor:pointer;" onclick="deletePhoto('${p.id}')">Supprimer</div>` : ''}
            ${needScratch ? `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:2.5rem; pointer-events:none; filter:drop-shadow(0 0 10px rgba(0,0,0,0.5));">🎁</div>` : ''}
        </div>`; 
    }); 
    m.style.display = "block"; 
}

window.showLightbox = function(url) {
    const modal = document.getElementById('lightbox'); // Utilise l'ID existant dans ton HTML
    const img = document.getElementById('lightbox-img');
    if (modal && img) {
        img.src = url;
        modal.style.display = "flex";
    }
}
window.closeGallery = () => document.getElementById('gallery-modal').style.display='none';
window.closeLightbox = () => document.getElementById('lightbox').style.display='none';
window.deletePhoto = async function(id) { if(confirm("Supprimer ?")) { document.getElementById(`photo-${id}`)?.remove(); await deleteDoc(doc(db,"photos",id)); } }

window.startScratch = function(id, url) {
    currentScratchId = id;
    const modal = document.getElementById('scratch-modal'); const img = document.getElementById('scratch-img-target'); const cvs = document.getElementById('scratch-canvas'); const ctx = cvs.getContext('2d');
    modal.style.display = 'flex'; img.src = url;
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#b0b0b0'; ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#999'; ctx.font = "30px Arial"; ctx.fillText("?", 140, 150); ctx.fillText("?", 50, 50); ctx.fillText("?", 250, 250);

    let isDrawing = false;
    const getPos = (e) => { const rect = cvs.getBoundingClientRect(); return { x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top }; };
    const scratch = (e) => {
        if (!isDrawing) return; e.preventDefault(); const pos = getPos(e);
        ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2); ctx.fill(); checkWin();
    };
    cvs.onmousedown = cvs.ontouchstart = (e) => { isDrawing = true; scratch(e); };
    cvs.onmousemove = cvs.ontouchmove = scratch;
    cvs.onmouseup = cvs.ontouchend = () => { isDrawing = false; };

    function checkWin() {
        const imageData = ctx.getImageData(0, 0, 300, 300); let transparent = 0;
        for (let i = 3; i < imageData.data.length; i += 4) { if (imageData.data[i] === 0) transparent++; }
        if ((transparent / (300 * 300)) * 100 > 50) { 
            cvs.onmousemove = null; cvs.ontouchmove = null; confetti({ particleCount: 100, spread: 70, zIndex: 10000 }); 
            updateDoc(doc(db, "photos", currentScratchId), { scratched: true });
            const gridItem = document.getElementById(`photo-${currentScratchId}`);
            if (gridItem) { const imgEl = gridItem.querySelector('img'); if (imgEl) { imgEl.style.filter = "none"; imgEl.onclick = () => showLightbox(url); } gridItem.querySelector('div[style*="absolute"]')?.remove(); }
            setTimeout(() => { document.getElementById('scratch-modal').style.display = 'none'; showLightbox(img.src); }, 800);
        }
    }
}

// --- PROJETS (TODOS) ---
let currentTodoTab = 'dist'; let currentTodoCat = 'visio';
const todoConfig = {
    'dist': { label: "Réalisations à distance", cats: [ { id: 'visio', icon: '💻', color: '#a29bfe', name: 'Date Visio' }, { id: 'movie', icon: '🍿', color: '#ff7675', name: 'Ciné Sync' }, { id: 'game',  icon: '🎮', color: '#74b9ff', name: 'Jeu' }, { id: 'call',  icon: '📞', color: '#55efc4', name: 'Appel' }, { id: 'gift',  icon: '📦', color: '#ffeaa7', name: 'Colis' } ] },
    'real': { label: "Rêves pour plus tard", cats: [ { id: 'travel', icon: '✈️', color: '#a29bfe', name: 'Voyage' }, { id: 'food',   icon: '🍔', color: '#fab1a0', name: 'Resto' }, { id: 'home',   icon: '🏠', color: '#55efc4', name: 'Cocon' }, { id: 'date',   icon: '❤️', color: '#ff7675', name: 'Love' }, { id: 'money',  icon: '💰', color: '#ffeaa7', name: 'Achat' } ] }
};

window.switchTodoTab = function(tab) {
    currentTodoTab = tab;
    document.getElementById('t-tab-dist').className = `todo-tab tab-dist ${tab==='dist'?'active':''}`;
    document.getElementById('t-tab-real').className = `todo-tab tab-real ${tab==='real'?'active':''}`;
    const track = document.getElementById('prog-track');
    track.className = `book-progress-track ${tab==='dist'?'progress-dist':'progress-real'}`;
    document.getElementById('prog-label').innerText = todoConfig[tab].label;
    renderCategories(); renderTodoList();
}

function renderCategories() {
    const container = document.getElementById('todo-cat-selector'); container.innerHTML = "";
    const cats = todoConfig[currentTodoTab].cats; currentTodoCat = cats[0].id; 
    cats.forEach(c => {
        const div = document.createElement('div'); div.className = `cat-option ${c.id === currentTodoCat ? 'selected' : ''}`;
        div.style.setProperty('--c', c.color); div.innerText = c.icon;
        div.onclick = () => { currentTodoCat = c.id; document.querySelectorAll('.cat-option').forEach(e => e.classList.remove('selected')); div.classList.add('selected'); };
        container.appendChild(div);
    });
}
renderCategories();

window.addTodo = function() {
    const t = document.getElementById('todo-input').value; if(!t) return;
    addDoc(collection(db, "todos"), { text: t, done: false, cat: currentTodoCat, tab: currentTodoTab, created: serverTimestamp() });
    document.getElementById('todo-input').value = "";
    const icon = currentTodoTab === 'dist' ? 'wifi' : 'plane';
    sendNtfy("📝 Nouveau projet ! ("+getCurrentTime(currentUser)+")", icon, "low");
}

window.toggleTodo = function(id, state) { 
    updateDoc(doc(db, "todos", id), { done: state });
    if (state === true) { confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: currentTodoTab === 'dist' ? ['#74b9ff', '#55efc4'] : ['#ff7675', '#a29bfe'] }); if(navigator.vibrate) navigator.vibrate(100); }
}

window.deleteTodo = function(id) { deleteDoc(doc(db,"todos",id)); }

onSnapshot(query(collection(db,"todos"), orderBy("created","desc")), s => { 
    allTodos = s.docs.map(d => ({id: d.id, ...d.data()}));
    renderTodoList();
});

function renderTodoList() {
    const l = document.getElementById('todo-list'); l.innerHTML = ""; 
    const filtered = allTodos.filter(t => (t.tab === currentTodoTab) || (!t.tab && currentTodoTab === 'real'));
    let total = 0; let doneCount = 0;

    filtered.forEach(t => {
        total++; if(t.done) doneCount++;
        let catConf = todoConfig['dist'].cats.find(c=>c.id===t.cat) || todoConfig['real'].cats.find(c=>c.id===t.cat);
        if(!catConf) catConf = { color: '#ccc', icon: '📌' };
        l.innerHTML += `<div class="todo-item ${t.done?'done':''}" style="--cat-color:${catConf.color}">
            <input type="checkbox" class="todo-check" ${t.done?'checked':''} onchange="toggleTodo('${t.id}', this.checked)">
            <div class="todo-content"><span class="todo-text ${t.done?'done':''}"><span class="todo-cat-icon">${catConf.icon}</span> ${t.text}</span></div>
            <button onclick="deleteTodo('${t.id}')" class="todo-del">✕</button></div>`;
    });
    const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    document.getElementById('todo-progress-bar').style.width = percent + "%";
    document.getElementById('todo-percent').innerText = percent + "%";
    if(total === 0) l.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-style:italic; padding:20px;">${currentTodoTab==='dist' ? "Rien de prévu à distance... 💻" : "Ajoute tes rêves ici ! ✨"}</div>`;
}

// --- LIVRES ---
window.addBook=function(){const t=document.getElementById('book-title').value;if(!t)return;addDoc(collection(db,"books"),{title:t,pages_total:parseInt(document.getElementById('book-pages').value)||200,created:serverTimestamp(),page_fr:0,rating_fr:0,page_tw:0,rating_tw:0});document.getElementById('book-title').value="";}
window.updatePage = function(id, role, val, max, title) { const newPage = parseInt(val); updateDoc(doc(db, "books", id), { ["page_"+role]: newPage }); if(newPage >= max) sendNtfy(`🎉 ${title} terminé ! (${getCurrentTime(currentUser)})`, "tada", "low"); }
window.rateBook = function(id, role, rating) { updateDoc(doc(db, "books", id), { ["rating_"+role]: rating }); }
window.deleteBook = function(id) { if(confirm("Supprimer ?")) deleteDoc(doc(db,"books",id)); }

onSnapshot(query(collection(db,"books"),orderBy("created","desc")), s => {
    const l = document.getElementById('book-list'); l.innerHTML = "";
    s.forEach(docSnap => {
        const book = docSnap.data(); const id = docSnap.id; 
        const totalPages = book.pages_total || 200;
        const frPage = book.page_fr || 0; const frRating = book.rating_fr || 0;
        const twPage = book.page_tw || 0; const twRating = book.rating_tw || 0;
        const frPercent = Math.min((frPage / totalPages) * 100, 100); const twPercent = Math.min((twPage / totalPages) * 100, 100);
        const makeStars = (role, currentRating) => {
            let html = ''; for(let i=1; i<=5; i++) { const filled = i <= currentRating ? 'filled' : ''; const action = role === currentUser ? `onclick="rateBook('${id}', '${role}', ${i})"` : ''; const cursor = role === currentUser ? 'pointer' : 'default'; html += `<span class="star ${filled}" style="cursor:${cursor}" ${action}>★</span>`; }
            const visibility = role === currentUser ? 'visible' : 'hidden'; html += `<span class="star-reset" style="visibility:${visibility};" onclick="rateBook('${id}', '${role}', 0)">Ø</span>`; return html;
        };
        const canEditFr = currentUser === 'fr' ? '' : 'disabled'; const canEditTw = currentUser === 'tw' ? '' : 'disabled';
        l.innerHTML += `<div class="book-item">
            <div class="book-title"><span>${book.title}</span><button style="border:none;background:none;color:var(--text-sub);font-size:0.8rem;cursor:pointer;" onclick="deleteBook('${id}')">✕</button></div>
            <div class="book-total-pages">${totalPages} pages</div>
            <div class="user-row"><div class="row-header"><span style="color:var(--blue);font-weight:bold;font-size:0.8rem;">THÉO</span><div class="star-rating">${makeStars('fr', frRating)}</div></div>
            <div class="user-inputs"><input type="number" class="page-input" value="${frPage}" ${canEditFr} onchange="updatePage('${id}', 'fr', this.value, ${totalPages}, '${book.title}')" placeholder="0"><div class="book-progress-track"><div class="book-progress-bar" style="width:${frPercent}%; background:var(--blue);"></div></div></div></div>
            <div class="user-row" style="border:none;"><div class="row-header"><span style="color:var(--pink);font-weight:bold;font-size:0.8rem;">ELISE</span><div class="star-rating">${makeStars('tw', twRating)}</div></div>
            <div class="user-inputs"><input type="number" class="page-input" value="${twPage}" ${canEditTw} onchange="updatePage('${id}', 'tw', this.value, ${totalPages}, '${book.title}')" placeholder="0"><div class="book-progress-track"><div class="book-progress-bar" style="width:${twPercent}%; background:var(--pink);"></div></div></div></div>
        </div>`;
    });
});

/* --- 10. NOTIFICATIONS & UTILITAIRES --- */
function sendNtfy(msg, tag, prio) { 
    const iconUrl = new URL("icon.jpg", window.location.href).href; 
    const topic = currentUser === 'tw' ? "lovetravel-2026-reception-theo" : "lovetravel-2026-reception-elise";
    fetch(`https://ntfy.sh/${topic}`, { 
        method: 'POST', body: msg, 
        headers: { 'Title': currentUser === 'tw' ? "Elise" : "Theo", 'Priority': prio, 'Icon': iconUrl } 
    }).catch(e => {}); 
}

function updateClocks(){
    const now=new Date();
    document.getElementById('clock-fr').innerText=now.toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'});
    document.getElementById('clock-tw').innerText=now.toLocaleTimeString('fr-FR',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit'});
} setInterval(updateClocks,1000); updateClocks();

function getCurrentTime(role) { return new Date().toLocaleTimeString('fr-FR', { timeZone: role==='fr'?'Europe/Paris':'Asia/Taipei', hour:'2-digit', minute:'2-digit' }); }

const dateDepart = new Date("2026-02-14T00:00:00+01:00").getTime(); 
const dateRetour = new Date("2026-07-05T08:00:00+02:00").getTime(); 
function updateCountdown() { 
    const now=new Date().getTime(); let p=0; 
    if(now>dateDepart && now<dateRetour) p=((now-dateDepart)/(dateRetour-dateDepart))*100; 
    if(now>dateRetour) p=100; 
    const dist=(now<dateDepart?dateDepart:dateRetour)-now; 
    const dDisplay=dist>0?dist:0; 
    const days=Math.floor(dDisplay/(1000*60*60*24)); 
    document.getElementById('days-count').innerText=days; 
    document.getElementById('days-unit').innerText=days<=1?"JOUR":"JOURS"; 
    document.getElementById('sub-count').innerText=`${Math.floor((dDisplay%(1000*60*60*24))/(1000*60*60))} h et ${Math.floor((dDisplay%(1000*60*60))/(1000*60))} min`; 
    document.getElementById('countdown-title').innerText=now<dateDepart?"DÉPART DANS":"RETROUVAILLES DANS"; 
    document.getElementById("prog-fill").style.width=p+"%"; 
    document.getElementById("prog-heart").style.left=p+"%"; 
} setInterval(updateCountdown,1000);

/* --- 11. PRESENCE & METEO --- */
function updatePresence() { setDoc(doc(db, "status", "presence"), { [currentUser]: Date.now() }, { merge: true }); }
setInterval(updatePresence, 5000); updatePresence();
onSnapshot(doc(db, "status", "presence"), (docSnap) => { 
    if(docSnap.exists()) { 
        const d = docSnap.data(); const now = Date.now(); 
        const isOnlineFr = (now - d.fr) < 60000 && d.fr !== 0; const isOnlineTw = (now - d.tw) < 60000 && d.tw !== 0; 
        document.getElementById('dot-fr').classList.toggle('online', isOnlineFr); document.getElementById('dot-tw').classList.toggle('online', isOnlineTw); 
    } 
});

async function updateWeather() { 
    try { 
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=45.77,24.99&longitude=3.08,121.30&current_weather=true"); const d = await r.json(); 
        const cols = document.querySelectorAll('.journey-col');
        const tFr = Math.round(d[0].current_weather.temperature); const isDayFr = d[0].current_weather.is_day === 1; const codeFr = d[0].current_weather.weathercode;
        document.getElementById('weather-fr').innerText = `${getWeatherIcon(codeFr, isDayFr)} ${tFr}°C`;
        cols[0].classList.toggle('is-night', !isDayFr); cols[0].classList.toggle('is-rain', codeFr >= 51);
        const tTw = Math.round(d[1].current_weather.temperature); const isDayTw = d[1].current_weather.is_day === 1; const codeTw = d[1].current_weather.weathercode;
        document.getElementById('weather-tw').innerText = `${getWeatherIcon(codeTw, isDayTw)} ${tTw}°C`;
        cols[1].classList.toggle('is-night', !isDayTw); cols[1].classList.toggle('is-rain', codeTw >= 51);
    } catch(e){ console.log(e); } 
}
function getWeatherIcon(code, isDay) { if (code >= 95) return "⚡"; if (code >= 51) return "🌧️"; if (code >= 71) return "❄️"; if (!isDay) return "🌙"; return "☀️"; }
updateWeather();

/* --- 12. EASTER EGGS --- */
let titleClicks = 0; let titleTimer = null;
window.clickTitle = function() {
    titleClicks++; clearTimeout(titleTimer); titleTimer = setTimeout(() => { titleClicks = 0; }, 1000);
    if (titleClicks === 5) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.3 }, colors:['#FFD700', '#ff4b6e'] });
        document.getElementById('jackpot-modal').style.display = 'flex';
        if(navigator.vibrate) navigator.vibrate([100,50,100,50,500]);
        titleClicks = 0; 
    }
}
document.body.addEventListener('dblclick', (e) => {
    const heart = document.createElement('div'); heart.className = 'float-heart'; heart.innerText = '❤️';
    heart.style.left = (e.clientX - 15) + 'px'; heart.style.top = (e.clientY - 15) + 'px';
    document.body.appendChild(heart); if(navigator.vibrate) navigator.vibrate(50); setTimeout(() => heart.remove(), 1000);
});

if ('getBattery' in navigator) {
    navigator.getBattery().then(function(battery) {
        checkBattery(battery.level); battery.addEventListener('levelchange', function() { checkBattery(this.level); });
    });
}
function checkBattery(level) {
    if (level < 0.2 && !sessionStorage.getItem('lowBatMsg')) {
        showAlert("Batterie Faible 🪫", "Ton téléphone est fatigué, mais mon amour pour toi est à 100% ! ❤️", "⚡️");
        sessionStorage.setItem('lowBatMsg', 'true'); 
    }
}

document.querySelectorAll('.chatouille-img').forEach(img => {
    let pressTimer;
    img.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); return false; });
    const triggerTickle = () => {
        const role = img.getAttribute('data-role');
        if (role === currentUser) return; 
        if(navigator.vibrate) navigator.vibrate(500);
        const rect = img.getBoundingClientRect(); const xRatio = (rect.left + rect.width/2) / window.innerWidth; const yRatio = (rect.top + rect.height/2) / window.innerHeight;
        confetti({ particleCount: 30, spread: 50, origin: { x: xRatio, y: yRatio } });
        showAlert("Guili Guili !", `Arrête de me chatouiller !`, "😂");
    };
    img.addEventListener('touchstart', (e) => { pressTimer = setTimeout(triggerTickle, 800); });
    img.addEventListener('touchend', () => clearTimeout(pressTimer));
    img.addEventListener('touchmove', () => clearTimeout(pressTimer));
    img.addEventListener('mousedown', () => { pressTimer = setTimeout(triggerTickle, 800); });
    img.addEventListener('mouseup', () => clearTimeout(pressTimer));
    img.addEventListener('mouseleave', () => clearTimeout(pressTimer));
});

/* --- 13. SYSTEME DE CHAT --- */
let isChatOpen = false;
let unreadMessages = 0;
let chatUnsubscribe = null;

window.toggleChat = function() {
    const win = document.getElementById('chat-window');
    const badge = document.getElementById('chat-badge');
    
    isChatOpen = !isChatOpen;
    win.style.display = isChatOpen ? 'flex' : 'none';
    
    if (isChatOpen) {
        // Remise à zéro du badge
        unreadMessages = 0;
        badge.classList.add('hidden');
        scrollToBottom();
    }
}

window.sendChatMessage = function() {
    const input = document.getElementById('chat-input');
    const txt = input.value.trim();
    if (!txt) return;

    addDoc(collection(db, "chat"), {
        text: txt,
        sender: currentUser,
        timestamp: serverTimestamp()
    });

    input.value = "";
    // Optionnel : petite vibration
    if(navigator.vibrate) navigator.vibrate(20);
}

// Envoyer avec la touche "Entrée"
document.getElementById('chat-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') window.sendChatMessage();
});

function scrollToBottom() {
    const div = document.getElementById('chat-messages');
    div.scrollTop = div.scrollHeight;
}

/* --- 14. RESTAURANTS (COMPLETE & OPTIMISÉE) --- */
let currentRestoTab = 'wish'; 
let allRestos = [];
let selectedRestoType = '🍽️'; 
let editSelectedType = '🍽️'; 
let pendingRestoValidationId = null; 
let currentGalleryRestoId = null; 
let currentEditRestoId = null; 
let pendingDeleteId = null; 

const foodEmojis = ["🍕","🍔","🍣","🍜"," taco","🥗","🥩","🍰","🍹","🥐","🧀","🍗","🍟","🍩","🍽️"];

// Initialisation des sélecteurs d'emojis (Ajout et Edition)
function initFoodPickers() {
    const container = document.getElementById('food-picker');
    if(container) {
        container.innerHTML = "";
        foodEmojis.forEach(emoji => {
            const div = document.createElement('div');
            div.className = `food-option ${emoji === selectedRestoType ? 'selected' : ''}`;
            div.innerText = emoji;
            div.onclick = () => {
                selectedRestoType = emoji;
                container.querySelectorAll('.food-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
            };
            container.appendChild(div);
        });
    }

    const editContainer = document.getElementById('food-picker-edit');
    if(editContainer) {
        editContainer.innerHTML = "";
        foodEmojis.forEach(emoji => {
            const div = document.createElement('div');
            div.id = `edit-emoji-${emoji}`;
            div.className = `food-option`;
            div.innerText = emoji;
            div.onclick = () => {
                editSelectedType = emoji;
                editContainer.querySelectorAll('.food-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
            };
            editContainer.appendChild(div);
        });
    }
}
initFoodPickers(); 

// --- GESTION PRINCIPALE ---

window.addRestaurant = async function() {
    const nameInput = document.getElementById('resto-name');
    const linkInput = document.getElementById('resto-link');
    const name = nameInput.value.trim();
    const link = linkInput.value.trim();

    if(!name) return;

    try {
        await addDoc(collection(db, "restaurants"), {
            name: name,
            type: selectedRestoType,
            link: link,
            status: 'wish',
            addedBy: currentUser,
            created: serverTimestamp(),
            rating_fr: 0, rating_tw: 0,
            comment_fr: "", comment_tw: "",
            eatenDate: null
        });

        nameInput.value = "";
        linkInput.value = "";
        sendNtfy(`🍽️ Nouveau resto ajouté : ${name} !`, "fries", "low");
    } catch (e) { console.error("Erreur ajout resto:", e); }
}

window.switchRestoTab = function(tab) {
    currentRestoTab = tab;
    document.getElementById('tab-resto-wish').classList.toggle('active', tab === 'wish');
    document.getElementById('tab-resto-done').classList.toggle('active', tab === 'done');
    
    const addCard = document.querySelector('.resto-add-card'); 
    if(addCard) addCard.style.display = (tab === 'wish') ? 'block' : 'none';
    
    renderRestos();
}

// --- MODIFICATION ---

window.openEditResto = function(id, name, link, type, e) {
    if(e) e.stopPropagation(); 
    currentEditRestoId = id;
    editSelectedType = type || '🍽️';

    document.getElementById('edit-resto-name').value = name;
    document.getElementById('edit-resto-link').value = link || "";
    
    const editContainer = document.getElementById('food-picker-edit');
    if(editContainer) {
        editContainer.querySelectorAll('.food-option').forEach(el => el.classList.remove('selected'));
        const targetEmoji = document.getElementById(`edit-emoji-${editSelectedType}`);
        if(targetEmoji) targetEmoji.classList.add('selected');
    }

    document.getElementById('resto-edit-modal').style.display = 'flex';
}

window.closeRestoEditModal = function() {
    document.getElementById('resto-edit-modal').style.display = 'none';
    currentEditRestoId = null;
}

window.saveRestoEdit = async function() {
    if(!currentEditRestoId) return;
    const newName = document.getElementById('edit-resto-name').value.trim();
    const newLink = document.getElementById('edit-resto-link').value.trim();
    
    if(newName) {
        await updateDoc(doc(db, "restaurants", currentEditRestoId), {
            name: newName,
            link: newLink,
            type: editSelectedType
        });
        closeRestoEditModal();
    }
}

// --- FONCTIONS DE LA GALERIE RESTO ---

window.closeRestoGallery = function() {
    document.getElementById('resto-gallery-modal').style.display = 'none';
    currentGalleryRestoId = null;
}

// Zoom sur la photo
window.showRestoZoom = function(url) {
    const lb = document.getElementById('resto-lightbox');
    const img = document.getElementById('resto-lightbox-img');
    img.src = url;
    lb.style.display = 'flex';
}

window.closeRestoLightbox = function() {
    document.getElementById('resto-lightbox').style.display = 'none';
}

// Rendu de la grille
function loadRestoPhotos(restoId) {
    const grid = document.getElementById('resto-gallery-grid');
    grid.innerHTML = "";
    
    const q = query(collection(db, "resto_photos"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snap) => {
        if (currentGalleryRestoId !== restoId) return;
        grid.innerHTML = "";
        const photos = snap.docs
            .map(d => ({id:d.id, ...d.data()}))
            .filter(p => p.restoId === restoId);
        
        if(photos.length === 0) {
            grid.innerHTML = "<div style='grid-column:1/-1; padding:40px; color:var(--text-sub); font-style:italic;'>Aucune photo souvenir... 📸</div>";
            return;
        }
        
        photos.forEach(p => {
            const container = document.createElement('div');
            container.className = "gallery-thumb-container";
            container.innerHTML = `
                <img src="${p.url}" onclick="showRestoZoom('${p.url}')">
                <button class="btn-delete-photo" onclick="deleteRestoPhoto('${p.id}')">✕</button>
            `;
            grid.appendChild(container);
        });
    });
}

// --- SUPPRESSION & VALIDATION ---

window.askDeleteResto = function(id, e) {
    if(e) e.stopPropagation();
    pendingDeleteId = id;
    document.getElementById('delete-confirm-modal').style.display = 'flex';
}

window.closeDeleteModal = function() {
    document.getElementById('delete-confirm-modal').style.display = 'none';
    pendingDeleteId = null;
}

window.confirmRestoDeletion = async function() {
    if(pendingDeleteId) {
        await deleteDoc(doc(db, "restaurants", pendingDeleteId));
        closeDeleteModal();
    }
}

window.openDateModal = function(id) {
    pendingRestoValidationId = id;
    const modal = document.getElementById('resto-date-modal');
    const dSelect = document.getElementById('date-day');
    const mSelect = document.getElementById('date-month');
    const ySelect = document.getElementById('date-year');

    if(dSelect.children.length === 0) {
        for(let i=1; i<=31; i++) dSelect.innerHTML += `<option value="${i}">${i}</option>`;
        const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
        months.forEach((m, i) => mSelect.innerHTML += `<option value="${i+1}">${m}</option>`);
        for(let i=2024; i<=2030; i++) ySelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    const today = new Date();
    dSelect.value = today.getDate();
    mSelect.value = today.getMonth() + 1;
    ySelect.value = today.getFullYear();
    modal.style.display = 'flex';
}

window.confirmRestoDate = async function() {
    if(!pendingRestoValidationId) return;
    const d = document.getElementById('date-day').value.padStart(2, '0');
    const m = document.getElementById('date-month').value.padStart(2, '0');
    const y = document.getElementById('date-year').value;
    const dateStr = `${y}-${m}-${d}`;

    await updateDoc(doc(db, "restaurants", pendingRestoValidationId), { 
        status: 'done', 
        eatenDate: dateStr 
    });
    confetti({ particleCount: 100, colors: ['#ff9eb5', '#8ecae6'] });
    document.getElementById('resto-date-modal').style.display = 'none';
    pendingRestoValidationId = null;
}

// --- GALERIE ---

window.openRestoGallery = function(id, name, e) {
    if(e) e.stopPropagation(); 
    currentGalleryRestoId = id;
    document.getElementById('gallery-resto-title').innerText = name;
    document.getElementById('resto-gallery-modal').style.display = 'flex';
    loadRestoPhotos(id);
}

function loadRestoPhotos(restoId) {
    const grid = document.getElementById('resto-gallery-grid');
    grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;'>Chargement...</div>";
    
    // On utilise un snapshot global filtré localement pour éviter les index complexes
    const qAll = query(collection(db, "resto_photos"), orderBy("timestamp", "desc"));
    
    onSnapshot(qAll, (snap) => {
        if (currentGalleryRestoId !== restoId) return; // Sécurité si on change vite
        grid.innerHTML = "";
        const photos = snap.docs
            .map(d => ({id:d.id, ...d.data()}))
            .filter(p => p.restoId === restoId);
        
        if(photos.length === 0) {
            grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#888;font-style:italic;'>Pas encore de photo... 📸</div>";
            return;
        }
        
        photos.forEach(p => {
            grid.innerHTML += `
                <div style="position:relative;">
                    <img src="${p.url}" class="gallery-thumb" onclick="showLightbox('${p.url}')">
                    <button onclick="deleteRestoPhoto('${p.id}')" style="position:absolute;top:0;right:0;background:rgba(0,0,0,0.6);color:white;border:none;width:24px;height:24px;border-radius:0 0 0 8px;cursor:pointer;">✕</button>
                </div>`;
        });
    });
}

window.handleRestoPhotoUpload = async function(input) {
    if(!input.files[0] || !currentGalleryRestoId) return;
    const btn = input.previousElementSibling; 
    const oldText = btn.innerText;
    btn.innerText = "Envoi...";
    btn.disabled = true;

    try {
        const file = input.files[0];
        const b64 = await compressImage(file); 
        await addDoc(collection(db, "resto_photos"), {
            url: b64,
            restoId: currentGalleryRestoId,
            by: currentUser,
            timestamp: serverTimestamp()
        });
    } catch(e) { console.error(e); }
    input.value = ""; 
    btn.innerText = oldText;
    btn.disabled = false;
}

window.deleteRestoPhoto = function(id) {
    deleteDoc(doc(db, "resto_photos", id));
}

// --- RENDER ---

window.rateResto = function(id, role, rating) { 
    updateDoc(doc(db, "restaurants", id), { [`rating_${role}`]: rating }); 
}

window.saveRestoComment = function(id, role, text) { 
    updateDoc(doc(db, "restaurants", id), { [`comment_${role}`]: text }); 
}

window.toggleRestoDetails = function(id) {
    const details = document.getElementById(`details-${id}`);
    const isOpen = details.classList.contains('open');
    document.querySelectorAll('.resto-details').forEach(el => el.classList.remove('open'));
    if(!isOpen) details.classList.add('open');
}

// Listener principal
onSnapshot(query(collection(db, "restaurants"), orderBy("created", "desc")), (snapshot) => {
    allRestos = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    renderRestos();
});

function renderRestos() {
    const currentlyOpenElement = document.querySelector('.resto-details.open');
    let savedOpenId = currentlyOpenElement ? currentlyOpenElement.id : null;

    const list = document.getElementById('resto-list');
    list.innerHTML = "";
    
    let filtered = allRestos.filter(r => r.status === currentRestoTab);

    if (currentRestoTab === 'done') {
        filtered.sort((a, b) => (b.eatenDate || "").localeCompare(a.eatenDate || ""));
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:var(--text-sub); font-style:italic; padding:20px;">
            ${currentRestoTab === 'wish' ? "Ajoute une adresse ! 🍕" : "Aucun festin mémorable..."}
        </div>`;
        return;
    }

    filtered.forEach(r => {
        const mapBtn = r.link ? `<a href="${r.link}" target="_blank" class="resto-map-btn" onclick="event.stopPropagation()">📍 Maps</a>` : "";
        let dateHtml = "";
        if (currentRestoTab === 'done' && r.eatenDate) {
            const [y, m, d] = r.eatenDate.split('-');
            dateHtml = `<div class="resto-date-badge">Le ${d}/${m}/${y}</div>`;
        }

        const makeStars = (role, currentRating) => {
            let html = ''; 
            for(let i=1; i<=5; i++) { 
                const isFilled = i <= currentRating;
                const canRate = currentRestoTab === 'done' && role === currentUser;
                html += `<span class="star ${isFilled ? 'filled' : ''}" 
                        style="font-size:1.1rem; cursor:${canRate ? 'pointer' : 'default'}" 
                        ${canRate ? `onclick="rateResto('${r.id}', '${role}', ${i})"` : ''}>★</span>`; 
            }
            return html;
        };

        let detailsContent = "";
        if (currentRestoTab === 'wish') {
            detailsContent = `<button onclick="openDateModal('${r.id}')" class="btn-validate-resto">On a mangé ici ! 😋</button>`;
        } else {
            detailsContent = `
                <div class="resto-ratings">
                    <div class="user-rate-col"><span class="rate-label">Théo</span><div>${makeStars('fr', r.rating_fr)}</div></div>
                    <div style="width:1px; background:var(--border);"></div>
                    <div class="user-rate-col"><span class="rate-label">Elise</span><div>${makeStars('tw', r.rating_tw)}</div></div>
                </div>
                <button onclick="openRestoGallery('${r.id}', '${r.name.replace(/'/g, "\\'")}', event)" class="resto-photo-btn">📷 Voir les photos</button>
                <div class="comments-section mt-10">
                    <div class="comment-box" style="border-left: 3px solid var(--blue);">
                        <h4>Théo 👨🏻</h4>
                        <textarea class="comment-input" rows="2" ${currentUser !== 'fr' ? 'readonly' : ''} onchange="saveRestoComment('${r.id}', 'fr', this.value)">${r.comment_fr || ""}</textarea>
                    </div>
                    <div class="comment-box" style="border-left: 3px solid var(--pink);">
                        <h4>Elise 👩🏻</h4>
                        <textarea class="comment-input" rows="2" ${currentUser !== 'tw' ? 'readonly' : ''} onchange="saveRestoComment('${r.id}', 'tw', this.value)">${r.comment_tw || ""}</textarea>
                    </div>
                </div>`;
        }

        list.innerHTML += `
            <div class="resto-item">
                <div class="resto-main-view" onclick="toggleRestoDetails('${r.id}')">
                    <div class="resto-info">
                        <div class="resto-icon">${r.type || '🍽️'}</div>
                        <div style="flex:1">
                            <div class="resto-name">${r.name}</div>
                            <div style="display:flex; gap:5px; margin-top:4px;">${dateHtml} ${mapBtn}</div>
                        </div>
                    </div>
                </div>
                <div class="resto-floating-actions">
                    <button onclick="askDeleteResto('${r.id}', event)" class="btn-mini-action btn-delete-red">✕</button>
                    <button onclick="openEditResto('${r.id}', '${r.name.replace(/'/g, "\\'")}', '${(r.link || "").replace(/'/g, "\\'")}', '${r.type}', event)" class="btn-mini-action btn-edit-blue">✏️</button>
                </div>
                <div class="resto-details" id="details-${r.id}">${detailsContent}</div>
            </div>`;
    });

    if (savedOpenId) {
        const toReopen = document.getElementById(savedOpenId);
        if (toReopen) toReopen.classList.add('open');
    }
}

/* --- GESTION CHAT (AVEC MODIF/SUPP) --- */

let chatMsgIdToEdit = null; // Stocke l'ID du message ciblé
let chatMsgTextToEdit = null; // Stocke le texte actuel

function initChatListener() {
    const q = query(collection(db, "chat"), orderBy("timestamp", "asc")); 
    
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        const div = document.getElementById('chat-messages');
        
        // Si aucun message
        if (snapshot.empty) {
            div.innerHTML = '<div class="chat-placeholder">C\'est calme ici...<br>Lance la conversation ! 💬</div>';
            return;
        }

        // On ne vide pas tout brutalement si on est en train d'éditer, 
        // mais pour faire simple et éviter les bugs de synchro, on reconstruit.
        // L'édition sera annulée si un nouveau message arrive pile en même temps, 
        // mais c'est rare.
        const currentEditId = document.querySelector('.edit-mode-input')?.dataset.id;
        div.innerHTML = ""; 

        snapshot.forEach(doc => {
            const msg = doc.data();
            const msgId = doc.id;
            const isMe = msg.sender === currentUser;
            
            // --- HORAIRES ---
            let timeDisplay = "";
            if(msg.timestamp) {
                const date = msg.timestamp.toDate();
                const myZone = currentUser === 'fr' ? 'Europe/Paris' : 'Asia/Taipei';
                const otherZone = currentUser === 'fr' ? 'Asia/Taipei' : 'Europe/Paris';
                const myTime = date.toLocaleTimeString('fr-FR', {timeZone: myZone, hour:'2-digit', minute:'2-digit'});
                const otherTime = date.toLocaleTimeString('fr-FR', {timeZone: otherZone, hour:'2-digit', minute:'2-digit'});
                timeDisplay = `${myTime} <span style="font-size:0.85em; opacity:0.7;">(${otherTime})</span>`;
            }

            // Création de la bulle
            const bubble = document.createElement('div');
            // IMPORTANT : On donne un ID à la bulle pour la retrouver
            bubble.id = `msg-${msgId}`;
            bubble.className = `msg-bubble ${isMe ? `msg-me ${currentUser}` : "msg-other"}`;
            
            // Si c'est ce message qu'on édite (cas rare de rafraichissement), on remet l'input
            if(currentEditId === msgId) {
                // On laisse la logique d'édition gérer ça, ou on affiche le texte normal
                // Pour simplifier, on affiche le texte normal, l'utilisateur réappuiera si besoin.
            }
            
            bubble.innerHTML = `${msg.text} <span class="msg-time">${timeDisplay}</span>`;
            
            // Ajout du Long Press
            if (isMe) {
                addLongPressEvent(bubble, msgId, msg.text);
            }

            div.appendChild(bubble);
        });
        
        scrollToBottom();

        // Badge Notif
        if (!isChatOpen && snapshot.docChanges().some(change => change.type === 'added')) {
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            if (lastDoc && lastDoc.data().sender !== currentUser) {
                unreadMessages++;
                document.getElementById('chat-badge').classList.remove('hidden');
                if(navigator.vibrate) navigator.vibrate([50, 50]);
            }
        }
    });
}

function addLongPressEvent(element, id, text) {
    let timer;
    // PC (Clic droit)
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openChatOptions(id, text);
    });
    // Mobile (Touch)
    const startPress = () => {
        element.classList.add('pressing'); 
        timer = setTimeout(() => {
            element.classList.remove('pressing');
            if(navigator.vibrate) navigator.vibrate(50); 
            openChatOptions(id, text);
        }, 600); 
    };
    const cancelPress = () => {
        element.classList.remove('pressing');
        clearTimeout(timer);
    };
    element.addEventListener('touchstart', startPress);
    element.addEventListener('touchend', cancelPress);
    element.addEventListener('touchmove', cancelPress); 
    element.addEventListener('mousedown', startPress); 
    element.addEventListener('mouseup', cancelPress);
    element.addEventListener('mouseleave', cancelPress);
}

/* --- ACTIONS DU CHAT --- */

window.openChatOptions = function(id, text) {
    chatMsgIdToEdit = id;
    chatMsgTextToEdit = text;
    document.getElementById('chat-options-modal').style.display = 'flex';
}

window.closeChatOptions = function() {
    document.getElementById('chat-options-modal').style.display = 'none';
}

// 1. SUPPRESSION DIRECTE (Plus de confirm)
window.deleteMsgAction = async function() {
    closeChatOptions(); // On ferme le menu
    if(chatMsgIdToEdit) {
        await deleteDoc(doc(db, "chat", chatMsgIdToEdit));
    }
}

// 2. ÉDITION DIRECTE (Inline)
window.editMsgAction = function() {
    closeChatOptions(); // On ferme le menu

    const bubble = document.getElementById(`msg-${chatMsgIdToEdit}`);
    if(!bubble) return;

    // On remplace le contenu de la bulle par un INPUT
    bubble.innerHTML = `
        <div class="edit-box-inline">
            <input type="text" class="edit-msg-input" id="input-edit-${chatMsgIdToEdit}" value="${chatMsgTextToEdit}" autocomplete="off">
            <button onclick="saveEditAction('${chatMsgIdToEdit}')" class="btn-save-edit">OK</button>
        </div>
    `;

    // On met le focus direct dans l'input
    const input = document.getElementById(`input-edit-${chatMsgIdToEdit}`);
    input.focus();

    // Si on appuie sur Entrée dans l'input, ça valide
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') saveEditAction(chatMsgIdToEdit);
    });
}

// Sauvegarde de l'édition
window.saveEditAction = async function(id) {
    const input = document.getElementById(`input-edit-${id}`);
    if(!input) return;

    const newText = input.value.trim();
    
    // Si vide ou inchangé, on remet comme avant (via le listener snapshot qui va se rafraichir ou on force)
    if (newText && newText !== chatMsgTextToEdit) {
        await updateDoc(doc(db, "chat", id), { text: newText });
    } else {
        // Si rien n'a changé, on force le rafraichissement pour enlever l'input
        // (Le snapshot ne se déclenche pas si pas de modif DB, donc on le fait manuellement ici pour l'UI)
        initChatListener(); 
    }
}

// Lancer l'écouteur au démarrage
initChatListener();
