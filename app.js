// ==========================================
// 1. CONFIGURATION ET INITIALISATION FIREBASE
// ==========================================

const YOUTUBE_API_KEY = "AIzaSyC7J45kE5jVZGW5GmSoJ6kwWqnHiso9l2M"; 

const firebaseConfig = {
    apiKey: "AIzaSyCpZZERo_h5-QvytRCiXeQKgA3A_LVWn90",
    authDomain: "musicquizarl.firebaseapp.com",
    databaseURL: "https://musicquizarl-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "musicquizarl",
    storageBucket: "musicquizarl.firebasestorage.app",
    messagingSenderId: "1087070856706",
    appId: "1:1087070856706:web:7fbdf247a2c4a58226e91b",
    measurementId: "G-PWQ0C34R1X"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let playerName = "";
let hasBuzzed = false;


// ==========================================
// 2. LOGIQUE DU LECTEUR ET RECHERCHE YOUTUBE
// ==========================================

let player;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: '', 
        events: {
            'onReady': () => console.log("Lecteur YouTube prêt !")
        }
    });
}

async function searchYouTube() {
    const query = document.getElementById('youtube-search').value;
    if (!query) return;

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.items) {
            displaySearchResults(data.items);
        } else {
            alert("Aucun résultat trouvé. Vérifie ta clé d'API.");
        }
    } catch (error) {
        console.error("Erreur lors de la recherche :", error);
    }
}

function displaySearchResults(videos) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = "";

    videos.forEach(video => {
        const div = document.createElement('div');
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.background = "#222";
        div.style.padding = "10px";
        div.style.cursor = "pointer";
        div.style.borderRadius = "8px";
        
        div.innerHTML = `
            <img src="${video.snippet.thumbnails.default.url}" alt="miniature" style="margin-right: 15px; border-radius: 5px;">
            <span style="text-align: left; font-size: 14px;">${video.snippet.title}</span>
        `;

        div.onclick = () => {
            resultsContainer.innerHTML = "";
            document.getElementById('youtube-search').value = "";
            document.getElementById('host-controls').style.display = 'block';
            startRound(video.id.videoId);
        };

        resultsContainer.appendChild(div);
    });
}


// ==========================================
// 3. CONTRÔLES DU JEU (HÔTE)
// ==========================================

function startRound(songId) {
    // Efface les buzzes de la manche précédente
    db.ref('room/game_1/buzzes').remove();

    db.ref('room/game_1').update({
        status: "playing",
        currentSong: songId || "",
        correctAnswer: ""
    });
}

// L'hôte clique sur le joueur qui a la bonne réponse → il marque un point
function validateCorrectPlayer(playerNameWinner) {
    db.ref('room/game_1').update({
        status: "results",
        correctAnswer: playerNameWinner
    });
    addPoint(playerNameWinner, 5);
}

// Mauvaise réponse orale : on réinitialise juste les buzzes et on continue la musique
function continueAfterWrongAnswer() {
    // Efface les buzzes pour permettre aux autres de buzzer
    db.ref('room/game_1/buzzes').remove();
    db.ref('room/game_1').update({ status: "playing" });
}

function addPoint(name, points) {
    const scoreRef = db.ref('room/game_1/scores/' + name);
    scoreRef.once('value').then(snap => {
        let current = snap.val() || 0;
        scoreRef.set(current + points);
    });
}

function nextRound() {
    db.ref('room/game_1/buzzes').remove();
    db.ref('room/game_1').set({
        status: "waiting",
        currentSong: "",
        correctAnswer: ""
    });
    document.getElementById('buzz-list').innerHTML = "";
    document.getElementById('host-controls').style.display = 'none';
    if (player && typeof player.stopVideo === 'function') player.stopVideo();
}


// ==========================================
// 4. LOGIQUE DES JOUEURS — BUZZER
// ==========================================

function joinGame() {
    const input = document.getElementById('pseudo').value;
    if (input.trim() !== "") {
        playerName = input.trim();
        document.getElementById('login-zone').style.display = 'none';
        document.getElementById('player-score-zone').style.display = 'block';
        listenToMyScore();
        alert("Bienvenue " + playerName + " ! Attends que l'hôte lance la musique.");
    } else {
        alert("Saisis un pseudo valide !");
    }
}

