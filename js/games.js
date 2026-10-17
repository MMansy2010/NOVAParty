/* ==========================================================================
   NOVA PARTY — MINI GAMES ENGINE & IMPLEMENTATIONS
   Contains modular Game Engine & 5 Tailored Mini Games (Ages 10-13)
   ========================================================================== */

class GameEngine {
  constructor() {
    this.games = [];
    this.activeGame = null;
    this.timerId = null;
    this.answersMap = {}; // { playerId: answerData }
  }

  registerGame(gameInstance) {
    this.games.push(gameInstance);
  }

  getGameList() {
    return this.games;
  }

  startRound(gameIndex, hostContainer, mobileContainer, roundData) {
    if (this.timerId) clearInterval(this.timerId);
    this.answersMap = {};
    stateStore.clearRoundState();

    this.activeGame = this.games[gameIndex % this.games.length];
    audioEngine.playGo();

    const titleEl = document.getElementById('host-game-title');
    const roundInd = document.getElementById('host-round-indicator');
    if (titleEl) titleEl.textContent = this.activeGame.name;
    if (roundInd) roundInd.textContent = `الجولة ${stateStore.currentRound} / ${stateStore.totalRounds}`;

    stateStore.addLog(`🎮 بدأت جولة [${stateStore.currentRound}]: ${this.activeGame.name}`);
    
    const hostStage = hostContainer || document.getElementById('host-game-canvas');
    const mobStage = mobileContainer || document.getElementById('mobile-game-controller');
    
    let rData = roundData;
    if (!rData && this.activeGame.prepareRoundData) {
      rData = this.activeGame.prepareRoundData();
    }
    stateStore.currentRoundData = rData;

    if (this.activeGame.initRound) {
      this.activeGame.initRound(hostStage, mobStage, rData);
    }

    let timeLeft = this.activeGame.duration || 15;
    this.updateTimers(timeLeft);

    this.timerId = setInterval(() => {
      if (stateStore.isTimerPaused) return;

      timeLeft--;
      this.updateTimers(timeLeft);
      audioEngine.playTick();

      if (this.activeGame.onTick) {
        this.activeGame.onTick(timeLeft, hostStage, mobStage);
      }

      if (timeLeft <= 0) {
        clearInterval(this.timerId);
        this.finishRound(hostStage, mobStage);
      }
    }, 1000);
  }

  updateTimers(sec) {
    stateStore.timer = sec;
    const hostTimer = document.getElementById('host-timer-val');
    const mobileTimer = document.getElementById('mobile-timer-display');
    if (hostTimer) hostTimer.textContent = sec;
    if (mobileTimer) mobileTimer.textContent = `⏱️ ${sec}s`;
  }

  handlePlayerAnswer(playerId, data) {
    if (!this.activeGame) return;
    this.answersMap[playerId] = data;
    
    audioEngine.playTap();
    stateStore.submitPlayerAnswer(playerId, data);

    if (this.activeGame.onAnswerReceived) {
      this.activeGame.onAnswerReceived(playerId, data);
    }

    // Check if all players answered
    const totalPlayers = stateStore.players.length;
    const answeredCount = Object.keys(this.answersMap).length;
    if (totalPlayers > 0 && answeredCount >= totalPlayers) {
      stateStore.addLog("⚡ أجاب جميع اللاعبين! إنهاء الجولة فورا...");
      if (this.timerId) clearInterval(this.timerId);
      const hostStage = document.getElementById('host-game-canvas');
      const mobStage = document.getElementById('mobile-game-controller');
      this.finishRound(hostStage, mobStage);
    }
  }

  setupMobileController(gameIndex, mobileContainer, roundData) {
    const gameIdx = gameIndex !== undefined ? gameIndex : stateStore.activeGameIndex;
    this.activeGame = this.games[gameIdx % this.games.length];
    
    const mobStage = mobileContainer || document.getElementById('mobile-game-controller');
    if (!mobStage) return;

    // Create virtual dummy host container if not rendering on host tab
    const dummyHost = document.createElement('div');
    const rData = roundData || stateStore.currentRoundData;
    if (this.activeGame && this.activeGame.initRound) {
      this.activeGame.initRound(dummyHost, mobStage, rData);
    }
  }

