/* ==========================================================================
   NOVA PARTY — MYSTERY MODE ENGINE (NOVA: THE CASE)
   Story-driven interactive investigation with secret evidence unlocking
   ========================================================================== */

class MysteryEngine {
  constructor() {
    this.caseData = {
      id: "CASE_001",
      title: "🚨 القضية #001: اختفاء الكأس الذهبية (The Missing Trophy)",
      time: "8:42 PM",
      location: "قاعة الحفلات الرئيسية",
      story: "أثناء حفل التكريم الكبير، انقطعت الأضواء لثوانٍ واختفت الكأس الذهبية المخصصة للبطل من صندوقها المقفل! هناك 4 مشتبه بهم كانوا متواجدين بالقرب من القاعة.",
      suspects: [
        { id: "chef", name: "الطهي (The Chef)", icon: "👨‍🍳", statement: "كنت أجهز العشاء في المطبخ من 8:30 حتى 8:50.", isCulprit: false },
        { id: "hacker", name: "المبرمج (The Hacker)", icon: "🧑‍💻", statement: "كنت أصلح راوتر الشبكة في الصالة الرئيسية.", isCulprit: false },
        { id: "artist", name: "الرسام (The Artist)", icon: "🧑‍🎨", statement: "كنت أرسم اللوحة في الحديقة الخارجية مع الطاهي.", isCulprit: false },
        { id: "scientist", name: "العالم (The Scientist)", icon: "🧑‍🔬", statement: "ادعى أنه كان في المختبر الجانبي طوال الوقت ولم يخرج.", isCulprit: true }
      ],
      evidences: [
        { 
          id: "ev1", 
          title: "📸 تسجيلات كاميرا الممر (CCTV)", 
          desc: "كاميرا الممر رصدت شخصاً يرتدي رداءً أبيض يدخل القاعة الساعة 8:40 PM قبل انقطاع الكهرباء بدقيقتين!",
          unlockedByRound: 1
        },
        { 
          id: "ev2", 
          title: "📄 رسالة نصية مسربة", 
          desc: "رسالة هاتفية: المطبخ كان خالياً تماماً بين 8:35 و 8:45 PM لأن الطاهي كان يوزع حلويات في الحديقة مع الرسام!",
          unlockedByRound: 2
        },
        { 
          id: "ev3", 
          title: "🔍 فحص قفل صندوق الكأس", 
          desc: "بصمات أصابع تحتوي على آثار مواد كيميائية فسفورية من المعمل تم العثور عليها على قفل الصندوق!",
          unlockedByRound: 3
        }
      ]
    };

    this.unlockedEvidences = [];
    this.phase = 'briefing'; // 'briefing', 'investigation', 'discussion', 'accusation', 'reveal'
    this.selectedCulprit = 'scientist';
    this.discTimerId = null;
  }

  getHostContainer() {
    return document.getElementById('host-stage-mystery');
  }

  startMysteryFlow() {
    this.phase = 'briefing';
    this.unlockedEvidences = [];
    stateStore.updateUnlockedEvidences([]);
    audioEngine.playMysteryChime();

    // Broadcast briefing to mobile devices
    stateStore.broadcast('MYSTERY_BRIEFING', {
      caseTitle: this.caseData.title,
      suspects: this.caseData.suspects
    });

    const hostStage = this.getHostContainer();
    if (hostStage) {
      this.renderCaseBoard(hostStage);
    }
  }

