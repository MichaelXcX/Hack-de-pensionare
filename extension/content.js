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

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    btn.textContent = 'Speaking...';

    try {
      // Fetch + play inside the click handler — user activation satisfies autoplay policy
      const data = await new Promise(resolve => chrome.storage.sync.get(['ttsVoice', 'stutterIntensity'], resolve));
      const voiceName = data.ttsVoice || 'en_us_006';
      const stutterIntensity = data.stutterIntensity ?? 50;
      const stutterRate = StutterEngine.intensityToRate(stutterIntensity);
      const chunks = StutterEngine.stutterify("Maybe it's time to touch grass.", { stutterRate });
      const stutteredText = StutterEngine.flatten(chunks);

      // Chunk the text
      const segments = [];
      let current = '';
      for (const word of stutteredText.split(' ')) {
        const candidate = current ? current + ' ' + word : word;
        if (current && candidate.length > 140) { segments.push(current); current = word; }
        else current = candidate;
      }
      if (current.trim()) segments.push(current);

      const urls = segments.map(seg =>
        `https://api.flowery.pw/v1/tts?text=${encodeURIComponent(seg)}&voice=${encodeURIComponent(voiceName)}&silence=0&speed=1.0`
      );

      const resp = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'fetchAudio', urls }, resolve));

      if (resp && resp.ok) {
        for (const r of resp.results) {
          if (!r.ok) continue;
          const binary = atob(r.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blobUrl = URL.createObjectURL(new Blob([bytes], { type: r.contentType }));
          await new Promise(resolve => {
            const audio = new Audio(blobUrl);
            audio.onended = () => { URL.revokeObjectURL(blobUrl); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(); };
            audio.play().catch(resolve);
          });
        }
      }
    } catch (e) {
      console.error('[Anarchist] Touch Grass TTS error:', e);
    }

    overlay.remove();
    chrome.runtime.sendMessage({ action: 'closeAllWindows' });
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
    showToast(getBurn('white_bg'));
  }

  // 2. Watch for "Stupid" interactions
  document.addEventListener('click', (e) => {
  // 1. Find the button or the closest thing to a button (handles <span> inside <button>)
  const btn = e.target.closest('button') || e.target.closest('a');
  
  if (btn) {
    const btnText = btn.innerText.toLowerCase().trim();
    
    // 2. Define your "Financial Regret" keywords
    const buyKeywords = ['cart', 'buy', 'checkout', 'purchase', 'order', 'pay', 'cos', 'cumparaturi'];

    // 3. Check if the button text contains any of those words
    const isBuying = buyKeywords.some(keyword => btnText.includes(keyword));

    if (isBuying) {
      showToast(getBurn('shopping')); // Triggers your mean shopping burn
    }
  }
});
  
  // 3. Mutation Observer to watch for AI/Search queries
  const observer = new MutationObserver(() => {
    const text = document.body.innerText.toLowerCase();
    if (text.includes("moodle")) {
      // Use a debounce or a flag so it doesn't spam toasts
      if (!window.recentlyInsulted) {
        showToast(getBurn('nerd'));
        window.recentlyInsulted = true;
        setTimeout(() => window.recentlyInsulted = false, 10000);
      }
    }
    
    if (text.includes("how do i") || text.includes("chatgpt") || text.includes("gemini") || text.includes("claude") || text.includes("how to")) {
      // Use a debounce or a flag so it doesn't spam toasts
      if (!window.recentlyInsulted) {
        showToast(getBurn('ai'));
        window.recentlyInsulted = true;
        setTimeout(() => window.recentlyInsulted = false, 10000);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserving() {
  document.removeEventListener('click', handleStupidClick);
  location.reload(); // Simplest way to kill the MutationObserver
}

// --- LeetCode Stickman Roasts ---

const ROASTS = {
  'Wrong Answer': [
    "wrong answer?? shocking. truly.",
    "bro really said 'i know algorithms' 💀",
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

// FIX 6: renamed to randomRoast everywhere — one consistent name
function randomRoast(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function initStickman() {
  if (document.getElementById('__anarchist_stickman__')) return;

  const style = document.createElement('style');
  style.id = '__anarchist_stickman_styles__';
  style.textContent = `
    #__anarchist_stickman__ {
      position: fixed;
      bottom: 0;
      right: 28px;
      z-index: 2147483647;
      width: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    }

    #__anarchist_bubble__ {
      background: #0a0a0a;
      color: #ff2200;
      border: 1.5px solid #ff2200;
      border-radius: 8px;
      padding: 8px 12px;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      line-height: 1.5;
      max-width: 230px;
      width: max-content;
      box-shadow: 0 0 14px rgba(255,34,0,0.2);
      position: absolute;
      bottom: 88px;
      right: 0;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
      white-space: pre-wrap;
    }

    #__anarchist_bubble__.visible {
      opacity: 1;
      transform: translateY(0);
    }

    #__anarchist_bubble__::after {
      content: '';
      position: absolute;
      bottom: -7px;
      right: 16px;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 7px solid #ff2200;
    }

    #__anarchist_stickman_svg__ {
      width: 60px;
      height: auto;
    }
  `;
  document.head.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.id = '__anarchist_stickman__';
  wrapper.innerHTML = `
    <div id="__anarchist_bubble__"></div>
    <img id="__anarchist_stickman_svg__" src="${chrome.runtime.getURL('assets/stick-push.svg')}" />
  `;
  document.body.appendChild(wrapper);
}

function stickmanSpeak(text, mood) {
  mood = mood || 'neutral';
  const wrapper = document.getElementById('__anarchist_stickman__');
  const bubble  = document.getElementById('__anarchist_bubble__');
  if (!wrapper || !bubble) return;

  bubble.textContent = text;
  bubble.classList.add('visible');

  // Use Flowery TTS instead of browser speechSynthesis
  chrome.storage.sync.get(['ttsVoice', 'stutterIntensity'], (data) => {
    const voiceName = data.ttsVoice || 'en_us_006';
    const stutterIntensity = data.stutterIntensity ?? 50;

    TTSController.speakWithStutter(text, {
      stutterIntensity,
      voiceName,
      onStatus: null
    }).catch(() => {
      // Fallback to speechSynthesis if Flowery fails
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate  = mood === 'roast' ? 1.35 : 1.0;
        u.pitch = mood === 'roast' ? 1.2  : 1.0;
        window.speechSynthesis.speak(u);
      }
    });
  });

  const duration = Math.max(3500, text.length * 65);
  setTimeout(() => {
    bubble.classList.remove('visible');
  }, duration);
}
// Exposed globally so background.js can reach it via executeScript
window.__lcStickmanSpeak = stickmanSpeak;

function detectResult(node) {
  const text = node.innerText || node.textContent || '';
  for (const [result, roasts] of Object.entries(ROASTS)) {
    if (text.includes(result)) {
      const mood = result === 'Accepted' ? 'happy' : 'roast';
      // FIX 6: use randomRoast() consistently
      stickmanSpeak(randomRoast(roasts), mood);
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

// FIX 7: LeetCode block is now at the bottom — everything above is defined
if (location.hostname.includes('leetcode.com')) {
  initStickman();
  initRoastObserver();
}