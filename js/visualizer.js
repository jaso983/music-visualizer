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

    this.particles = [];
    this._energyHistory = [];
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
    this.particles = [];
    this._energyHistory = [];
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
      case 'particles': this._drawParticles(); break;
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
    const len = frequencyData.length;
    const barW = width / len;
    const gap = Math.max(1, barW * 0.15);

    for (let i = 0; i < len; i++) {
      const v = frequencyData[i] / 255;
      const barH = v * height * 0.85;
      const hue = (i / len) * 300 + 200;
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
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * 0.38;
    const innerR = maxR * 0.25;
    const len = frequencyData.length;

    const bassAvg = frequencyData.slice(0, 15).reduce((a, b) => a + b, 0) / (15 * 255);
    const pulse = innerR + bassAvg * 12;

    ctx.fillStyle = this.theme === 'dark' ? 'rgba(233, 69, 96, 0.12)' : 'rgba(214, 51, 108, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, pulse + 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < len; i++) {
      const v = frequencyData[i] / 255;
      const angle = (i / len) * Math.PI * 2 - Math.PI / 2;
      const barH = v * (maxR - innerR);
      const hue = (i / len) * 360;

      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * (innerR + barH);
      const y2 = cy + Math.sin(angle) * (innerR + barH);

      ctx.strokeStyle = `hsl(${hue}, 80%, ${50 + v * 25}%)`;
      ctx.lineWidth = Math.max(1.2, (maxR - innerR) / len * 1.8);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  /* ---- Mode: Particles ---- */
  _drawParticles() {
    const { ctx, width, height, frequencyData } = this;
    const cx = width / 2;
    const cy = height / 2;

    const bass = frequencyData.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
    const mid = frequencyData.slice(15, 60).reduce((a, b) => a + b, 0) / 45;

    // Beat detection
    this._energyHistory.push(bass);
    if (this._energyHistory.length > 43) this._energyHistory.shift();
    const avgEnergy = this._energyHistory.reduce((a, b) => a + b, 0) / this._energyHistory.length;
    const isBeat = bass > avgEnergy * 1.5 && bass > 25;

    // Spawn particles
    const spawnCount = isBeat ? Math.floor(bass / 8) : Math.floor(bass / 25);
    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (bass / 255) * 5 + 0.5;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.006 + Math.random() * 0.018,
        size: 1.2 + Math.random() * 4,
        hue: (angle / (Math.PI * 2)) * 360 + mid * 0.3,
      });
    }

    // Draw glow on beat
    if (isBeat) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
      glow.addColorStop(0, 'rgba(233, 69, 96, 0.15)');
      glow.addColorStop(1, 'rgba(233, 69, 96, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.fill();
    }

    // Update & draw
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.995;
      p.vy *= 0.995;
      p.life -= p.decay;

      if (p.life <= 0 || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life * 0.8})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.particles.length > 600) {
      this.particles = this.particles.slice(-600);
    }
  }

  /* ---- Mode: Waveform ---- */
  _drawWaveform() {
    const { ctx, width, height, timeData } = this;
    const midY = height / 2;

    // Mirror fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    const c = this.theme === 'dark' ? '233, 69, 96' : '214, 51, 108';
    grad.addColorStop(0, `rgba(${c}, 0.02)`);
    grad.addColorStop(0.45, `rgba(${c}, 0.15)`);
    grad.addColorStop(0.5, `rgba(${c}, 0.4)`);
    grad.addColorStop(0.55, `rgba(${c}, 0.15)`);
    grad.addColorStop(1, `rgba(${c}, 0.02)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, midY);

    const step = width / timeData.length;
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128 - 1;
      const y = midY + v * midY * 0.9;
      ctx.lineTo(i * step, y);
    }

    // Mirror
    for (let i = timeData.length - 1; i >= 0; i--) {
      const v = timeData[i] / 128 - 1;
      const y = midY - v * midY * 0.9;
      ctx.lineTo(i * step, y);
    }

    ctx.closePath();
    ctx.fill();

    // Center line
    ctx.strokeStyle = this.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Glow waveform line
    ctx.strokeStyle = this.theme === 'dark' ? '#e94560' : '#d6336c';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.theme === 'dark' ? '#e94560' : '#d6336c';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128 - 1;
      const y = midY + v * midY * 0.9;
      if (i === 0) ctx.moveTo(i * step, y);
      else ctx.lineTo(i * step, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
