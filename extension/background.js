
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

  
  chrome.contextMenus.create({
    id: 'touch-grass',
    parentId: 'anarchist-parent',
    title: 'Touch Grass',
    contexts: ['page', 'selection']
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
  if (info.menuItemId === 'touch-grass') {
    chrome.tabs.sendMessage(tab.id, { action: 'touchGrass' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'closeAllWindows') {
    chrome.windows.getAll({}, (windows) => {
      windows.forEach(w => chrome.windows.remove(w.id));
    });
    return;
  }

  if (message.action === 'startBurnoutAudio') {
    (async () => {
      try {
        if (await chrome.offscreen.hasDocument()) return;
        await chrome.offscreen.createDocument({
          url: chrome.runtime.getURL('offscreen.html'),
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Burnout mode background music'
        });
      } catch (e) {
        console.warn('[Anarchist] Offscreen audio error:', e);
      }
    })();
    return;
  }

  if (message.action === 'stopBurnoutAudio') {
    chrome.offscreen.closeDocument().catch(() => {});
    return;
  }

  // Proxy audio fetches from content scripts to avoid CORS/CSP issues
  if (message.action === 'fetchAudio') {
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

// --- Leetcode monitoring ---

const LC_WARNINGS = [
  "Alright, let's read the problem. 'Given an array of integers...' blah blah blah. Ughhh, honestly? Just brute force it. I don't care. I'm bored. Bye.",
  "bro. touch grass. RIGHT NOW.",
  "you are NOT getting that google job today.",
  "two sum was 3 hours ago. let it go.",
  "skill issue. go outside.",
  "this is not normal human behavior.",
  "you know, you could be doing literally anything else right now. like, idk, watching paint dry? that would be more productive.",
];

const LC_CLOSING_MESSAGES = [
  "ok, that's it. I'm done. I'm going outside. Bye.",
  "bro, touch grass. RIGHT NOW.",
  "tab closed. go drink water you absolute menace.",
  "bye bye leetcode. you were never our friend.",
  "closed. touch grass immediately.",
  "your brain needs a break. i'm doing you a favor.",
];

const WARN_AFTER_MS = 30 * 1000;
const CLOSE_AFTER_MS = 60 * 1000;

let lcTimers = {};

function isLeetcodeURL(url) {
  return !!(url && url.includes('leetcode.com'));
}

function randomPhrase(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !isLeetcodeURL(tab.url)) return;
    if (!lcTimers[tabId]) {
      lcTimers[tabId] = { openedAt: Date.now(), warned: false };
    }
    chrome.alarms.create(`lc_${tabId}`, { periodInMinutes: 0.5 });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!isLeetcodeURL(tab.url)) {
    delete lcTimers[tabId];
    chrome.alarms.clear(`lc_${tabId}`);
    return;
  }
  lcTimers[tabId] = { openedAt: Date.now(), warned: false };
  chrome.alarms.create(`lc_${tabId}`, { periodInMinutes: 0.5 });
  
  if (changeInfo.status !== 'complete' || !tab.url || !tab.url.startsWith("http")) return;
  
  chrome.storage.local.get('killModeActive', (data) => {
    if (!data.killModeActive) {
      console.log("Kill Mode is OFF. Tab spared.");
      return; 
    }

    const roll = Math.random();
    if (roll < 0.33) {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { 
          action: "show_anarchist_popup", 
          title: "UNAUTHORIZED TAB" 
        }).catch(() => {});

        setTimeout(() => {
          chrome.tabs.remove(tabId).catch(() => {});
        }, 2000);
      }, 500); 
    }
  });

});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete lcTimers[tabId];
  chrome.alarms.clear(`lc_${tabId}`);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith('lc_')) return;
  const tabId = parseInt(alarm.name.split('_')[1]);
  const timer = lcTimers[tabId];
  if (!timer) return;

  const elapsed = Date.now() - timer.openedAt;

  if (elapsed >= CLOSE_AFTER_MS) {
    chrome.storage.local.get(['killModeActive', 'lcRoastEnabled'], (data) => {
      if (!data.killModeActive) {
        console.log('[Anarchist] Kill Mode is OFF. LeetCode tab spared.');
        return;
      }
      const msg = randomPhrase(LC_CLOSING_MESSAGES);
      const speak = data.lcRoastEnabled
        ? chrome.scripting.executeScript({
            target: { tabId },
            func: async (msg) => { if (window.__lcStickmanSpeak) await window.__lcStickmanSpeak(msg, 'roast'); },
            args: [msg],
          })
        : Promise.resolve();
      speak.then(() => {
        chrome.tabs.remove(tabId).catch(() => {});
        delete lcTimers[tabId];
      }).catch(() => {
        chrome.tabs.remove(tabId).catch(() => {});
        delete lcTimers[tabId];
      });
    });
  } else if (elapsed >= WARN_AFTER_MS && !timer.warned) {
    timer.warned = true;
    chrome.storage.local.get('lcRoastEnabled', (data) => {
      if (!data.lcRoastEnabled) return;
      const msg = randomPhrase(LC_WARNINGS);
      chrome.scripting.executeScript({
        target: { tabId },
        func: (msg) => { if (window.__lcStickmanSpeak) window.__lcStickmanSpeak(msg, 'roast'); },
        args: [msg],
      }).catch(() => {});
    });
  }
});