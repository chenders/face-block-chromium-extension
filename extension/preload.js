// preload.js - Runs at document_start to prevent image flashing
// This script hides all images immediately before they load, then the main content script
// will restore visibility for non-matching images after processing

(function () {
  'use strict';

  // Quick check if this might be an SSR site with hydration (to avoid hydration errors)
  // We check early indicators that are available at document_start
  //
  // Supported frameworks:
  // - React/Next.js: Server-rendered React apps with hydration
  // - Vue/Nuxt: Vue SSR framework
  // - Angular Universal: Angular SSR
  // - Svelte/SvelteKit: Svelte SSR framework
  // - Solid.js: Solid SSR with hydration
  // - Qwik: Resumable framework (uses serialization instead of hydration)
  // - Astro: Static site generator with optional hydration islands
  //
  // Why we skip preload hiding on SSR sites:
  // SSR frameworks render HTML on the server and hydrate it on the client.
  // If we modify the DOM (hide images) before hydration completes, the framework
  // detects a mismatch between server HTML and client state, causing warnings.
  // Instead, we delay face detection until after hydration using requestIdleCallback.
  function isLikelySsrSite() {
    // Check for known SSR-heavy sites by domain
    const knownSsrSites = [
      // React/Next.js sites
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
      // Vue/Nuxt sites (common examples)
      'nuxtjs.org',
      'vuejs.org',
      // Angular sites
      'angular.io',
      'angular.dev',
    ];

    const hostname = window.location.hostname.replace('www.', '');
    if (knownSsrSites.some(site => hostname.includes(site))) {
      return true;
    }

    // Check for SSR framework indicators in the HTML
    const htmlContent = document.documentElement?.outerHTML || '';

    // React/Next.js indicators
    if (
      htmlContent.includes('__NEXT_DATA__') ||
      htmlContent.includes('data-reactroot') ||
      htmlContent.includes('data-reactid') ||
      htmlContent.includes('id="__next"') ||
      htmlContent.includes('id="__react')
    ) {
      return true;
    }

    // Vue/Nuxt indicators
    if (
      htmlContent.includes('__NUXT__') ||
      htmlContent.includes('data-n-head') ||
      htmlContent.includes('data-v-') ||
      htmlContent.includes('id="__nuxt"')
    ) {
      return true;
    }

    // Angular Universal indicators
    if (
      htmlContent.includes('ng-version') ||
      htmlContent.includes('ng-state') ||
      htmlContent.includes('<app-root')
    ) {
      return true;
    }

    // Svelte/SvelteKit indicators
    if (htmlContent.includes('__SVELTEKIT__') || htmlContent.includes('data-sveltekit')) {
      return true;
    }

    // Solid.js indicators
    if (htmlContent.includes('data-hk')) {
      return true;
    }

    // Qwik indicators (resumability, but better to be safe)
    if (htmlContent.includes('q:id') || htmlContent.includes('q:key')) {
      return true;
    }

    // Astro indicators (islands architecture)
    if (htmlContent.includes('astro-island')) {
      return true;
    }

    return false;
  }

  // Skip preload hiding on SSR sites to avoid hydration mismatches
  // SSR sites will handle blocking with a slight delay instead
  if (isLikelySsrSite()) {
    return;
  }

  // Inject CSS to hide all images initially (non-SSR sites only)
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