  finishRound(hostContainer, mobileContainer) {
    if (this.timerId) clearInterval(this.timerId);
    audioEngine.playVictoryFanfare();

    if (this.activeGame && this.activeGame.calculateScores) {
      this.activeGame.calculateScores(this.answersMap);
    }

    // Broadcast round completion to all player devices
    stateStore.broadcast('ROUND_FINISHED', {
      gameIndex: stateStore.activeGameIndex,
      currentRound: stateStore.currentRound
    });

    // Trigger Mystery mode evidence unlock if active
    if (stateStore.gameMode === 'mystery') {
      mysteryEngine.onRoundComplete(this.answersMap);
    }

    const hostStage = hostContainer || document.getElementById('host-stage-game');
    const mobStage = mobileContainer || document.getElementById('mobile-game-controller');

    if (this.activeGame && this.activeGame.showRoundSummary) {
      this.activeGame.showRoundSummary(hostStage, mobStage);
    }

    // Add Host Controls to summary box
    if (hostStage) {
      const summaryControls = document.createElement('div');
      summaryControls.style.cssText = 'text-align: center; margin-top: 25px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;';
      
      const isLastRound = stateStore.currentRound >= stateStore.totalRounds;
      summaryControls.innerHTML = `
        ${isLastRound ? `
          <button class="btn gold-btn giant-btn" onclick="app.showFinalResults()">🏆 عرض النتائج النهائية والتتويج!</button>
        ` : `
          <button class="btn primary-btn giant-btn" onclick="app.nextRound()">➡️ الجولة التالية (الجولة ${stateStore.currentRound + 1})</button>
        `}
        <button class="btn secondary-btn" onclick="app.showHostStage('lobby')">🏠 اللوبي</button>
      `;
      hostStage.appendChild(summaryControls);
    }
  }
}

const gameEngine = new GameEngine();

/* --------------------------------------------------------------------------
   1. ⚡ TAP REACTION GAME
   -------------------------------------------------------------------------- */
class ReactionGame {
  constructor() {
    this.name = "⚡ 1. TAP REACTION — سرعة الاستجابة";
    this.duration = 10;
    this.startTime = 0;
    this.isReady = false;
  }

  prepareRoundData() {
    const randomDelay = Math.floor(Math.random() * 2500) + 2000;
    return { startDelay: randomDelay };
  }

  initRound(host, mobile, roundData) {
    this.isReady = false;
    const delay = (roundData && roundData.startDelay) ? roundData.startDelay : 2500;

    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h1 id="react-status" style="font-size:3.2rem; color:var(--gold);">استعد... (WAIT!) 🔴</h1>
          <p style="font-size:1.3rem; color:var(--text-muted); margin-top:15px;">لا تضغط حتى تظهر الإشارة الخضراء (TAP)!</p>
        </div>
      `;
    }

    if (mobile) {
      mobile.innerHTML = `
        <div style="text-align:center; padding:15px 5px;">
          <h2 id="mob-react-title" style="color:var(--gold); font-size:1.6rem; margin-bottom:8px;">استعد... 🔴</h2>
          <p id="mob-react-sub" style="margin-bottom:18px; font-size:0.95rem; color:var(--text-muted);">انتظر الإشارة الخضراء ثم اضغط بسرعة!</p>
          <button id="tap-btn" class="tap-giant-btn giant-btn" style="background:#ef4444; color:white; width:100%; height:180px; font-size:1.8rem; border-radius:24px; box-shadow:0 8px 30px rgba(239,68,68,0.4);">انتظر 🔴</button>
        </div>
      `;
    }

    setTimeout(() => {
      this.isReady = true;
      this.startTime = Date.now();
      audioEngine.playGo();

      const reactStatus = document.getElementById('react-status');
      if (reactStatus) {
        reactStatus.textContent = "🟢 اضغط الآن بسرعة!! (TAP NOW!)";
        reactStatus.style.color = "var(--accent)";
      }

      const mobTitle = document.getElementById('mob-react-title');
      if (mobTitle) {
        mobTitle.textContent = "🟢 اضغط الآن بسرعة!!";
        mobTitle.style.color = "var(--accent)";
      }

      const tapBtn = document.getElementById('tap-btn');
      if (tapBtn) {
        tapBtn.style.background = "var(--accent)";
        tapBtn.style.boxShadow = "0 8px 30px rgba(16,185,129,0.5)";
        tapBtn.textContent = "اضغط بسرعة! 🟢";
      }
    }, delay);

    const btn = document.getElementById('tap-btn');
    if (btn) {
      btn.onclick = () => {
        if (!this.isReady) {
          audioEngine.playError();
          gameEngine.handlePlayerAnswer(stateStore.getSelfId(), { ms: 9999, summary: "انطلاقة خاطئة! ❌" });
          btn.disabled = true;
          btn.textContent = "انطلاقة مبكرة! ❌";
        } else {
          const ms = Date.now() - this.startTime;
          gameEngine.handlePlayerAnswer(stateStore.getSelfId(), { ms, summary: `${ms} ms ⚡` });
          btn.disabled = true;
          btn.textContent = `تم! (${ms} ms)`;
        }
      };
    }
  }

  calculateScores(answers) {
    let sorted = Object.entries(answers)
      .map(([pid, val]) => ({ pid, ms: val.ms }))
      .sort((a, b) => a.ms - b.ms);

    sorted.forEach((item, index) => {
      if (item.ms < 9999) {
        const points = Math.max(50, 300 - index * 70);
        stateStore.updatePlayerScore(item.pid, points);
      }
    });
  }

  showRoundSummary(host, mobile) {
    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h2 style="font-size:2.2rem; color:var(--accent);">⚡ أسرع سرعة استجابة!</h2>
          <p style="margin-top:15px; font-size:1.3rem;">تم حساب الفروق بالميللي ثانية بنجاح.</p>
        </div>
      `;
    }
  }
}

