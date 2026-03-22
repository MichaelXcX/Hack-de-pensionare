const blacklist = ['gemini', 'github'];
let burnoutMusicWindowId = null;

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
    // If already open, just focus it
    if (burnoutMusicWindowId !== null) {
      chrome.windows.get(burnoutMusicWindowId, (win) => {
        if (chrome.runtime.lastError || !win) {
          burnoutMusicWindowId = null;
        } else {
          chrome.windows.update(burnoutMusicWindowId, { focused: true });
        }
      });
      return;
    }
    chrome.windows.create({
      url: 'https://www.youtube.com/watch?v=CGyEd0aKWZE&t=110',
      type: 'popup',
      width: 480,
      height: 300
    }, (win) => { burnoutMusicWindowId = win.id; });
    return;
  }

  if (message.action === 'stopBurnoutAudio') {
    if (burnoutMusicWindowId !== null) {
      chrome.windows.remove(burnoutMusicWindowId).catch(() => {});
      burnoutMusicWindowId = null;
    }
    return;
  }

  if (message.action === 'burnoutDone') {
    // Close the music window
    if (burnoutMusicWindowId !== null) {
      chrome.windows.remove(burnoutMusicWindowId).catch(() => {});
      burnoutMusicWindowId = null;
    }
    // Close the tab (or its whole window if it's the only tab)
    if (sender.tab && sender.tab.id) {
      chrome.tabs.query({ windowId: sender.tab.windowId }, (tabs) => {
        if (tabs.length <= 1) {
          chrome.windows.remove(sender.tab.windowId).catch(() => {});
        } else {
          chrome.tabs.remove(sender.tab.id).catch(() => {});
        }
      });
    }
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

setInterval(() => {
  const entries = Object.entries(lcTimers);
  entries.forEach(([tabId, timer]) => {
    const elapsed = Date.now() - timer.openedAt;
    const warnIn  = Math.max(0, Math.round((WARN_AFTER_MS  - elapsed) / 1000));
    const closeIn = Math.max(0, Math.round((CLOSE_AFTER_MS - elapsed) / 1000));
    if (!timer.warned) {
      console.log(`[LC] tab ${tabId} | stickman appears in: ${warnIn}s`);
    } else {
      console.log(`[LC] tab ${tabId} | stickman already warned | tab closes in: ${closeIn}s`);
    }
  });

}, 1000);

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
  }
  lcTimers[tabId] = { openedAt: Date.now(), warned: false };
  chrome.alarms.create(`lc_${tabId}`, { periodInMinutes: 0.5 });
  console.log("intraram in functie");
  if (changeInfo.status !== 'complete' || !tab.url || !tab.url.startsWith("http")) return;
  
  chrome.storage.local.get('killModeActive', (data) => {

    if (!data.killModeActive) {
      console.log("Kill Mode is OFF. Tab spared.");
      return; 
    }

    const roll = Math.random();
    console.log(roll);

    if (roll < 0.15) {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { 
          action: "show_anarchist_popup", 
          title: "NO :D", 
        }).catch(() => {});

        setTimeout(() => {
          chrome.tabs.remove(tabId).catch(() => {});
        }, 2000);
      }, 500); 
    }
    else if (roll < 0.3) {
      killRandomTab("Yk what? I'm bored. Fuck you.");
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

//Random tab killer

function killRandomTab(text) {
  // 1. Get every single tab currently open
  chrome.tabs.query({}, (allTabs) => {
    
    // 2. Filter the array to find "Killable" tabs
    const killableTabs = allTabs.filter(tab => {
      const isProtocolSafe = tab.url && tab.url.startsWith("http");
      const isProtected = blacklist.some(site => tab.url.toLowerCase().includes(site));
      
      // Only keep tabs that are HTTP/HTTPS AND not on your blacklist
      return isProtocolSafe && !isProtected;
    });

    // 3. If there are survivors, pick one at random
    if (killableTabs.length > 0) {
      console.log(killableTabs.length);
      const victim = killableTabs[Math.floor(Math.random() * killableTabs.length)];
      
      console.log(`Executing random tab: ${victim.title}`);
      
      // 4. Send the scary popup first
      chrome.tabs.sendMessage(victim.id, { 
        action: "show_anarchist_popup", 
        title: text, 
      }).catch(() => {});

      // 5. Kill it after 2 seconds
      setTimeout(() => {
        chrome.tabs.remove(victim.id).catch(() => {});
      }, 2000);
    } else {
      console.log("No valid victims found. Everyone is safe... for now.");
    }
  });
}
