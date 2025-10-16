// Service worker for cross-tab actions
let settings = {};
const CONTEXT_MENU_TOGGLE_ID = 'deskpilot-toggle-extension';

// Load settings on startup
chrome.runtime.onInstalled.addListener((details) => {
  const defaultSettings = {
    keyMappings: {
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
    },
    exclusionRules: [],
    smoothScrolling: true,
    scrollStepSize: 60,
    customCSS: '',
    extensionEnabled: true
  };

  chrome.storage.sync.get(null, async (current) => {
    if (details.reason === 'install') {
      await chrome.storage.sync.set(defaultSettings);
      settings = defaultSettings;
    } else {
      const updates = {};
      for (const key of Object.keys(defaultSettings)) {
        if (typeof current[key] === 'undefined') {
          updates[key] = defaultSettings[key];
        }
      }
      if (Object.keys(updates).length > 0) {
        await chrome.storage.sync.set(updates);
      }
      settings = { ...defaultSettings, ...current, ...updates };
    }
    initializeContextMenu();
    updateActionBadge(settings.extensionEnabled !== false);
  });
});

chrome.storage.sync.get(null, (items) => {
  settings = { extensionEnabled: true, ...items };
  initializeContextMenu();
  updateActionBadge(settings.extensionEnabled !== false);
});

chrome.storage.onChanged.addListener((changes) => {
  for (let key in changes) {
    settings[key] = changes[key].newValue;
  }
  if (changes.extensionEnabled) {
    const enabled = changes.extensionEnabled.newValue !== false;
    updateContextMenuState(enabled);
    updateActionBadge(enabled);
  }
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === CONTEXT_MENU_TOGGLE_ID) {
    const enabled = info.checked;
    chrome.storage.sync.set({ extensionEnabled: enabled });
  }
});

function initializeContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_TOGGLE_ID,
      title: 'Enable DeskPilot',
      contexts: ['action'],
      type: 'checkbox',
      checked: settings.extensionEnabled !== false
    });
  });
}

function updateContextMenuState(enabled) {
  chrome.contextMenus.update(CONTEXT_MENU_TOGGLE_ID, {
    checked: enabled
  }, () => void chrome.runtime.lastError);
}

function updateActionBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
    chrome.action.setBadgeText({ text: 'OFF' });
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openOmnibar') {
    handleOmnibar(request.newTab, sender.tab);
  } else if (request.action === 'openTabSearch') {
    handleTabSearch(sender.tab);
  } else if (request.action === 'nextTab') {
    handleNextTab(sender.tab.id);
  } else if (request.action === 'prevTab') {
    handlePrevTab(sender.tab.id);
  } else if (request.action === 'closeTab') {
    chrome.tabs.remove(sender.tab.id);
  } else if (request.action === 'historyBack') {
    chrome.tabs.goBack(sender.tab.id);
  } else if (request.action === 'historyForward') {
    chrome.tabs.goForward(sender.tab.id);
  } else if (request.action === 'searchBookmarksHistory') {
    searchBookmarksAndHistory(request.query, sendResponse);
    return true;
  } else if (request.action === 'getAllTabs') {
    getAllTabs(sendResponse);
    return true;
  }
});

async function handleOmnibar(newTab, currentTab) {
  const html = createOmnibarHTML();
  await chrome.scripting.insertCSS({
    target: { tabId: currentTab.id },
    css: getOmnibarCSS()
  });
  
  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: showOmnibar,
    args: [html, newTab]
  });
}

function createOmnibarHTML() {
  return `
    <div id="deskpilot-omnibar" style="position: fixed; top: 20%; left: 50%; transform: translateX(-50%); z-index: 2147483647; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 600px; max-width: 90vw;">
      <input type="text" id="deskpilot-omnibar-input" placeholder="Search bookmarks, history, or enter URL..." style="width: 100%; padding: 16px; font-size: 16px; border: none; border-bottom: 1px solid #e0e0e0; border-radius: 8px 8px 0 0; outline: none;">
      <div id="deskpilot-omnibar-results" style="max-height: 400px; overflow-y: auto;"></div>
    </div>
  `;
}

