let audioCtx = null;
let masterGain = null;
let sirenInterval = null;

function startSiren() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(audioCtx.destination);

  let rising = true;
  function scheduleTone() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.connect(env);
    env.connect(masterGain);
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(rising ? 280 : 560, now);
    osc.frequency.exponentialRampToValueAtTime(rising ? 560 : 280, now + 0.6);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.8, now + 0.05);
    env.gain.setValueAtTime(0.8, now + 0.55);
    env.gain.linearRampToValueAtTime(0, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
    rising = !rising;
  }

  scheduleTone();
  sirenInterval = setInterval(scheduleTone, 600);
}

function stopSiren() {
  if (sirenInterval) { clearInterval(sirenInterval); sirenInterval = null; }
  if (masterGain) { masterGain.disconnect(); masterGain = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'stopBurnoutAudio') stopSiren();
});

startSiren();
