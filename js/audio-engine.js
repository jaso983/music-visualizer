class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.gainNode = null;
    this.source = null;
    this._demoNodes = null;

    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.volume = 0.7;
    this.startTime = 0;
    this.seekOffset = 0;
    this._db = null;

    this.onTimeUpdate = null;
    this.onTrackChange = null;
    this.onPlayStateChange = null;
    this.onPlaylistChange = null;
  }

  init() {
    if (this.audioContext) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.75;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.volume;

    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  async loadFile(file) {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.playlist.push({
      name: file.name,
      buffer: audioBuffer,
      duration: audioBuffer.duration,
    });
    if (this.currentIndex === -1) this.currentIndex = 0;
    try { await this._saveTrack(file.name, arrayBuffer); } catch (e) { /* DB unavailable */ }
    if (this.onPlaylistChange) this.onPlaylistChange();
  }

  removeTrack(index) {
    const name = this.playlist[index] ? this.playlist[index].name : null;
    this._stopSource();
    this.isPlaying = false;
    this.playlist.splice(index, 1);
    if (this.playlist.length === 0) {
      this.currentIndex = -1;
      this.seekOffset = 0;
    } else if (index <= this.currentIndex) {
      this.currentIndex = Math.max(0, this.currentIndex - 1);
    }
    if (name) { try { this._deleteTrack(name); } catch (e) {} }
    if (this.onPlaylistChange) this.onPlaylistChange();
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  play(index) {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    if (index !== undefined && index !== this.currentIndex) {
      this.currentIndex = index;
      this.seekOffset = 0;
    }
    if (this.currentIndex < 0 || this.currentIndex >= this.playlist.length) return;

    this._stopSource();
    this._stopDemo();

    const track = this.playlist[this.currentIndex];
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = track.buffer;
    this.source.connect(this.analyser);
    this.source.start(0, this.seekOffset);

    this.startTime = this.audioContext.currentTime - this.seekOffset;
    this.isPlaying = true;

    this.source.onended = () => {
      if (this.isPlaying) this.next();
    };

    if (this.onPlayStateChange) this.onPlayStateChange(true);
    if (this.onTrackChange) this.onTrackChange();
  }

  pause() {
    this._stopSource();
    this._stopDemo();
    if (this.isPlaying) {
      this.seekOffset = this.getCurrentTime();
    }
    this.isPlaying = false;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else if (this.currentIndex >= 0) this.play();
    else if (this.playlist.length === 0) this.startDemo();
  }

  next() {
    if (this.playlist.length === 0) return;
    this.seekOffset = 0;
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.play();
  }

  prev() {
    if (this.playlist.length === 0) return;
    this.seekOffset = 0;
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.play();
  }

  seek(percent) {
    if (this.currentIndex < 0 || !this.playlist[this.currentIndex]) return;
    const duration = this.playlist[this.currentIndex].duration;
    this.seekOffset = Math.max(0, Math.min(percent, 1)) * duration;
    if (this.isPlaying) {
      this._stopSource();
      const track = this.playlist[this.currentIndex];
      this.source = this.audioContext.createBufferSource();
      this.source.buffer = track.buffer;
      this.source.connect(this.analyser);
      this.source.start(0, this.seekOffset);
      this.startTime = this.audioContext.currentTime - this.seekOffset;
      this.source.onended = () => { if (this.isPlaying) this.next(); };
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(100, value)) / 100;
    if (this.gainNode) this.gainNode.gain.value = this.volume;
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.seekOffset || 0;
    if (this._demoNodes) return this.audioContext.currentTime - this.startTime;
    if (!this.source) return this.seekOffset || 0;
    return this.audioContext.currentTime - this.startTime;
  }

  getDuration() {
    if (this._demoNodes) return 100;
    if (this.currentIndex < 0 || !this.playlist[this.currentIndex]) return 0;
    return this.playlist[this.currentIndex].duration;
  }

  getProgress() {
    const dur = this.getDuration();
    if (!dur) return 0;
    return Math.min(this.getCurrentTime() / dur, 1);
  }

  startDemo() {
    this.pause();
    this.init();
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;

    const gain1 = this.audioContext.createGain();
    gain1.gain.value = 0;

    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 180;

    const gain2 = this.audioContext.createGain();
    gain2.gain.value = 0;

    osc1.connect(gain1);
    gain1.connect(this.analyser);
    osc2.connect(gain2);
    gain2.connect(this.analyser);

    const now = this.audioContext.currentTime;
    const beat = 0.45;

    for (let i = 0; i < 400; i++) {
      const t = now + i * beat;
      if (i % 2 === 0) {
        gain1.gain.setValueAtTime(0.45, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      } else {
        gain2.gain.setValueAtTime(0.22, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      }
    }

    osc1.start(now);
    osc2.start(now);

    this._demoNodes = { osc1, gain1, osc2, gain2 };
    this.isPlaying = true;
    this.startTime = now;
    this.seekOffset = 0;

    if (this.onPlayStateChange) this.onPlayStateChange(true);
  }

  _stopSource() {
    if (this.source) {
      try { this.source.onended = null; this.source.stop(); } catch (e) { /* already stopped */ }
      this.source.disconnect();
      this.source = null;
    }
  }

  _stopDemo() {
    if (this._demoNodes) {
      try { this._demoNodes.osc1.stop(); } catch (e) {}
      try { this._demoNodes.osc2.stop(); } catch (e) {}
      this._demoNodes.osc1.disconnect();
      this._demoNodes.osc2.disconnect();
      this._demoNodes.gain1.disconnect();
      this._demoNodes.gain2.disconnect();
      this._demoNodes = null;
    }
  }

  /* ---- IndexedDB Persistence ---- */
  async _initDB() {
    if (this._db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('music-viz-player', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'name' });
        }
      };
      request.onsuccess = (e) => { this._db = e.target.result; resolve(); };
      request.onerror = () => reject(request.error);
    });
  }

  async _saveTrack(name, arrayBuffer) {
    await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      store.put({ name, data: arrayBuffer, time: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async _loadTracks() {
    await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('tracks', 'readonly');
      const store = tx.objectStore('tracks');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _deleteTrack(name) {
    await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      store.delete(name);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async restorePlaylist() {
    try {
      await this._initDB();
      const tracks = await this._loadTracks();
      for (const track of tracks) {
        try {
          const audioBuffer = await this.audioContext.decodeAudioData(track.data.slice(0));
          this.playlist.push({
            name: track.name,
            buffer: audioBuffer,
            duration: audioBuffer.duration,
          });
          if (this.currentIndex === -1) this.currentIndex = 0;
        } catch (e) {
          try { await this._deleteTrack(track.name); } catch (_) {}
        }
      }
    } catch (e) { /* IndexedDB unavailable, skip */ }
    if (this.onPlaylistChange) this.onPlaylistChange();
  }

  destroy() {
    this._stopSource();
    this._stopDemo();
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
  }
}
