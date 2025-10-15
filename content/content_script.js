// Main content script
let settings = {};
let mode = 'normal';
let keySequence = '';
let sequenceTimeout = null;
let pendingSingle = null;
let rightAltActive = false;

// Mode manager
const ModeManager = {
  enterInsertMode() {
    mode = 'insert';
    this.showModeIndicator('INSERT MODE');
  },
  
  enterNormalMode() {
    mode = 'normal';
    this.showModeIndicator('NORMAL MODE');
  },
  
  showModeIndicator(text) {
    const indicator = document.createElement('div');
    indicator.textContent = text;
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-size: 14px;
      font-weight: bold;
      z-index: 2147483647;
      animation: fadeOut 1.5s forwards;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeOut {
        0%, 70% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 1500);
  }
};

// Help dialog
const HelpDialog = {
  show() {
    if (document.getElementById('deskpilot-help')) {
      this.hide();
      return;
    }
    
    const dialog = document.createElement('div');
    dialog.id = 'deskpilot-help';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.3);
      z-index: 2147483647;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    const reverseMap = this.getReverseKeyMap();
    
    dialog.innerHTML = `
      <h2 style="margin-top: 0;">DeskPilot Commands</h2>
      <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 14px;">
        <strong>Key</strong><strong>Action</strong>
        <kbd>${reverseMap.scrollDown}</kbd><span>Scroll down</span>
        <kbd>${reverseMap.scrollUp}</kbd><span>Scroll up</span>
        <kbd>${reverseMap.scrollDownHalf}</kbd><span>Scroll down half page</span>
        <kbd>${reverseMap.scrollUpHalf}</kbd><span>Scroll up half page</span>
        <kbd>${reverseMap.scrollToTop}</kbd><span>Scroll to top</span>
        <kbd>${reverseMap.scrollToBottom}</kbd><span>Scroll to bottom</span>
        <kbd>${reverseMap.linkHints}</kbd><span>Show link hints</span>
        <kbd>${reverseMap.linkHintsNewTab}</kbd><span>Link hints (new tab)</span>
        <kbd>${reverseMap.nextTab}</kbd><span>Next tab</span>
        <kbd>${reverseMap.prevTab}</kbd><span>Previous tab</span>
        <kbd>${reverseMap.closeTab}</kbd><span>Close tab</span>
        <kbd>${reverseMap.historyBack}</kbd><span>History back</span>
        <kbd>${reverseMap.historyForward}</kbd><span>History forward</span>
        <kbd>${reverseMap.omnibar}</kbd><span>Open omnibar</span>
        <kbd>${reverseMap.omnibarNewTab}</kbd><span>Omnibar (new tab)</span>
        <kbd>${reverseMap.tabSearch}</kbd><span>Search tabs</span>
        <kbd>${reverseMap.insertMode}</kbd><span>Insert mode</span>
        <kbd>Esc</kbd><span>Normal mode</span>
        <kbd>${reverseMap.help}</kbd><span>Show this help</span>
      </div>
      <p style="margin-top: 20px; font-size: 12px; color: #666;">Press ? or Esc to close</p>
    `;
    
    document.body.appendChild(dialog);
    
    const closeHandler = (e) => {
      if (e.key === 'Escape' || e.key === '?') {
        this.hide();
      }
    };
    
    document.addEventListener('keydown', closeHandler);
    dialog.closeHandler = closeHandler;
  },
  
  hide() {
    const dialog = document.getElementById('deskpilot-help');
    if (dialog) {
      document.removeEventListener('keydown', dialog.closeHandler);
      dialog.remove();
    }
  },
  
  getReverseKeyMap() {
    const reverse = {};
    for (let cmd in settings.keyMappings) {
      reverse[cmd] = settings.keyMappings[cmd];
    }
    return reverse;
  }
};

// Check if URL is excluded
function isExcluded() {
  const url = window.location.href;
  return settings.exclusionRules?.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  });
}

