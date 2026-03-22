// --- Cache the last selection so it survives popup focus steal ---
let lastSelection = '';

// --- Floating TTS selection button ---
const selBtn = document.createElement('button');
selBtn.id = 'anarchist-sel-btn';
selBtn.innerHTML = '&#127908; Stutter Speak';
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(selBtn), { once: true });
if (document.body) document.body.appendChild(selBtn);

function positionSelBtn(x, y) {
  selBtn.style.left = Math.min(x, window.innerWidth - 160) + 'px';
  selBtn.style.top  = Math.max(y - 44, 6) + 'px';
}

document.addEventListener('mouseup', (e) => {
  const sel = window.getSelection().toString().trim();
  if (sel) {
    lastSelection = sel;
    positionSelBtn(e.clientX - 60, e.clientY);
    selBtn.style.display = 'flex';
  } else {
    selBtn.style.display = 'none';
  }
});

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection().toString().trim();
  if (sel) lastSelection = sel;
  if (!sel) selBtn.style.display = 'none';
});

selBtn.addEventListener('mousedown', e => e.preventDefault());
selBtn.addEventListener('click', () => {
  selBtn.style.display = 'none';
  const text = window.getSelection().toString().trim() || lastSelection;
  if (!text) return;
  if (!chrome?.storage?.sync) {
    showToast('Extension reloaded — please refresh the page.');
    return;
  }
  chrome.storage.sync.get(['ttsVoice', 'stutterIntensity'], (data) => {
    runTTS(text, data.stutterIntensity ?? 50, data.ttsVoice || 'en_us_006');
  });
});

// --- Status bar ---
const statusBar = document.createElement('div');
statusBar.id = 'anarchist-status-bar';
const spinner = document.createElement('span');
spinner.className = 'anarchist-spinner';
const statusMsg = document.createElement('span');
statusBar.appendChild(spinner);
statusBar.appendChild(statusMsg);
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(statusBar), { once: true });
if (document.body) document.body.appendChild(statusBar);

function setStatus(msg) {
  if (!msg) {
    statusBar.style.display = 'none';
    statusMsg.textContent = '';
    return;
  }
  statusMsg.textContent = msg;
  statusBar.style.display = 'flex';
  console.log('[Anarchist TTS]', msg);
}

// --- Shared TTS runner ---
function runTTS(text, stutterIntensity, voiceName) {
  const words = text.trim().split(/\s+/).length;
  setStatus(`Preparing ${words} word${words !== 1 ? 's' : ''}...`);
  TTSController.speakWithStutter(text, {
    stutterIntensity,
    voiceName,
    onStatus: setStatus
  }).then(() => {
    setStatus(null);
    showToast('Done');
  }).catch((err) => {
    setStatus(null);
    console.error('[Anarchist] TTS error:', err);
    showToast('Speech error: ' + err.message);
  });
}

// --- Listen for messages from popup / background ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'stutterSpeak':
      handleStutterSpeak(message, sendResponse);
      return true;
    case 'stopSpeaking':
      TTSController.stop();
      showToast('Stopped');
      break;
    case 'touchGrass':
      handleTouchGrass();
      break;
    case 'feature2':
      handleFeature2();
      break;
    case 'contextMenu':
      handleContextMenu(message);
      break;
    case 'toggleMeanMode':
      message.status ? startObserving() : stopObserving();
      break;
    case 'show_anarchist_popup':
  showChaosPopup(message.title); // Calls your green/black box function
  sendResponse({ status: "Popup displayed" }); // Clears the 'undefined' log
  break;
    case 'toggleBurnoutMode':
      if (message.status) {
        if (isPdfPage()) startBurnoutMode();
      } else {
        stopBurnoutMode();
      }
      break;
  }
});

function handleStutterSpeak(message, sendResponse) {
  const selection = message.text
    || window.getSelection().toString().trim()
    || lastSelection;

  if (!selection) {
    sendResponse({ error: 'No text selected' });
    showToast('Select some text first!');
    return;
  }

  sendResponse({ ok: true });

  chrome.storage.sync.get(['ttsVoice'], (data) => {
    runTTS(selection, message.stutterIntensity ?? 50, data.ttsVoice || 'en_us_006');
  });
}