/* --------------------------------------------------------------------------
   2. 📖 SEERAH & ISLAMIC TRIVIA (Ages 10-13)
   -------------------------------------------------------------------------- */
class SeerahQuizGame {
  constructor() {
    this.name = "📖 2. SEERAH QUIZ — السيرة والتحدي الإسلامي";
    this.duration = 15;
    this.questions = [
      {
        q: "من هو الملك الموكل بالنفيخ في الصور يوم القيامة؟ 🎺",
        ans: "إسرافيل عليه السلام",
        options: ["إسرافيل عليه السلام", "جبريل عليه السلام", "ميكائيل عليه السلام", "ملك الموت"]
      },
      {
        q: "ما هي أول معركة فاصلة في الإسلام بين المسلمين والمشركين؟ ⚔️",
        ans: "غزوة بدر الكبرى",
        options: ["غزوة بدر الكبرى", "غزوة أحد", "غزوة الخندق", "غزوة حنين"]
      },
      {
        q: "من الصحابي الملقب بـ (سيف الله المسلول)؟ 🗡️",
        ans: "خالد بن الوليد رضي الله عنه",
        options: ["خالد بن الوليد رضي الله عنه", "علي بن أبي طالب رضي الله عنه", "حمزة بن عبد المطلب رضي الله عنه", "عمر بن الخطاب رضي الله عنه"]
      },
      {
        q: "من هو الصحابي الوحيد الذي ذُكر اسمه صراحةً في القرآن الكريم؟ 📖",
        ans: "زيد بن حارثة رضي الله عنه",
        options: ["زيد بن حارثة رضي الله عنه", "أبو بكر الصديق رضي الله عنه", "عثمان بن عفان رضي الله عنه", "سعد بن أبي وقاص رضي الله عنه"]
      },
      {
        q: "كم عدد سور القرآن الكريم؟ 📗",
        ans: "114 سورة",
        options: ["114 سورة", "110 سورة", "120 سورة", "100 سورة"]
      }
    ];
    this.currentQ = null;
  }

  prepareRoundData() {
    const idx = Math.floor(Math.random() * this.questions.length);
    return { questionIndex: idx };
  }

