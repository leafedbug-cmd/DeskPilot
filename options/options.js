// Options page logic
const defaultKeyMappings = {
  scrollDown: 'j',
  scrollUp: 'k',
  scrollDownHalf: 'd',
  scrollUpHalf: 'u',
  scrollToTop: 'gg',
  scrollToBottom: 'G',
  linkHints: 'f',
  linkHintsNewTab: 'F',
  nextTab: 'J',
  prevTab: 'K',
  closeTab: 'x',
  historyBack: 'H',
  historyForward: 'L',
  omnibar: 'o',
  omnibarNewTab: 'O',
  tabSearch: 'T',
  insertMode: 'i',
  help: '?'
};

const commandLabels = {
  scrollDown: 'Scroll Down',
  scrollUp: 'Scroll Up',
  scrollDownHalf: 'Scroll Down Half Page',
  scrollUpHalf: 'Scroll Up Half Page',
  scrollToTop: 'Scroll to Top',
  scrollToBottom: 'Scroll to Bottom',
  linkHints: 'Show Link Hints',
  linkHintsNewTab: 'Link Hints (New Tab)',
  nextTab: 'Next Tab',
  prevTab: 'Previous Tab',
  closeTab: 'Close Tab',
  historyBack: 'History Back',
  historyForward: 'History Forward',
  omnibar: 'Open Omnibar',
  omnibarNewTab: 'Omnibar (New Tab)',
  tabSearch: 'Search Tabs',
  insertMode: 'Enter Insert Mode',
  help: 'Show Help'
};

let currentSettings = {};

// Load settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get(null);
  currentSettings = settings;
  
  renderKeyMappings(settings.keyMappings || defaultKeyMappings);
  renderExclusionList(settings.exclusionRules || []);
  
  document.getElementById('smoothScrolling').checked = settings.smoothScrolling !== false;
  document.getElementById('scrollStepSize').value = settings.scrollStepSize || 60;
  document.getElementById('customCSS').value = settings.customCSS || '';
}

function renderKeyMappings(mappings) {
  const container = document.getElementById('keyMappings');
  container.innerHTML = '';
  
  for (let cmd in mappings) {
    const div = document.createElement('div');
    div.className = 'key-mapping';
    
    const label = document.createElement('label');
    label.textContent = commandLabels[cmd] || cmd;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = mappings[cmd];
    input.dataset.command = cmd;
    input.className = 'key-input';
    
    const reset = document.createElement('button');
    reset.textContent = '↺';
    reset.title = 'Reset to default';
    reset.onclick = () => {
      input.value = defaultKeyMappings[cmd];
    };
    
    div.appendChild(label);
    div.appendChild(input);
    div.appendChild(reset);
    container.appendChild(div);
  }
}

function renderExclusionList(rules) {
  const container = document.getElementById('exclusionList');
  container.innerHTML = '';
  
  rules.forEach((rule, index) => {
    const div = document.createElement('div');
    div.className = 'exclusion-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = rule;
    input.dataset.index = index;
    input.className = 'exclusion-input';
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeExclusion(index);
    
    div.appendChild(input);
    div.appendChild(removeBtn);
    container.appendChild(div);
  });
}

function addExclusion() {
  const input = document.getElementById('newExclusion');
  const pattern = input.value.trim();
  
  if (pattern) {
    if (!currentSettings.exclusionRules) {
      currentSettings.exclusionRules = [];
    }
    currentSettings.exclusionRules.push(pattern);
    renderExclusionList(currentSettings.exclusionRules);
    input.value = '';
  }
}

function removeExclusion(index) {
  currentSettings.exclusionRules.splice(index, 1);
  renderExclusionList(currentSettings.exclusionRules);
}

async function saveSettings() {
  const keyMappings = {};
  document.querySelectorAll('.key-input').forEach(input => {
    keyMappings[input.dataset.command] = input.value;
  });
  
  const exclusionRules = [];
  document.querySelectorAll('.exclusion-input').forEach(input => {
    if (input.value.trim()) {
      exclusionRules.push(input.value.trim());
    }
  });
  
  const settings = {
    keyMappings,
    exclusionRules,
    smoothScrolling: document.getElementById('smoothScrolling').checked,
    scrollStepSize: parseInt(document.getElementById('scrollStepSize').value),
    customCSS: document.getElementById('customCSS').value
  };
  
  await chrome.storage.sync.set(settings);
  currentSettings = settings;
  
  showStatus();
}

function showStatus() {
  const status = document.getElementById('status');
  status.classList.add('show');
  setTimeout(() => status.classList.remove('show'), 2000);
}

async function resetToDefaults() {
  if (confirm('Reset all settings to defaults?')) {
    const defaults = {
      keyMappings: defaultKeyMappings,
      exclusionRules: [],
      smoothScrolling: true,
      scrollStepSize: 60,
      customCSS: ''
    };
    
    await chrome.storage.sync.set(defaults);
    await loadSettings();
    showStatus();
  }
}

function exportSettings() {
  const data = JSON.stringify(currentSettings, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'deskpilot-settings.json';
  a.click();
  
  URL.revokeObjectURL(url);
}

function importSettings() {
  document.getElementById('importFile').click();
}

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const text = await file.text();
  try {
    const settings = JSON.parse(text);
    await chrome.storage.sync.set(settings);
    await loadSettings();
    showStatus();
  } catch (err) {
    alert('Invalid settings file: ' + err.message);
  }
  
  e.target.value = '';
});

// Initialize
loadSettings();