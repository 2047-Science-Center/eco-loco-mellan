// audio.js — Eco Loco (Mellan): SFX + öhälso-ambienser.
// Filvägar kommer från spec/assets.json → audio (läses live).
// Ljudfiler som saknas hoppas över tyst — spelet fungerar ljudlöst tills filerna finns.

export class GameAudio {
  constructor(paths = {}) {
    this.paths = paths;          // { namn: 'assets/audio/x.mp3', ... }
    this.sfx = {};               // namn -> HTMLAudioElement (eller null om saknas)
    this.amb = {};               // mode -> HTMLAudioElement (loopar)
    this.currentAmb = null;
    this.unlocked = false;
    this.sfxVolume = 0.7;
    this.ambVolume = 0.35;
  }

  // Anropas på användarens första tryck (autoplay-policy).
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    for (const [name, src] of Object.entries(this.paths)) {
      const a = new Audio();
      a.preload = 'auto';
      const isAmb = name.startsWith('amb_');
      a.addEventListener('error', () => { (isAmb ? this.amb : this.sfx)[isAmb ? name.slice(4) : name] = null; });
      a.src = src;
      if (isAmb) { a.loop = true; a.volume = 0; this.amb[name.slice(4)] = a; }
      else { a.volume = this.sfxVolume; this.sfx[name] = a; }
    }
  }

  play(name) {
    const a = this.sfx[name];
    if (!a) return;
    try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* saknad fil */ }
  }

  // Korsfada mjukt till rätt ambiens för öläget (~1.5 s, per design/AUDIO.md).
  setAmbience(mode) {
    if (mode === this.currentAmb) return;
    const prev = this.amb[this.currentAmb], next = this.amb[mode];
    this.currentAmb = mode;
    if (next) { try { next.play().catch(() => {}); } catch { /* saknad fil */ } }
    const steps = 15, dt = 100;
    let i = 0;
    clearInterval(this._fade);
    this._fade = setInterval(() => {
      i++;
      const t = i / steps;
      if (prev) prev.volume = this.ambVolume * (1 - t);
      if (next) next.volume = this.ambVolume * t;
      if (i >= steps) { clearInterval(this._fade); if (prev) { prev.pause(); } }
    }, dt);
  }
}