  initRound(host, mobile, roundData) {
    const idx = (roundData && roundData.questionIndex !== undefined) 
      ? roundData.questionIndex 
      : Math.floor(Math.random() * this.questions.length);
    this.currentQ = this.questions[idx % this.questions.length];

    if (host) {
      host.innerHTML = `
        <div style="text-align:center; padding:10px;">
          <h3 style="font-size:1.5rem; color:var(--text-muted);">سؤال ذكاء ومعرفة للأبطال:</h3>
          <h1 style="font-size:2.5rem; color:var(--gold); margin:20px 0;">${this.currentQ.q}</h1>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; max-width:600px; margin:20px auto;">
            ${this.currentQ.options.map(opt => `
              <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:14px; font-size:1.3rem; font-weight:bold; color:white;">${opt}</div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (mobile) {
      mobile.innerHTML = `
        <div style="text-align:center; width:100%; padding:10px 5px;">
          <h4 style="color:var(--text-muted); font-size:0.9rem;">اختر الإجابة الصحيحة: 📖</h4>
          <h2 style="color:var(--gold); font-size:1.3rem; margin:15px 0; line-height:1.4;">${this.currentQ.q}</h2>
          <div class="grid-buttons" style="display:grid; grid-template-columns:1fr; gap:10px; margin-top:15px;">
            ${this.currentQ.options.map(opt => `
              <button class="grid-opt-btn" onclick="SeerahQuizGame.submit('${opt.replace(/'/g, "\\'")}')" style="font-size:1.05rem; padding:14px; font-weight:bold; text-align:center;">${opt}</button>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  static submit(val) {
    gameEngine.handlePlayerAnswer(stateStore.getSelfId(), { val, summary: val });
  }

  calculateScores(answers) {
    Object.entries(answers).forEach(([pid, data]) => {
      if (this.currentQ && data.val === this.currentQ.ans) {
        stateStore.updatePlayerScore(pid, 300);
      }
    });
  }

