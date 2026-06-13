// ==========================================
// 1. CONFIGURATION ET INITIALISATION FIREBASE
// ==========================================

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
// 2. CONTRÔLES DU JEU (HÔTE)
// ==========================================

function startRound() {
    db.ref('room/game_1/buzzes').remove();
    db.ref('room/game_1').update({
        status: "playing",
        correctAnswer: ""
    });
    document.getElementById('host-controls').style.display = 'block';
    document.getElementById('host-start-btn').style.display = 'none';
}

function validateCorrectPlayer(playerNameWinner, points) {
    db.ref('room/game_1').update({
        status: "results",
        correctAnswer: playerNameWinner
    });
    addPoint(playerNameWinner, points);
}

function continueAfterWrongAnswer() {
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
        correctAnswer: ""
    });
    document.getElementById('buzz-list').innerHTML = "";
    document.getElementById('host-controls').style.display = 'none';
    document.getElementById('host-start-btn').style.display = 'inline-block';
}

function resetScores() {
    if (!confirm("Remettre tous les scores à zéro ?")) return;
    db.ref('room/game_1/scores').remove();
    nextRound();
}


// ==========================================
// 3. LOGIQUE DES JOUEURS — BUZZER
// ==========================================

function joinGame() {
    const input = document.getElementById('pseudo').value;
    if (input.trim() !== "") {
        playerName = input.trim();
        document.getElementById('login-zone').style.display = 'none';
        document.getElementById('player-score-zone').style.display = 'block';
        listenToMyScore();
        showPlayerWaiting();
    } else {
        alert("Saisis un pseudo valide !");
    }
}

function showPlayerWaiting() {
    document.getElementById('player-zone').style.display = 'block';
    document.getElementById('round-ended-zone').style.display = 'none';
    document.getElementById('buzzer-status-text').innerText = "⏳ Attends le lancement de la question…";
    document.getElementById('buzzer-btn').disabled = true;
    document.getElementById('buzzer-feedback').innerText = "";
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
// 4. ÉCOUTE EN TEMPS RÉEL
// ==========================================

function listenToGame() {
    db.ref('room/game_1').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.status === "playing") {
            if (playerName && !IS_HOST) {
                document.getElementById('player-zone').style.display = 'block';
                document.getElementById('round-ended-zone').style.display = 'none';
                document.getElementById('buzzer-status-text').innerText = "🎯 Buzze si tu connais la réponse !";

                const buzzes = data.buzzes || {};
                if (!buzzes[playerName]) {
                    hasBuzzed = false;
                    document.getElementById('buzzer-btn').disabled = false;
                    document.getElementById('buzzer-feedback').innerText = "";
                }
            }
        }
        else if (data.status === "results") {
            if (playerName && !IS_HOST) {
                document.getElementById('player-zone').style.display = 'none';
                document.getElementById('round-ended-zone').style.display = 'block';
                const feedback = document.getElementById('round-feedback');
                if (data.correctAnswer === playerName) {
                    feedback.innerText = "✅ Bravo " + playerName + " ! Bonne réponse !";
                    feedback.style.color = "#2ecc71";
                } else {
                    feedback.innerText = "🏆 C'est " + data.correctAnswer + " qui a trouvé !";
                    feedback.style.color = "#e74c3c";
                }
            }
        }
        else if (data.status === "waiting") {
            if (playerName && !IS_HOST) {
                showPlayerWaiting();
            }
            hasBuzzed = false;
        }
    });
}

function listenToBuzzes() {
    db.ref('room/game_1/buzzes').on('value', (snapshot) => {
        const buzzes = snapshot.val();
        const list = document.getElementById('buzz-list');
        if (!list) return;
        list.innerHTML = "";

        if (!buzzes) {
            list.innerHTML = '<p style="color:#888; font-size:14px;">En attente des buzzes…</p>';
            return;
        }

        const sorted = Object.keys(buzzes)
            .map(name => ({ name, timestamp: buzzes[name].timestamp }))
            .sort((a, b) => a.timestamp - b.timestamp);

        sorted.forEach((b, index) => {
            const ranks = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];
            const rank = ranks[index] || (index + 1) + ".";
            const div = document.createElement('div');
            div.className = 'buzz-entry';
            div.innerHTML = `
                <span class="buzz-rank">${rank}</span>
                <span class="buzz-name">${b.name}</span>
                <div class="points-btns">
                    <button class="pt-btn pt1" onclick="validateCorrectPlayer('${b.name}', 1)">+1</button>
                    <button class="pt-btn pt2" onclick="validateCorrectPlayer('${b.name}', 2)">+2</button>
                    <button class="pt-btn pt3" onclick="validateCorrectPlayer('${b.name}', 3)">+3</button>
                </div>
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
                let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";
                li.innerHTML = `<strong>${medal} ${p.name}</strong> — ${p.score} pts`;
                li.style.padding = "10px 14px";
                li.style.margin = "6px 0";
                li.style.background = index === 0 ? "#2d2416" : "#1e1e2e";
                li.style.borderRadius = "8px";
                li.style.borderLeft = index === 0 ? "4px solid #f1c40f" : "4px solid #444";
                list.appendChild(li);
            });
        }
    });
}

// Démarrage
listenToGame();
listenToScores();
listenToBuzzes();
