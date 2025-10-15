// Scrolling logic
const Scroller = {
  settings: {},
  
  init(settings) {
    this.settings = settings;
  },
  
  scrollDown() {
    this.scroll(this.settings.scrollStepSize || 60);
  },
  
  scrollUp() {
    this.scroll(-(this.settings.scrollStepSize || 60));
  },
  
  scrollDownHalf() {
    this.scroll(window.innerHeight / 2);
  },
  
  scrollUpHalf() {
    this.scroll(-window.innerHeight / 2);
  },
  
  scrollToTop() {
    if (this.settings.smoothScrolling) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  },
  
  scrollToBottom() {
    if (this.settings.smoothScrolling) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
      window.scrollTo(0, document.body.scrollHeight);
    }
  },
  
  scroll(amount) {
    if (this.settings.smoothScrolling) {
      window.scrollBy({ top: amount, behavior: 'smooth' });
    } else {
      window.scrollBy(0, amount);
    }
  }
};