function handleTouchGrass() {
  const existing = document.getElementById('anarchist-grass-overlay');
  if (existing) existing.remove();

  const grassUrl = chrome.runtime.getURL('assets/grass.jpeg');

  const overlay = document.createElement('div');
  overlay.id = 'anarchist-grass-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.85)',
    animation: 'anarchist-fadein 0.4s ease'
  });

  const img = document.createElement('img');
  img.src = grassUrl;
  Object.assign(img.style, {
    maxWidth: '80vw',
    maxHeight: '60vh',
    borderRadius: '16px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
    objectFit: 'cover'
  });

  const btn = document.createElement('button');
  btn.textContent = 'Maybe it\'s time to touch it';
  Object.assign(btn.style, {
    marginTop: '32px',
    padding: '16px 40px',
    fontSize: '22px',
    fontWeight: 'bold',
    fontFamily: 'system-ui, sans-serif',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(39,174,96,0.5)',
    transition: 'transform 0.1s'
  });
  btn.addEventListener('mouseenter', () => { if (!btn.disabled) btn.style.transform = 'scale(1.05)'; });
  btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1.0)');

  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';

    showMeanBurn("Maybe it's time to touch grass.", {
      container: overlay,
      onDone: () => {
        overlay.remove();
        chrome.runtime.sendMessage({ action: 'closeAllWindows' });
      }
    });
  });

  if (!document.getElementById('anarchist-styles')) {
    const style = document.createElement('style');
    style.id = 'anarchist-styles';
    style.textContent = `
      @keyframes anarchist-fadein {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  overlay.appendChild(img);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

function handleFeature2() {
  const stats = {
    links: document.querySelectorAll('a').length,
    images: document.querySelectorAll('img').length,
    headings: document.querySelectorAll('h1,h2,h3').length
  };
  showToast(`Links: ${stats.links} | Images: ${stats.images} | Headings: ${stats.headings}`);
}

function handleContextMenu(message) {
  if (message.subAction === 'stutterSpeak') {
    const text = message.selection || window.getSelection().toString().trim() || lastSelection;
    if (!text) {
      showToast('No text selected');
      return;
    }
    showToast('Speaking...');
    chrome.storage.sync.get(['stutterIntensity', 'ttsVoice'], (data) => {
      runTTS(text, data.stutterIntensity ?? 50, data.ttsVoice || 'en_us_006');
    });
  }
}

// --- Auto-trigger Touch Grass randomly on page load (30% chance, if enabled) ---
chrome.storage.local.get('touchGrassEnabled', (data) => {
  if (!data.touchGrassEnabled) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (Math.random() < 0.30) handleTouchGrass();
    });
  } else {
    if (Math.random() < 0.30) handleTouchGrass();
  }
});

// --- Toast notification helper ---

// ============================================================
// --- Shared Sprite Animator for alex_sprite.png ---
// ============================================================
const SpriteAnimator = {
  CHAR_W: 90,
  CHAR_H: 120,
  TOTAL_FRAMES: 10,
  HEADER_RATIO: 0.10,
  ROWS: { idle: 0, walk: 1, salute: 4 },

  createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = this.CHAR_W;
    canvas.height = this.CHAR_H;
    Object.assign(canvas.style, { display: 'block', imageRendering: 'pixelated' });
    return canvas;
  },

  loadImage() {
    const img = new Image();
    img.src = chrome.runtime.getURL('assets/alex_sprite.png');
    return img;
  },

  draw(ctx, img, row, frame, facing, w, h) {
    ctx.clearRect(0, 0, w, h);
    if (!img.complete || !img.naturalWidth) return;
    const fw = img.naturalWidth / this.TOTAL_FRAMES;
    const headerOff = img.naturalHeight * this.HEADER_RATIO;
    const fh = (img.naturalHeight * (1 - this.HEADER_RATIO)) / 5;
    ctx.save();
    if (facing === 'left') {
      ctx.scale(-1, 1);
      ctx.drawImage(img, frame * fw, headerOff + row * fh, fw, fh, -w, 0, w, h);
    } else {
      ctx.drawImage(img, frame * fw, headerOff + row * fh, fw, fh, 0, 0, w, h);
    }
    ctx.restore();
  },

  // Creates a standard walk-in wrapper positioned at bottom-right, off-screen
  createWalkWrapper(position) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: position || 'fixed',
      bottom: '70px',
      right: '0px',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transform: `translateX(${this.CHAR_W + 20}px)`,
      transition: 'transform 0s'
    });
    return wrap;
  },

  // Creates a speech bubble element
  createBubble(text) {
    const bubble = document.createElement('div');
    Object.assign(bubble.style, {
      background: '#fff', border: '2px solid #333', borderRadius: '10px',
      padding: '8px 12px', marginBottom: '6px', maxWidth: '220px',
      fontSize: '13px', fontFamily: 'system-ui, sans-serif', fontWeight: 'bold',
      color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', opacity: '0',
      transition: 'opacity 0.4s', textAlign: 'center', position: 'relative'
    });
    bubble.textContent = text;
    const tri = document.createElement('div');
    Object.assign(tri.style, {
      position: 'absolute', bottom: '-10px', right: '18px',
      width: '0', height: '0',
      borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
      borderTop: '10px solid #333'
    });
    bubble.appendChild(tri);
    return bubble;
  },

  // Shared easing helpers
  easeOut(p) { return 1 - Math.pow(1 - p, 3); },
  easeIn(p)  { return Math.pow(p, 3); },

  // Standard walk-in/out translateX
  slideX(wrap, startX, targetX, progress, easing) {
    const x = startX + (targetX - startX) * easing(progress);
    wrap.style.transform = `translateX(${x}px)`;
  }
};

// --- Mean Mode: stickman walk-in then show burn ---
function showMeanBurn(message, opts = {}) {
  const container  = opts.container || document.body;
  const onDone     = opts.onDone   || null;
  const positioned = container === document.body ? 'fixed' : 'absolute';

  const existing = document.getElementById('anarchist-stickman');
  if (existing) existing.remove();

  // Start TTS in parallel
  let ttsPromise;
  chrome.storage.sync.get(['ttsVoice', 'stutterIntensity'], (data) => {
    const voiceName        = data.ttsVoice         || 'en_us_006';
    const stutterIntensity = data.stutterIntensity  ?? 50;
    ttsPromise = TTSController.speakWithStutter(message, { stutterIntensity, voiceName, onStatus: () => {} })
      .catch(() => new Promise(resolve => {
        if (!window.speechSynthesis) { resolve(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(message);
        u.onend = u.onerror = resolve;
        window.speechSynthesis.speak(u);
      }));
    if (phase === 'idle') startWalkout();
  });

  const { CHAR_W, CHAR_H, ROWS } = SpriteAnimator;
  const ANIM_SPEED = 4;
  const wrap = SpriteAnimator.createWalkWrapper(positioned);
  wrap.id = 'anarchist-stickman';
  const bubble = SpriteAnimator.createBubble(message);
  const canvas = SpriteAnimator.createCanvas();
  const img = SpriteAnimator.loadImage();
  const ctx = canvas.getContext('2d');

  wrap.appendChild(bubble);
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  let frameCount = 0, currentFrame = 0;
  let phase = 'walkin', facing = 'left', rafId;
  const START_X = CHAR_W + 20, TARGET_X = 0, WALK_DURATION = 80;
  let walkTick = 0;
  const SALUTE_HOLD = 80;
  let saluteTick = 0;

  let walkoutScheduled = false;
  function startWalkout() {
    if (walkoutScheduled) return;
    if (!ttsPromise) return;
    walkoutScheduled = true;
    ttsPromise.then(() => { phase = 'walkout'; facing = 'right'; bubble.style.opacity = '0'; walkTick = 0; });
  }

  function tick() {
    if (phase === 'salute' || phase === 'idle') {
      SpriteAnimator.draw(ctx, img, phase === 'salute' ? ROWS.salute : ROWS.idle, 0, facing, CHAR_W, CHAR_H);
    } else {
      frameCount++;
      if (frameCount >= ANIM_SPEED) { frameCount = 0; currentFrame = (currentFrame + 1) % SpriteAnimator.TOTAL_FRAMES; }
      SpriteAnimator.draw(ctx, img, ROWS.walk, currentFrame, facing, CHAR_W, CHAR_H);
    }

    if (phase === 'walkin') {
      walkTick++;
      const p = Math.min(walkTick / WALK_DURATION, 1);
      SpriteAnimator.slideX(wrap, START_X, TARGET_X, p, SpriteAnimator.easeOut);
      if (p >= 1) { phase = 'salute'; saluteTick = 0; }
    } else if (phase === 'salute') {
      saluteTick++;
      if (saluteTick >= SALUTE_HOLD) {
        phase = 'idle'; facing = 'left';
        bubble.style.opacity = '1';
        startWalkout();
      }
    } else if (phase === 'walkout') {
      walkTick++;
      const p = Math.min(walkTick / WALK_DURATION, 1);
      SpriteAnimator.slideX(wrap, TARGET_X, START_X, p, SpriteAnimator.easeIn);
      if (p >= 1) { cancelAnimationFrame(rafId); wrap.remove(); onDone?.(); return; }
    }
    rafId = requestAnimationFrame(tick);
  }

  img.onload = () => { rafId = requestAnimationFrame(tick); };
  if (img.complete && img.naturalWidth) rafId = requestAnimationFrame(tick);
}

function showToast(text) {
  document.querySelectorAll('.hdp-toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'hdp-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

const burns = {
  ai: [
    "Oh, asking the magic rock to think for you again?",
    "Natural intelligence failed, so we're trying the artificial kind?",
    "I'd explain why this is a bad prompt, but you'd just ask GPT to summarize it.",
    "BEEP BOOP: 'I am a human who can't do my own homework.'"
  ],
  shopping: [
    "Your bank account is screaming. Please stop.",
    "Another purchase? That's bold for someone with your credit score.",
    "Window shopping? Or just torture-testing your self-control?",
    "That'll look great in the back of your closet for the next three years."
  ],
  social: [
    "Scrolling again? Your dopamine receptors are literally fried.",
    "Comparing your life to strangers? A classic Friday night move.",
    "Refresh the page. Maybe someone liked your mediocre photo yet."
  ],
  generic: [
    "I've seen faster typing from a pigeon.",
    "Is this really the best use of your limited time on Earth?",
    "Staring at the screen won't make you smarter, but keep trying."
  ],
  white_bg: [
    "My eyes! Use dark mode, you caveman."
  ],
  nerd: [
    "Esti urzica vere...",
    "At this point just give up"
  ]
};

// Helper to get a random insult from a category
const getBurn = (category) => {
  const list = burns[category] || burns.generic;
  return list[Math.floor(Math.random() * list.length)];
};


// Check if mean mode is already on when a new tab opens
chrome.storage.local.get('meanModeActive', (data) => {
  if (data.meanModeActive) startObserving();
});

function startObserving() {
  // 1. Detect Brightness (Mean Dark Mode check)
  const bgColor = window.getComputedStyle(document.body).backgroundColor;
  if (bgColor.includes("255, 255, 255")) {
    showMeanBurn(getBurn('white_bg'));
  }

  // 2. Watch for "Stupid" interactions
  function handleStupidClick(e) {
  const btn = e.target.closest('button') || e.target.closest('a');
  if (btn) {
    const btnText = btn.innerText.toLowerCase().trim();
    const buyKeywords = ['cart', 'buy', 'checkout', 'purchase', 'order', 'pay', 'cos', 'cumparaturi'];
    const isBuying = buyKeywords.some(keyword => btnText.includes(keyword));
    if (isBuying) {
      showMeanBurn(getBurn('shopping'));
    }
  }
  }
  document.addEventListener('click', handleStupidClick);
  window.__anarchistClickHandler = handleStupidClick;
  
  // 3. Mutation Observer to watch for AI/Search queries
  const observer = new MutationObserver(() => {
    const text = document.body.innerText.toLowerCase();
    if (text.includes("moodle")) {
      // Use a debounce or a flag so it doesn't spam toasts
      if (!window.recentlyInsulted) {
        showMeanBurn(getBurn('nerd'));
        window.recentlyInsulted = true;
        setTimeout(() => window.recentlyInsulted = false, 10000);
      }
    }
    
    if (text.includes("how do i") || text.includes("chatgpt") || text.includes("gemini") || text.includes("claude") || text.includes("how to")) {
      // Use a debounce or a flag so it doesn't spam toasts
      if (!window.recentlyInsulted) {
        showMeanBurn(getBurn('ai'));
        window.recentlyInsulted = true;
        setTimeout(() => window.recentlyInsulted = false, 10000);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserving() {
  if (window.__anarchistClickHandler) {
    document.removeEventListener('click', window.__anarchistClickHandler);
    window.__anarchistClickHandler = null;
  }
  location.reload();
}

// --- LeetCode Stickman Roasts ---

const ROASTS = {
  'Wrong Answer': [
    "wrong answer?? shocking. truly.",
    "bro really said \'I know algorithms \' 💀",
    "your solution is wrong. just like your life choices.",
    "even a for loop would've done better.",
    "wrong answer. go touch grass.",
    "you spent all that time on this. for THAT.",
    "have you considered a career change?",
  ],
  'Time Limit Exceeded': [
    "O(n²) in 2025. brave.",
    "time limit exceeded. just like your patience.",
    "have you heard of Big O notation? asking for a friend.",
    "your algo is slower than you walking to the gym.",
    "bro discovered nested loops and never looked back.",
    "the server fell asleep waiting for your code.",
  ],
  'Runtime Error': [
    "runtime error. classic.",
    "it didn't even run properly. impressive.",
    "null pointer? in this economy?",
    "your code crashed. much like your confidence.",
    "index out of bounds? check your ego too.",
    "the compiler is crying.",
  ],
  'Memory Limit Exceeded': [
    "you really said 'memory is free' huh.",
    "storing the entire internet in one array i see.",
    "memory limit exceeded. delete some bad ideas first.",
    "your RAM called. it wants a divorce.",
  ],
  'Compile Error': [
    "it didn't even compile bro 💀",
    "syntax error. you can't even type correctly.",
    "compile error. go back to hello world.",
    "the compiler is embarrassed for you.",
    "have you tried turning your brain off and on again?",
  ],
  'Accepted': [
    "wow. correct. it only took forever.",
    "even a broken clock is right twice a day.",
    "ok fine. you got one. don't let it go to your head.",
    "accepted. now go touch grass anyway.",
    "you passed. your mom is still not impressed.",
  ],
};

function randomRoast(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function stickmanSpeak(text, mood) {
  return new Promise((resolve) => {
    showMeanBurn(text, {onDone: resolve});
  });
}

// Exposed globally so background.js can reach it via executeScript
window.__lcStickmanSpeak = stickmanSpeak;

function detectResult(node) {
  const text = node.innerText || node.textContent || '';
  for (const [result, roasts] of Object.entries(ROASTS)) {
    if (text.includes(result)) {
      chrome.storage.local.get('lcRoastEnabled', (data) => {
        if (!data.lcRoastEnabled) return;
        const mood = result === 'Accepted' ? 'happy' : 'roast';
      
      stickmanSpeak(randomRoast(roasts), mood);
      });
      
      return true;
    }
  }
  return false;
}

function initRoastObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (detectResult(node)) return;
        const children = node.querySelectorAll ? node.querySelectorAll('*') : [];
        for (const child of children) {
          if (detectResult(child)) return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (location.hostname.includes('leetcode.com')) {
  initRoastObserver();
}

//Tab killing
function showChaosPopup(titleText) {
  const existing = document.getElementById('anarchist-popup');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'anarchist-popup';
  div.innerHTML = `
    <div style="font-weight:bold; border-bottom:1px solid #00ff00; margin-bottom:8px;">⚠️ SYSTEM ANARCHY</div>
    <div style="font-size:14px; color:#00ff00;">${titleText}</div>
    <div style="font-size:10px; margin-top:10px; color:red;">TERMINATING...</div>
  `;

  Object.assign(div.style, {
    position: 'fixed', top: '40px', right: '40px', width: '250px',
    backgroundColor: '#000', color: '#00ff00', padding: '20px',
    fontFamily: 'monospace', border: '2px solid #00ff00', zIndex: '2147483647',
    boxShadow: '10px 10px 0px #ff0000', pointerEvents: 'none'
  });

  document.body.appendChild(div);
}

// ============================================================
// --- Burnout Mode: arson stickman on PDF scroll ---
// ============================================================

let _burnoutScrollHandler = null;
let _burnoutLastFire = 0;
const BURNOUT_COOLDOWN = 20000; // ms between fires

function isPdfPage() {
  if (location.href.toLowerCase().includes('.pdf')) return true;
  if (document.querySelector('embed[type="application/pdf"]')) return true;
  if (document.querySelector('iframe[src*=".pdf"]')) return true;
  if (document.querySelector('#plugin')) return true;
  if (document.contentType === 'application/pdf') return true;
  // Chrome built-in PDF viewer URL
  if (location.href.startsWith('chrome-extension://') && location.href.includes('pdf')) return true;
  return false;
}

function startBurnoutMode() {
  if (_burnoutScrollHandler) return; // already running

  let _scrollThrottle = null;
  let scrollCount = 0;

  _burnoutScrollHandler = () => {
    const now = Date.now();
    if (now - _burnoutLastFire < BURNOUT_COOLDOWN) return;
    scrollCount++;
    if (scrollCount < 4) return;
    scrollCount = 0;
    _burnoutLastFire = now;
    chrome.runtime.sendMessage({ action: 'startBurnoutAudio' });
    triggerBurnout();
  };

  const throttled = () => {
    if (_scrollThrottle) return;
    _scrollThrottle = setTimeout(() => {
      _scrollThrottle = null;
      _burnoutScrollHandler && _burnoutScrollHandler();
    }, 500);
  };

  window.addEventListener('scroll', throttled, { passive: true });
  window.addEventListener('wheel', throttled, { passive: true, capture: true });
  document.addEventListener('scroll', throttled, { passive: true, capture: true });
  _burnoutScrollHandler._throttled = throttled;
  console.log('[Anarchist] Burnout Mode ON');
}

function stopBurnoutMode() {
  if (_burnoutScrollHandler && _burnoutScrollHandler._throttled) {
    window.removeEventListener('scroll', _burnoutScrollHandler._throttled);
    window.removeEventListener('wheel', _burnoutScrollHandler._throttled, { capture: true });
    document.removeEventListener('scroll', _burnoutScrollHandler._throttled, { capture: true });
  }
  _burnoutScrollHandler = null;
  chrome.runtime.sendMessage({ action: 'stopBurnoutAudio' });
  const burnoutEl = document.getElementById('anarchist-burnout-host');
  if (burnoutEl) burnoutEl.remove();
  console.log('[Anarchist] Burnout Mode OFF');
}

// Auto-start if already enabled when page loads (only on PDF pages)
chrome.storage.local.get('burnoutMode', (data) => {
  if (data.burnoutMode && isPdfPage()) startBurnoutMode();
});

function triggerBurnout() {
  if (document.getElementById('anarchist-burnout-host')) return;

  const lighterUrl = chrome.runtime.getURL('assets/lighter.png');
  const fireUrl    = chrome.runtime.getURL('assets/fire.png');

  const { CHAR_W, CHAR_H, ROWS } = SpriteAnimator;
  const ANIM_SPEED = 4;
  const FIRE_FRAME_SIZE = 341;
  const FIRE_GRID = 4;
  const FIRE_FRAMES = FIRE_GRID * FIRE_GRID;
  const FIRE_ANIM_SPEED = 3;

  // Shadow DOM host — isolates our elements from the page's CSS/CSP
  const host = document.createElement('div');
  host.id = 'anarchist-burnout-host';
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none' });
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  // Inner container inside shadow root
  const root = document.createElement('div');
  Object.assign(root.style, { position: 'relative', width: '100%', height: '100%' });
  shadow.appendChild(root);

  // Stickman
  const stickyWrap = SpriteAnimator.createWalkWrapper('fixed');
  const stickCanvas = SpriteAnimator.createCanvas();
  const stickImg = SpriteAnimator.loadImage();
  const stickCtx = stickCanvas.getContext('2d');
  stickyWrap.appendChild(stickCanvas);
  root.appendChild(stickyWrap);

  let stickFacing = 'left', stickFrame = 0, stickFrameTick = 0;

  // Lighter
  const lighterEl = document.createElement('img');
  lighterEl.src = lighterUrl;
  Object.assign(lighterEl.style, {
    position: 'fixed', width: '48px', height: '48px', objectFit: 'contain',
    display: 'none', zIndex: '2147483647', pointerEvents: 'none',
    transformOrigin: 'center center'
  });
  root.appendChild(lighterEl);

  // Fire tiles — tiled across the full bottom of the screen
  const tileCount = Math.ceil(window.innerWidth / FIRE_FRAME_SIZE) + 1;
  const fireTiles = [];
  for (let i = 0; i < tileCount; i++) {
    const tile = document.createElement('div');
    Object.assign(tile.style, {
      position: 'fixed', bottom: '0px', left: (i * FIRE_FRAME_SIZE) + 'px',
      width: FIRE_FRAME_SIZE + 'px', height: FIRE_FRAME_SIZE + 'px',
      backgroundImage: `url(${fireUrl})`,
      backgroundSize: `${FIRE_FRAME_SIZE * FIRE_GRID}px ${FIRE_FRAME_SIZE * FIRE_GRID}px`,
      backgroundRepeat: 'no-repeat', imageRendering: 'pixelated',
      display: 'none'
    });
    root.appendChild(tile);
    fireTiles.push(tile);
  }
  let fireFrame = 0, fireFrameTick = 0;

  function drawFire() {
    const col = fireFrame % FIRE_GRID;
    const row = Math.floor(fireFrame / FIRE_GRID) % FIRE_GRID;
    const pos = `-${col * FIRE_FRAME_SIZE}px -${row * FIRE_FRAME_SIZE}px`;
    fireTiles.forEach(t => { t.style.backgroundPosition = pos; });
  }

  // State machine
  let phase = 'walkin';
  const START_X = CHAR_W + 20, TARGET_X = 0, WALK_TICKS = 80;
  let walkTick = 0, rafId;
  let throwTick = 0;
  const THROW_TICKS = 55;
  const throwStartX = window.innerWidth - CHAR_W - 10;
  const throwStartY = window.innerHeight - CHAR_H - 20;
  const throwEndX   = window.innerWidth - FIRE_FRAME_SIZE - 10;
  const throwEndY   = window.innerHeight - 30;
  let fireTick = 0;
  const FIRE_DURATION = 180;

  function tick() {
    // Draw stickman
    if (phase === 'walkin' || phase === 'walkout') {
      stickFrameTick++;
      if (stickFrameTick >= ANIM_SPEED) { stickFrameTick = 0; stickFrame = (stickFrame + 1) % SpriteAnimator.TOTAL_FRAMES; }
      SpriteAnimator.draw(stickCtx, stickImg, ROWS.walk, stickFrame, stickFacing, CHAR_W, CHAR_H);
    } else if (phase === 'throw') {
      SpriteAnimator.draw(stickCtx, stickImg, ROWS.salute, 0, stickFacing, CHAR_W, CHAR_H);
    } else {
      SpriteAnimator.draw(stickCtx, stickImg, ROWS.idle, 0, stickFacing, CHAR_W, CHAR_H);
    }

    // Draw fire
    if (phase === 'fire' || phase === 'walkout') {
      fireFrameTick++;
      if (fireFrameTick >= FIRE_ANIM_SPEED) { fireFrameTick = 0; fireFrame = (fireFrame + 1) % FIRE_FRAMES; }
      drawFire();
    }

    if (phase === 'walkin') {
      walkTick++;
      const p = Math.min(walkTick / WALK_TICKS, 1);
      SpriteAnimator.slideX(stickyWrap, START_X, TARGET_X, p, SpriteAnimator.easeOut);
      if (p >= 1) { phase = 'throw'; throwTick = 0; }
    } else if (phase === 'throw') {
      if (throwTick === 0) lighterEl.style.display = 'block';
      throwTick++;
      const p = Math.min(throwTick / THROW_TICKS, 1);
      const lx = throwStartX + (throwEndX - throwStartX) * p;
      const ly = throwStartY + (throwEndY - throwStartY) * p - Math.sin(p * Math.PI) * 120;
      lighterEl.style.left = lx + 'px';
      lighterEl.style.top  = ly + 'px';
      lighterEl.style.transform = `rotate(${p * 360}deg)`;
      if (p >= 1) { lighterEl.style.display = 'none'; fireTiles.forEach(t => t.style.display = 'block'); drawFire(); phase = 'fire'; fireTick = 0; }
    } else if (phase === 'fire') {
      fireTick++;
      if (fireTick >= FIRE_DURATION) { phase = 'walkout'; stickFacing = 'right'; walkTick = 0; }
    } else if (phase === 'walkout') {
      walkTick++;
      const p = Math.min(walkTick / WALK_TICKS, 1);
      SpriteAnimator.slideX(stickyWrap, TARGET_X, START_X, p, SpriteAnimator.easeIn);
      if (p >= 1) { cancelAnimationFrame(rafId); host.remove(); return; }
    }
    rafId = requestAnimationFrame(tick);
  }

  const imgsDone = new Set();
  function onImageDone(key) {
    if (imgsDone.has(key)) return;
    imgsDone.add(key);
    rafId = requestAnimationFrame(tick);
  }
  stickImg.onload  = () => onImageDone('stick');
  stickImg.onerror = () => onImageDone('stick');
  if (stickImg.complete) onImageDone('stick');
}