(function () {
  'use strict';

  var engine = new AudioEngine();
  var viz = new Visualizer();
  var ui = new UI(engine, viz);

  var freqBuf = null;
  var timeBuf = null;

  function init() {
    engine.init();
    viz.init(document.getElementById('visualizer'));
    ui.init();

    freqBuf = new Uint8Array(engine.analyser.frequencyBinCount);
    timeBuf = new Uint8Array(engine.analyser.frequencyBinCount);

    loop();
  }

  function loop() {
    requestAnimationFrame(loop);

    if (engine.analyser) {
      engine.analyser.getByteFrequencyData(freqBuf);
      engine.analyser.getByteTimeDomainData(timeBuf);
      viz.updateData(freqBuf, timeBuf);
    }

    viz.render();
    ui.update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
