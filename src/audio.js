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

  // Ambiens/soundscape spelas numera på CENTRALHÖGTALAREN (rigg/hjärna), inte på skärmen.
  // Kvar som no-op så att anropare inte behöver ändras och amb_*-nycklarna är borta ur manifestet.
  setAmbience(_mode) { /* no-op — all "show"-ljudbild ligger centralt */ }
}
