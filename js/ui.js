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
    this._initSettings();
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
      this._showCurrentModeSection();
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

      this._updatePlaylist();
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
      li.className = 'playlist-item' + (i === this.engine.currentIndex && !this.engine._demoNodes ? ' active' : '');

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

  /* ---- Settings Panel ---- */
  _initSettings() {
    const modeNames = { bars: '频谱柱状', circular: '环形频谱', waveform: '波形图' };

    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.id = 'settingsPanel';

    let html = '<div class="settings-panel-header"><span class="settings-panel-title">可视化设置</span><button class="settings-close-btn" id="settingsCloseBtn">&times;</button></div>';

    for (const [mode, defs] of Object.entries(Visualizer.SETTINGS_DEF)) {
      html += `<div data-mode-section="${mode}" class="settings-section"><div class="settings-section-title">${modeNames[mode]}</div>`;
      defs.forEach(d => {
        const val = this.viz.settings[mode][d.key];
        html += `<div class="setting-item">
          <label class="setting-label"><span>${d.label}</span><span class="setting-value" data-value="${mode}-${d.key}">${val}</span></label>
          <input type="range" class="setting-slider" min="${d.min}" max="${d.max}" step="${d.step}" value="${val}" data-mode="${mode}" data-setting="${d.key}">
        </div>`;
      });
      html += `<button class="settings-reset-btn" data-mode="${mode}">重置默认</button></div>`;
    }

    panel.innerHTML = html;
    document.querySelector('.app-header').appendChild(panel);

    this._showCurrentModeSection();

    // Toggle open/close
    document.getElementById('settingsBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    document.getElementById('settingsCloseBtn').addEventListener('click', () => {
      panel.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target.id !== 'settingsBtn') {
        panel.classList.remove('open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') panel.classList.remove('open');
    });

    // Slider events
    panel.querySelectorAll('.setting-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const mode = slider.dataset.mode;
        const key = slider.dataset.setting;
        const value = parseFloat(slider.value);
        this.viz.updateSetting(mode, key, value);

        const valueSpan = panel.querySelector(`[data-value="${mode}-${key}"]`);
        if (valueSpan) {
          const def = Visualizer.SETTINGS_DEF[mode].find(d => d.key === key);
          valueSpan.textContent = def && def.step >= 1 ? value.toFixed(0) : value.toFixed(2);
        }
      });
    });

    // Reset buttons
    panel.querySelectorAll('.settings-reset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        Visualizer.SETTINGS_DEF[mode].forEach(d => {
          this.viz.updateSetting(mode, d.key, d.default);
          const slider = panel.querySelector(`.setting-slider[data-mode="${mode}"][data-setting="${d.key}"]`);
          if (slider) slider.value = d.default;
          const valueSpan = panel.querySelector(`[data-value="${mode}-${d.key}"]`);
          if (valueSpan) valueSpan.textContent = d.step >= 1 ? d.default.toFixed(0) : d.default.toFixed(2);
        });
      });
    });
  }

  _showCurrentModeSection() {
    const panel = document.getElementById('settingsPanel');
    if (!panel) return;
    panel.querySelectorAll('[data-mode-section]').forEach(sec => {
      sec.style.display = sec.dataset.modeSection === this.viz.mode ? '' : 'none';
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