  showRoundSummary(host) {
    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h2>الإجابة الصحيحة هي: <br/><span style="font-size:2.4rem; color:var(--accent); display:inline-block; margin-top:12px;">${this.currentQ ? this.currentQ.ans : ''}</span></h2>
        </div>
      `;
    }
  }
}

/* --------------------------------------------------------------------------
   3. 💪 PHYSICAL & MOTION CHALLENGE (Host Score Award)
   -------------------------------------------------------------------------- */
class PhysicalChallengeGame {
  constructor() {
    this.name = "💪 3. PHYSICAL CHALLENGE — تحدي الحركات والرشاقة";
    this.duration = 25;
    this.challenges = [
      { text: "اعمل 5 نطات 🏃 + 5 ضغط 💪 بأسرع ما يمكن واصرخ 'أنا خلصت!'", icon: "🤸" },
      { text: "الجري في المكان 10 ثوانٍ 🏃‍♂️ ثم الوقوف على رجل واحدة 🦵!", icon: "🔥" },
      { text: "اعمل 5 قفزات عالية في الهواء 🚀 وسجل وصولك عند الهوست!", icon: "⭐" }
    ];
    this.activeChallenge = null;
  }

  prepareRoundData() {
    const idx = Math.floor(Math.random() * this.challenges.length);
    return { challengeIndex: idx };
  }

  initRound(host, mobile, roundData) {
    const idx = (roundData && roundData.challengeIndex !== undefined) 
      ? roundData.challengeIndex 
      : Math.floor(Math.random() * this.challenges.length);
    this.activeChallenge = this.challenges[idx % this.challenges.length];
    if (stateStore) stateStore.activeChallenge = this.activeChallenge;

    if (host) {
      host.innerHTML = `
        <div style="text-align:center; padding:10px;">
          <h1 style="font-size:2.8rem; color:var(--gold); margin-bottom:15px;">${this.activeChallenge.icon} تحدي الحركات المباشر!</h1>
          <h2 style="font-size:1.8rem; color:white; margin-bottom:20px; line-height:1.5;">${this.activeChallenge.text}</h2>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; max-width:850px; margin:0 auto; text-align:right;">
            <!-- Live Finishers Feed -->
            <div class="glass-panel" style="padding:15px; border-color:var(--accent);">
              <h3 style="color:var(--accent); font-size:1.1rem; margin-bottom:10px;">⚡ ترتيب الواصلين أولاً (Live):</h3>
              <div id="host-physical-finishers" style="display:flex; flex-direction:column; gap:8px;">
                <p id="host-no-finishers" style="color:var(--text-muted); font-size:0.9rem;">بانتظار وصول أول لاعب... انطلقوا! 🏃💨</p>
              </div>
            </div>

            <!-- Manual Award Controls for Host -->
            <div class="glass-panel" style="padding:15px;">
              <h3 style="color:var(--gold); font-size:1.1rem; margin-bottom:10px;">🎮 منح نقاط إضافية مباشرة من الهوست:</h3>
              <div id="host-physical-scores" style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto;">
                ${stateStore.players.map(p => `
                  <div style="background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:1rem;">${p.avatar || '🎮'} ${p.name}</span>
                    <div style="display:flex; gap:6px;">
                      <button class="btn gold-btn primary-sm" onclick="PhysicalChallengeGame.award('${p.id}', 300)" style="padding:4px 8px; font-size:0.8rem;">🥇 +300</button>
                      <button class="btn primary-btn primary-sm" onclick="PhysicalChallengeGame.award('${p.id}', 200)" style="padding:4px 8px; font-size:0.8rem;">🥈 +200</button>
                      <button class="btn secondary-btn secondary-sm" onclick="PhysicalChallengeGame.award('${p.id}', 100)" style="padding:4px 8px; font-size:0.8rem;">🥉 +100</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (mobile) {
      mobile.innerHTML = `
        <div style="text-align:center; padding:15px 5px;">
          <div style="font-size:3.5rem; margin-bottom:10px;">${this.activeChallenge.icon}</div>
          <h2 style="color:var(--gold); font-size:1.4rem; margin-bottom:15px; line-height:1.4;">${this.activeChallenge.text}</h2>
          <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:20px;">انطلق فوراً! وعندما تنتهي، اضغط الزر أدناه لتسجيل وصولك عند الهوست فوراً!</p>
          <button id="phys-done-btn" class="btn gold-btn giant-btn" onclick="PhysicalChallengeGame.finishPhysical()" style="width:100%; height:80px; font-size:1.5rem; border-radius:20px;">خلصت التحدي! ✋🔥</button>
        </div>
      `;
    }
  }

  static finishPhysical() {
    audioEngine.playVictoryFanfare();
    const finishTime = Date.now();
    gameEngine.handlePlayerAnswer(stateStore.getSelfId(), { 
      summary: "أنهى التحدي البدني! ✋",
      finishTime: finishTime
    });
    const btn = document.getElementById('phys-done-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "تم إرسال إشعار الانتهاء! 🎯";
      btn.style.opacity = "0.7";
    }
  }

  onAnswerReceived(playerId, data) {
    const p = stateStore.players.find(x => x.id === playerId);
    const container = document.getElementById('host-physical-finishers');
    const noFinish = document.getElementById('host-no-finishers');
    if (noFinish) noFinish.style.display = 'none';

    if (container && p) {
      const currentCount = container.querySelectorAll('.finisher-entry').length + 1;
      const medal = currentCount === 1 ? '🥇' : (currentCount === 2 ? '🥈' : (currentCount === 3 ? '🥉' : '🎖️'));
      const entry = document.createElement('div');
      entry.className = 'finisher-entry animate-pop';
      entry.style.cssText = 'background:rgba(16,185,129,0.18); border:1px solid var(--accent); padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;';
      entry.innerHTML = `
        <span>${medal} #${currentCount} ${p.avatar} ${p.name}</span>
        <strong style="color:var(--accent);">تم بنجاح! ⚡</strong>
      `;
      container.appendChild(entry);
    }
  }

  static award(pid, points) {
    audioEngine.playGoldCoins();
    stateStore.updatePlayerScore(pid, points);
    const p = stateStore.players.find(x => x.id === pid);
    stateStore.addLog(`🏆 أعطى الهوست ${points} نقطة للاعب ${p ? p.name : pid}!`);
  }

  calculateScores(answers) {
    // Automatically rank all who pressed finish
    const submissions = Object.entries(answers)
      .map(([pid, data]) => ({ pid, finishTime: data.finishTime || 0 }))
      .sort((a, b) => a.finishTime - b.finishTime);

    submissions.forEach((item, index) => {
      let points = 50;
      if (index === 0) points = 300;
      else if (index === 1) points = 200;
      else if (index === 2) points = 100;
      stateStore.updatePlayerScore(item.pid, points);
    });
  }

  showRoundSummary(host) {
    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h2 style="font-size:2.2rem; color:var(--gold);">💪 انتهى تحدي اللياقة والنشاط!</h2>
          <p style="font-size:1.2rem; margin-top:10px; color:var(--text-main);">تم توزيع نقاط XP للمراكز الأولى بحسب سرعة الإنجاز وتقييم الهوست.</p>
        </div>
      `;
    }
  }
}

/* --------------------------------------------------------------------------
   4. 🧠 MEMORY MATRIX GAME
   -------------------------------------------------------------------------- */
class MemoryGame {
  constructor() {
    this.name = "🧠 4. MEMORY MATRIX — قوة الذاكرة والرمز المفقود";
    this.duration = 12;
    this.items = ['🚀', '🏰', '🛡️', '⚔️', '👑', '⛵'];
    this.missingItem = '';
  }

