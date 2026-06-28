class Visualizer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.mode = 'bars';
    this.theme = 'dark';

    this.frequencyData = null;
    this.timeData = null;

    this._smoothTime = null;
    this.settings = this._loadSettings();
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
  }

  setMode(mode) {
    this.mode = mode;
    this._smoothTime = null;
  }

  setTheme(theme) {
    this.theme = theme;
  }

  updateData(frequencyData, timeData) {
    this.frequencyData = frequencyData;
    this.timeData = timeData;
  }

  render() {
    const { ctx, width, height, dpr, theme } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = theme === 'dark' ? '#1a1a2e' : '#f0f0f5';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (!this.frequencyData || !this.timeData) {
      this._drawIdle();
      return;
    }

    switch (this.mode) {
      case 'bars': this._drawBars(); break;
      case 'circular': this._drawCircular(); break;
      case 'waveform': this._drawWaveform(); break;
    }
  }

  _drawIdle() {
    const { ctx, width, height, theme } = this;
    const cx = width / 2;
    const cy = height / 2;
    const t = Date.now() / 1000;

    // Pulsing circle
    const r = 40 + Math.sin(t * 1.5) * 8;
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    const hintColor = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    ctx.fillStyle = hintColor;
    ctx.font = '14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('加载音乐文件或点击 Demo 演示开始', cx, cy + 70);
  }

  /* ---- Mode: Bars ---- */
  _drawBars() {
    const { ctx, width, height, frequencyData } = this;
    const s = this.settings.bars;
    const len = frequencyData.length;
    const visible = Math.floor(len * (s.freqRange / 100));
    const barW = width / visible;
    const gap = Math.max(1, barW * s.barGap);

    for (let i = 0; i < visible; i++) {
      const v = frequencyData[i] / 255;
      const barH = v * height * s.ampSensitivity;
      const hue = (i / visible) * s.hueRange + s.hueStart;
      const lightness = 40 + v * 35;

      const grad = ctx.createLinearGradient(0, height, 0, height - barH);
      grad.addColorStop(0, `hsl(${hue}, 75%, ${lightness}%)`);
      grad.addColorStop(1, `hsl(${hue}, 90%, ${lightness + 20}%)`);

      ctx.fillStyle = grad;
      ctx.fillRect(i * barW + gap / 2, height - barH, barW - gap, barH);

      ctx.fillStyle = `hsla(${hue}, 90%, 70%, ${v * 0.5})`;
      ctx.fillRect(i * barW + gap / 2, height - barH, barW - gap, Math.max(1, barW));
    }
  }

  /* ---- Mode: Circular ---- */
  _drawCircular() {
    const { ctx, width, height, frequencyData } = this;
    const s = this.settings.circular;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * s.outerRadius;
    const innerR = maxR * s.innerRadius;
    const len = frequencyData.length;
    const visible = Math.floor(len * 0.82);

    const bassAvg = frequencyData.slice(0, 15).reduce((a, b) => a + b, 0) / (15 * 255);
    const pulse = innerR + bassAvg * s.pulseStrength;

    ctx.fillStyle = this.theme === 'dark' ? 'rgba(233, 69, 96, 0.12)' : 'rgba(214, 51, 108, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, pulse + 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < visible; i++) {
      const v = frequencyData[i] / 255;
      const angle = (i / visible) * Math.PI * 2 - Math.PI / 2;
      const barH = v * (maxR - innerR) * s.ampSensitivity;
      const hue = (i / visible) * s.hueSpan;

      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * (innerR + barH);
      const y2 = cy + Math.sin(angle) * (innerR + barH);

      ctx.strokeStyle = `hsl(${hue}, 80%, ${50 + v * 25}%)`;
      ctx.lineWidth = Math.max(1.2, (maxR - innerR) / visible * 1.8);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  /* ---- Mode: Waveform ---- */
  _drawWaveform() {
    const { ctx, width, height, timeData } = this;
    const s = this.settings.waveform;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * s.ringRadius;
    const len = timeData.length;

    // Temporal smoothing
    if (!this._smoothTime || this._smoothTime.length !== len) {
      this._smoothTime = new Float32Array(len);
      for (let i = 0; i < len; i++) this._smoothTime[i] = timeData[i];
    }
    const alpha = s.smoothing;
    for (let i = 0; i < len; i++) {
      this._smoothTime[i] += (timeData[i] - this._smoothTime[i]) * alpha;
    }

    // Reference rings
    for (let r = maxR * 0.25; r <= maxR * 1.05; r += maxR * 0.2) {
      ctx.strokeStyle = this.theme === 'dark'
        ? `rgba(255,255,255,${0.04})`
        : `rgba(0,0,0,${0.04})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const accent = (a) => this.theme === 'dark'
      ? `hsla(${s.accentHue}, 75%, 55%, ${a})`
      : `hsla(${s.accentHue}, 65%, 48%, ${a})`;

    // Outer ring — smoothed full-resolution
    ctx.strokeStyle = accent(1);
    ctx.lineWidth = s.lineWidth;
    ctx.shadowColor = accent(1);
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const v = this._smoothTime[i] / 128 - 1;
      const angle = (i / len) * Math.PI * 2 - Math.PI / 2;
      const r = maxR * 0.55 + v * maxR * s.ampSensitivity;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner ring — decimated & smoothed
    const step = Math.ceil(len / 90);
    ctx.strokeStyle = accent(0.45);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < len; i += step) {
      let sum = 0;
      let n = 0;
      for (let j = i; j < i + step && j < len; j++, n++) { sum += this._smoothTime[j]; }
      const v = (sum / n) / 128 - 1;
      const angle = (i / len) * Math.PI * 2 - Math.PI / 2;
      const r = maxR * 0.55 + v * maxR * s.ampSensitivity;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Center dot
    let ampSum = 0;
    for (let i = 0; i < len; i++) { ampSum += Math.abs(this._smoothTime[i] / 128 - 1); }
    const dotR = 3 + (ampSum / len) * 14;
    ctx.fillStyle = accent(0.65);
    ctx.shadowColor = accent(1);
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _defaultSettings() {
    const s = {};
    for (const [mode, defs] of Object.entries(Visualizer.SETTINGS_DEF)) {
      s[mode] = {};
      defs.forEach(d => { s[mode][d.key] = d.default; });
    }
    return s;
  }

  _loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('viz-settings'));
      const defaults = this._defaultSettings();
      if (saved) {
        for (const mode of Object.keys(defaults)) {
          if (saved[mode]) {
            defaults[mode] = { ...defaults[mode], ...saved[mode] };
          }
        }
      }
      return defaults;
    } catch (e) {
      return this._defaultSettings();
    }
  }

  updateSetting(mode, key, value) {
    if (this.settings[mode] && this.settings[mode].hasOwnProperty(key)) {
      this.settings[mode][key] = value;
      localStorage.setItem('viz-settings', JSON.stringify(this.settings));
    }
  }
}

Visualizer.SETTINGS_DEF = {
  bars: [
    { key: 'ampSensitivity', label: '振幅灵敏度', min: 0.1, max: 2.0, step: 0.01, default: 0.85 },
    { key: 'hueStart',      label: '起始色相',   min: 0,   max: 360, step: 1,    default: 200 },
    { key: 'hueRange',      label: '色相跨度',   min: 60,  max: 360, step: 1,    default: 300 },
    { key: 'barGap',        label: '柱间间隙',   min: 0,   max: 0.5, step: 0.01, default: 0.15 },
    { key: 'freqRange',     label: '频率范围 %',  min: 10,  max: 100, step: 1,    default: 82 },
  ],
  circular: [
    { key: 'ampSensitivity', label: '振幅灵敏度', min: 0.2, max: 2.5, step: 0.01, default: 1.0 },
    { key: 'outerRadius',    label: '外圈半径',   min: 0.15, max: 0.48, step: 0.01, default: 0.38 },
    { key: 'innerRadius',    label: '内圈半径',   min: 0.05, max: 0.5, step: 0.01, default: 0.25 },
    { key: 'hueSpan',        label: '色相跨度',   min: 60,  max: 360, step: 1,    default: 360 },
    { key: 'pulseStrength',  label: '脉冲强度',   min: 0,   max: 30,  step: 0.5,  default: 12 },
  ],
  waveform: [
    { key: 'ampSensitivity', label: '振幅灵敏度',   min: 0.1, max: 1.0, step: 0.01, default: 0.42 },
    { key: 'smoothing',      label: '平滑度 alpha', min: 0.05, max: 0.8, step: 0.01, default: 0.28 },
    { key: 'lineWidth',      label: '线条粗细',     min: 0.5, max: 5,   step: 0.1,  default: 2.2 },
    { key: 'accentHue',      label: '强调色相',     min: 0,   max: 360, step: 1,    default: 350 },
    { key: 'ringRadius',     label: '参考环半径',   min: 0.2, max: 0.5, step: 0.01, default: 0.43 },
  ],
};
