// --- Context menu ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'anarchist-parent',
    title: 'The Anarchist',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'stutter-speak',
    parentId: 'anarchist-parent',
    title: 'Stutter Speak Selection',
    contexts: ['selection']
  });

  chrome.storage.sync.set({
    notifications: true,
    stutterIntensity: 50,
    elevenlabsApiKey: 'sk_a0f8a7a5034349cf927e2d8345e374f543154c97fb93e3fd',
    elevenlabsVoice: 'Rachel'
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'stutter-speak') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'contextMenu',
      subAction: 'stutterSpeak',
      selection: info.selectionText || null
    });
  }
});

// --- Message handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'feature3') {
    sendResponse({ status: 'Feature 3 done (background)' });
    return true;
  }

  // Proxy audio fetches from content scripts to avoid CORS/CSP issues
  if (message.action === 'fetchAudio') {
    // Support both single url and batch urls array
    const urls = message.urls || [message.url];
    Promise.all(urls.map(url =>
      fetch(url)
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const contentType = r.headers.get('content-type') || 'audio/mpeg';
          const buf = await r.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return { ok: true, base64: btoa(binary), contentType };
        })
        .catch(err => ({ ok: false, error: err.message }))
    ))
    .then(results => sendResponse({ ok: true, results }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return true;
});