  prepareRoundData() {
    const shuffled = [...this.items].sort(() => 0.5 - Math.random());
    const missing = shuffled.pop();
    return { shownItems: shuffled, missingItem: missing };
  }

  initRound(host, mobile, roundData) {
    let shuffled = [];
    if (roundData && roundData.shownItems) {
      shuffled = roundData.shownItems;
      this.missingItem = roundData.missingItem;
    } else {
      const arr = [...this.items].sort(() => 0.5 - Math.random());
      this.missingItem = arr.pop();
      shuffled = arr;
    }

    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h2 style="font-size:2rem; color:var(--gold);">احفظ الرموز التالية جيداً! 🧠</h2>
          <div id="memory-items" style="font-size:4rem; margin:30px 0; display:flex; gap:20px; justify-content:center; flex-wrap:wrap;">
            ${shuffled.map(x => `<span>${x}</span>`).join('')}
          </div>
          <p id="memory-sub" style="font-size:1.2rem; color:var(--text-muted);">تختفي الرموز بعد 3 ثوان...</p>
        </div>
      `;
    }

    if (mobile) {
      mobile.innerHTML = `
        <div style="text-align:center; padding:15px 5px;">
          <h3 style="color:var(--gold); font-size:1.3rem;">احفظ الرموز التالية جيداً! 🧠</h3>
          <div id="mob-memory-items" style="font-size:3.2rem; margin:20px 0; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
            ${shuffled.map(x => `<span>${x}</span>`).join('')}
          </div>
          <p id="mob-memory-sub" style="font-size:0.95rem; color:var(--text-muted);">تختفي الرموز بعد 3 ثوان...</p>
        </div>
      `;
    }

    setTimeout(() => {
      const itemsDiv = document.getElementById('memory-items');
      const sub = document.getElementById('memory-sub');
      if (itemsDiv) itemsDiv.innerHTML = '❓ ❓ ❓ ❓ ❓';
      if (sub) sub.textContent = 'ما هو الرمز المفقود من المجموعة؟';

      const mobItems = document.getElementById('mob-memory-items');
      const mobSub = document.getElementById('mob-memory-sub');
      if (mobItems) mobItems.innerHTML = '❓ ❓ ❓ ❓ ❓';
      if (mobSub) mobSub.textContent = 'اختر الرمز المفقود الآن!';

      if (mobile) {
        mobile.innerHTML = `
          <div style="text-align:center; padding:10px 5px;">
            <h3 style="margin-bottom:15px; color:var(--accent); font-size:1.2rem;">اختر الرمز المفقود من المجموعة: ❓</h3>
            <div class="grid-buttons" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              ${this.items.map(item => `
                <button class="grid-opt-btn" onclick="MemoryGame.submit('${item}')" style="font-size:2.2rem; padding:16px;">${item}</button>
              `).join('')}
            </div>
          </div>
        `;
      }
    }, 3000);
  }

  static submit(item) {
    gameEngine.handlePlayerAnswer(stateStore.getSelfId(), { item, summary: item });
  }

  calculateScores(answers) {
    Object.entries(answers).forEach(([pid, val]) => {
      if (val.item === this.missingItem) {
        stateStore.updatePlayerScore(pid, 250);
      }
    });
  }

  showRoundSummary(host) {
    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h2>الرمز المفقود كان: <span style="font-size:3.5rem;">${this.missingItem}</span></h2>
        </div>
      `;
    }
  }
}

/* --------------------------------------------------------------------------
   5. 🎨 DRAW & GUESS GAME
   -------------------------------------------------------------------------- */
