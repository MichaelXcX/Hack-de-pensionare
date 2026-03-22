const fields = {
  notifications: document.getElementById('opt-notifications'),
  contextMenu: document.getElementById('opt-context-menu'),
  stutterIntensity: document.getElementById('opt-stutter-intensity'),
  intensityVal: document.getElementById('opt-intensity-val'),
  voice: document.getElementById('opt-voice')
};

// Flowery TTS voice list
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
VOICES.forEach(({ name, label }) => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = label;
  fields.voice.appendChild(opt);
});

// Live slider update
fields.stutterIntensity.addEventListener('input', () => {
  fields.intensityVal.textContent = fields.stutterIntensity.value + '%';
});

// Load saved settings
chrome.storage.sync.get(['notifications', 'contextMenu', 'stutterIntensity', 'ttsVoice'], (data) => {
  fields.notifications.checked = data.notifications ?? true;
  fields.contextMenu.checked = data.contextMenu ?? true;
  const intensity = data.stutterIntensity ?? 50;
  fields.stutterIntensity.value = intensity;
  fields.intensityVal.textContent = intensity + '%';
  if (data.ttsVoice) fields.voice.value = data.ttsVoice;
});

// Save
document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set({
    notifications: fields.notifications.checked,
    contextMenu: fields.contextMenu.checked,
    stutterIntensity: parseInt(fields.stutterIntensity.value),
    ttsVoice: fields.voice.value
  }, () => {
    const msg = document.getElementById('saved-msg');
    msg.textContent = 'Saved!';
    setTimeout(() => msg.textContent = '', 2000);
  });
});
