class UI {
  constructor(audioEngine, visualizer) {
    this.engine = audioEngine;
    this.viz = visualizer;
    this._seekDragging = false;
  }

  init() {
    this._initTheme();
    this._initModeTabs();
    this._initControls();
    this._initProgress();
    this._initVolume();
    this._initDragDrop();
    this._initFileInput();
    this._initFolderScan();
    this._initDemo();
    this.engine.restorePlaylist();
  }

  /* ---- Theme ---- */
  _initTheme() {
    const saved = localStorage.getItem('viz-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.viz.setTheme(saved);

    document.getElementById('themeBtn').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('viz-theme', next);
      this.viz.setTheme(next);
    });
  }

  /* ---- Mode Tabs ---- */
  _initModeTabs() {
    const tabs = document.getElementById('modeTabs');
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.mode-tab');
      if (!tab) return;
      tabs.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      this.viz.setMode(tab.dataset.mode);
    });
  }

  /* ---- Playback Controls ---- */
  _initControls() {
    document.getElementById('playBtn').addEventListener('click', () => {
      this.engine.toggle();
    });

    document.getElementById('prevBtn').addEventListener('click', () => {
      this.engine.prev();
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
      this.engine.next();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); this.engine.toggle(); break;
        case 'ArrowLeft': this.engine.prev(); break;
        case 'ArrowRight': this.engine.next(); break;
        case 'ArrowUp': this.engine.setVolume(Math.min(100, this.engine.volume * 100 + 5)); this._syncVolume(); break;
        case 'ArrowDown': this.engine.setVolume(Math.max(0, this.engine.volume * 100 - 5)); this._syncVolume(); break;
      }
    });

    this.engine.onPlayStateChange = (playing) => {
      const btn = document.getElementById('playBtn');
      btn.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';

      // Sync demo button
      const demoBtn = document.getElementById('demoBtn');
      if (this.engine._demoNodes) {
        demoBtn.classList.add('playing');
        demoBtn.innerHTML = '&#9632; 停止 Demo';
      } else {
        demoBtn.classList.remove('playing');
        demoBtn.innerHTML = '&#9654; Demo 演示';
      }
    };

    this.engine.onTrackChange = () => {
      this._updatePlaylist();
    };

    this.engine.onPlaylistChange = () => {
      this._updatePlaylist();
    };
  }

  /* ---- Progress Bar ---- */
  _initProgress() {
    const wrap = document.getElementById('progressWrap');

    const seekTo = (e) => {
      const rect = wrap.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      this.engine.seek(pct);
    };

    wrap.addEventListener('mousedown', (e) => {
      this._seekDragging = true;
      seekTo(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (this._seekDragging) seekTo(e);
    });

    document.addEventListener('mouseup', () => {
      this._seekDragging = false;
    });
  }

  /* ---- Volume ---- */
  _initVolume() {
    const slider = document.getElementById('volumeSlider');
    slider.addEventListener('input', () => {
      this.engine.setVolume(parseInt(slider.value));
    });
  }

  _syncVolume() {
    document.getElementById('volumeSlider').value = Math.round(this.engine.volume * 100);
  }

  /* ---- Playlist ---- */
  _updatePlaylist() {
    const list = document.getElementById('playlist');
    list.innerHTML = '';

    if (this.engine.playlist.length === 0) {
      list.innerHTML = '<li class="playlist-empty">列表为空<br>拖放文件或点击下方按钮添加</li>';
      return;
    }

    this.engine.playlist.forEach((track, i) => {
      const li = document.createElement('li');
      li.className = 'playlist-item' + (i === this.engine.currentIndex ? ' active' : '');

      const name = document.createElement('span');
      name.className = 'track-name';
      name.textContent = track.name;
      name.title = track.name;

      const del = document.createElement('button');
      del.className = 'track-del';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.removeTrack(i);
      });

      li.appendChild(name);
      li.appendChild(del);

      li.addEventListener('click', () => {
        this.engine.play(i);
      });

      list.appendChild(li);
    });
  }

  /* ---- Drag & Drop ---- */
  _initDragDrop() {
    const container = document.getElementById('canvasContainer');
    const overlay = document.getElementById('dropOverlay');

    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

    ['dragenter', 'dragover'].forEach(ev => {
      container.addEventListener(ev, (e) => { prevent(e); overlay.classList.add('active'); });
    });

    ['dragleave', 'drop'].forEach(ev => {
      overlay.addEventListener(ev, (e) => { prevent(e); overlay.classList.remove('active'); });
    });

    container.addEventListener('drop', (e) => {
      prevent(e);
      overlay.classList.remove('active');
      if (e.dataTransfer.files.length > 0) {
        this._handleFiles(e.dataTransfer.files);
      }
    });
  }

  /* ---- File Input ---- */
  _initFileInput() {
    const input = document.getElementById('fileInput');
    document.getElementById('addMusicBtn').addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files.length > 0) this._handleFiles(input.files);
      input.value = '';
    });
  }

  async _handleFiles(fileList) {
    for (const file of fileList) {
      if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name)) {
        await this.engine.loadFile(file);
      }
    }
  }

  /* ---- Folder Scan ---- */
  _initFolderScan() {
    const btn = document.getElementById('scanFolderBtn');

    if (!window.showDirectoryPicker) {
      btn.style.display = 'none';
      return;
    }

    btn.addEventListener('click', async () => {
      try {
        const dirHandle = await window.showDirectoryPicker();
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(entry.name)) {
            const file = await entry.getFile();
            await this.engine.loadFile(file);
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    });
  }

  /* ---- Demo ---- */
  _initDemo() {
    document.getElementById('demoBtn').addEventListener('click', () => {
      if (this.engine._demoNodes) {
        this.engine.pause();
      } else {
        this.engine.startDemo();
      }
    });
  }

  /* ---- Per-frame updates ---- */
  update() {
    const pct = this.engine.getProgress();
    document.getElementById('progressFill').style.width = (pct * 100) + '%';

    const t = this.engine.getCurrentTime();
    const d = this.engine.getDuration();
    document.getElementById('currentTime').textContent = formatTime(t);
    document.getElementById('durationTime').textContent = formatTime(d);
  }
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
