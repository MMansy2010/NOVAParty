/* ==========================================================================
   NOVA PARTY — WEB AUDIO API SOUND SYNTHESIZER
   Zero external MP3 dependencies! High quality synthesized retro-modern SFX.
   ========================================================================== */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    const icon = document.getElementById('sound-icon');
    if (icon) {
      icon.textContent = this.isMuted ? '🔇' : '🔊';
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, vol = 0.1) {
    if (this.isMuted) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio playback exception:", e);
    }
  }

  // SFX Presets
  playTap() {
    this.playTone(440, 'sine', 0.08, 0.1);
  }

  playTick() {
    this.playTone(800, 'square', 0.04, 0.05);
  }

  playGo() {
    this.playTone(523.25, 'triangle', 0.2, 0.2); // C5
    setTimeout(() => this.playTone(659.25, 'triangle', 0.3, 0.25), 100); // E5
  }

  playSuccess() {
    this.playTone(523.25, 'sine', 0.1, 0.15); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.1, 0.15), 80); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.25, 0.2), 160); // G5
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.2, 0.2);
    setTimeout(() => this.playTone(110, 'sawtooth', 0.3, 0.25), 100);
  }

  playMysteryChime() {
    this.playTone(329.63, 'sine', 0.3, 0.15); // E4
    setTimeout(() => this.playTone(392.00, 'sine', 0.3, 0.15), 150); // G4
    setTimeout(() => this.playTone(493.88, 'sine', 0.4, 0.2), 300); // B4
  }

  playVictoryFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.25), idx * 120);
    });
  }
}

const audioEngine = new AudioEngine();
window.audioEngine = audioEngine;
