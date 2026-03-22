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

document.getElementById('btn-touch-grass').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'touchGrass' });
    window.close();
  });
});

// --- Inside popup.js ---
document.getElementById('btn-feature-3').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'feature3' }, (response) => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = response.status;
    setTimeout(() => statusDiv.textContent = "", 2000);
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
