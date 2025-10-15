// Command registry
const CommandRegistry = {
  scrollDown: () => Scroller.scrollDown(),
  scrollUp: () => Scroller.scrollUp(),
  scrollDownHalf: () => Scroller.scrollDownHalf(),
  scrollUpHalf: () => Scroller.scrollUpHalf(),
  scrollToTop: () => Scroller.scrollToTop(),
  scrollToBottom: () => Scroller.scrollToBottom(),
  linkHints: () => Hinter.showHints(false),
  linkHintsNewTab: () => Hinter.showHints(true),
  nextTab: () => chrome.runtime.sendMessage({ action: 'nextTab' }),
  prevTab: () => chrome.runtime.sendMessage({ action: 'prevTab' }),
  closeTab: () => chrome.runtime.sendMessage({ action: 'closeTab' }),
  historyBack: () => chrome.runtime.sendMessage({ action: 'historyBack' }),
  historyForward: () => chrome.runtime.sendMessage({ action: 'historyForward' }),
  omnibar: () => chrome.runtime.sendMessage({ action: 'openOmnibar', newTab: false }),
  omnibarNewTab: () => chrome.runtime.sendMessage({ action: 'openOmnibar', newTab: true }),
  tabSearch: () => chrome.runtime.sendMessage({ action: 'openTabSearch' }),
  insertMode: () => ModeManager.enterInsertMode(),
  help: () => HelpDialog.show()
};