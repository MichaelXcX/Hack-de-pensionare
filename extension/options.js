const fields = {
  notifications: document.getElementById('opt-notifications'),
  contextMenu: document.getElementById('opt-context-menu')
};

// Load saved settings
chrome.storage.sync.get(['notifications', 'contextMenu'], (data) => {
  fields.notifications.checked = data.notifications ?? true;
  fields.contextMenu.checked = data.contextMenu ?? true;
});

// Save
document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set({
    notifications: fields.notifications.checked,
    contextMenu: fields.contextMenu.checked
  }, () => {
    const msg = document.getElementById('saved-msg');
    msg.textContent = 'Saved!';
    setTimeout(() => msg.textContent = '', 2000);
  });
});