function buzz() {
    if (!playerName || hasBuzzed) return;

    hasBuzzed = true;
    document.getElementById('buzzer-btn').disabled = true;
    document.getElementById('buzzer-feedback').innerText = "⚡ Buzzé ! Donne ta réponse à l'oral !";
    document.getElementById('buzzer-feedback').style.color = "#f1c40f";

    db.ref('room/game_1/buzzes/' + playerName).set({
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}


// ==========================================
// 5. ÉCOUTE EN TEMPS RÉEL
// ==========================================

function listenToGame() {
    db.ref('room/game_1').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.status === "playing") {
            // --- Vue joueur ---
            if (playerName) {
                document.getElementById('player-zone').style.display = 'block';
                document.getElementById('round-ended-zone').style.display = 'none';
                // Réactive le buzzer si les buzzes ont été effacés (après mauvaise réponse)
                const buzzes = data.buzzes || {};
                if (!buzzes[playerName]) {
                    hasBuzzed = false;
                    document.getElementById('buzzer-btn').disabled = false;
                    document.getElementById('buzzer-feedback').innerText = "";
                }
            }
            // --- Lecture YouTube ---
            if (player && typeof player.loadVideoById === 'function' && data.currentSong) {
                // Ne relance que si c'est une nouvelle chanson
                player.loadVideoById(data.currentSong);
                player.playVideo();
            }
        } 
        else if (data.status === "results") {
            if (playerName) {
                document.getElementById('player-zone').style.display = 'none';
                document.getElementById('round-ended-zone').style.display = 'block';
                const feedback = document.getElementById('round-feedback');
                if (data.correctAnswer === playerName) {
                    feedback.innerText = "✅ Bravo " + playerName + " ! Tu as la bonne réponse !";
                    feedback.style.color = "#2ecc71";
                } else {
                    feedback.innerText = "❌ C'est " + data.correctAnswer + " qui a trouvé !";
                    feedback.style.color = "#e74c3c";
                }
            }
            if (player && typeof player.stopVideo === 'function') player.stopVideo();
        }
        else if (data.status === "waiting") {
            if (playerName) {
                document.getElementById('player-zone').style.display = 'none';
                document.getElementById('round-ended-zone').style.display = 'none';
            }
            hasBuzzed = false;
            if (player && typeof player.stopVideo === 'function') player.stopVideo();
        }
    });
}

// Écoute les buzzes en temps réel pour l'hôte
function listenToBuzzes() {
    db.ref('room/game_1/buzzes').on('value', (snapshot) => {
        const buzzes = snapshot.val();
        const list = document.getElementById('buzz-list');
        if (!list) return;
        list.innerHTML = "";

        if (!buzzes) return;

        const sorted = Object.keys(buzzes)
            .map(name => ({ name, timestamp: buzzes[name].timestamp }))
            .sort((a, b) => a.timestamp - b.timestamp);

        sorted.forEach((b, index) => {
            const ranks = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣"];
            const rank = ranks[index] || (index + 1) + ".";
            const div = document.createElement('div');
            div.className = 'buzz-entry';
            div.innerHTML = `
                <span class="buzz-rank">${rank}</span>
                <span class="buzz-name">${b.name}</span>
                <button class="buzz-correct-btn" onclick="validateCorrectPlayer('${b.name}')">✅ Bonne réponse</button>
            `;
            list.appendChild(div);
        });
    });
}

function listenToMyScore() {
    if (!playerName) return;
    db.ref('room/game_1/scores/' + playerName).on('value', (snapshot) => {
        document.getElementById('my-score').innerText = snapshot.val() || 0;
    });
}

function listenToScores() {
    db.ref('room/game_1/scores').on('value', (snapshot) => {
        const scores = snapshot.val();
        const list = document.getElementById('score-list');
        if (list) list.innerHTML = "";

        if (scores) {
            const sortedScores = Object.keys(scores)
                .map(name => ({ name, score: scores[name] }))
                .sort((a, b) => b.score - a.score);

            sortedScores.forEach((p, index) => {
                const li = document.createElement('li');
                let medal = index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "🏅 ";
                li.innerHTML = `<strong>${medal} ${p.name}</strong> : ${p.score} pts`;
                li.style.padding = "8px";
                li.style.margin = "5px";
                li.style.background = "#2c3e50";
                li.style.borderRadius = "5px";
                list.appendChild(li);
            });
        }
    });
}

// Démarrage
listenToGame();
listenToScores();
listenToBuzzes();
