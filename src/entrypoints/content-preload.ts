import { defineContentScript } from 'wxt/utils/define-content-script';

// Preload script for early CSS injection to prevent flash
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  css: ['preload-hide.css'],
  main() {
    console.log('Face Block Extension - Preload script loaded');

    // Check if we should enable image hiding
    checkAndEnableImageHiding();
  }
});

function checkAndEnableImageHiding() {
  // Add data attribute to control CSS visibility
  document.documentElement.setAttribute('data-face-block-active', 'true');

  // Detect SSR frameworks
  const isSSR = detectSSRFramework();
  if (isSSR) {
    console.log('SSR framework detected, adjusting strategy...');
    // We can adjust our approach here if needed for specific frameworks
  }
}

function detectSSRFramework() {
  // Check for common SSR framework indicators
  const indicators = {
    nextjs: () => document.getElementById('__next') !== null,
    nuxt: () => document.getElementById('__nuxt') !== null,
    gatsby: () => document.getElementById('___gatsby') !== null,
    remix: () => document.querySelector('[data-remix-app]') !== null,
  };

  for (const [framework, check] of Object.entries(indicators)) {
    if (check()) {
      console.log(`Detected ${framework} framework`);
      return framework;
    }
  }

  return null;
}