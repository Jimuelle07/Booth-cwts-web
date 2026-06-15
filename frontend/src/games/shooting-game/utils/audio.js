// ─── Shooting Game Audio Engine ─────────────────────────────────────
// Pure Web Audio API synthesis — no external audio files needed.
// Each instance manages its own AudioContext for independent per-panel control.

export default class ShootingGameAudio {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.musicGain = null
    this.sfxGain = null
    this.compressor = null
    this.delayNode = null
    this.delayGain = null
    this.delayFilter = null
    this.muted = false
    this.musicPlaying = false
    this._musicIntensity = 'normal'
    this._musicNodes = []
    this._sirenNode = null
    this._sirenGain = null
    this._sirenFilter = null
    this._noiseBuffer = null
    this._disposed = false
    this._scheduleNextBarTime = 0
    this._currentBarIndex = 0
    this._musicTimer = null
    this._sirenTimer = null
  }

  // ── Lazy init (call on first user interaction) ──
  ensureContext() {
    if (this._disposed) return false
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return true
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()

      // 1. Dynamics Compressor (prevents digital clipping, glues SFX/BGM)
      this.compressor = this.ctx.createDynamicsCompressor()
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime)
      this.compressor.knee.setValueAtTime(8, this.ctx.currentTime)
      this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime)
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime)
      this.compressor.release.setValueAtTime(0.08, this.ctx.currentTime)
      this.compressor.connect(this.ctx.destination)

      // 2. Master Gain (Mute control)
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.muted ? 0 : 1
      this.masterGain.connect(this.compressor)

      // 3. Audio Channels
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.value = 0.60
      this.sfxGain.connect(this.masterGain)

      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.20
      this.musicGain.connect(this.masterGain)

      // 4. Stereo Feedback Delay Node (provides spatial depth and reverb feel)
      this.delayNode = this.ctx.createDelay(1.0)
      this.delayNode.delayTime.setValueAtTime(0.14, this.ctx.currentTime) // 140ms delay
      
      this.delayGain = this.ctx.createGain()
      this.delayGain.gain.setValueAtTime(0.28, this.ctx.currentTime) // feedback amount
      
      this.delayFilter = this.ctx.createBiquadFilter()
      this.delayFilter.type = 'lowpass'
      this.delayFilter.frequency.setValueAtTime(2200, this.ctx.currentTime) // dampen echo high frequencies

      // Feedback loop routing
      this.delayNode.connect(this.delayFilter)
      this.delayFilter.connect(this.delayGain)
      this.delayGain.connect(this.delayNode)

      // Delay output routing
      this.delayNode.connect(this.sfxGain)

      // Pre-generate noise buffer for white noise synthesis
      this._noiseBuffer = this._createNoiseBuffer(2.0)
      return true
    } catch {
      return false
    }
  }

  // ── Mute toggle ──
  toggleMute() {
    this.muted = !this.muted
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : 1,
        this.ctx.currentTime,
        0.04
      )
    }
    return this.muted
  }

  setMuted(val) {
    this.muted = val
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : 1,
        this.ctx.currentTime,
        0.04
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SFX IMPLEMENTATIONS
  // ══════════════════════════════════════════════════════════════════

  // ── Shoot (per weapon type) ──
  playShoot(weaponType = 'rapid') {
    if (!this.ensureContext()) return
    switch (weaponType) {
      case 'rapid':
        // Punchy transient + fast slide saw
        this._triggerNoise({ duration: 0.02, filterType: 'highpass', filterFreqStart: 3000, filterFreqEnd: 3000, gainStart: 0.12 })
        this._triggerSynthVoice({ type: 'sawtooth', freqStart: 950, freqEnd: 220, duration: 0.08, gainStart: 0.10, filterFreqStart: 3500, filterFreqEnd: 400 })
        break
      case 'fireball':
        // Fat square wave + heavy lowpass filter envelope sweep
        this._triggerNoise({ duration: 0.08, filterType: 'lowpass', filterFreqStart: 600, filterFreqEnd: 100, gainStart: 0.08 })
        this._triggerSynthVoice({ type: 'square', freqStart: 280, freqEnd: 70, duration: 0.22, gainStart: 0.18, filterFreqStart: 2200, filterFreqEnd: 80, filterQ: 8 })
        break
      case 'spread':
        // Detuned triple supersaw wide spread
        this._triggerSynthVoice({ type: 'sawtooth', freqStart: 700, freqEnd: 320, duration: 0.12, gainStart: 0.04, detune: -18, sendToDelay: true })
        this._triggerSynthVoice({ type: 'sawtooth', freqStart: 700, freqEnd: 320, duration: 0.12, gainStart: 0.05, detune: 0, sendToDelay: true })
        this._triggerSynthVoice({ type: 'sawtooth', freqStart: 700, freqEnd: 320, duration: 0.12, gainStart: 0.04, detune: 18, sendToDelay: true })
        break
      case 'homing':
        // Metallic FM synth zap
        this._triggerFM({ carrierType: 'sine', modType: 'sine', carrierFreqStart: 350, carrierFreqEnd: 850, modFreq: 220, modIndex: 350, duration: 0.14, gainStart: 0.12, sendToDelay: true })
        break
      case 'beam':
        // High frequency bandpass sweep on noise (energy pulse)
        this._triggerNoise({ duration: 0.10, filterType: 'bandpass', filterFreqStart: 3800, filterFreqEnd: 800, filterQ: 6, gainStart: 0.18 })
        this._triggerOsc({ type: 'sine', freqStart: 1200, freqEnd: 1000, duration: 0.08, gainStart: 0.04 })
        break
      case 'zigzag':
        // Double-triggered alternating frequency sweeps
        this._triggerSynthVoice({ type: 'square', freqStart: 440, freqEnd: 220, duration: 0.08, gainStart: 0.08, sendToDelay: true })
        this._triggerSynthVoice({ type: 'square', freqStart: 660, freqEnd: 330, duration: 0.08, gainStart: 0.06, delay: 0.035, sendToDelay: true })
        break
      case 'dual':
        // Two detuned saws fired with a 25ms delay
        this._triggerSynthVoice({ type: 'sawtooth', freqStart: 750, freqEnd: 300, duration: 0.09, gainStart: 0.09, detune: -12 })
        this._triggerSynthVoice({ type: 'sawtooth', freqStart: 760, freqEnd: 310, duration: 0.09, gainStart: 0.07, detune: 12, delay: 0.025 })
        break
      case 'shockwave':
        // Sub-bass sine sweep + lowpass noise blast
        this._triggerNoise({ duration: 0.28, filterType: 'lowpass', filterFreqStart: 800, filterFreqEnd: 80, gainStart: 0.18 })
        this._triggerOsc({ type: 'sine', freqStart: 150, freqEnd: 35, duration: 0.32, gainStart: 0.25 })
        break
      case 'auto-pulse':
        // Three rapid short sweeps to simulate pulsed fire
        this._triggerOsc({ type: 'triangle', freqStart: 450, freqEnd: 550, duration: 0.05, gainStart: 0.08 })
        this._triggerOsc({ type: 'triangle', freqStart: 450, freqEnd: 550, duration: 0.05, gainStart: 0.07, delay: 0.04 })
        this._triggerOsc({ type: 'triangle', freqStart: 450, freqEnd: 550, duration: 0.05, gainStart: 0.06, delay: 0.08 })
        break
      default:
        this._triggerSynthVoice({ type: 'sawtooth', freqStart: 880, freqEnd: 220, duration: 0.07, gainStart: 0.10 })
    }
  }

  // ── Enemy hit (crisp metallic click + noise spark) ──
  playHit() {
    if (!this.ensureContext()) return
    this._triggerNoise({ duration: 0.04, filterType: 'highpass', filterFreqStart: 3200, filterFreqEnd: 3200, gainStart: 0.09 })
    this._triggerOsc({ type: 'sine', freqStart: 1800, freqEnd: 900, duration: 0.03, gainStart: 0.07 })
  }

  // ── Explosion (sub thump + lowpass noise crunch + high sizzle) ──
  playExplosion() {
    if (!this.ensureContext()) return
    this._triggerOsc({ type: 'sine', freqStart: 125, freqEnd: 20, duration: 0.26, gainStart: 0.24 })
    this._triggerNoise({ duration: 0.25, filterType: 'lowpass', filterFreqStart: 1100, filterFreqEnd: 150, filterQ: 3, gainStart: 0.22 })
    this._triggerNoise({ duration: 0.15, filterType: 'highpass', filterFreqStart: 2500, filterFreqEnd: 2500, gainStart: 0.08 })
  }

  // ── Big explosion (deep rumble + cascading crackles + noise swell) ──
  playBossExplosion() {
    if (!this.ensureContext()) return
    // Deep sub rumble
    this._triggerOsc({ type: 'sine', freqStart: 85, freqEnd: 15, duration: 0.95, gainStart: 0.38 })
    // Slow sweeping lowpass noise swell
    this._triggerNoise({ duration: 0.85, filterType: 'lowpass', filterFreqStart: 1400, filterFreqEnd: 40, filterQ: 5, gainStart: 0.30, sendToDelay: true })
    // Cascading crackles at staggered delay offsets
    this._triggerNoise({ duration: 0.30, filterType: 'bandpass', filterFreqStart: 800, filterFreqEnd: 200, filterQ: 3, gainStart: 0.16, delay: 0.10 })
    this._triggerNoise({ duration: 0.25, filterType: 'highpass', filterFreqStart: 2000, filterFreqEnd: 2000, gainStart: 0.14, delay: 0.22 })
    this._triggerNoise({ duration: 0.35, filterType: 'bandpass', filterFreqStart: 600, filterFreqEnd: 150, filterQ: 4, gainStart: 0.16, delay: 0.35 })
    this._triggerOsc({ type: 'sawtooth', freqStart: 80, freqEnd: 30, duration: 0.45, gainStart: 0.20, delay: 0.15 })
  }

  // ── Power-up pickup (ascending C Major Pentatonic arpeggio + FM bells) ──
  playPowerUp() {
    if (!this.ensureContext()) return
    const root = 523.25 // C5
    // Pentatonic scale ratios: C, D, E, G, A, C
    const ratios = [1, 1.125, 1.25, 1.5, 1.875, 2]
    ratios.forEach((ratio, idx) => {
      const freq = root * ratio
      this._triggerFM({
        carrierType: 'sine',
        modType: 'sine',
        carrierFreqStart: freq,
        carrierFreqEnd: freq * 1.015,
        modFreq: freq * 2.005, // octave overtone + tiny detune
        modIndex: freq * 0.85,
        duration: 0.32,
        gainStart: 0.14,
        delay: idx * 0.065,
        sendToDelay: true
      })
    })
  }

  // ── Player damage (heavy sub punch + distorted square crunch) ──
  playDamage() {
    if (!this.ensureContext()) return
    this._triggerOsc({ type: 'sine', freqStart: 140, freqEnd: 25, duration: 0.30, gainStart: 0.26 })
    this._triggerSynthVoice({ type: 'square', freqStart: 180, freqEnd: 40, duration: 0.24, gainStart: 0.16, filterFreqStart: 550, filterFreqEnd: 30, filterQ: 6 })
    this._triggerNoise({ duration: 0.26, filterType: 'lowpass', filterFreqStart: 320, filterFreqEnd: 50, gainStart: 0.24 })
  }

  // ── Game over (melancholy descending polyphonic chord progression) ──
  playGameOver() {
    if (!this.ensureContext()) return
    this.stopMusic()
    this.stopSiren()

    const t = this.ctx.currentTime
    const playChord = (notes, startTime, duration) => {
      notes.forEach(freq => {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, startTime)
        osc.frequency.linearRampToValueAtTime(freq * 0.99, startTime + duration)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(550, startTime)
        filter.frequency.exponentialRampToValueAtTime(140, startTime + duration)

        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.09, startTime + 0.10)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(this.sfxGain)

        osc.start(startTime)
        osc.stop(startTime + duration + 0.10)
      })
    }

    // Progression in A minor: Am -> F -> Dm -> E
    playChord([220.00, 261.63, 329.63], t + 0.0, 0.8) // Am: A3, C4, E4
    playChord([174.61, 220.00, 261.63], t + 0.7, 0.8) // F: F3, A3, C4
    playChord([146.83, 174.61, 220.00], t + 1.4, 0.8) // Dm: D3, F3, A3
    playChord([164.81, 207.65, 246.94], t + 2.1, 1.5) // E: E3, G#3, B3
  }

  // ── Menu / UI select (high-pitched clean double chime) ──
  playSelect() {
    if (!this.ensureContext()) return
    this._triggerFM({
      carrierType: 'sine',
      modType: 'sine',
      carrierFreqStart: 1046.50, // C6
      carrierFreqEnd: 1046.50,
      modFreq: 2093,
      modIndex: 50,
      duration: 0.05,
      gainStart: 0.10,
      sendToDelay: true
    })
    this._triggerFM({
      carrierType: 'sine',
      modType: 'sine',
      carrierFreqStart: 1567.98, // G6
      carrierFreqEnd: 1567.98,
      modFreq: 3135,
      modIndex: 50,
      duration: 0.07,
      gainStart: 0.08,
      delay: 0.05,
      sendToDelay: true
    })
  }

  // ── Start game jingle (triumphant brassy arcade fanfare) ──
  playStartJingle() {
    if (!this.ensureContext()) return
    const t = this.ctx.currentTime

    const playFanfareNote = (freq, delayTime, duration, volume = 0.07) => {
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc1.type = 'sawtooth'
      osc2.type = 'sawtooth'
      osc1.frequency.setValueAtTime(freq, t + delayTime)
      osc2.frequency.setValueAtTime(freq, t + delayTime)
      osc1.detune.setValueAtTime(-9, t + delayTime)
      osc2.detune.setValueAtTime(9, t + delayTime)

      // Brassy filter envelope sweep
      filter.type = 'lowpass'
      filter.Q.setValueAtTime(3.5, t + delayTime)
      filter.frequency.setValueAtTime(100, t + delayTime)
      filter.frequency.exponentialRampToValueAtTime(1800, t + delayTime + 0.07)
      filter.frequency.exponentialRampToValueAtTime(350, t + delayTime + duration)

      gain.gain.setValueAtTime(0, t + delayTime)
      gain.gain.linearRampToValueAtTime(volume, t + delayTime + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + delayTime + duration)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(this.sfxGain)
      if (this.delayNode) {
        gain.connect(this.delayNode)
      }

      osc1.start(t + delayTime)
      osc2.start(t + delayTime)
      osc1.stop(t + delayTime + duration + 0.05)
      osc2.stop(t + delayTime + duration + 0.05)
    }

    // Uplifting run: C4 -> E4 -> G4 leading to rich C5/E5/G5/C6 chord
    playFanfareNote(261.63, 0.0, 0.14) // C4
    playFanfareNote(329.63, 0.06, 0.14) // E4
    playFanfareNote(392.00, 0.12, 0.14) // G4
    
    // Major triad chord explosion at 0.18s
    playFanfareNote(261.63 * 2, 0.18, 0.85, 0.05) // C5
    playFanfareNote(329.63 * 2, 0.18, 0.85, 0.05) // E5
    playFanfareNote(392.00 * 2, 0.18, 0.85, 0.05) // G5
    playFanfareNote(523.25 * 2, 0.18, 0.85, 0.035) // C6
  }

  // ══════════════════════════════════════════════════════════════════
  // BOSS WARNING SIREN (Cinematic detuned klaxon sweep)
  // ══════════════════════════════════════════════════════════════════

  startSiren() {
    if (!this.ensureContext()) return
    if (this._sirenNode) return

    const osc1 = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc1.type = 'sawtooth'
    osc2.type = 'sawtooth'
    osc1.frequency.setValueAtTime(175, this.ctx.currentTime)
    osc2.frequency.setValueAtTime(175, this.ctx.currentTime)
    osc1.detune.setValueAtTime(-14, this.ctx.currentTime)
    osc2.detune.setValueAtTime(14, this.ctx.currentTime)

    filter.type = 'lowpass'
    filter.Q.setValueAtTime(6.0, this.ctx.currentTime)
    filter.frequency.setValueAtTime(280, this.ctx.currentTime)

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime)

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)

    osc1.start()
    osc2.start()

    this._sirenNode = [osc1, osc2]
    this._sirenGain = gain
    this._sirenFilter = filter
    
    this._sirenLfo(osc1, osc2, filter)
  }

  _sirenLfo(osc1, osc2, filter) {
    if (!osc1 || this._disposed || !this._sirenNode) return
    const t = this.ctx.currentTime

    // Heavy pitch + filter cutoff sweep over 1.2 seconds
    osc1.frequency.cancelScheduledValues(t)
    osc1.frequency.setValueAtTime(160, t)
    osc1.frequency.linearRampToValueAtTime(205, t + 0.6)
    osc1.frequency.linearRampToValueAtTime(160, t + 1.2)

    osc2.frequency.cancelScheduledValues(t)
    osc2.frequency.setValueAtTime(160, t)
    osc2.frequency.linearRampToValueAtTime(205, t + 0.6)
    osc2.frequency.linearRampToValueAtTime(160, t + 1.2)

    filter.frequency.cancelScheduledValues(t)
    filter.frequency.setValueAtTime(250, t)
    filter.frequency.exponentialRampToValueAtTime(1450, t + 0.6)
    filter.frequency.exponentialRampToValueAtTime(250, t + 1.2)

    this._sirenTimer = setTimeout(() => this._sirenLfo(osc1, osc2, filter), 1200)
  }

  stopSiren() {
    if (this._sirenTimer) {
      clearTimeout(this._sirenTimer)
      this._sirenTimer = null
    }
    if (this._sirenNode) {
      try {
        const t = this.ctx.currentTime
        this._sirenGain.gain.cancelScheduledValues(t)
        this._sirenGain.gain.setValueAtTime(this._sirenGain.gain.value, t)
        this._sirenGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
        
        const nodes = this._sirenNode
        setTimeout(() => {
          nodes.forEach(n => { try { n.stop(); n.disconnect() } catch {} })
        }, 300)
      } catch {}
      this._sirenNode = null
      this._sirenGain = null
      this._sirenFilter = null
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PROCEDURAL BGM ENGINE (Driving Synthwave sequencer)
  // ══════════════════════════════════════════════════════════════════

  startMusic() {
    if (!this.ensureContext()) return
    if (this.musicPlaying) return
    this.musicPlaying = true
    this._musicIntensity = 'normal'
    this._currentBarIndex = 0
    this._scheduleNextBarTime = this.ctx.currentTime + 0.05
    this._musicTick()
  }

  _musicTick() {
    if (!this.musicPlaying || this._disposed) return
    
    const t = this.ctx.currentTime
    const lookAhead = 0.35 // schedule 350ms in advance
    const bpm = 126
    const beatLen = 60 / bpm // 0.476s
    const barLen = beatLen * 4 // 1.904s
    
    if (this._scheduleNextBarTime < t + lookAhead) {
      this._scheduleBar(this._scheduleNextBarTime, beatLen, this._currentBarIndex)
      this._scheduleNextBarTime += barLen
      this._currentBarIndex = (this._currentBarIndex + 1) % 8 // 8-bar loop
    }

    // Clean up finished music nodes to prevent memory leak
    const now = this.ctx.currentTime
    this._musicNodes = this._musicNodes.filter(n => {
      if (n._stopTime && n._stopTime < now) {
        try { n.disconnect() } catch {}
        return false
      }
      return true
    })
    
    this._musicTimer = setTimeout(() => this._musicTick(), 100)
  }

  _scheduleBar(startTime, beatLen, barIndex) {
    const t = startTime
    const eighthLen = beatLen / 2
    const sixteenthLen = beatLen / 4
    const isIntense = this._musicIntensity === 'intense'

    // Root frequencies for A minor synth progression: Am, Am, F, F, C, C, G, G
    let rootFreq = 55.00 // A1
    let scale = 'Am'
    if (barIndex === 0 || barIndex === 1) {
      rootFreq = 55.00 // A1
      scale = 'Am'
    } else if (barIndex === 2 || barIndex === 3) {
      rootFreq = 43.65 // F1
      scale = 'F'
    } else if (barIndex === 4 || barIndex === 5) {
      rootFreq = 65.41 // C2
      scale = 'C'
    } else if (barIndex === 6 || barIndex === 7) {
      rootFreq = 49.00 // G1
      scale = 'G'
    }

    // ─── 1. Synthwave walking pluck bass ───
    const bassPattern = [
      { pitch: rootFreq, vol: 0.22 },      // 1
      { pitch: rootFreq, vol: 0.18 },      // 1.5
      { pitch: rootFreq * 2, vol: 0.22 },  // 2
      { pitch: rootFreq, vol: 0.18 },      // 2.5
      { pitch: rootFreq, vol: 0.22 },      // 3
      { pitch: rootFreq * 2, vol: 0.20 },  // 3.5
      { pitch: rootFreq, vol: 0.22 },      // 4
      { pitch: rootFreq * 1.5, vol: 0.20 } // 4.5
    ]

    bassPattern.forEach((note, index) => {
      const nt = t + index * eighthLen
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc1.type = 'sawtooth'
      osc2.type = 'sawtooth'
      osc1.frequency.setValueAtTime(note.pitch, nt)
      osc2.frequency.setValueAtTime(note.pitch, nt)
      osc1.detune.setValueAtTime(-10, nt)
      osc2.detune.setValueAtTime(10, nt)

      filter.type = 'lowpass'
      filter.Q.setValueAtTime(3.0, nt)
      filter.frequency.setValueAtTime(isIntense ? 900 : 550, nt)
      filter.frequency.exponentialRampToValueAtTime(isIntense ? 120 : 80, nt + eighthLen * 0.8)

      gain.gain.setValueAtTime(note.vol, nt)
      gain.gain.exponentialRampToValueAtTime(0.001, nt + eighthLen * 0.95)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(this.musicGain)

      osc1.start(nt)
      osc1.stop(nt + eighthLen)
      osc2.start(nt)
      osc2.stop(nt + eighthLen)

      osc1._stopTime = nt + eighthLen
      osc2._stopTime = nt + eighthLen
      this._musicNodes.push(osc1, osc2)
    })

    // ─── 2. Drums (Four-on-the-floor kick, retro snare, hi-hats) ───
    for (let i = 0; i < 4; i++) {
      const kt = t + i * beatLen

      // Kick Drum (pitch drop sine + click transient)
      const kOsc = this.ctx.createOscillator()
      const kGain = this.ctx.createGain()
      kOsc.type = 'sine'
      kOsc.frequency.setValueAtTime(130, kt)
      kOsc.frequency.exponentialRampToValueAtTime(32, kt + 0.12)
      
      kGain.gain.setValueAtTime(0.32, kt)
      kGain.gain.exponentialRampToValueAtTime(0.0001, kt + 0.16)
      
      kOsc.connect(kGain)
      kGain.connect(this.musicGain)
      
      kOsc.start(kt)
      kOsc.stop(kt + 0.20)
      kOsc._stopTime = kt + 0.20
      this._musicNodes.push(kOsc)

      const clickOsc = this.ctx.createOscillator()
      const clickGain = this.ctx.createGain()
      clickOsc.type = 'triangle'
      clickOsc.frequency.setValueAtTime(1000, kt)
      clickOsc.frequency.exponentialRampToValueAtTime(100, kt + 0.01)
      clickGain.gain.setValueAtTime(0.08, kt)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, kt + 0.01)
      clickOsc.connect(clickGain)
      clickGain.connect(this.musicGain)
      clickOsc.start(kt)
      clickOsc.stop(kt + 0.02)
      clickOsc._stopTime = kt + 0.02
      this._musicNodes.push(clickOsc)

      // Snare Drum on beats 2 & 4
      if (i === 1 || i === 3) {
        const st = kt
        // White noise snare body
        const sSrc = this.ctx.createBufferSource()
        const sNoiseGain = this.ctx.createGain()
        const sFilter = this.ctx.createBiquadFilter()

        sSrc.buffer = this._noiseBuffer
        sFilter.type = 'bandpass'
        sFilter.frequency.setValueAtTime(1000, st)
        sFilter.Q.setValueAtTime(1.5, st)

        sNoiseGain.gain.setValueAtTime(0.18, st)
        sNoiseGain.gain.exponentialRampToValueAtTime(0.001, st + 0.18)

        sSrc.connect(sFilter)
        sFilter.connect(sNoiseGain)
        sNoiseGain.connect(this.musicGain)

        sSrc.start(st)
        sSrc.stop(st + 0.20)
        sSrc._stopTime = st + 0.20
        this._musicNodes.push(sSrc)

        // Snare sine punch (180Hz)
        const sToneOsc = this.ctx.createOscillator()
        const sToneGain = this.ctx.createGain()
        sToneOsc.type = 'sine'
        sToneOsc.frequency.setValueAtTime(180, st)
        sToneGain.gain.setValueAtTime(0.15, st)
        sToneGain.gain.exponentialRampToValueAtTime(0.001, st + 0.12)
        sToneOsc.connect(sToneGain)
        sToneGain.connect(this.musicGain)
        sToneOsc.start(st)
        sToneOsc.stop(st + 0.15)
        sToneOsc._stopTime = st + 0.15
        this._musicNodes.push(sToneOsc)
      }
    }

    // Hi-Hats on eighth off-beats
    for (let i = 0; i < 8; i++) {
      const ht = t + i * eighthLen + eighthLen / 2
      const hatSrc = this.ctx.createBufferSource()
      const hatGain = this.ctx.createGain()
      const hatFilter = this.ctx.createBiquadFilter()

      hatSrc.buffer = this._noiseBuffer
      hatFilter.type = 'highpass'
      hatFilter.frequency.setValueAtTime(7500, ht)

      hatGain.gain.setValueAtTime(0.06, ht)
      hatGain.gain.exponentialRampToValueAtTime(0.0001, ht + 0.04)

      hatSrc.connect(hatFilter)
      hatFilter.connect(hatGain)
      hatGain.connect(this.musicGain)

      hatSrc.start(ht)
      hatSrc.stop(ht + 0.05)
      hatSrc._stopTime = ht + 0.05
      this._musicNodes.push(hatSrc)
    }

    // Double-speed 16th hi-hats in Intense Mode
    if (isIntense) {
      for (let i = 0; i < 16; i++) {
        if (i % 2 === 1) { // fill gaps
          const ht = t + i * sixteenthLen
          const hatSrc = this.ctx.createBufferSource()
          const hatGain = this.ctx.createGain()
          const hatFilter = this.ctx.createBiquadFilter()

          hatSrc.buffer = this._noiseBuffer
          hatFilter.type = 'highpass'
          hatFilter.frequency.setValueAtTime(9000, ht)

          hatGain.gain.setValueAtTime(0.035, ht)
          hatGain.gain.exponentialRampToValueAtTime(0.0001, ht + 0.025)

          hatSrc.connect(hatFilter)
          hatFilter.connect(hatGain)
          hatGain.connect(this.musicGain)

          hatSrc.start(ht)
          hatSrc.stop(ht + 0.04)
          hatSrc._stopTime = ht + 0.04
          this._musicNodes.push(hatSrc)
        }
      }
    }

    // ─── 3. Pad Chords (Lush background synth) ───
    let chordNotes = []
    if (scale === 'Am') chordNotes = [110.00, 164.81, 220.00, 261.63] // A2, E3, A3, C4
    else if (scale === 'F') chordNotes = [87.31, 130.81, 174.61, 220.00] // F2, C3, F3, A3
    else if (scale === 'C') chordNotes = [130.81, 196.00, 261.63, 329.63] // C3, G3, C4, E4
    else if (scale === 'G') chordNotes = [98.00, 146.83, 196.00, 246.94] // G2, D3, G3, B3

    chordNotes.forEach(freq => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, t)
      
      filter.type = 'lowpass'
      filter.Q.setValueAtTime(1.5, t)
      filter.frequency.setValueAtTime(300, t)
      filter.frequency.exponentialRampToValueAtTime(750, t + beatLen * 2)
      filter.frequency.exponentialRampToValueAtTime(400, t + beatLen * 4)

      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.06, t + 0.4)
      gain.gain.setValueAtTime(0.06, t + beatLen * 4 - 0.3)
      gain.gain.linearRampToValueAtTime(0.001, t + beatLen * 4)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.musicGain)

      osc.start(t)
      osc.stop(t + beatLen * 4)
      osc._stopTime = t + beatLen * 4
      this._musicNodes.push(osc)
    })

    // ─── 4. Lead Melody / Arpeggiator ───
    if (isIntense) {
      // Fast sixteenth-note spacey arpeggiator routed through feedback delay
      let arpNotes = []
      if (scale === 'Am') arpNotes = [220.00, 261.63, 329.63, 440.00, 523.25, 440.00, 329.63, 261.63]
      else if (scale === 'F') arpNotes = [174.61, 220.00, 261.63, 349.23, 440.00, 349.23, 261.63, 220.00]
      else if (scale === 'C') arpNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 523.25, 392.00, 329.63]
      else if (scale === 'G') arpNotes = [196.00, 246.94, 293.66, 392.00, 493.88, 392.00, 293.66, 246.94]

      for (let i = 0; i < 16; i++) {
        const noteTime = t + i * sixteenthLen
        const noteFreq = arpNotes[i % arpNotes.length]

        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(noteFreq, noteTime)

        filter.type = 'bandpass'
        filter.Q.setValueAtTime(3.0, noteTime)
        filter.frequency.setValueAtTime(900 + Math.sin(i * 0.4) * 400, noteTime)

        gain.gain.setValueAtTime(0.045, noteTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + sixteenthLen * 0.95)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(this.musicGain)
        
        if (this.delayNode) {
          gain.connect(this.delayNode)
        }

        osc.start(noteTime)
        osc.stop(noteTime + sixteenthLen)
        osc._stopTime = noteTime + sixteenthLen
        this._musicNodes.push(osc)
      }
    } else {
      // Sparse melodic fragments on beats 1.5, 2.5, 3.5 etc.
      let melody = []
      if (barIndex % 2 === 0) {
        if (scale === 'Am') {
          melody = [
            { note: 440.00, time: beatLen },          // A4
            { note: 523.25, time: beatLen * 1.5 },    // C5
            { note: 493.88, time: beatLen * 2.5 }     // B4
          ]
        } else if (scale === 'F') {
          melody = [
            { note: 349.23, time: beatLen },          // F4
            { note: 440.00, time: beatLen * 1.5 },    // A4
            { note: 392.00, time: beatLen * 2.5 }     // G4
          ]
        } else if (scale === 'C') {
          melody = [
            { note: 523.25, time: beatLen },          // C5
            { note: 587.33, time: beatLen * 1.5 },    // D5
            { note: 659.25, time: beatLen * 2.5 }     // E5
          ]
        } else if (scale === 'G') {
          melody = [
            { note: 392.00, time: beatLen },          // G4
            { note: 493.88, time: beatLen * 1.5 },    // B4
            { note: 440.00, time: beatLen * 2.5 }     // A4
          ]
        }
      }

      melody.forEach(({ note, time }) => {
        const mt = t + time
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(note, mt)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(1200, mt)

        gain.gain.setValueAtTime(0.001, mt)
        gain.gain.linearRampToValueAtTime(0.08, mt + 0.05)
        gain.gain.setValueAtTime(0.08, mt + beatLen * 0.4)
        gain.gain.exponentialRampToValueAtTime(0.0001, mt + beatLen * 0.8)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(this.musicGain)
        
        if (this.delayNode) {
          gain.connect(this.delayNode)
        }

        osc.start(mt)
        osc.stop(mt + beatLen)
        osc._stopTime = mt + beatLen
        this._musicNodes.push(osc)
      })
    }
  }

  stopMusic() {
    this.musicPlaying = false
    if (this._musicTimer) {
      clearTimeout(this._musicTimer)
      this._musicTimer = null
    }
    this._musicNodes.forEach(n => {
      try { n.stop(); n.disconnect() } catch {}
    })
    this._musicNodes = []
  }

  // Increase music intensity (dynamic transitions during boss fights)
  setMusicIntensity(level) {
    this._musicIntensity = level // triggers sixteenth arpeggios on next scheduled bar
    if (!this.musicGain) return
    const vol = level === 'intense' ? 0.28 : 0.20
    this.musicGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.25)
  }

  // ══════════════════════════════════════════════════════════════════
  // INTERNAL SYNTHESIS HELPERS
  // ══════════════════════════════════════════════════════════════════

  _triggerOsc({
    type = 'sine',
    freqStart,
    freqEnd,
    duration,
    gainStart = 0.1,
    gainEnd = 0.001,
    delay = 0,
    detune = 0,
    sendToDelay = false,
    filter = null
  }) {
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freqStart, t)
    if (freqEnd && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 10), t + duration)
    }
    if (detune !== 0) {
      osc.detune.setValueAtTime(detune, t)
    }

    gain.gain.setValueAtTime(gainStart, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), t + duration)

    if (filter) {
      osc.connect(filter)
      filter.connect(gain)
    } else {
      osc.connect(gain)
    }

    gain.connect(this.sfxGain)
    if (sendToDelay && this.delayNode) {
      gain.connect(this.delayNode)
    }

    osc.start(t)
    osc.stop(t + duration + 0.05)
    return osc
  }

  _triggerSynthVoice({
    type = 'sawtooth',
    freqStart,
    freqEnd,
    duration,
    gainStart = 0.1,
    gainEnd = 0.001,
    filterFreqStart = 2000,
    filterFreqEnd = 100,
    filterQ = 4.0,
    filterType = 'lowpass',
    delay = 0,
    detune = 0,
    sendToDelay = false
  }) {
    const t = this.ctx.currentTime + delay
    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.Q.setValueAtTime(filterQ, t)
    filter.frequency.setValueAtTime(filterFreqStart, t)
    if (filterFreqEnd !== filterFreqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(filterFreqEnd, 10), t + duration)
    }

    return this._triggerOsc({
      type,
      freqStart,
      freqEnd,
      duration,
      gainStart,
      gainEnd,
      delay,
      detune,
      sendToDelay,
      filter
    })
  }

  _triggerFM({
    carrierType = 'sine',
    modType = 'sine',
    carrierFreqStart,
    carrierFreqEnd,
    modFreq,
    modIndex,
    duration,
    gainStart = 0.1,
    gainEnd = 0.001,
    delay = 0,
    sendToDelay = false
  }) {
    const t = this.ctx.currentTime + delay
    const carrier = this.ctx.createOscillator()
    const modulator = this.ctx.createOscillator()
    const modGain = this.ctx.createGain()
    const gain = this.ctx.createGain()

    carrier.type = carrierType
    modulator.type = modType

    carrier.frequency.setValueAtTime(carrierFreqStart, t)
    if (carrierFreqEnd && carrierFreqEnd !== carrierFreqStart) {
      carrier.frequency.exponentialRampToValueAtTime(Math.max(carrierFreqEnd, 10), t + duration)
    }

    modulator.frequency.setValueAtTime(modFreq, t)
    modGain.gain.setValueAtTime(modIndex, t)

    gain.gain.setValueAtTime(gainStart, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), t + duration)

    modulator.connect(modGain)
    modGain.connect(carrier.frequency)
    carrier.connect(gain)
    
    gain.connect(this.sfxGain)
    if (sendToDelay && this.delayNode) {
      gain.connect(this.delayNode)
    }

    modulator.start(t)
    carrier.start(t)
    modulator.stop(t + duration + 0.05)
    carrier.stop(t + duration + 0.05)
  }

  _triggerNoise({
    duration,
    filterType = 'lowpass',
    filterFreqStart = 1000,
    filterFreqEnd = 100,
    filterQ = 1.0,
    gainStart = 0.1,
    gainEnd = 0.001,
    delay = 0,
    sendToDelay = false
  }) {
    if (!this._noiseBuffer) return
    const t = this.ctx.currentTime + delay

    const src = this.ctx.createBufferSource()
    src.buffer = this._noiseBuffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.Q.setValueAtTime(filterQ, t)
    filter.frequency.setValueAtTime(filterFreqStart, t)
    if (filterFreqEnd !== filterFreqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(filterFreqEnd, 10), t + duration)
    }

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(gainStart, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), t + duration)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)
    
    if (sendToDelay && this.delayNode) {
      gain.connect(this.delayNode)
    }

    src.start(t)
    src.stop(t + duration + 0.05)
  }

  _createNoiseBuffer(duration) {
    const sampleRate = this.ctx?.sampleRate || 44100
    const length = sampleRate * duration
    const buffer = this.ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  // ── Cleanup ──
  dispose() {
    this._disposed = true
    this.stopMusic()
    this.stopSiren()
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {})
    }
    this.ctx = null
  }
}