function getOmnibarCSS() {
  return `
    #deskpilot-omnibar-results > div {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
    }
    #deskpilot-omnibar-results > div:hover,
    #deskpilot-omnibar-results > div.selected {
      background: #f5f5f5;
    }
    #deskpilot-omnibar-results .result-title {
      font-weight: 500;
      margin-bottom: 4px;
    }
    #deskpilot-omnibar-results .result-url {
      font-size: 12px;
      color: #666;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
}

function showOmnibar(html, openInNewTab) {
  // Remove existing omnibar if any
  const existing = document.getElementById('deskpilot-omnibar');
  if (existing) existing.remove();
  
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container.firstElementChild);
  
  const omnibar = document.getElementById('deskpilot-omnibar');
  const input = document.getElementById('deskpilot-omnibar-input');
  const results = document.getElementById('deskpilot-omnibar-results');
  
  let currentResults = [];
  let selectedIndex = -1;
  
  input.focus();
  
  const updateSelection = () => {
    const items = results.querySelectorAll('div');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === selectedIndex);
    });
  };
  
  const navigate = () => {
    if (selectedIndex >= 0 && currentResults[selectedIndex]) {
      const url = currentResults[selectedIndex].url;
      if (openInNewTab) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
      omnibar.remove();
    } else if (input.value.trim()) {
      let url = input.value.trim();
      if (!url.match(/^https?:\/\//)) {
        if (url.includes('.')) {
          url = 'https://' + url;
        } else {
          url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
      }
      if (openInNewTab) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
      omnibar.remove();
    }
  };
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      omnibar.remove();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection();
    }
  });
  
  input.addEventListener('input', async () => {
    const query = input.value.trim();
    if (query.length < 2) {
      results.innerHTML = '';
      currentResults = [];
      selectedIndex = -1;
      return;
    }
    
    const response = await chrome.runtime.sendMessage({
      action: 'searchBookmarksHistory',
      query: query
    });
    
    currentResults = response;
    selectedIndex = response.length > 0 ? 0 : -1;
    
    results.innerHTML = response.map((item, idx) => `
      <div data-index="${idx}">
        <div class="result-title">${escapeHtml(item.title || item.url)}</div>
        <div class="result-url">${escapeHtml(item.url)}</div>
      </div>
    `).join('');
    
    updateSelection();
    
    results.querySelectorAll('div[data-index]').forEach((el) => {
      el.addEventListener('click', () => {
        selectedIndex = parseInt(el.dataset.index);
        navigate();
      });
    });
  });
  
  // Click outside to close
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!omnibar.contains(e.target)) {
        omnibar.remove();
      }
    }, { once: true });
  }, 100);
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

async function searchBookmarksAndHistory(query, sendResponse) {
  const results = [];
  
  // Search bookmarks
  try {
    const bookmarks = await chrome.bookmarks.search(query);
    bookmarks.forEach(b => {
      if (b.url) {
        results.push({ title: b.title, url: b.url, type: 'bookmark' });
      }
    });
  } catch (e) {
    console.error('Bookmark search failed:', e);
  }
  
  // Search history
  try {
    const history = await chrome.history.search({ text: query, maxResults: 20 });
    history.forEach(h => {
      results.push({ title: h.title, url: h.url, type: 'history' });
    });
  } catch (e) {
    console.error('History search failed:', e);
  }
  
  // Remove duplicates and limit results
  const unique = Array.from(new Map(results.map(r => [r.url, r])).values());
  sendResponse(unique.slice(0, 10));
}

async function handleTabSearch(currentTab) {
  const html = createTabSearchHTML();
  await chrome.scripting.insertCSS({
    target: { tabId: currentTab.id },
    css: getOmnibarCSS()
  });
  
  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: showTabSearch,
    args: [html]
  });
}

function createTabSearchHTML() {
  return `
    <div id="deskpilot-tabsearch" style="position: fixed; top: 20%; left: 50%; transform: translateX(-50%); z-index: 2147483647; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 600px; max-width: 90vw;">
      <input type="text" id="deskpilot-tabsearch-input" placeholder="Search open tabs..." style="width: 100%; padding: 16px; font-size: 16px; border: none; border-bottom: 1px solid #e0e0e0; border-radius: 8px 8px 0 0; outline: none;">
      <div id="deskpilot-tabsearch-results" style="max-height: 400px; overflow-y: auto;"></div>
    </div>
  `;
}

function showTabSearch(html) {
  const existing = document.getElementById('deskpilot-tabsearch');
  if (existing) existing.remove();
  
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container.firstElementChild);
  
  const tabsearch = document.getElementById('deskpilot-tabsearch');
  const input = document.getElementById('deskpilot-tabsearch-input');
  const results = document.getElementById('deskpilot-tabsearch-results');
  
  let allTabs = [];
  let filteredTabs = [];
  let selectedIndex = -1;
  
  input.focus();
  
  chrome.runtime.sendMessage({ action: 'getAllTabs' }, (tabs) => {
    allTabs = tabs;
    filteredTabs = tabs;
    renderResults();
  });
  
  const updateSelection = () => {
    const items = results.querySelectorAll('div[data-index]');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === selectedIndex);
    });
  };
  
  const renderResults = () => {
    results.innerHTML = filteredTabs.map((tab, idx) => `
      <div data-index="${idx}">
        <div class="result-title">${escapeHtml(tab.title)}</div>
        <div class="result-url">${escapeHtml(tab.url)}</div>
      </div>
    `).join('');
    
    selectedIndex = filteredTabs.length > 0 ? 0 : -1;
    updateSelection();
    
    results.querySelectorAll('div[data-index]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        switchToTab(filteredTabs[idx].id, filteredTabs[idx].windowId);
      });
    });
  };
  
  const switchToTab = (tabId, windowId) => {
    chrome.runtime.sendMessage({
      action: 'switchToTab',
      tabId: tabId,
      windowId: windowId
    });
    tabsearch.remove();
  };
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      tabsearch.remove();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const tab = filteredTabs[selectedIndex];
      switchToTab(tab.id, tab.windowId);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredTabs.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    }
  });
  
  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    if (!query) {
      filteredTabs = allTabs;
    } else {
      filteredTabs = allTabs.filter(tab => 
        tab.title.toLowerCase().includes(query) || 
        tab.url.toLowerCase().includes(query)
      );
    }
    renderResults();
  });
  
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!tabsearch.contains(e.target)) {
        tabsearch.remove();
      }
    }, { once: true });
  }, 100);
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

async function getAllTabs(sendResponse) {
  const tabs = await chrome.tabs.query({});
  sendResponse(tabs);
}

// Handle tab switching
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'switchToTab') {
    chrome.tabs.update(request.tabId, { active: true });
    chrome.windows.update(request.windowId, { focused: true });
  }
});

async function handleNextTab(currentTabId) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const currentIndex = tabs.findIndex(t => t.id === currentTabId);
  const nextIndex = (currentIndex + 1) % tabs.length;
  await chrome.tabs.update(tabs[nextIndex].id, { active: true });
}

async function handlePrevTab(currentTabId) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const currentIndex = tabs.findIndex(t => t.id === currentTabId);
  const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  await chrome.tabs.update(tabs[prevIndex].id, { active: true });
}
