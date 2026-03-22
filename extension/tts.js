// --- TTS Playback Controller (Flowery TTS — free, no API key) ---
// Fetched via background service worker to bypass page CSP/CORS.

const TTSController = (() => {
  let currentAudio = null;
  let speaking = false;
  let cancelRequested = false;

  const VOICES = [
    { name: 'en_us_001', label: 'American female (1)' },
    { name: 'en_us_006', label: 'American male (1)' },
    { name: 'en_us_007', label: 'American male (2)' },
    { name: 'en_us_009', label: 'American male (3)' },
    { name: 'en_us_010', label: 'American female (2)' },
    { name: 'en_uk_001', label: 'British male' },
    { name: 'en_uk_003', label: 'British female' },
    { name: 'en_au_001', label: 'Australian female' },
    { name: 'en_au_002', label: 'Australian male' },
  ];

  // Split stuttered text into chunks short enough for URL encoding
  function chunkText(text, maxLen = 140) {
    const words = text.split(' ');
    const chunks = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (current && candidate.length > maxLen) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) chunks.push(current);
    return chunks;
  }

  // Ask background SW to fetch all audio URLs at once (single message — avoids SW wake-up gaps)
  function fetchAllAudio(urls) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'fetchAudio', urls }, (resp) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!resp || !resp.ok) {
          return reject(new Error(resp?.error || 'Fetch failed'));
        }
        const blobUrls = resp.results.map(r => {
          if (!r.ok) throw new Error(r.error || 'Segment fetch failed');
          const binary = atob(r.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: r.contentType });
          return URL.createObjectURL(blob);
        });
        resolve(blobUrls);
      });
    });
  }

  async function playBlobUrl(blobUrl) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(blobUrl);
      currentAudio = audio;
      const cleanup = () => { URL.revokeObjectURL(blobUrl); currentAudio = null; };
      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = (e) => {
        cleanup();
        reject(new Error(`Playback error: ${audio.error?.message || e.type}`));
      };
      audio.play().catch((e) => { cleanup(); reject(e); });
    });
  }

  async function speakWithStutter(text, options = {}) {
    if (speaking) stop();

    const {
      stutterIntensity = 50,
      voiceName = 'en_us_006',
      onStatus = null,
      onTooLong = null,
      maxWords = 60
    } = options;

    const log = (msg) => {
      console.log('[Anarchist TTS]', msg);
      if (onStatus) onStatus(msg);
    };

    speaking = true;
    cancelRequested = false;

    // Check word count BEFORE stuttering — much more predictable threshold
    const wordCount = text.trim().split(/\s+/).length;
    if (onTooLong && wordCount > maxWords) {
      speaking = false;
      onTooLong(wordCount);
      return;
    }

    const stutterRate = StutterEngine.intensityToRate(stutterIntensity);
    const chunks = StutterEngine.stutterify(text, { stutterRate });
    const stutteredText = StutterEngine.flatten(chunks);
    const segments = chunkText(stutteredText).filter(s => s.trim());

    if (!segments.length) { speaking = false; return; }

    log(`Fetching audio — ${segments.length} segment${segments.length !== 1 ? 's' : ''}...`);

    const urls = segments.map(seg =>
      `https://api.flowery.pw/v1/tts?text=${encodeURIComponent(seg)}&voice=${encodeURIComponent(voiceName)}&silence=0&speed=1.0`
    );

    try {
      const blobUrls = await fetchAllAudio(urls);
      log('Speaking...');
      for (let i = 0; i < blobUrls.length; i++) {
        if (cancelRequested) { URL.revokeObjectURL(blobUrls[i]); break; }
        if (blobUrls.length > 1) log(`Speaking segment ${i + 1}/${blobUrls.length}...`);
        await playBlobUrl(blobUrls[i]);
      }
    } finally {
      speaking = false;
      cancelRequested = false;
    }
  }

  function stop() {
    cancelRequested = true;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    speaking = false;
  }

  function isSpeaking() {
    return speaking;
  }

  return { speakWithStutter, stop, isSpeaking, VOICES };
})();
