// --- Context menu ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'hack-menu',
    title: 'Hack de Pensionare',
    contexts: ['page', 'selection']
  });

  chrome.storage.sync.set({ notifications: true });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'hack-menu') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'contextMenu',
      selection: info.selectionText || null
    });
  }
});

// --- Message handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'feature3') {
    // Background-only logic goes here
    sendResponse({ status: 'Feature 3 done (background)' });
  }
  return true;
});
