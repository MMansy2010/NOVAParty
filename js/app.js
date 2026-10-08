class NovaApp {
  constructor() {
    this.currentView = 'landing';
    this.selectedAvatar = '🐺';
    this.selectedTitle = 'THE STRATEGIST';
  }

  init() {
    this.setupAvatarPicker();
    stateStore.subscribe((action, payload, state) => this.onStateChange(action, payload, state));
    this.updateHostHeaderInfo();
    this.renderHostPlayersGrid();
    this.renderHostLeaderboard();
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Toggle active view container
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    // Toggle navbar buttons
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-mode-${viewName}`);
    if (btn) btn.classList.add('active');

    audioEngine.playTap();

    if (viewName === 'host') {
      this.updateHostHeaderInfo();
      this.renderHostPlayersGrid();
      this.renderHostLeaderboard();
    } else if (viewName === 'mobile') {
      // Auto fill current room code in mobile join input
      const codeInput = document.getElementById('mobile-input-code');
      if (codeInput) {
        codeInput.value = stateStore.roomCode || '1234';
      }
    }
  }

  startAsHost(mode = 'party') {
    const newCode = stateStore.createRoom(mode);

    this.updateHostHeaderInfo();
    this.switchView('host');
    this.showHostStage('lobby');
    
    audioEngine.playSuccess();
    stateStore.addLog(`🖥️ تم فتح غرفة جديدة برمز [${newCode}] في طور: ${mode === 'party' ? 'Party Mode' : 'Mystery Mode'}`);
  }

  updateHostHeaderInfo() {
    const codeBadge = document.getElementById('host-room-code');
    const displayCode = document.getElementById('host-code-display');
    const modeTag = document.getElementById('host-game-mode');

    if (codeBadge) codeBadge.textContent = stateStore.roomCode;
    if (displayCode) displayCode.textContent = stateStore.roomCode;
    if (modeTag) {
      modeTag.textContent = stateStore.gameMode === 'party' ? '🏆 PARTY MODE' : '🕵️ MYSTERY MODE (CASE #001)';
    }
  }

  copyRoomCode() {
    const code = stateStore.roomCode;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code);
      alert(`تم نسخ رمز الغرفة: ${code}`);
    } else {
      alert(`رمز الغرفة هو: ${code}`);
    }
  }

  showHostStage(stageName) {
    document.querySelectorAll('.stage-view').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`host-stage-${stageName}`);
    if (target) target.classList.add('active');
  }

  setupAvatarPicker() {
    const opts = document.querySelectorAll('.avatar-option');
    opts.forEach(opt => {
      opt.onclick = () => {
        opts.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.selectedAvatar = opt.getAttribute('data-avatar');
        this.selectedTitle = opt.getAttribute('data-title');
        audioEngine.playTap();
      };
    });
  }

  joinRoomFromMobile() {
    const codeInput = document.getElementById('mobile-input-code');
    const nameInput = document.getElementById('mobile-input-name');
    const errBox = document.getElementById('mobile-join-error');

    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
    const name = nameInput ? nameInput.value.trim() : '';

    if (!code) {
      this.showJoinError('يرجى كتابة رمز الغرفة اولاً');
      return;
    }

    if (!name) {
      this.showJoinError('من فضلك اكتب اسمك أولاً');
      return;
    }

    const result = stateStore.joinRoom(code, name, this.selectedAvatar, this.selectedTitle);
    
    if (!result.success) {
      this.showJoinError(result.message);
      audioEngine.playError();
      return;
    }

    if (errBox) errBox.style.display = 'none';
    audioEngine.playSuccess();

    // Switch mobile view to lobby waiting screen
    document.querySelectorAll('.mobile-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('mobile-lobby-screen').classList.add('active');

    this.renderMobileLobby();
  }

  renderMobileLobby() {
    const card = document.getElementById('mobile-player-card');
    if (!card) return;

    const myDataRaw = sessionStorage.getItem('nova_joined_player');
    const myData = myDataRaw ? JSON.parse(myDataRaw) : null;

    const playersHtml = stateStore.players.map(p => `
      <div class="glass-card" style="padding: 10px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; background: rgba(255,255,255,0.05); border: 1px solid ${myData && myData.id === p.id ? 'var(--primary)' : 'var(--border-glass)'};">
        <span style="font-size: 2.2rem;">${p.avatar}</span>
        <div style="flex: 1; text-align: right;">
          <strong style="display: block; font-size: 1.05rem; color: white;">${p.name} ${myData && myData.id === p.id ? '<span style="color:var(--primary); font-size:0.8rem;">(أنت 👤)</span>' : ''}</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${p.title}</span>
        </div>
        <span style="background: rgba(16, 185, 129, 0.2); border: 1px solid var(--accent); color: var(--accent); font-size: 0.75rem; padding: 3px 10px; border-radius: 12px; font-weight: bold;">جاهز 🟢</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size:0.85rem; color:var(--accent); background:rgba(16,185,129,0.15); display:inline-block; padding:4px 14px; border-radius:20px; font-weight:bold; margin-bottom:8px;">
          🔑 رمز الغرفة: ${stateStore.roomCode}
        </div>
        <h3 style="color: var(--gold); font-size: 1.4rem;">👥 المتواجدون في اللوبي</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">اللاعبون المتصلون حالياً (${stateStore.players.length})</p>
      </div>

      <div class="mobile-players-list" style="max-height: 250px; overflow-y: auto; margin-bottom: 15px; padding-left:4px;">
        ${playersHtml.length > 0 ? playersHtml : '<p style="color:var(--text-muted); text-align:center;">بانتظار انضمام باقي اللاعبين...</p>'}
      </div>
    `;
  }

  showJoinError(msg) {
    let errBox = document.getElementById('mobile-join-error');
    if (!errBox) {
      const form = document.getElementById('join-form');
      if (form) {
        errBox = document.createElement('div');
        errBox.id = 'mobile-join-error';
        errBox.style.cssText = 'background: rgba(239, 68, 68, 0.2); border: 1px solid var(--danger); color: #fca5a5; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9rem; text-align: center;';
        form.insertBefore(errBox, form.firstChild);
      }
    }
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
  }

  startSelectedGameMode() {
    if (stateStore.players.length === 0) {
      if (!confirm('لم ينضم أي لاعبين بعد! هل تريد بدء اللعبة على أية حال؟')) {
        return;
      }
    }

    if (stateStore.gameMode === 'party') {
      this.showHostStage('game');

      const gameIdx = stateStore.activeGameIndex;
      const hostCanvas = document.getElementById('host-game-canvas');
      const mobileController = document.getElementById('mobile-game-controller');

      // Broadcast to all connected player devices that the round has started
      stateStore.broadcast('ROUND_STARTED', {
        gameIndex: gameIdx,
        currentRound: stateStore.currentRound
      });

      // Initialize round on Host TV display
      gameEngine.startRound(gameIdx, hostCanvas, mobileController);
    } else {
      this.showHostStage('mystery');
      const hostStage = document.getElementById('host-stage-mystery');
      mysteryEngine.renderCaseBoard(hostStage);
    }
  }

  nextRound() {
    stateStore.activeGameIndex++;
    stateStore.currentRound++;
    this.startSelectedGameMode();
  }

  togglePauseTimer() {
    stateStore.isTimerPaused = !stateStore.isTimerPaused;
    const btn = document.getElementById('btn-host-pause');
    if (btn) {
      btn.textContent = stateStore.isTimerPaused ? 'استئناف 🔴' : 'إيقاف ⏸️';
    }
    stateStore.addLog(stateStore.isTimerPaused ? '⏸️ تم إيقاف الموقت مؤقتاً بواسطة الهوست' : '▶️ تم استئناف الموقت');
  }

  kickPlayer(playerId) {
    if (confirm('هل أنت تأكد من استبعاد هذا اللاعب؟')) {
      stateStore.kickPlayer(playerId);
      this.renderHostPlayersGrid();
      this.renderHostLeaderboard();
    }
  }

  showFinalResults() {
    this.showHostStage('results');
    audioEngine.playVictoryFanfare();

    const sorted = [...stateStore.players].sort((a, b) => b.score - a.score);

    // Render Podium
    const podium = document.getElementById('host-podium');
    if (podium) {
      if (sorted.length === 0) {
        podium.innerHTML = `<p style="color:var(--text-muted);">لا يوجد لاعبين في هذه الجولة.</p>`;
      } else {
        podium.innerHTML = `
          ${sorted[1] ? `
            <div class="podium-place second">
              <div style="font-size:2.5rem;">🥈</div>
              <div style="font-size:2.5rem;">${sorted[1].avatar}</div>
              <h3>${sorted[1].name}</h3>
              <p style="color:var(--accent); font-weight:800;">${sorted[1].score} XP</p>
            </div>
          ` : ''}

          <div class="podium-place first">
            <div style="font-size:3.5rem;">🥇</div>
            <div style="font-size:3.5rem;">${sorted[0].avatar}</div>
            <h2>${sorted[0].name}</h2>
            <p style="color:var(--gold); font-size:1.4rem; font-weight:900;">${sorted[0].score} XP</p>
          </div>

          ${sorted[2] ? `
            <div class="podium-place third">
              <div style="font-size:2rem;">🥉</div>
              <div style="font-size:2rem;">${sorted[2].avatar}</div>
              <h4>${sorted[2].name}</h4>
              <p style="color:var(--accent); font-weight:800;">${sorted[2].score} XP</p>
            </div>
          ` : ''}
        `;
      }
    }

    // Render Badges
    const badgesGrid = document.getElementById('host-badges-grid');
    if (badgesGrid) {
      badgesGrid.innerHTML = `
        <div class="glass-card" style="padding:14px; text-align:center;">
          <div style="font-size:2rem;">⚡</div>
          <strong>أسرع استجابة</strong>
          <p style="font-size:0.85rem; color:var(--text-muted);">${sorted[0] ? sorted[0].name : '—'}</p>
        </div>
        <div class="glass-card" style="padding:14px; text-align:center;">
          <div style="font-size:2rem;">🧠</div>
          <strong>عبقري الذاكرة</strong>
          <p style="font-size:0.85rem; color:var(--text-muted);">${sorted[1] ? sorted[1].name : (sorted[0] ? sorted[0].name : '—')}</p>
        </div>
        <div class="glass-card" style="padding:14px; text-align:center;">
          <div style="font-size:2rem;">🕵️</div>
          <strong>المحقق الخبير</strong>
          <p style="font-size:0.85rem; color:var(--text-muted);">${sorted[0] ? sorted[0].name : '—'}</p>
        </div>
      `;
    }
  }

  simQuickSetup() {
    // Ensure room exists
    if (!stateStore.roomCode) {
      stateStore.createRoom('party');
    }

    // Populate Host frame
    const fHost = document.getElementById('sim-frame-host');
    if (fHost) fHost.src = 'index.html#view-host';

    // Populate 3 player frames
    const fP1 = document.getElementById('sim-frame-p1');
    const fP2 = document.getElementById('sim-frame-p2');
    const fP3 = document.getElementById('sim-frame-p3');

    if (fP1) fP1.src = 'index.html#view-mobile';
    if (fP2) fP2.src = 'index.html#view-mobile';
    if (fP3) fP3.src = 'index.html#view-mobile';

    // Broadcast 3 simulated players automatically
    stateStore.addPlayer({ id: 'sim_p1', name: 'محمد 🐺', avatar: '🐺', title: 'THE STRATEGIST', score: 350 });
    stateStore.addPlayer({ id: 'sim_p2', name: 'أحمد 🦊', avatar: '🦊', title: 'SPEEDSTER', score: 280 });
    stateStore.addPlayer({ id: 'sim_p3', name: 'يوسف 🦁', avatar: '🦁', title: 'BRAINIAC', score: 210 });

    stateStore.addLog("⚡ تم إعداد 3 لاعبين شرفيين محاكين في بيئة المحاكي بنجاح!");
  }

  resetRoom() {
    if (confirm('هل أنت متاكد من إعادة ضبط الغرفة وتصفير النقاط؟')) {
      stateStore.reset();
      this.updateHostHeaderInfo();
      this.renderHostPlayersGrid();
      this.renderHostLeaderboard();
      this.showHostStage('lobby');
    }
  }

  onStateChange(action, payload, state) {
    this.updateHostHeaderInfo();
    this.renderHostPlayersGrid();
    this.renderHostLeaderboard();
    this.renderLogs();
    this.renderMobileLobby();

    // Handle Mobile Screen State Transitions based on state changes
    if (action === 'ROUND_STARTED') {
      const isMobileView = this.currentView === 'mobile';
      const hasJoined = sessionStorage.getItem('nova_joined_player');
      
      if (isMobileView || hasJoined) {
        document.querySelectorAll('.mobile-screen').forEach(s => s.classList.remove('active'));
        const gameScreen = document.getElementById('mobile-game-screen');
        if (gameScreen) gameScreen.classList.add('active');

        // Setup mobile touch controller for this round
        const mobileController = document.getElementById('mobile-game-controller');
        gameEngine.setupMobileController(payload ? payload.gameIndex : 0, mobileController);
      }
    }

    if (action === 'ROUND_FINISHED') {
      const mobileController = document.getElementById('mobile-game-controller');
      if (mobileController && (this.currentView === 'mobile' || sessionStorage.getItem('nova_joined_player'))) {
        const sorted = [...stateStore.players].sort((a, b) => b.score - a.score);
        const standingsHtml = sorted.map((p, idx) => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; margin-bottom:6px; background:rgba(255,255,255,0.05); border-radius:10px;">
            <span>${idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx+1}`))} ${p.avatar} ${p.name}</span>
            <strong style="color:var(--gold);">${p.score} XP</strong>
          </div>
        `).join('');

        mobileController.innerHTML = `
          <div style="text-align:center; padding:20px 10px;">
            <div style="font-size:3rem; margin-bottom:8px;">🏁</div>
            <h3 style="color:var(--accent); font-size:1.5rem; margin-bottom:12px;">انتهت الجولة!</h3>
            <div style="text-align:right; margin-bottom:15px;">
              <h4 style="color:var(--text-muted); font-size:0.9rem; margin-bottom:8px;">ترتيب اللاعبين الحسابي:</h4>
              ${standingsHtml}
            </div>
            <p style="color:var(--gold); font-size:0.85rem; animation:pulse 1.5s infinite;">⏳ بانتظار إطلاق الجولة التالية من الهوست...</p>
          </div>
        `;
      }
    }

    // Check if player kicked
    if (action === 'PLAYER_KICK' && payload.playerId === stateStore.getSelfId()) {
      alert('تم استبعادك من الغرفة بواسطة الهوست!');
      sessionStorage.removeItem('nova_joined_player');
      document.querySelectorAll('.mobile-screen').forEach(s => s.classList.remove('active'));
      document.getElementById('mobile-join-screen').classList.add('active');
    }
  }

  renderHostPlayersGrid() {
    const grid = document.getElementById('host-players-grid');
    const count = document.getElementById('joined-count');
    if (count) count.textContent = stateStore.players.length;

    if (grid) {
      if (stateStore.players.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted);">
            <div style="font-size: 3rem; margin-bottom: 10px;">📱</div>
            <p style="font-size: 1.2rem;">الغرفة فارغة حالياً... بانتظار دخول اللاعبين باستخدام رمز الغرفة [<strong>${stateStore.roomCode}</strong>]</p>
          </div>
        `;
      } else {
        grid.innerHTML = stateStore.players.map(p => `
          <div class="player-card-host" style="position:relative;">
            <button onclick="app.kickPlayer('${p.id}')" title="طرد اللاعب" style="position:absolute; top:5px; left:5px; background:rgba(239,68,68,0.2); border:none; color:var(--danger); border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:12px;">✕</button>
            <div class="avatar">${p.avatar}</div>
            <div class="name">${p.name}</div>
            <div class="title-tag">${p.title}</div>
            <div style="margin-top:6px; color:var(--gold); font-weight:800; font-size:0.9rem;">⭐ ${p.score} XP</div>
          </div>
        `).join('');
      }
    }
  }

  renderHostLeaderboard() {
    const list = document.getElementById('host-leaderboard');
    if (!list) return;

    if (stateStore.players.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.9rem;">بانتظار الانضمام...</div>`;
      return;
    }

    list.innerHTML = stateStore.players.map((p, idx) => `
      <div class="leader-item rank-${idx + 1}">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-weight:900;">#${idx + 1}</span>
          <span style="font-size:1.5rem;">${p.avatar}</span>
          <span>${p.name}</span>
        </div>
        <span class="score">${p.score} XP</span>
      </div>
    `).join('');
  }

  renderLogs() {
    const logBox = document.getElementById('host-game-log');
    if (!logBox) return;
    logBox.innerHTML = stateStore.logs.map(l => `<div class="log-item">${l}</div>`).join('');
  }

  submitFinalAccusation() {
    const culprit = mysteryEngine.selectedCulprit || 'scientist';
    const motiveSelect = document.getElementById('mobile-motive-select');
    const motive = motiveSelect ? motiveSelect.value : 'timeline';

    const pId = stateStore.getSelfId();
    const p = stateStore.players.find(x => x.id === pId);

    stateStore.broadcast('SUBMIT_ACCUSATION', {
      playerId: pId,
      playerName: p ? p.name : 'لاعب',
      culprit,
      motive
    });

    alert('تم تسليم الاتهام بنجاح! انتظر إعلان النتائج على شاشة التلفزيون.');
  }
}

const app = new NovaApp();

// Auto init on window load
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