// Check if element should block shortcuts
function shouldIgnoreKey() {
  const el = document.activeElement;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

// Get command from key
function getCommandFromKey(key) {
  for (let cmd in settings.keyMappings) {
    if (settings.keyMappings[cmd] === key) {
      return cmd;
    }
  }
  return null;
}

// Key handler
document.addEventListener('keydown', (e) => {
  // Show hints on Right Alt (robust detection across layouts)
  const isRightAlt =
    e.code === 'AltRight' ||
    e.key === 'AltGraph' ||
    (e.key === 'Alt' && e.location === 2);
  const isAltGrLike =
    (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey &&
      (e.key === 'Alt' || e.key === 'AltGraph' || e.code === 'AltRight' || e.location === 2));
  const altGraphState = e.getModifierState && e.getModifierState('AltGraph');
  if ((isRightAlt || altGraphState || isAltGrLike) && !rightAltActive) {
    rightAltActive = true;
    e.preventDefault();
    e.stopPropagation();
    // Debug: verify the AltRight event is captured
    try { console.debug('[DeskPilot] Right Alt pressed - triggering hints'); } catch(e) {}
    Hinter.showHints(false);
    return;
  }

  // Always allow Escape to exit insert mode
  if (e.key === 'Escape' && mode === 'insert') {
    ModeManager.enterNormalMode();
    return;
  }
  
  // In insert mode, ignore all other shortcuts
  if (mode === 'insert') return;
  
  // Check exclusion rules
  if (isExcluded()) return;
  
  // Ignore keys when in input fields (unless in normal mode)
  if (shouldIgnoreKey() && mode === 'normal') return;
  
  // Build key string
  let key = e.key;
  if (e.shiftKey && key.length === 1) {
    key = key.toUpperCase();
  }

  // Generic multi-key sequence handling
  if (key.length === 1) {
    const allKeys = settings.keyMappings ? Object.values(settings.keyMappings) : [];

    const startsWith = (prefix) => allKeys.some(k => typeof k === 'string' && k.startsWith(prefix));
    const hasLonger = (prefix) => allKeys.some(k => typeof k === 'string' && k.startsWith(prefix) && k.length > prefix.length);

    const tryExecute = (mapping) => {
      const c = getCommandFromKey(mapping);
      if (c && CommandRegistry[c]) {
        e.preventDefault();
        CommandRegistry[c]();
        return true;
      }
      return false;
    };

    // If we already have a sequence in progress
    if (keySequence) {
      const attempt = keySequence + key;
      // Exact match executes immediately
      if (tryExecute(attempt)) {
        keySequence = '';
        pendingSingle = null;
        if (sequenceTimeout) { clearTimeout(sequenceTimeout); sequenceTimeout = null; }
        return;
      }
      // Keep waiting if there are longer sequences beginning with the attempt
      if (hasLonger(attempt)) {
        keySequence = attempt;
        // refresh timer
        if (sequenceTimeout) clearTimeout(sequenceTimeout);
        sequenceTimeout = setTimeout(() => {
          // If a partial remains after timeout and has a shorter exact mapping, run it
          if (pendingSingle) {
            const c = pendingSingle; pendingSingle = null;
            if (CommandRegistry[c]) CommandRegistry[c]();
          }
          keySequence = '';
          sequenceTimeout = null;
        }, 1000);
        e.preventDefault();
        return;
      }
      // Sequence broken. If there was a pending shorter command (e.g., 'j'), run it now
      if (pendingSingle) {
        const c = pendingSingle; pendingSingle = null;
        if (CommandRegistry[c]) { e.preventDefault(); CommandRegistry[c](); }
      }
      keySequence = '';
      if (sequenceTimeout) { clearTimeout(sequenceTimeout); sequenceTimeout = null; }
      // Fall through to process current key as fresh
    }

    // No sequence in progress: start one if this key begins a multi-key mapping
    if (hasLonger(key)) {
      keySequence = key;
      // If the single key itself maps to a command, defer it until timeout
      const singleCmd = getCommandFromKey(key);
      pendingSingle = singleCmd && CommandRegistry[singleCmd] ? singleCmd : null;
      if (sequenceTimeout) clearTimeout(sequenceTimeout);
      sequenceTimeout = setTimeout(() => {
        if (pendingSingle) {
          const c = pendingSingle; pendingSingle = null;
          if (CommandRegistry[c]) CommandRegistry[c]();
        }
        keySequence = '';
        sequenceTimeout = null;
      }, 1000);
      e.preventDefault();
      return;
    }

    // If not starting a longer sequence, try single-key command immediately
    const cmdSingle = getCommandFromKey(key);
    if (cmdSingle && CommandRegistry[cmdSingle]) {
      e.preventDefault();
      CommandRegistry[cmdSingle]();
      return;
    }
  }

  // Non-character keys or unmapped characters: direct lookup
  const cmd = getCommandFromKey(key);
  if (cmd && CommandRegistry[cmd]) {
    e.preventDefault();
    CommandRegistry[cmd]();
  }
}, true);

// Also listen on keyup to catch environments where AltGr only emits on release
document.addEventListener('keyup', (e) => {
  const isRightAlt =
    e.code === 'AltRight' ||
    e.key === 'AltGraph' ||
    (e.key === 'Alt' && e.location === 2);
  const isAltGrLike =
    (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey &&
      (e.key === 'Alt' || e.key === 'AltGraph' || e.code === 'AltRight' || e.location === 2));
  const altGraphState = e.getModifierState && e.getModifierState('AltGraph');
  if (isRightAlt || altGraphState || isAltGrLike) {
    e.preventDefault();
    e.stopPropagation();
    // If we didn't catch it on keydown, trigger on keyup
    if (!rightAltActive) {
      try { console.debug('[DeskPilot] Right Alt released - triggering hints'); } catch(e) {}
      Hinter.showHints(false);
    }
    rightAltActive = false;
  }
}, true);

// Initialize
(async function init() {
  settings = await StorageHelper.getSettings();
  
  if (isExcluded()) return;
  
  Scroller.init(settings);
  
  // Apply custom CSS if any
  if (settings.customCSS) {
    const style = document.createElement('style');
    style.textContent = settings.customCSS;
    document.head.appendChild(style);
  }
})();

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
  for (let key in changes) {
    settings[key] = changes[key].newValue;
  }
  Scroller.init(settings);
});