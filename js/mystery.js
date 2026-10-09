/* ==========================================================================
   NOVA PARTY — MYSTERY MODE ENGINE (NOVA: THE CASE)
   Story-driven interactive investigation with secret evidence unlocking
   ========================================================================== */

class MysteryEngine {
  constructor() {
    this.caseData = {
      id: "CASE_001",
      title: "🚨 CASE #001: THE MISSING TROPHY — اختفاء الكأس الذهبية",
      time: "8:42 PM",
      location: "قاعة الحفلات الرئيسية",
      suspects: [
        { id: "chef", name: "الطهي (The Chef)", icon: "👨‍🍳", statement: "كنت أجهز العشاء في المطبخ من 8:30 حتى 8:50.", isCulprit: false },
        { id: "hacker", name: "المبرمج (The Hacker)", icon: "🧑‍💻", statement: "كنت أصلح راوتر الشبكة في الصالة.", isCulprit: false },
        { id: "artist", name: "الرسام (The Artist)", icon: "🧑‍🎨", statement: "كنت أرسم اللوحة في الحديقة الخارجية.", isCulprit: false },
        { id: "scientist", name: "العالم (The Scientist)", icon: "🧑‍🔬", statement: "ادعى أنه كان في المختبر الجانبي طوال الوقت ولم يخرج.", isCulprit: true }
      ],
      evidences: [
        { id: "ev1", title: "📸 تسجيلات CCTV", desc: "كاميرا الممر سجلت شخصاً برداء أبيض يدخل القاعة الساعة 8:40 PM!", targetPlayer: 0 },
        { id: "ev2", title: "📄 رسالة سرية مكسورة", desc: "رسالة نصية: المطبخ كان خالياً تماماً بين 8:35 و 8:45 PM!", targetPlayer: 1 },
        { id: "ev3", title: "🔍 بصمات على القفل", desc: "بصمات أصابع تحتوي على آثار مواد كيميائية من المعمل على صندوق الكأس!", targetPlayer: 2 }
      ]
    };

    this.unlockedEvidences = [];
    this.phase = 'investigation'; // 'investigation', 'discussion', 'accusation', 'reveal'
  }

  renderCaseBoard(hostContainer) {
    const suspectsHtml = this.caseData.suspects.map(s => `
      <div class="suspect-card ${s.id === 'scientist' ? '' : ''}">
        <div style="font-size:2.5rem;">${s.icon}</div>
        <h4 style="margin:8px 0; font-size:1.1rem;">${s.name}</h4>
        <p style="font-size:0.8rem; color:var(--text-muted);">${s.statement}</p>
      </div>
    `).join('');

    const evidenceHtml = this.unlockedEvidences.map(ev => `
      <div class="evidence-node animate-pop">
        <strong style="color:var(--gold); display:block;">${ev.title}</strong>
        <span>${ev.desc}</span>
      </div>
    `).join('');

    hostContainer.innerHTML = `
      <div class="mystery-board-container" style="width:100%;">
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="color:var(--gold); font-size:1.8rem;">${this.caseData.title}</h2>
          <p style="color:var(--text-muted);">توقيت الحادثة: ${this.caseData.time} | المكان: ${this.caseData.location}</p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:24px;">
          ${suspectsHtml}
        </div>

        <div class="glass-panel" style="padding:20px;">
          <h3 style="margin-bottom:12px; color:var(--accent);">📜 الأدلة التي تم فك تشفيرها حتى الآن (${this.unlockedEvidences.length}/3):</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
            ${evidenceHtml.length > 0 ? evidenceHtml : '<p style="color:var(--text-muted);">العب الجولات التنافسية لفتح الأدلة السرية!</p>'}
          </div>
        </div>

        <div style="text-align:center; margin-top:20px;">
          <button class="btn accent-btn giant-btn" onclick="mysteryEngine.startDiscussionPhase()">
            🗣️ بدء مرحلة المناقشة والاتهمام النهائي (DISCUSSION PHASE)
          </button>
        </div>
      </div>
    `;
  }

