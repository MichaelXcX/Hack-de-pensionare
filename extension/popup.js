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

document.getElementById('btn-feature-1').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'feature1' });
    status.textContent = 'Feature 1 activated';
  });
});

document.getElementById('btn-feature-2').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'feature2' });
    status.textContent = 'Feature 2 activated';
  });
});

document.getElementById('btn-feature-3').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'feature3' }, (response) => {
    status.textContent = response?.status || 'Feature 3 activated';
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
