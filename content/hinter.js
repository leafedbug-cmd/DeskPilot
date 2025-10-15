// Link hint logic
const Hinter = {
  hints: [],
  hintElements: [],
  currentInput: '',
  openInNewTab: false,
  
  showHints(newTab) {
    this.openInNewTab = newTab;
    this.removeHints();
    
    // Get all clickable elements
    const elements = this.getClickableElements();
    const hints = this.generateHintStrings(elements.length);
    
    this.hints = hints;
    this.hintElements = [];
    this.currentInput = '';
    
    elements.forEach((el, i) => {
      const hint = this.createHintElement(hints[i], el);
      this.hintElements.push({ hint, element: el, text: hints[i] });
    });
    
    this.attachKeyListener();
  },
  
  getClickableElements() {
    const elements = [];
    const selector = 'a, button, input[type="button"], input[type="submit"], [role="button"], [onclick]';
    const nodes = document.querySelectorAll(selector);
    
    nodes.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && 
          rect.top >= 0 && rect.left >= 0 &&
          rect.bottom <= window.innerHeight && 
          rect.right <= window.innerWidth) {
        elements.push(el);
      }
    });
    
    return elements;
  },
  
  generateHintStrings(count) {
    const chars = 'asdfghjkl';
    const hints = [];
    
    for (let i = 0; i < count; i++) {
      let hint = '';
      let num = i;
      do {
        hint = chars[num % chars.length] + hint;
        num = Math.floor(num / chars.length) - 1;
      } while (num >= 0);
      hints.push(hint);
    }
    
    return hints;
  },
  
  createHintElement(text, targetEl) {
    const hint = document.createElement('div');
    hint.className = 'deskpilot-hint';
    hint.textContent = text;
    hint.style.cssText = `
      position: absolute;
      background: #ffdd57;
      color: #000;
      padding: 2px 6px;
      font-size: 12px;
      font-weight: bold;
      font-family: monospace;
      border: 1px solid #000;
      border-radius: 3px;
      z-index: 2147483647;
      pointer-events: none;
    `;
    
    const rect = targetEl.getBoundingClientRect();
    hint.style.left = (rect.left + window.scrollX) + 'px';
    hint.style.top = (rect.top + window.scrollY) + 'px';
    
    document.body.appendChild(hint);
    return hint;
  },
  
  attachKeyListener() {
    this.keyHandler = (e) => {
      if (e.key === 'Escape') {
        this.removeHints();
        return;
      }
      
      if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
        e.preventDefault();
        e.stopPropagation();
        
        this.currentInput += e.key.toLowerCase();
        this.filterHints();
      }
    };
    
    document.addEventListener('keydown', this.keyHandler, true);
  },
  
  filterHints() {
    let matchedElement = null;
    
    this.hintElements = this.hintElements.filter(({ hint, element, text }) => {
      if (text === this.currentInput) {
        matchedElement = element;
        return false;
      }
      
      if (text.startsWith(this.currentInput)) {
        hint.textContent = text;
        return true;
      }
      
      hint.remove();
      return false;
    });
    
    if (matchedElement) {
      this.clickElement(matchedElement);
      this.removeHints();
    } else if (this.hintElements.length === 0) {
      this.removeHints();
    }
  },
  
  clickElement(el) {
    if (this.openInNewTab && el.tagName === 'A' && el.href) {
      window.open(el.href, '_blank');
    } else {
      el.click();
    }
  },
  
  removeHints() {
    this.hintElements.forEach(({ hint }) => hint.remove());
    this.hintElements = [];
    this.hints = [];
    this.currentInput = '';
    
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
  }
};