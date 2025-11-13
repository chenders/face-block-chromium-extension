// preload.js - Runs at document_start to prevent image flashing
// This script hides all images immediately before they load, then the main content script
// will restore visibility for non-matching images after processing

(function () {
  'use strict';

  // Quick check if this might be a React site (to avoid hydration errors)
  // We check early indicators that are available at document_start
  function isLikelyReactSite() {
    // Check for known React-heavy sites by domain
    const knownReactSites = [
      'unsplash.com',
      'airbnb.com',
      'netflix.com',
      'instagram.com',
      'facebook.com',
      'reddit.com',
      'twitter.com',
      'x.com',
      'github.com',
      'linkedin.com',
    ];

    const hostname = window.location.hostname.replace('www.', '');
    if (knownReactSites.some(site => hostname.includes(site))) {
      return true;
    }

    // Check for React meta tags or data attributes in the HTML
    const htmlContent = document.documentElement?.outerHTML || '';

    // Look for common React/Next.js indicators in the HTML
    if (
      htmlContent.includes('__NEXT_DATA__') ||
      htmlContent.includes('data-reactroot') ||
      htmlContent.includes('data-reactid') ||
      htmlContent.includes('id="__next"') ||
      htmlContent.includes('id="__react')
    ) {
      return true;
    }

    return false;
  }

  // Skip preload hiding on React sites to avoid hydration mismatches
  // React sites will handle blocking with a slight delay instead
  if (isLikelyReactSite()) {
    return;
  }

  // Inject CSS to hide all images initially (non-React sites only)
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
})();