  renderCaseBoard(hostContainer) {
    const container = hostContainer || this.getHostContainer();
    if (!container) return;

    const suspectsHtml = this.caseData.suspects.map(s => `
      <div class="suspect-card" style="background:rgba(255,255,255,0.05); padding:16px; border-radius:14px; border:1px solid var(--border-glass); text-align:center;">
        <div style="font-size:3rem; margin-bottom:6px;">${s.icon}</div>
        <h4 style="margin:6px 0; font-size:1.15rem; color:var(--text-main); font-weight:800;">${s.name}</h4>
        <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">${s.statement}</p>
      </div>
    `).join('');

    const evidenceHtml = this.caseData.evidences.map((ev, idx) => {
      const isUnlocked = idx < this.unlockedEvidences.length;
      return `
        <div class="evidence-node animate-pop" style="background:${isUnlocked ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)'}; border:2px solid ${isUnlocked ? 'var(--accent)' : 'var(--border-glass)'}; padding:14px; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="color:${isUnlocked ? 'var(--gold)' : 'var(--text-muted)'}; font-size:1rem;">
              ${isUnlocked ? ev.title : `🔒 الدليل #${idx + 1} (مغلق)`}
            </strong>
            <span style="font-size:0.8rem; padding:2px 8px; border-radius:6px; background:${isUnlocked ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; color:white;">
              ${isUnlocked ? 'تم فك التشفير ✅' : `الجولة ${idx + 1}`}
            </span>
          </div>
          <p style="font-size:0.85rem; color:${isUnlocked ? 'var(--text-main)' : 'var(--text-muted)'}; line-height:1.4;">
            ${isUnlocked ? ev.desc : 'العب جولة التحدي لفتح هذا الدليل السري!'}
          </p>
        </div>
      `;
    }).join('');

    const evidenceCount = this.unlockedEvidences.length;
    let actionBtnHtml = '';

    if (evidenceCount < 3) {
      const nextRoundNum = evidenceCount + 1;
      const gameNames = ["سرعة الاستجابة ⚡", "سؤال السيرة والذكاء 📖", "تحدي الذاكرة 🧠"];
      const nextGameName = gameNames[evidenceCount] || "التحدي";
      actionBtnHtml = `
        <button class="btn primary-btn giant-btn" onclick="mysteryEngine.launchInvestigationRound(${evidenceCount})" style="font-size:1.3rem; padding:16px 32px;">
          🎮 بدء الجولة ${nextRoundNum}: ${nextGameName} (لكشف الدليل #${nextRoundNum})
        </button>
      `;
    } else {
      actionBtnHtml = `
        <button class="btn gold-btn giant-btn" onclick="mysteryEngine.startDiscussionPhase()" style="font-size:1.3rem; padding:16px 32px;">
          🗣️ تم جمع جميع الأدلة! بدء مرحلة المناقشة الجماعية والاتهام (DISCUSSION PHASE) ⚖️
        </button>
      `;
    }

    container.innerHTML = `
      <div class="mystery-board-container" style="width:100%; max-width:1100px; margin:0 auto;">
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="color:var(--gold); font-size:2rem; font-weight:900;">${this.caseData.title}</h2>
          <p style="color:var(--text-muted); font-size:1rem; margin-top:4px;">توقيت الحادثة: ${this.caseData.time} | المكان: ${this.caseData.location}</p>
          <p style="color:var(--text-main); font-size:0.95rem; max-width:800px; margin:8px auto 0; background:rgba(255,255,255,0.04); padding:10px 16px; border-radius:10px;">${this.caseData.story}</p>
        </div>

        <h3 style="color:var(--accent); font-size:1.2rem; margin-bottom:12px;">👥 المشتبه بهم الأربعة وأقوالهم الأولية:</h3>
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:14px; margin-bottom:22px;">
          ${suspectsHtml}
        </div>

        <div class="glass-panel" style="padding:18px; margin-bottom:22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="color:var(--gold); font-size:1.2rem;">📜 شبكة الأدلة الجنائية (${evidenceCount}/3 أدلة):</h3>
            <span style="color:var(--accent); font-weight:bold;">${evidenceCount === 3 ? '🎉 تم اكتشاف جميع الأدلة!' : 'بانتظار فك باقي الأدلة'}</span>
          </div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
            ${evidenceHtml}
          </div>
        </div>

        <div style="text-align:center; margin-top:10px;">
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }

  launchInvestigationRound(roundIndex) {
    this.phase = 'investigation';
    stateStore.activeGameIndex = roundIndex;
    stateStore.currentRound = roundIndex + 1;

    app.showHostStage('game');
    const hostCanvas = document.getElementById('host-game-canvas');
    const mobileController = document.getElementById('mobile-game-controller');

    stateStore.broadcast('ROUND_STARTED', {
      gameIndex: roundIndex,
      currentRound: roundIndex + 1
    });

    gameEngine.startRound(roundIndex, hostCanvas, mobileController);
  }

  onRoundComplete(answersMap) {
    const nextEvidenceIndex = this.unlockedEvidences.length;
    if (nextEvidenceIndex < this.caseData.evidences.length) {
      const newEv = this.caseData.evidences[nextEvidenceIndex];
      this.unlockedEvidences.push(newEv);
      stateStore.updateUnlockedEvidences(this.unlockedEvidences);
      audioEngine.playMysteryChime();
      stateStore.addLog(`🔓 تم كشف دليل جديد: ${newEv.title}!`);
    }

    // Update host summary stage with button to return to case board
    const hostStage = document.getElementById('host-stage-game');
    if (hostStage) {
      const mysteryNav = document.createElement('div');
      mysteryNav.style.cssText = 'text-align:center; margin-top:20px;';
      mysteryNav.innerHTML = `
        <button class="btn accent-btn giant-btn" onclick="mysteryEngine.returnToCaseBoard()">
          🕵️ العودة للوحة الأدلة والتحقيق لمشاهدة الدليل الجديد!
        </button>
      `;
      hostStage.appendChild(mysteryNav);
    }
  }

  returnToCaseBoard() {
    app.showHostStage('mystery');
    this.renderCaseBoard();
  }

  renderMobileEvidenceList() {
    const list = document.getElementById('mobile-evidence-list');
    if (!list) return;
    if (!this.unlockedEvidences || this.unlockedEvidences.length === 0) {
      list.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:15px;">لم يكتشف الفريق أي أدلة سرية بعد... العب جولات التحدي لفك تشفير الأدلة!</p>`;
      return;
    }

    list.innerHTML = this.unlockedEvidences.map(ev => `
      <div class="glass-card" style="padding:12px 14px; margin-bottom:10px; border-right:4px solid var(--gold);">
        <strong style="color:var(--gold); display:block; font-size:1.05rem;">${ev.title}</strong>
        <p style="font-size:0.85rem; color:var(--text-main); margin-top:4px; line-height:1.4;">${ev.desc}</p>
      </div>
    `).join('');
  }

  startDiscussionPhase() {
    this.phase = 'discussion';
    if (this.discTimerId) clearInterval(this.discTimerId);
    audioEngine.playMysteryChime();
    stateStore.addLog("🗣️ بدأت مرحلة المناقشة الحية!");
    stateStore.broadcast('MYSTERY_DISCUSSION_START', {});

    app.showHostStage('mystery');
    const hostStage = this.getHostContainer();
    if (!hostStage) return;

    let timeLeft = 60;
    hostStage.innerHTML = `
      <div style="text-align:center; padding:20px; max-width:950px; margin:0 auto;">
        <h1 style="font-size:2.8rem; color:var(--gold); margin-bottom:10px;">🗣️ مرحلة المناقشة والتحقيق — تناقشوا الآن!</h1>
        <p style="font-size:1.2rem; color:var(--text-main); margin-bottom:20px;">
          راجعوا الأدلة الثلاثة المكشوفة وقارنوها بأقوال المشتبه بهم الأربعة: من الذي يملك الفرصة، الدافع، وتناقضت أقواله مع الأدلة؟
        </p>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:25px; text-align:right;">
          ${this.unlockedEvidences.map(ev => `
            <div style="background:rgba(16,185,129,0.15); border:1px solid var(--accent); padding:12px; border-radius:10px;">
              <strong style="color:var(--gold); display:block; font-size:0.95rem;">${ev.title}</strong>
              <span style="font-size:0.85rem; color:white; line-height:1.4;">${ev.desc}</span>
            </div>
          `).join('')}
        </div>

        <div style="font-size:4.5rem; font-weight:900; color:var(--danger); font-family:var(--font-heading); margin:15px 0;" id="mystery-disc-timer">
          01:00
        </div>

        <button class="btn primary-btn giant-btn" style="margin-top:15px; font-size:1.25rem; padding:15px 30px;" onclick="mysteryEngine.startAccusationPhase()">
          ⚖️ الانتقال للتصويت وتوجيه الاتهام النهائي (ACCUSATION PHASE)
        </button>
      </div>
    `;

    this.discTimerId = setInterval(() => {
      timeLeft--;
      const timerEl = document.getElementById('mystery-disc-timer');
      if (timerEl) {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      audioEngine.playTick();

      if (timeLeft <= 0) {
        clearInterval(this.discTimerId);
        this.startAccusationPhase();
      }
    }, 1000);

    // Update mobile UI
    const mobMystery = document.getElementById('mobile-accusation-panel');
    if (mobMystery) {
      mobMystery.classList.remove('hidden');
      this.renderMobileSuspectSelect();
    }
  }

  startAccusationPhase() {
    if (this.discTimerId) clearInterval(this.discTimerId);
    this.phase = 'accusation';
    audioEngine.playMysteryChime();
    stateStore.addLog("⚖️ بدأت مرحلة توجيه الاتهام النهائي عبر الموبايل!");
    stateStore.broadcast('MYSTERY_ACCUSATION_START', {});

    app.showHostStage('mystery');
    this.renderAccusationTracker();

    // Render mobile suspects select
    this.renderMobileSuspectSelect();
  }

  renderAccusationTracker() {
    const hostStage = this.getHostContainer();
    if (!hostStage) return;

    const total = stateStore.players.length;
    const submittedCount = Object.keys(stateStore.accusations || {}).length;

    hostStage.innerHTML = `
      <div style="text-align:center; padding:20px; max-width:900px; margin:0 auto;">
        <h1 style="font-size:2.8rem; color:var(--gold); margin-bottom:10px;">⚖️ مرحلة تسليم الاتهام النهائي</h1>
        <p style="font-size:1.2rem; color:var(--text-main); margin-bottom:20px;">
          كل لاعب يختار الجاني وسبب الاتهام في شاشة هاتفه الآن!
        </p>

        <div style="font-size:1.3rem; color:var(--accent); margin-bottom:20px; font-weight:bold;">
          تم استلام اتهامات (${submittedCount} / ${total}) لاعبين
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; margin-bottom:30px;">
          ${stateStore.players.map(p => {
            const hasAccused = !!(stateStore.accusations && stateStore.accusations[p.id]);
            return `
              <div style="background:${hasAccused ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${hasAccused ? 'var(--accent)' : 'var(--border-glass)'}; padding:14px; border-radius:12px; display:flex; align-items:center; justify-content:space-between;">
                <span style="font-weight:bold; font-size:1.1rem;">${p.avatar} ${p.name}</span>
                <span style="font-size:0.9rem; color:${hasAccused ? 'var(--accent)' : 'var(--gold)'}; font-weight:bold;">
                  ${hasAccused ? 'تم التسليم 🔒' : 'يفكر... ⏳'}
                </span>
              </div>
            `;
          }).join('')}
        </div>

        <button class="btn gold-btn giant-btn" style="font-size:1.3rem; padding:16px 36px;" onclick="mysteryEngine.triggerFinalAccusation()">
          🔍 كشف الجاني الحقيقي وتتويج المحققين العباقرة! 🏆
        </button>
      </div>
    `;
  }

  renderMobileSuspectSelect() {
    const grid = document.getElementById('mobile-suspects-select');
    if (!grid) return;
    grid.innerHTML = this.caseData.suspects.map(s => `
      <div class="grid-opt-btn" onclick="mysteryEngine.selectSuspect('${s.id}', this)" style="text-align:center; padding:12px; border:2px solid var(--border-glass); cursor:pointer; border-radius:12px; transition:0.2s;">
        <span style="font-size:2.2rem; display:block; margin-bottom:4px;">${s.icon}</span>
        <span style="font-size:1rem; font-weight:bold;">${s.name}</span>
      </div>
    `).join('');
    this.selectedCulprit = 'scientist';
  }

  selectSuspect(id, element) {
    document.querySelectorAll('#mobile-suspects-select .grid-opt-btn').forEach(b => {
      b.style.borderColor = 'var(--border-glass)';
      b.style.background = 'rgba(255,255,255,0.08)';
    });
    element.style.borderColor = 'var(--danger)';
    element.style.background = 'rgba(239,68,68,0.2)';
    this.selectedCulprit = id;
    audioEngine.playTap();
  }

  triggerFinalAccusation() {
    this.phase = 'reveal';
    if (this.discTimerId) clearInterval(this.discTimerId);
    audioEngine.playVictoryFanfare();
    stateStore.broadcast('MYSTERY_REVEAL_START', {});

    const correctDetectives = [];
    const wrongDetectives = [];

    // Score calculations: +500 XP for correct accusation of the scientist
    stateStore.players.forEach(p => {
      const acc = stateStore.accusations ? stateStore.accusations[p.id] : null;
      if (acc && acc.culprit === 'scientist') {
        stateStore.updatePlayerScore(p.id, 500);
        correctDetectives.push(p);
      } else {
        wrongDetectives.push({ player: p, accusation: acc });
      }
    });

    app.showHostStage('mystery');
    const hostStage = this.getHostContainer();
    if (hostStage) {
      hostStage.innerHTML = `
        <div style="text-align:center; padding:20px; animation:popIn 0.5s ease-out; max-width:950px; margin:0 auto;">
          <h1 style="font-size:3.2rem; color:var(--accent); font-weight:900;">🔍 كشف الجاني الحقيقي!</h1>
          <div style="font-size:5.5rem; margin:10px 0;">🧑‍🔬</div>
          <h2 style="font-size:2.4rem; color:var(--danger); margin-bottom:12px;">الجاني الحقيقي هو: العالم (The Scientist)!</h2>
          
          <div class="glass-panel" style="padding:16px 20px; text-align:right; max-width:850px; margin:0 auto 20px; border-color:var(--gold);">
            <h3 style="color:var(--gold); font-size:1.15rem; margin-bottom:8px;">💡 الدليل القاطع والحل الرياضي للقضية:</h3>
            <p style="font-size:1rem; color:var(--text-main); line-height:1.6;">
              1. العالم ادعى أنه كان في المختبر الجانبي طوال الوقت ولم يخرج أبداً.<br/>
              2. كاميرا CCTV أثبتت دخول شخص يرتدي رداءً أبيض (معطف المختبر) للقاعة الساعة 8:40 PM!<br/>
              3. الدليل الحاسم: قفل صندوق الكأس وجدت عليه آثار مواد كيميائية فسفورية تطابق معمل العالم تماماً!<br/>
              4. الطاهي والرسام كانا معاً في الحديقة (الرسالة المسربة)، والمبرمج كان في الصالة، إذاً العالم هو السارق الوحيد!
            </p>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; max-width:850px; margin:0 auto 25px; text-align:right;">
            <div class="glass-panel" style="padding:16px; border-color:var(--accent);">
              <h3 style="color:var(--accent); font-size:1.15rem; margin-bottom:10px;">🥇 المحققون العباقرة (+500 XP):</h3>
              ${correctDetectives.length > 0 ? correctDetectives.map(p => `
                <div style="padding:8px 12px; background:rgba(16,185,129,0.18); border-radius:8px; margin-bottom:6px; font-weight:bold; color:white; display:flex; justify-content:space-between;">
                  <span>${p.avatar} ${p.name}</span>
                  <strong style="color:var(--gold);">⭐ +500 XP</strong>
                </div>
              `).join('') : '<p style="color:var(--text-muted); font-size:0.95rem;">لم يتمكن أحد من كشف الجاني الحقيقي!</p>'}
            </div>

            <div class="glass-panel" style="padding:16px; border-color:var(--danger);">
              <h3 style="color:var(--danger); font-size:1.15rem; margin-bottom:10px;">❌ اتهامات جانبية:</h3>
              ${wrongDetectives.length > 0 ? wrongDetectives.map(item => {
                const cId = item.accusation ? item.accusation.culprit : null;
                const sObj = this.caseData.suspects.find(s => s.id === cId);
                const sName = sObj ? sObj.name : 'لم يقدم اتهاماً';
                return `
                  <div style="padding:8px 12px; background:rgba(239,68,68,0.15); border-radius:8px; margin-bottom:6px; font-size:0.9rem; color:var(--text-main); display:flex; justify-content:space-between;">
                    <span>${item.player.avatar} ${item.player.name}</span>
                    <span style="color:var(--text-muted);">اتهم: ${sName}</span>
                  </div>
                `;
              }).join('') : '<p style="color:var(--accent);">الجميع نجح في حل القضية!</p>'}
            </div>
          </div>

          <button class="btn gold-btn giant-btn" style="font-size:1.3rem; padding:16px 36px;" onclick="app.showFinalResults()">
            🏆 عرض قائمة المتصدرين والتتويج النهائي!
          </button>
        </div>
      `;
    }
  }
}

const mysteryEngine = new MysteryEngine();
window.mysteryEngine = mysteryEngine;
