// --- Cache the last selection so it survives popup focus steal ---
let lastSelection = '';

document.addEventListener('mouseup', () => {
  const sel = window.getSelection().toString().trim();
  if (sel) lastSelection = sel;
});

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection().toString().trim();
  if (sel) lastSelection = sel;
});

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
    case 'feature2':
      handleFeature2();
      break;
    case 'contextMenu':
      handleContextMenu(message);
      break;
  }
});

function handleStutterSpeak(message, sendResponse) {
  // Use passed-in text, or live selection, or cached selection
  const selection = message.text
    || window.getSelection().toString().trim()
    || lastSelection;

  if (!selection) {
    sendResponse({ error: 'No text selected' });
    showToast('Select some text first!');
    return;
  }

  sendResponse({ ok: true });
  showToast('Speaking...');

  chrome.storage.sync.get(['ttsVoice'], (data) => {
    TTSController.speakWithStutter(selection, {
      stutterIntensity: message.stutterIntensity ?? 50,
      voiceName: data.ttsVoice || 'Brian'
    }).then(() => {
      showToast('Done');
    }).catch((err) => {
      console.error('[Anarchist] TTS error:', err);
      showToast('Speech error: ' + err.message);
    });
  });
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
      TTSController.speakWithStutter(text, {
        stutterIntensity: data.stutterIntensity ?? 50,
        voiceName: data.ttsVoice || 'Brian'
      }).then(() => showToast('Done')).catch(err => showToast('Error: ' + err.message));
    });
  }
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
