// preload.js - Runs at document_start to prevent image flashing
// This script hides all images immediately before they load, then the main content script
// will restore visibility for non-matching images after processing

(function() {
  'use strict';

  // Inject CSS to hide all images initially
  const style = document.createElement('style');
  style.id = 'face-block-preload-styles';
  style.textContent = `
    img:not([data-face-block-processed]):not([src^="data:"]):not([src^="blob:"]) {
      opacity: 0 !important;
      transition: none !important;
    }
  `;

  // Insert at the very beginning of <head> or create <head> if it doesn't exist
  function injectStyle() {
    if (document.head) {
      document.head.insertBefore(style, document.head.firstChild);
    } else if (document.documentElement) {
      const head = document.createElement('head');
      head.appendChild(style);
      document.documentElement.insertBefore(head, document.documentElement.firstChild);
    } else {
      // Retry shortly if DOM not ready
      setTimeout(injectStyle, 10);
    }
  }

  injectStyle();

  console.log('Face Block Chromium Extension: Preload script injected');
})();
