(() => {
  if (!window.AuthManager || !window.AuthManager.isAuthenticated()) {
    window.location.replace("login.html");
  }

  // State Variables
  let roomState = null;
  let roomUnsubscribe = null;
  let currentUser = { id: "usr_" + Math.random().toString(36).substr(2, 6), name: "Player" };

  // UI Elements
  const setupPanel = document.getElementById("mp-setup-panel");
  const lobbyPanel = document.getElementById("mp-lobby-panel");
  const gamePanel = document.getElementById("mp-game-panel");
  const winnerPanel = document.getElementById("mp-winner-panel");

  const hostNameInput = document.getElementById("host-name-input");
  const playerNameInput = document.getElementById("player-name-input");
  const roomCodeInput = document.getElementById("room-code-input");
  const createRoomBtn = document.getElementById("create-room-btn");
  const joinRoomBtn = document.getElementById("join-room-btn");

  const lobbyRoomCode = document.getElementById("lobby-room-code");
  const lobbySubjectInfo = document.getElementById("lobby-subject-info");
  const playerCount = document.getElementById("player-count");
  const lobbyPlayersGrid = document.getElementById("lobby-players-grid");
  const hostControls = document.getElementById("host-controls");
  const waitingHostNotice = document.getElementById("waiting-host-notice");
  const startMultiplayerGameBtn = document.getElementById("start-multiplayer-game-btn");
  const copyCodeBtn = document.getElementById("copy-code-btn");
  const leaveRoomBtn = document.getElementById("leave-room-btn");

  const gameRoomCode = document.getElementById("game-room-code");
  const mpTimerDisplay = document.getElementById("mp-timer-display");
  const mpProgressBar = document.getElementById("mp-progress-bar");
  const mpProgressStats = document.getElementById("mp-progress-stats");
  const mpQuestionMeta = document.getElementById("mp-question-meta");
  const mpQuestionText = document.getElementById("mp-question-text");
  const mpOptionsList = document.getElementById("mp-options-list");
  const liveScoresList = document.getElementById("live-scores-list");
  const mpSubmitBtn = document.getElementById("mp-submit-btn");

  const mpQuestionImgContainer = document.getElementById("mp-question-image-container");
  const mpQuestionImg = document.getElementById("mp-question-image");
  const mpQuestionAudioContainer = document.getElementById("mp-question-audio-container");
  const mpQuestionAudio = document.getElementById("mp-question-audio");
  const mpAudioPlay = document.getElementById("mp-audio-play");
  const mpAudioPause = document.getElementById("mp-audio-pause");

  const mpPodiumCards = document.getElementById("mp-podium-cards");
  const mpFinalScoreboardBody = document.getElementById("mp-final-scoreboard-body");

  function getDB() {
    if (window.db) return window.db;
    if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
      window.db = firebase.firestore();
      return window.db;
    }
    return null;
  }

  function initSessionUser() {
    let session = null;
    if (window.AuthManager) {
      session = window.AuthManager.getSession();
      if (session) {
        const name = session.fullName || session.username || "User";
        currentUser.name = name;
        currentUser.id = session.username || currentUser.id;
        if (hostNameInput) hostNameInput.value = name;
        if (playerNameInput) playerNameInput.value = name;
      }
    }
    const userBadge = document.getElementById("mp-user-badge");
    if (userBadge) {
      userBadge.style.cursor = "pointer";
      userBadge.onclick = () => window.location.href = "profile.html";

      if (!session) {
        userBadge.innerHTML = `<span class="user-chip-guest">Guest Player</span>`;
      } else {
        const name = session.fullName || session.username || "User";
        const avatar = session.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true`;
        userBadge.innerHTML = `
          <span class="user-badge-flex">
            <img src="${avatar}" class="user-header-avatar" alt="${name}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true';" />
            <span class="user-name">${name}</span>
          </span>
        `;
      }
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        if (confirm("Do you want to logout?")) {
          if (window.AuthManager) window.AuthManager.clearSession();
          window.location.href = "login.html";
        }
      };
    }
  }

  // Firebase Realtime Listener
  function listenToRoom(roomCode) {
    const db = getDB();
    if (!db) return;

    if (roomUnsubscribe) roomUnsubscribe();

    roomUnsubscribe = db.collection("multiplayer_rooms").doc(roomCode)
      .onSnapshot((doc) => {
        if (doc.exists) {
          roomState = doc.data();
          updateUIPanels();
        } else {
          alert("Room has been closed or does not exist.");
          roomState = null;
          updateUIPanels();
        }
      }, (err) => {
        console.error("Firestore Listen Error:", err);
      });
  }

  // Create Room Function (Firestore)
  function createRoom() {
    const db = getDB();
    if (!db) {
      alert("Database is initializing. Please try again in 2 seconds.");
      return;
    }

    const hostName = hostNameInput.value.trim() || currentUser.name || "Host Player";
    currentUser.name = hostName;
    const subject = document.getElementById("mp-subject-select").value;
    const difficulty = document.getElementById("mp-difficulty-select").value;

    const bank = window.QUESTION_BANK || [];
    let filtered = bank;
    if (subject !== "Mixed (All Subjects)") {
      filtered = bank.filter((q) => q.subject === subject);
    }
    if (filtered.length < 5) filtered = bank;

    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, 5);
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newRoom = {
      code: roomCode,
      hostId: currentUser.id,
      subject: subject,
      difficulty: difficulty,
      status: "LOBBY",
      currentQuestionIndex: 0,
      timerSeconds: 180,
      questions: selectedQuestions,
      players: [
        {
          id: currentUser.id,
          name: hostName,
          isHost: true,
          score: 0,
          answers: {}
        }
      ],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("multiplayer_rooms").doc(roomCode).set(newRoom)
      .then(() => {
        listenToRoom(roomCode);
      })
      .catch((err) => {
        alert("Error creating room: " + err.message);
      });
  }

  // Join Room Function (Firestore)
  function joinRoom() {
    const db = getDB();
    if (!db) {
      alert("Database is initializing. Please try again.");
      return;
    }

    const code = roomCodeInput.value.trim().toUpperCase();
    const playerName = playerNameInput.value.trim() || currentUser.name || "Player";
    currentUser.name = playerName;

    if (!code || code.length < 4) {
      alert("Please enter a valid room code.");
      return;
    }

    const roomRef = db.collection("multiplayer_rooms").doc(code);
    roomRef.get().then((doc) => {
      if (!doc.exists) {
        alert("Room code not found!");
        return;
      }
      const data = doc.data();
      if (data.status !== "LOBBY") {
        alert("This game has already started or finished.");
        return;
      }

      const players = data.players || [];
      const alreadyIn = players.find(p => p.id === currentUser.id);

      if (!alreadyIn) {
        players.push({
          id: currentUser.id,
          name: playerName,
          isHost: false,
          score: 0,
          answers: {}
        });
      }

      roomRef.update({ players: players }).then(() => {
        listenToRoom(code);
      });
    }).catch((err) => {
      alert("Error joining room: " + err.message);
    });
  }

  function leaveRoom() {
    if (!roomState) return;
    const db = getDB();
    if (roomUnsubscribe) roomUnsubscribe();

    if (db && roomState.code) {
      const roomRef = db.collection("multiplayer_rooms").doc(roomState.code);
      const updatedPlayers = roomState.players.filter(p => p.id !== currentUser.id);
      
      if (updatedPlayers.length === 0) {
        roomRef.delete();
      } else {
        roomRef.update({ players: updatedPlayers });
      }
    }

    roomState = null;
    updateUIPanels();
  }

  function startGame() {
    if (!roomState) return;
    const db = getDB();
    if (db) {
      db.collection("multiplayer_rooms").doc(roomState.code).update({
        status: "IN_GAME"
      });
    }
  }

  function updateUIPanels() {
    if (!roomState) {
      setupPanel.classList.remove("hidden");
      lobbyPanel.classList.add("hidden");
      gamePanel.classList.add("hidden");
      winnerPanel.classList.add("hidden");
      return;
    }

    if (roomState.status === "LOBBY") {
      setupPanel.classList.add("hidden");
      lobbyPanel.classList.remove("hidden");
      gamePanel.classList.add("hidden");
      winnerPanel.classList.add("hidden");
      renderLobby();
    } else if (roomState.status === "IN_GAME") {
      setupPanel.classList.add("hidden");
      lobbyPanel.classList.add("hidden");
      gamePanel.classList.remove("hidden");
      winnerPanel.classList.add("hidden");
      renderGame();
    } else if (roomState.status === "FINISHED") {
      setupPanel.classList.add("hidden");
      lobbyPanel.classList.add("hidden");
      gamePanel.classList.add("hidden");
      winnerPanel.classList.remove("hidden");
      renderWinnerScreen();
    }
  }

  function renderLobby() {
    lobbyRoomCode.textContent = roomState.code;
    lobbySubjectInfo.textContent = `Subject: ${roomState.subject} | Difficulty: ${roomState.difficulty}`;
    playerCount.textContent = roomState.players.length;

    lobbyPlayersGrid.innerHTML = "";
    roomState.players.forEach((p) => {
      const card = document.createElement("div");
      card.className = "player-avatar-card";
      card.innerHTML = `
        <div class="avatar-icon">${p.isHost ? "👑" : "👤"}</div>
        <div class="player-name">${p.name} ${p.id === currentUser.id ? "(You)" : ""}</div>
      `;
      lobbyPlayersGrid.appendChild(card);
    });

    const isHost = roomState.hostId === currentUser.id;
    if (isHost) {
      hostControls.classList.remove("hidden");
      waitingHostNotice.classList.add("hidden");
    } else {
      hostControls.classList.add("hidden");
      waitingHostNotice.classList.remove("hidden");
    }
  }

  function renderGame() {
    gameRoomCode.textContent = roomState.code;

    const secs = roomState.timerSeconds || 180;
    const minsStr = String(Math.floor(secs / 60)).padStart(2, "0");
    const secsStr = String(secs % 60).padStart(2, "0");
    mpTimerDisplay.textContent = `${minsStr}:${secsStr}`;

    const currentQIndex = roomState.currentQuestionIndex || 0;
    const currentQuestion = roomState.questions[currentQIndex];
    if (!currentQuestion) return;

    mpProgressStats.textContent = `Question ${currentQIndex + 1} of ${roomState.questions.length}`;
    mpProgressBar.style.width = `${((currentQIndex + 1) / roomState.questions.length) * 100}%`;

    mpQuestionMeta.textContent = `Question ${currentQIndex + 1} | ${currentQuestion.subject}`;
    mpQuestionText.textContent = currentQuestion.question;

    const imageUrl = currentQuestion.imageUrl || currentQuestion.image;
    if (imageUrl) {
      mpQuestionImg.src = imageUrl;
      mpQuestionImgContainer.classList.remove("hidden");
    } else {
      mpQuestionImgContainer.classList.add("hidden");
    }

    const audioUrl = currentQuestion.audioUrl || currentQuestion.audio;
    if (audioUrl) {
      mpQuestionAudio.src = audioUrl;
      mpQuestionAudioContainer.classList.remove("hidden");
      if (mpAudioPlay) mpAudioPlay.onclick = () => mpQuestionAudio.play().catch(console.warn);
      if (mpAudioPause) mpAudioPause.onclick = () => mpQuestionAudio.pause();
    } else {
      mpQuestionAudioContainer.classList.add("hidden");
    }

    mpOptionsList.innerHTML = "";
    const me = roomState.players.find((p) => p.id === currentUser.id);

    currentQuestion.options.forEach((optText, optIdx) => {
      const label = document.createElement("label");
      label.className = "option-card";
      
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "mp-option";
      radio.checked = me && me.answers && me.answers[currentQIndex] === optIdx;
      
      radio.onclick = () => {
        selectAnswer(currentQIndex, optIdx, currentQuestion.correctAnswer);
      };

      if (radio.checked) label.classList.add("selected");

      const span = document.createElement("span");
      span.textContent = optText;
      label.append(radio, span);
      mpOptionsList.appendChild(label);
    });

    renderLiveScoreboard();

    if (currentQIndex === roomState.questions.length - 1) {
      mpSubmitBtn.textContent = "Finish & Calculate Winners";
      mpSubmitBtn.onclick = finishGame;
    } else {
      mpSubmitBtn.textContent = "Next Question ➔";
      mpSubmitBtn.onclick = () => {
        const db = getDB();
        if (db) {
          db.collection("multiplayer_rooms").doc(roomState.code).update({
            currentQuestionIndex: currentQIndex + 1
          });
        }
      };
    }
  }

  function selectAnswer(qIndex, answerIdx, correctIdx) {
    const db = getDB();
    if (!db || !roomState) return;

    const updatedPlayers = roomState.players.map((p) => {
      if (p.id === currentUser.id) {
        p.answers = p.answers || {};
        p.answers[qIndex] = answerIdx;
        
        let score = 0;
        roomState.questions.forEach((q, idx) => {
          if (p.answers[idx] === q.correctAnswer) {
            score++;
          }
        });
        p.score = score;
      }
      return p;
    });

    db.collection("multiplayer_rooms").doc(roomState.code).update({
      players: updatedPlayers
    });
  }

  function renderLiveScoreboard() {
    liveScoresList.innerHTML = "";
    roomState.players.forEach((p) => {
      const row = document.createElement("div");
      row.className = "live-score-item";
      row.innerHTML = `
        <span>${p.isHost ? "👑" : "👤"} ${p.name} ${p.id === currentUser.id ? "(You)" : ""}</span>
        <strong>${p.score || 0}/${roomState.questions.length} Score</strong>
      `;
      liveScoresList.appendChild(row);
    });
  }

  function finishGame() {
    const db = getDB();
    if (db && roomState) {
      db.collection("multiplayer_rooms").doc(roomState.code).update({
        status: "FINISHED"
      });
    }
  }

  function renderWinnerScreen() {
    const sortedPlayers = [...roomState.players].sort((a, b) => (b.score || 0) - (a.score || 0));

    mpPodiumCards.innerHTML = "";
    const titles = [
      { badge: "🥇 1st Winner", class: "gold-podium" },
      { badge: "🥈 2nd Runner Up", class: "silver-podium" },
      { badge: "🥉 3rd Runner Up", class: "bronze-podium" }
    ];

    sortedPlayers.slice(0, 3).forEach((player, idx) => {
      const meta = titles[idx];
      const card = document.createElement("div");
      card.className = `podium-card ${meta.class}`;
      const percentage = roomState.questions.length ? ((player.score / roomState.questions.length) * 100).toFixed(0) : 0;
      card.innerHTML = `
        <div class="podium-badge">${meta.badge}</div>
        <h3 class="podium-name">${player.name}</h3>
        <p class="podium-detail">Score: <strong>${player.score}/${roomState.questions.length}</strong> (${percentage}%)</p>
      `;
      mpPodiumCards.appendChild(card);
    });

    mpFinalScoreboardBody.innerHTML = "";
    sortedPlayers.forEach((p, idx) => {
      const tr = document.createElement("tr");
      const percentage = roomState.questions.length ? ((p.score / roomState.questions.length) * 100).toFixed(1) : 0;
      tr.innerHTML = `
        <td>#${idx + 1}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.score}/${roomState.questions.length}</td>
        <td>${percentage}%</td>
        <td>180s</td>
      `;
      mpFinalScoreboardBody.appendChild(tr);
    });
  }

  if (createRoomBtn) createRoomBtn.onclick = createRoom;
  if (joinRoomBtn) joinRoomBtn.onclick = joinRoom;
  if (leaveRoomBtn) leaveRoomBtn.onclick = leaveRoom;
  if (startMultiplayerGameBtn) startMultiplayerGameBtn.onclick = startGame;
  if (copyCodeBtn) {
    copyCodeBtn.onclick = () => {
      if (roomState && roomState.code) {
        navigator.clipboard.writeText(roomState.code).then(() => alert("Room code copied!"));
      }
    };
  }

  initSessionUser();
})();