// --- Listen for messages from popup / background ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'feature1':
      handleFeature1();
      break;
    case 'feature2':
      handleFeature2();
      break;
    case 'contextMenu':
      handleContextMenu(message.selection);
      break;
  }
});

function handleFeature1() {
  // Example: highlight all links on the page
  document.querySelectorAll('a').forEach(link => {
    link.style.outline = '2px solid #e94560';
  });
}

function handleFeature2() {
  // Example: show page stats
  const stats = {
    links: document.querySelectorAll('a').length,
    images: document.querySelectorAll('img').length,
    headings: document.querySelectorAll('h1,h2,h3').length
  };
  showToast(`Links: ${stats.links} | Images: ${stats.images} | Headings: ${stats.headings}`);
}

function handleContextMenu(selection) {
  if (selection) {
    showToast(`Selected: "${selection}"`);
  }
}

// --- Toast notification helper ---
function showToast(text) {
  const toast = document.createElement('div');
  toast.className = 'hdp-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