class DrawGuessGame {
  constructor() {
    this.name = "🎨 5. DRAW & GUESS — الرسم والتخمين الإبداعي";
    this.duration = 25;
    this.words = ["سفينة 🚢", "فيل 🐘", "قلعة 🏰", "صاروخ 🚀", "سيارة 🚗", "تاج 👑", "شمس ☀️", "بيت 🏠"];
    this.targetWord = "";
    this.currentColor = '#000000';
    this.currentBrushSize = 4;
  }

  prepareRoundData() {
    const word = this.words[Math.floor(Math.random() * this.words.length)];
    return { targetWord: word };
  }

  initRound(host, mobile, roundData) {
    if (roundData && roundData.targetWord) {
      this.targetWord = roundData.targetWord;
    } else if (stateStore && stateStore.targetWord) {
      this.targetWord = stateStore.targetWord;
    } else {
      this.targetWord = this.words[Math.floor(Math.random() * this.words.length)];
    }
    if (stateStore) stateStore.targetWord = this.targetWord;
    this.currentColor = '#000000';
    this.currentBrushSize = 4;

    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h3 style="font-size:1.5rem; color:var(--gold);">الرسمة المطلوبة: <span style="color:var(--accent); font-size:1.8rem;">${this.targetWord}</span></h3>
          <canvas id="host-draw-view" width="380" height="230" style="background:white; border-radius:16px; margin:15px 0; border:3px solid var(--gold); box-shadow:0 8px 30px rgba(0,0,0,0.5);"></canvas>
          <p style="font-size:0.9rem; color:var(--text-muted);">رسمة اللاعبين تظهر هنا مباشرة عبر الفايربيز 🎨</p>
        </div>
      `;
    }

    if (mobile) {
      mobile.innerHTML = `
        <div style="text-align:center; width:100%; padding:10px 5px;">
          <p style="margin-bottom:10px; font-size:1.1rem;">ارسم الشكل المطلوب: <strong style="color:var(--gold); font-size:1.3rem;">${this.targetWord}</strong></p>
          <canvas id="mobile-draw-canvas" width="300" height="220" style="background:white; border-radius:16px; width:100%; max-width:320px; touch-action:none; border:2px solid var(--gold); cursor:crosshair;"></canvas>
          
          <div style="margin-top:10px; display:flex; justify-content:center; gap:8px; align-items:center;">
            <div onclick="DrawGuessGame.setColor('#000000')" style="width:28px; height:28px; border-radius:50%; background:#000; cursor:pointer; border:2px solid white;"></div>
            <div onclick="DrawGuessGame.setColor('#ef4444')" style="width:28px; height:28px; border-radius:50%; background:#ef4444; cursor:pointer; border:2px solid white;"></div>
            <div onclick="DrawGuessGame.setColor('#3b82f6')" style="width:28px; height:28px; border-radius:50%; background:#3b82f6; cursor:pointer; border:2px solid white;"></div>
            <div onclick="DrawGuessGame.setColor('#10b981')" style="width:28px; height:28px; border-radius:50%; background:#10b981; cursor:pointer; border:2px solid white;"></div>
            <div onclick="DrawGuessGame.setColor('#f59e0b')" style="width:28px; height:28px; border-radius:50%; background:#f59e0b; cursor:pointer; border:2px solid white;"></div>
          </div>

          <div style="margin-top:12px; display:flex; gap:10px; justify-content:center;">
            <button class="btn secondary-btn secondary-sm" onclick="DrawGuessGame.clearCanvas()">مسح 🗑️</button>
            <button id="btn-submit-draw" class="btn primary-btn primary-sm" onclick="DrawGuessGame.submitDraw()">تم الرسم! 🎨</button>
          </div>
        </div>
      `;
      this.setupDrawing();
    }
  }

  static setColor(color) {
    if (window.gameEngine && window.gameEngine.activeGame) {
      window.gameEngine.activeGame.currentColor = color;
    }
  }

  setupDrawing() {
    const canvas = document.getElementById('mobile-draw-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let syncTimeout = null;

    const getCoords = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = (e.touches && e.touches.length > 0) ? e.touches[0] : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : e);
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    };

    const syncToFirebase = () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        stateStore.submitDrawing(stateStore.getSelfId(), dataUrl);
      }, 150);
    };

    const startDraw = (e) => {
      if (e.cancelable) e.preventDefault();
      isDrawing = true;
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const endDraw = (e) => {
      if (e.cancelable) e.preventDefault();
      if (isDrawing) {
        isDrawing = false;
        ctx.beginPath();
        syncToFirebase();
      }
    };

    const draw = (e) => {
      if (e.cancelable) e.preventDefault();
      if (!isDrawing) return;
      const { x, y } = getCoords(e);

      ctx.lineWidth = this.currentBrushSize || 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.currentColor || '#000000';

      ctx.lineTo(x, y);
      ctx.stroke();

      // Mirror directly to host canvas if open in same tab
      const hostCanvas = document.getElementById('host-draw-view');
      if (hostCanvas) {
        const hctx = hostCanvas.getContext('2d');
        hctx.drawImage(canvas, 0, 0, hostCanvas.width, hostCanvas.height);
      }
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('mousemove', draw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });
    canvas.addEventListener('touchcancel', endDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
  }

  static renderRemoteDrawing(drawingPayload) {
    const hostCanvas = document.getElementById('host-draw-view');
    if (!hostCanvas || !drawingPayload) return;
    const hctx = hostCanvas.getContext('2d');
    
    if (!drawingPayload.data) {
      hctx.clearRect(0, 0, hostCanvas.width, hostCanvas.height);
      return;
    }

    const img = new Image();
    img.onload = () => {
      hctx.clearRect(0, 0, hostCanvas.width, hostCanvas.height);
      hctx.drawImage(img, 0, 0, hostCanvas.width, hostCanvas.height);
    };
    img.src = drawingPayload.data;
  }

  static clearCanvas() {
    const canvas = document.getElementById('mobile-draw-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const hostCanvas = document.getElementById('host-draw-view');
    if (hostCanvas) {
      const hctx = hostCanvas.getContext('2d');
      hctx.clearRect(0, 0, hostCanvas.width, hostCanvas.height);
    }
    stateStore.submitDrawing(stateStore.getSelfId(), '');
  }

  static submitDraw() {
    audioEngine.playVictoryFanfare();
    const canvas = document.getElementById('mobile-draw-canvas');
    let dataUrl = '';
    if (canvas) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      stateStore.submitDrawing(stateStore.getSelfId(), dataUrl);
    }
    gameEngine.handlePlayerAnswer(stateStore.getSelfId(), { summary: "أنهى الرسمة! 🎨", drawing: dataUrl });
    const btn = document.getElementById('btn-submit-draw');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "تم إرسال الرسمة بنجاح! 🎨✨";
      btn.style.opacity = "0.7";
    }
  }

  calculateScores(answers) {
    // Award 250 XP to all players who submitted their drawing
    Object.keys(answers).forEach(pid => {
      stateStore.updatePlayerScore(pid, 250);
    });
  }

  showRoundSummary(host) {
    if (host) {
      host.innerHTML = `
        <div style="text-align:center;">
          <h2>الرسمة الإبداعية كانت: <span style="color:var(--accent); font-size:2.2rem;">${this.targetWord}</span></h2>
          ${stateStore.drawingData && stateStore.drawingData.data ? `
            <div style="margin:15px auto; max-width:380px; padding:8px; background:white; border-radius:16px; border:3px solid var(--gold); box-shadow:0 8px 30px rgba(0,0,0,0.4);">
              <img src="${stateStore.drawingData.data}" style="width:100%; height:200px; object-fit:contain; border-radius:10px; display:block;" alt="Drawing" />
            </div>
          ` : ''}
          <p style="color:var(--gold); font-size:1.15rem; margin-top:10px;">حصل جميع الرسامين الذين شاركوا على +250 XP! 🎨⭐</p>
        </div>
      `;
    }
  }
}

// Register all 5 kid-friendly games (ages 10-13) into the engine
gameEngine.registerGame(new ReactionGame());
gameEngine.registerGame(new SeerahQuizGame());
gameEngine.registerGame(new PhysicalChallengeGame());
gameEngine.registerGame(new MemoryGame());
gameEngine.registerGame(new DrawGuessGame());

window.gameEngine = gameEngine;
window.ReactionGame = ReactionGame;
window.SeerahQuizGame = SeerahQuizGame;
window.PhysicalChallengeGame = PhysicalChallengeGame;
window.MemoryGame = MemoryGame;
window.DrawGuessGame = DrawGuessGame;

