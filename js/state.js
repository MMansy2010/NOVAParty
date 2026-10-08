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
    
    // Mystery Mode State
    this.unlockedEvidence = {}; 
    this.accusations = {}; 
    this.logs = ['[نظام] أهلاً بك في NOVA Party!'];

    this.listeners = [];
    
    // Firebase Realtime DB Setup
    this.db = null;
    this.roomRef = null;

    this.initFirebase();
    this.loadActiveRoomFromStorage();
    this.initRealtime();
  }

  generateRoomCode() {
    return '1234';
  }

  initFirebase() {
    try {
      if (window.firebase && !window.firebase.apps.length) {
        // Public Firebase Realtime DB Endpoint for NOVA Party Multi-Device Sync
        const firebaseConfig = {
          databaseURL: "https://nova-party-game-default-rtdb.firebaseio.com"
        };
        window.firebase.initializeApp(firebaseConfig);
      }
      if (window.firebase && window.firebase.database) {
        this.db = window.firebase.database();
        console.log("🔥 Firebase Realtime Database Initialized!");
        this.subscribeToFirebaseRoom(this.roomCode);
      }
    } catch (err) {
      console.warn("Firebase Init Fallback:", err);
    }
  }

  subscribeToFirebaseRoom(code) {
    if (!this.db || !code) return;
    const roomPath = `rooms/${code.toUpperCase()}`;
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
    if (data.currentRound) this.currentRound = data.currentRound;
    if (data.activeGameIndex !== undefined) this.activeGameIndex = data.activeGameIndex;
    if (data.hostId) this.hostId = data.hostId;
    
    if (data.players) {
      this.players = Object.values(data.players);
    }

    if (data.logs && Array.isArray(data.logs)) {
      this.logs = data.logs;
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
    this.roomCode = '1234';
    this.gameMode = gameMode;
    this.currentPhase = 'lobby';
    this.players = [];
    this.hostId = this.getSelfId();
    this.activeGameIndex = 0;
    this.currentRound = 1;
    this.unlockedEvidence = {};
    this.accusations = {};
    this.logs = [`[غرفة] تم إنشاء غرفة جديدة برمز: ${this.roomCode}`];
    
    sessionStorage.setItem('nova_is_host', 'true');
    sessionStorage.setItem('nova_room_code', this.roomCode);

    const roomData = {
      roomCode: this.roomCode,
      gameMode: this.gameMode,
      currentPhase: this.currentPhase,
      players: {},
      hostId: this.hostId,
      activeGameIndex: 0,
      currentRound: 1,
      logs: this.logs,
      lastAction: 'ROOM_CREATED',
      updatedAt: Date.now()
    };

    if (this.db) {
      this.db.ref(`rooms/${this.roomCode}`).set(roomData);
      this.subscribeToFirebaseRoom(this.roomCode);
    }

    this.saveActiveRoomToStorage();
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
    
    // Update Firebase if connected
    if (this.db && this.roomCode) {
      const updateData = {
        lastAction: action,
        lastPayload: payload || null,
        updatedAt: Date.now()
      };

      if (action === 'ROUND_STARTED') {
        updateData.currentPhase = 'in_game';
        updateData.activeGameIndex = payload.gameIndex;
        updateData.currentRound = payload.currentRound || (payload.gameIndex + 1);
      } else if (action === 'ROUND_FINISHED') {
        updateData.currentPhase = 'summary';
      }

      this.db.ref(`rooms/${this.roomCode}`).update(updateData);
    }

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (e) {}
    }
    try {
      localStorage.setItem('nova_party_cross_event', JSON.stringify(message));
    } catch (e) {}

    this.handleIncomingMessage(message);
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
        this.addPlayer(payload);
        this.saveActiveRoomToStorage();
        break;
      case 'ROOM_STATE_SYNC':
        if (payload && payload.players) {
          this.players = payload.players;
          if (payload.roomCode) this.roomCode = payload.roomCode;
          if (payload.currentPhase) this.currentPhase = payload.currentPhase;
          if (payload.currentRound) this.currentRound = payload.currentRound;
          if (payload.activeGameIndex !== undefined) this.activeGameIndex = payload.activeGameIndex;
        }
        this.saveActiveRoomToStorage();
        break;
      case 'PLAYER_KICK':
        this.players = this.players.filter(p => p.id !== payload.playerId);
        this.addLog(`🛑 تم استبعاد اللاعب من الغرفة.`);
        if (this.db) {
          this.db.ref(`rooms/${this.roomCode}/players/${payload.playerId}`).remove();
        }
        this.saveActiveRoomToStorage();
        break;
      case 'ROUND_STARTED':
        this.currentPhase = 'in_game';
        this.activeGameIndex = payload.gameIndex;
        this.currentRound = payload.currentRound || (payload.gameIndex + 1);
        this.addLog(`🎮 بدأت الجولة ${this.currentRound}`);
        this.saveActiveRoomToStorage();
        break;
      case 'ROUND_FINISHED':
        this.currentPhase = 'summary';
        this.addLog(`🏁 انتهت الجولة ${this.currentRound}`);
        this.saveActiveRoomToStorage();
        break;
      case 'SCORE_UPDATE':
        this.updatePlayerScore(payload.playerId, payload.pointsToAdd);
        this.saveActiveRoomToStorage();
        break;
      case 'SUBMIT_ANSWER':
        this.onAnswerReceived(payload);
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
    const targetCode = (this.roomCode || '1234').toUpperCase();
    
    if (cleanCode && cleanCode !== '1234' && cleanCode !== targetCode) {
      return { success: false, message: `رمز الغرفة (${cleanCode}) غير صحيح! رمز الغرفة الموحد هو: 1234` };
    }

    this.roomCode = '1234';
    const playerId = this.getSelfId();
    const player = {
      id: playerId,
      name: playerName.trim(),
      avatar: avatar || '🐺',
      title: title || 'PLAYER',
      score: 0
    };

    sessionStorage.setItem('nova_joined_player', JSON.stringify(player));
    
    // 1. Add locally
    this.addPlayer(player);

    // 2. Write to Firebase Realtime Database under rooms/1234/players/{playerId}
    if (this.db) {
      this.db.ref(`rooms/${this.roomCode}/players/${playerId}`).set(player);
      this.db.ref(`rooms/${this.roomCode}/lastAction`).set('PLAYER_JOINED');
      this.db.ref(`rooms/${this.roomCode}/logs`).set(this.logs);
      this.subscribeToFirebaseRoom(this.roomCode);
    }

    // 3. Broadcast locally
    this.broadcast('PLAYER_JOIN_REQUEST', player);
    return { success: true, player };
  }

  addPlayer(player) {
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
    this.broadcast('PLAYER_KICK', { playerId });
  }

  updatePlayerScore(playerId, points) {
    const p = this.players.find(x => x.id === playerId);
    if (p) {
      p.score += points;
      this.addLog(`⭐ حصل ${p.name} على +${points} XP (المجموع: ${p.score})`);
      if (this.db) {
        this.db.ref(`rooms/${this.roomCode}/players/${playerId}/score`).set(p.score);
      }
    }
    this.players.sort((a, b) => b.score - a.score);
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
    this.unlockedEvidence = {};
    this.accusations = {};
    this.logs = ['[نظام] تم إعادة ضبط الغرفة.'];
    
    if (this.db) {
      this.db.ref(`rooms/${this.roomCode}`).remove();
    }
    
    this.saveActiveRoomToStorage();
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


