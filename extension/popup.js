// --- Tab navigation ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// --- Feature buttons ---
const status = document.getElementById('status');
const btnSpeak = document.getElementById('btn-stutter-speak');
const btnStop = document.getElementById('btn-stop-speak');
const intensitySlider = document.getElementById('intensity-slider');
const intensityValue = document.getElementById('intensity-value');

// Load saved intensity
chrome.storage.sync.get('stutterIntensity', (data) => {
  const val = data.stutterIntensity ?? 50;
  intensitySlider.value = val;
  intensityValue.textContent = val + '%';
});

intensitySlider.addEventListener('input', () => {
  intensityValue.textContent = intensitySlider.value + '%';
  chrome.storage.sync.set({ stutterIntensity: parseInt(intensitySlider.value) });
});

btnSpeak.addEventListener('click', () => {
  const intensity = parseInt(intensitySlider.value);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    // Grab selection via scripting API (survives popup focus steal)
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection().toString().trim()
    }, (results) => {
      const selectedText = results?.[0]?.result || '';
      chrome.tabs.sendMessage(tabId, {
        action: 'stutterSpeak',
        stutterIntensity: intensity,
        text: selectedText
      }, (response) => {
        if (response?.error) {
          status.textContent = response.error;
        } else {
          status.textContent = 'Speaking...';
          btnStop.disabled = false;
        }
      });
    });
  });
});

btnStop.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'stopSpeaking' });
  });
  status.textContent = 'Stopped';
  btnStop.disabled = true;
});

// --- Auto Touch Grass toggle ---
const btnTouchGrassToggle = document.getElementById('btn-touch-grass-toggle');

function updateTouchGrassBtn(active) {
  btnTouchGrassToggle.textContent = active ? '🌿 Touch Grass: ON' : '🌿 Touch Grass: OFF';
  btnTouchGrassToggle.style.background = active ? '#27ae60' : '';
}

chrome.storage.local.get('touchGrassEnabled', (data) => {
  updateTouchGrassBtn(!!data.touchGrassEnabled);
});

btnTouchGrassToggle.addEventListener('click', () => {
  chrome.storage.local.get('touchGrassEnabled', (data) => {
    const newState = !data.touchGrassEnabled;
    chrome.storage.local.set({ touchGrassEnabled: newState }, () => {
      updateTouchGrassBtn(newState);
    });
  });
});

// --- Mean Mode toggle ---
const btnMeanMode = document.getElementById('btn-mean-mode');

function updateMeanBtn(active) {
  btnMeanMode.textContent = active ? '😈 Mean Mode: ON' : '😈 Mean Mode: OFF';
  btnMeanMode.style.background = active ? '#e94560' : '';
}

chrome.storage.local.get('meanModeActive', (data) => {
  updateMeanBtn(!!data.meanModeActive);
});

btnMeanMode.addEventListener('click', () => {
  chrome.storage.local.get('meanModeActive', (data) => {
    const newState = !data.meanModeActive;
    chrome.storage.local.set({ meanModeActive: newState }, () => {
      updateMeanBtn(newState);
      // Send to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'toggleMeanMode', status: newState }).catch(() => {});
        });
      });
    });
  });
});


// --- Kill Mode toggle ---
// --- Kill Mode toggle ---
const btnKillMode = document.getElementById('btn-kill-mode');

function updateKillBtn(active) {
  btnKillMode.textContent = active ? '💀 Kill Mode: ON' : '💀 Kill Mode: OFF';
  btnKillMode.style.background = active ? '#520000' : ''; // Dark red when active
  btnKillMode.style.color = active ? '#ff0000' : '';
}

// Initialize button state on popup load
chrome.storage.local.get('killModeActive', (data) => {
  updateKillBtn(!!data.killModeActive);
});

btnKillMode.addEventListener('click', () => {
  chrome.storage.local.get('killModeActive', (data) => {
    const newState = !data.killModeActive;
    chrome.storage.local.set({ killModeActive: newState }, () => {
      updateKillBtn(newState);
    });
  });
});

// --- Settings ---
const notifToggle = document.getElementById('toggle-notifications');

chrome.storage.sync.get('notifications', (data) => {
  notifToggle.checked = data.notifications ?? true;
});

notifToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ notifications: notifToggle.checked });
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