  onRoundComplete(answersMap) {
    // Unlock evidence based on top performer
    const nextEvidenceIndex = this.unlockedEvidences.length;
    if (nextEvidenceIndex < this.caseData.evidences.length) {
      const newEv = this.caseData.evidences[nextEvidenceIndex];
      this.unlockedEvidences.push(newEv);
      audioEngine.playMysteryChime();
      stateStore.addLog(`🔓 تم كشف دليل جديد: ${newEv.title}!`);
    }
  }

  startDiscussionPhase() {
    this.phase = 'discussion';
    audioEngine.playMysteryChime();
    stateStore.addLog("🗣️ بدأت مرحلة المناقشة الحية لمدة 3 دقائق!");

    const hostStage = document.getElementById('host-game-canvas');
    if (hostStage) {
      hostStage.innerHTML = `
        <div style="text-align:center; padding:30px;">
          <h1 style="font-size:3rem; color:var(--gold); margin-bottom:15px;">🗣️ DISCUSSION PHASE — تناقشوا الآن!</h1>
          <p style="font-size:1.4rem; color:var(--text-main); max-width:700px; margin:0 auto 20px;">
            كل لاعب حصل على دلاء سرية مختلفة في موبايله! قارنوا الأوقات والأقوال لمعرفة من الكذاب!
          </p>
          <div style="font-size:4rem; font-weight:900; color:var(--danger);" id="disc-timer">03:00</div>
          <button class="btn primary-btn giant-btn" style="margin-top:25px;" onclick="mysteryEngine.triggerFinalAccusation()">
            ⚖️ الانقال فوراً للتصويت والاتهام النهائي (FINAL ACCUSATION)
          </button>
        </div>
      `;
    }

    // Also update mobile UI to accusation panel
    const mobMystery = document.getElementById('mobile-accusation-panel');
    if (mobMystery) {
      mobMystery.classList.remove('hidden');
      this.renderMobileSuspectSelect();
    }
  }

  renderMobileSuspectSelect() {
    const grid = document.getElementById('mobile-suspects-select');
    if (!grid) return;
    grid.innerHTML = this.caseData.suspects.map(s => `
      <div class="grid-opt-btn" onclick="mysteryEngine.selectSuspect('${s.id}', this)" style="text-align:center; padding:12px;">
        <span style="font-size:2rem; display:block;">${s.icon}</span>
        <span>${s.name}</span>
      </div>
    `).join('');
  }

  selectSuspect(id, element) {
    document.querySelectorAll('#mobile-suspects-select .grid-opt-btn').forEach(b => b.style.borderColor = 'var(--border-glass)');
    element.style.borderColor = 'var(--danger)';
    this.selectedCulprit = id;
  }

  triggerFinalAccusation() {
    this.phase = 'reveal';
    audioEngine.playVictoryFanfare();

    // Calculate score for correct culprit accusation
    stateStore.players.forEach(p => {
      const acc = stateStore.accusations[p.id];
      if (acc && acc.culprit === 'scientist') {
        stateStore.updatePlayerScore(p.id, 500); // 500 bonus points for correct detective work
      }
    });

    const hostStage = document.getElementById('host-game-canvas');
    if (hostStage) {
      hostStage.innerHTML = `
        <div style="text-align:center; padding:30px; animation:popIn 0.5s ease-out;">
          <h1 style="font-size:3.5rem; color:var(--accent);">🔍 كشف الجاني الحقيقي!</h1>
          <div style="font-size:6rem; margin:20px 0;">🧑‍🔬</div>
          <h2 style="font-size:2.5rem; color:var(--danger); margin-bottom:15px;">الجاني هو: العالم (The Scientist)!</h2>
          <p style="font-size:1.3rem; color:var(--text-muted); max-width:750px; margin:0 auto;">
            السبب: كاميرا CCTV كشفت دخوله الساعة 8:40 PM، وتأكد التناقض بوجود آثار المواد الكيميائية الخاصة بمعمله على قفل الكأس الذهبية!
          </p>
          <button class="btn gold-btn giant-btn" style="margin-top:30px;" onclick="app.showFinalResults()">
            🏆 عرض قائمة المتصدرين النهائية والأوسمة!
          </button>
        </div>
      `;
    }
  }
}

const mysteryEngine = new MysteryEngine();
window.mysteryEngine = mysteryEngine;
