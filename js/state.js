/* ==========================================================================
   NOVA PARTY — FIREBASE REALTIME DATABASE CONFIGURATION & SYNC ENGINE
   Real-Time Cross-Device Synchronization for Mobile Phones, Laptops & TV Displays
   ========================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyAGBU3Rwjubml8OXNe1lKP2sISoK-Gb0RA",
  authDomain: "learndeutch-510318.firebaseapp.com",
  databaseURL: "https://learndeutch-510318-default-rtdb.firebaseio.com",
  projectId: "learndeutch-510318",
  storageBucket: "learndeutch-510318.firebasestorage.app",
  messagingSenderId: "845781895579",
  appId: "1:845781895579:web:24cbbb0274a04f2fe6f93e",
  measurementId: "G-QCZ476BV2T"
};

class GameStateStore {
  constructor() {
    this.channelName = 'nova_party_realtime_bus';
    this.channel = null;
    
    // Core Game State
    this.roomCode = '1234';
    this.gameMode = 'party'; // 'party' or 'mystery'
    this.currentPhase = 'lobby'; // 'lobby', 'in_game', 'summary', 'results'
    this.hostId = null;
    
    this.players = [];

    this.activeGameIndex = 0;
    this.currentRound = 1;
    this.totalRounds = 8;
    this.timer = 15;
    this.isTimerPaused = false;
    
    // Realtime Game Data
    this.answersMap = {}; // { playerId: answerData }
    this.drawingData = null; // { data: url/strokes, playerId, timestamp }
    this.unlockedEvidences = []; 
    this.accusations = {}; // { playerId: { culprit, motive } }
    this.logs = ['[نظام] أهلاً بك في NOVA Party! جاهز للاتصال المباشر.'];

    this.listeners = [];
    
    // Firebase Realtime DB Setup
    this.db = null;
    this.roomRef = null;
    this.firebaseConnected = false;

    this.initFirebase();
    this.loadActiveRoomFromStorage();
    this.initRealtime();
  }

  generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async initFirebase() {
    if (!window.firebase) {
      console.warn("Firebase SDK not loaded");
      return;
    }

    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }

      // Anonymous auth attempt to ensure read/write rules if enforced
      if (window.firebase.auth) {
        try {
          await window.firebase.auth().signInAnonymously();
        } catch (authErr) {
          console.warn("Firebase Anonymous Auth Note:", authErr);
        }
      }

      this.db = window.firebase.database();
      console.log("🔥 Firebase Realtime Database Initialized!");
      this.addLog("🔥 [Firebase] تم الاتصال بقاعدة بيانات الفايربيز المباشرة!");

      // Monitor online connection status
      const connectedRef = this.db.ref('.info/connected');
      connectedRef.on('value', (snap) => {
        this.firebaseConnected = (snap.val() === true);
        this.notifyListeners('FIREBASE_STATUS_CHANGE', { connected: this.firebaseConnected });
      });

      if (this.roomCode) {
        this.subscribeToFirebaseRoom(this.roomCode);
      }
    } catch (err) {
      console.warn("Firebase Init Warning:", err);
    }
  }

  subscribeToFirebaseRoom(code) {
    if (!this.db || !code) return;
    const cleanCode = code.trim().toUpperCase();
    this.roomCode = cleanCode;
    const roomPath = `rooms/${cleanCode}`;

    if (this.roomRef) {
      this.roomRef.off();
    }

    this.roomRef = this.db.ref(roomPath);
    this.roomRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        this.syncFromRemoteData(data);
      }
    });
  }

  syncFromRemoteData(data) {
    if (!data) return;
    const action = data.lastAction || 'ROOM_STATE_SYNC';
    const payload = data.lastPayload || null;

    if (data.roomCode) this.roomCode = data.roomCode;
    if (data.gameMode) this.gameMode = data.gameMode;
    if (data.currentPhase) this.currentPhase = data.currentPhase;
    if (data.currentRound !== undefined) this.currentRound = data.currentRound;
    if (data.activeGameIndex !== undefined) this.activeGameIndex = data.activeGameIndex;
    if (data.isTimerPaused !== undefined) this.isTimerPaused = data.isTimerPaused;
    if (data.timer !== undefined) this.timer = data.timer;
    if (data.hostId) this.hostId = data.hostId;
    
    // Players List Sync
    if (data.players) {
      const playerList = Array.isArray(data.players) ? data.players : Object.values(data.players);
      this.players = playerList.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else {
      this.players = [];
    }

    // Answers Sync
    if (data.answers) {
      this.answersMap = typeof data.answers === 'object' ? data.answers : {};
      if (window.gameEngine) {
        window.gameEngine.answersMap = this.answersMap;
      }
    } else {
      this.answersMap = {};
      if (window.gameEngine) window.gameEngine.answersMap = {};
    }

    // Drawing Canvas Sync
    if (data.drawing) {
      this.drawingData = data.drawing;
    }

    // Mystery Mode Evidence Sync
    if (data.unlockedEvidences) {
      this.unlockedEvidences = Array.isArray(data.unlockedEvidences) ? data.unlockedEvidences : Object.values(data.unlockedEvidences);
      if (window.mysteryEngine) {
        window.mysteryEngine.unlockedEvidences = this.unlockedEvidences;
      }
    }

    // Accusations Sync
    if (data.accusations) {
      this.accusations = typeof data.accusations === 'object' ? data.accusations : {};
    }

    // Logs Sync
    if (data.logs) {
      this.logs = Array.isArray(data.logs) ? data.logs : Object.values(data.logs);
    }

    this.saveActiveRoomToStorage();
    this.notifyListeners(action, payload);
  }

  loadActiveRoomFromStorage() {
    try {
      const saved = localStorage.getItem('nova_active_room_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.roomCode) {
          this.roomCode = parsed.roomCode;
          this.gameMode = parsed.gameMode || 'party';
          this.currentPhase = parsed.currentPhase || 'lobby';
          this.players = parsed.players || [];
          this.activeGameIndex = parsed.activeGameIndex || 0;
          this.currentRound = parsed.currentRound || 1;
          this.hostId = parsed.hostId || null;
        }
      }
    } catch (e) {}

    if (!this.roomCode) {
      this.roomCode = '1234';
    }
  }

  saveActiveRoomToStorage() {
    try {
      localStorage.setItem('nova_active_room_data', JSON.stringify({
        roomCode: this.roomCode,
        gameMode: this.gameMode,
        currentPhase: this.currentPhase,
        players: this.players,
        activeGameIndex: this.activeGameIndex,
        currentRound: this.currentRound,
        hostId: this.hostId
      }));
    } catch (e) {}
  }

  createRoom(gameMode = 'party') {
    this.roomCode = this.generateRoomCode();
    this.gameMode = gameMode;
    this.currentPhase = 'lobby';
    this.players = [];
    this.hostId = this.getSelfId();
    this.activeGameIndex = 0;
    this.currentRound = 1;
    this.answersMap = {};
    this.drawingData = null;
    this.unlockedEvidences = [];
    this.accusations = {};
    this.logs = [`[غرفة] تم إنشاء غرفة جديدة برمز: ${this.roomCode}`];
    
    sessionStorage.setItem('nova_is_host', 'true');
    sessionStorage.setItem('nova_room_code', this.roomCode);

    this.saveActiveRoomToStorage();
    this.subscribeToFirebaseRoom(this.roomCode);

    this.broadcast('ROOM_CREATED', {
      roomCode: this.roomCode,
      gameMode: this.gameMode,
      hostId: this.hostId
    });

    return this.roomCode;
  }

  initRealtime() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'nova_party_cross_event' && e.newValue) {
        try {
          const message = JSON.parse(e.newValue);
          if (message.senderId !== this.getSelfId()) {
            this.handleIncomingMessage(message);
          }
        } catch (err) {}
      } else if (e.key === 'nova_active_room_data') {
        this.loadActiveRoomFromStorage();
        this.notifyListeners('STORAGE_SYNC', null);
      }
    });
  }

  broadcast(action, payload) {
    const message = { action, payload, senderId: this.getSelfId(), timestamp: Date.now() };

    // Update Firebase Realtime Database
    if (this.db && this.roomCode) {
      const updates = {
        roomCode: this.roomCode,
        gameMode: this.gameMode,
        currentPhase: this.currentPhase,
        currentRound: this.currentRound,
        activeGameIndex: this.activeGameIndex,
        isTimerPaused: this.isTimerPaused,
        timer: this.timer,
        hostId: this.hostId,
        lastAction: action,
        lastPayload: payload || null,
        lastTimestamp: Date.now(),
        logs: this.logs
      };

      if (this.players && this.players.length > 0) {
        const pObj = {};
        this.players.forEach(p => { pObj[p.id] = p; });
        updates.players = pObj;
      }

      this.db.ref(`rooms/${this.roomCode.toUpperCase()}`).update(updates).catch(err => {
        console.warn("Firebase update warning:", err);
      });
    }

    // Local Tab BroadcastChannel & localStorage fallback
    if (this.channel) {
      try { this.channel.postMessage(message); } catch (e) {}
    }
    try {
      localStorage.setItem('nova_party_cross_event', JSON.stringify(message));
    } catch (e) {}

    this.handleIncomingMessage(message);
  }

  submitPlayerAnswer(playerId, answerData) {
    if (!this.db || !this.roomCode) return;
    this.answersMap[playerId] = answerData;
    
    // Save to Firebase under answers/playerId
    this.db.ref(`rooms/${this.roomCode.toUpperCase()}/answers/${playerId}`).set(answerData);
    this.db.ref(`rooms/${this.roomCode.toUpperCase()}`).update({
      lastAction: 'SUBMIT_ANSWER',
      lastPayload: { playerId, answerData },
      lastTimestamp: Date.now()
    });

    this.broadcast('SUBMIT_ANSWER', { playerId, answerData });
  }

  submitDrawing(playerId, drawData) {
    if (!this.db || !this.roomCode) return;
    const payload = { data: drawData, playerId, timestamp: Date.now() };
    this.drawingData = payload;
    this.db.ref(`rooms/${this.roomCode.toUpperCase()}/drawing`).set(payload);
    this.broadcast('DRAWING_SYNC', payload);
  }

  submitAccusation(playerId, accusationData) {
    if (!this.db || !this.roomCode) return;
    this.accusations[playerId] = accusationData;
    this.db.ref(`rooms/${this.roomCode.toUpperCase()}/accusations/${playerId}`).set(accusationData);
    this.broadcast('SUBMIT_ACCUSATION', { playerId, accusationData });
  }

  updateUnlockedEvidences(evidences) {
    this.unlockedEvidences = evidences;
    if (this.db && this.roomCode) {
      this.db.ref(`rooms/${this.roomCode.toUpperCase()}/unlockedEvidences`).set(evidences);
    }
    this.broadcast('EVIDENCE_UNLOCKED', evidences);
  }

  clearRoundState() {
    this.answersMap = {};
    this.drawingData = null;
    if (this.db && this.roomCode) {
      this.db.ref(`rooms/${this.roomCode.toUpperCase()}/answers`).remove();
      this.db.ref(`rooms/${this.roomCode.toUpperCase()}/drawing`).remove();
    }
  }

  handleIncomingMessage(data) {
    if (!data || !data.action) return;
    const { action, payload } = data;
    switch (action) {
      case 'ROOM_CREATED':
        this.roomCode = payload.roomCode;
        this.gameMode = payload.gameMode;
        this.hostId = payload.hostId;
        this.players = [];
        this.currentPhase = 'lobby';
        this.saveActiveRoomToStorage();
        break;
      case 'PLAYER_JOIN_REQUEST':
        if (payload) {
          this.addPlayer(payload);
          this.saveActiveRoomToStorage();
        }
        break;
      case 'ROOM_STATE_SYNC':
        if (payload && payload.players) {
          this.players = payload.players;
          if (payload.roomCode) this.roomCode = payload.roomCode;
          if (payload.currentPhase) this.currentPhase = payload.currentPhase;
          if (payload.currentRound !== undefined) this.currentRound = payload.currentRound;
          if (payload.activeGameIndex !== undefined) this.activeGameIndex = payload.activeGameIndex;
        }
        this.saveActiveRoomToStorage();
        break;
      case 'PLAYER_KICK':
        if (payload && payload.playerId) {
          this.players = this.players.filter(p => p.id !== payload.playerId);
          this.addLog(`🛑 تم استبعاد اللاعب من الغرفة.`);
          this.saveActiveRoomToStorage();
        }
        break;
      case 'ROUND_STARTED':
        this.currentPhase = 'in_game';
        if (payload) {
          this.activeGameIndex = payload.gameIndex !== undefined ? payload.gameIndex : this.activeGameIndex;
          this.currentRound = payload.currentRound || (this.activeGameIndex + 1);
        }
        this.answersMap = {};
        this.drawingData = null;
        this.addLog(`🎮 بدأت الجولة ${this.currentRound}`);
        this.saveActiveRoomToStorage();
        break;
      case 'ROUND_FINISHED':
        this.currentPhase = 'summary';
        this.addLog(`🏁 انتهت الجولة ${this.currentRound}`);
        this.saveActiveRoomToStorage();
        break;
      case 'SCORE_UPDATE':
        if (payload && payload.playerId) {
          this.updatePlayerScore(payload.playerId, payload.pointsToAdd);
          this.saveActiveRoomToStorage();
        }
        break;
      case 'SUBMIT_ANSWER':
        if (payload && payload.answerData) {
          this.answersMap[payload.playerId] = payload.answerData;
          if (window.gameEngine) window.gameEngine.answersMap[payload.playerId] = payload.answerData;
          this.onAnswerReceived({
            playerId: payload.playerId,
            playerName: (this.players.find(p => p.id === payload.playerId) || {}).name || payload.playerId,
            summary: payload.answerData.summary || 'تم تسجيل الإجابة'
          });
        }
        break;
      case 'SUBMIT_ACCUSATION':
        if (payload && payload.playerId && payload.accusationData) {
          this.accusations[payload.playerId] = payload.accusationData;
          this.addLog(`⚖️ سلم ${payload.accusationData.playerName || 'لاعب'} اتهامه النهائي!`);
        }
        break;
    }
    this.notifyListeners(action, payload);
  }

  getSelfId() {
    let id = sessionStorage.getItem('nova_player_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substr(2, 6) + '_' + Date.now().toString(36).slice(-4);
      sessionStorage.setItem('nova_player_id', id);
    }
    return id;
  }

  joinRoom(enteredCode, playerName, avatar, title) {
    const cleanCode = (enteredCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'يرجى كتابة رمز الغرفة أولاً' };
    }

    this.roomCode = cleanCode;
    const playerId = this.getSelfId();
    const player = {
      id: playerId,
      name: playerName.trim(),
      avatar: avatar || '🐺',
      title: title || 'PLAYER',
      score: 0,
      joinedAt: Date.now()
    };

    sessionStorage.setItem('nova_joined_player', JSON.stringify(player));
    sessionStorage.setItem('nova_room_code', cleanCode);

    this.addPlayer(player);
    this.subscribeToFirebaseRoom(cleanCode);

    if (this.db) {
      const pRef = this.db.ref(`rooms/${cleanCode}/players/${playerId}`);
      pRef.set(player);
      pRef.onDisconnect().remove();

      this.db.ref(`rooms/${cleanCode}`).update({
        lastAction: 'PLAYER_JOIN_REQUEST',
        lastPayload: player,
        lastTimestamp: Date.now()
      });
    }

    this.broadcast('PLAYER_JOIN_REQUEST', player);
    return { success: true, player };
  }

  addPlayer(player) {
    if (!player || !player.id) return;
    const existingIndex = this.players.findIndex(p => p.id === player.id);
    if (existingIndex === -1) {
      const nameIndex = this.players.findIndex(p => p.name === player.name);
      if (nameIndex !== -1) {
        player.name = player.name + ' (' + (this.players.length + 1) + ')';
      }
      this.players.push(player);
      this.addLog(`👤 انضم ${player.name} (${player.avatar}) للعبة!`);
    } else {
      Object.assign(this.players[existingIndex], player);
    }
  }

  kickPlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    if (this.db && this.roomCode) {
      this.db.ref(`rooms/${this.roomCode.toUpperCase()}/players/${playerId}`).remove();
    }
    this.broadcast('PLAYER_KICK', { playerId });
  }

  updatePlayerScore(playerId, points) {
    const p = this.players.find(x => x.id === playerId);
    if (p) {
      p.score = (p.score || 0) + points;
      this.addLog(`⭐ حصل ${p.name} على +${points} XP (المجموع: ${p.score})`);
      if (this.db && this.roomCode) {
        this.db.ref(`rooms/${this.roomCode.toUpperCase()}/players/${playerId}/score`).set(p.score);
      }
    }
    this.players.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  onAnswerReceived(data) {
    this.addLog(`⚡ إجابة من ${data.playerName}: ${data.summary || 'تم الإرسال'}`);
  }

  addLog(msg) {
    this.logs.unshift(`[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`);
    if (this.logs.length > 25) this.logs.pop();
  }

  subscribe(fn) {
    this.listeners.push(fn);
  }

  notifyListeners(action, payload) {
    this.listeners.forEach(fn => fn(action, payload, this));
  }

  reset() {
    this.players.forEach(p => p.score = 0);
    this.activeGameIndex = 0;
    this.currentRound = 1;
    this.currentPhase = 'lobby';
    this.answersMap = {};
    this.drawingData = null;
    this.unlockedEvidences = [];
    this.accusations = {};
    this.logs = ['[نظام] تم إعادة ضبط الغرفة.'];
    this.saveActiveRoomToStorage();
    if (this.db && this.roomCode) {
      const pObj = {};
      this.players.forEach(p => { pObj[p.id] = p; });
      this.db.ref(`rooms/${this.roomCode.toUpperCase()}`).set({
        roomCode: this.roomCode,
        gameMode: this.gameMode,
        currentPhase: this.currentPhase,
        currentRound: this.currentRound,
        activeGameIndex: this.activeGameIndex,
        hostId: this.hostId,
        players: pObj,
        logs: this.logs,
        lastAction: 'ROOM_RESET',
        lastTimestamp: Date.now()
      });
    }
    this.broadcast('ROOM_STATE_SYNC', {
      players: this.players,
      roomCode: this.roomCode,
      currentPhase: this.currentPhase,
      currentRound: this.currentRound,
      activeGameIndex: this.activeGameIndex
    });
  }
}

const stateStore = new GameStateStore();
window.stateStore = stateStore;




