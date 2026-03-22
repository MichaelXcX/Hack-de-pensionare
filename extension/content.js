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

selBtn.addEventListener('mousedown', e => e.preventDefault()); // don't lose selection
selBtn.addEventListener('click', () => {
  selBtn.style.display = 'none';
  const text = window.getSelection().toString().trim() || lastSelection;
  if (!text) return;
  chrome.storage.sync.get(['ttsVoice', 'stutterIntensity'], (data) => {
    runTTS(text, data.stutterIntensity ?? 50, data.ttsVoice || 'en_us_006');
  });
});

// --- Status bar (loading / speaking) ---
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

// --- Shared TTS runner used by selection button + popup + context menu ---
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
      return true; // async response
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
  // Remove existing overlay if any
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
  btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.05)');
  btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1.0)');
  btn.addEventListener('click', () => {
    overlay.remove();
    setTimeout(() => {
      alert('Good boy');
      // Ask background to close all windows — window.close() can't do that
      chrome.runtime.sendMessage({ action: 'closeAllWindows' });
    }, 80);
  });

  // Inject keyframe if not already present
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

// --- Auto-trigger Touch Grass randomly on page load (30% chance) ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (Math.random() < 0.30) handleTouchGrass();
  });
} else {
  if (Math.random() < 0.30) handleTouchGrass();
}

// --- Toast notification helper ---
function showToast(text) {
  // Remove any existing toast
  document.querySelectorAll('.hdp-toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'hdp-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
