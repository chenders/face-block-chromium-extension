// preload.js - Runs at document_start to enable image hiding
//
// This script sets a data attribute on the <html> element to activate
// the CSS rules that hide images (injected via manifest.json).
//
// The CSS hiding approach:
// - CSS is injected by the browser at engine level (via manifest.json)
// - CSS only activates when html[data-face-block-active] is present
// - This script adds that attribute immediately at document_start
// - content.js removes the attribute after face detection completes
//
// Why this works with SSR frameworks (Next.js, React, etc.):
// - No style elements are added to the DOM (CSS comes from manifest)
// - Only a harmless data attribute is added to <html>
// - Frameworks don't manage the <html> element, so no conflicts
// - No hydration errors or head management issues
//
// This ensures zero flash of unwanted images while being framework-agnostic.

(function () {
  'use strict';

  // Activate image hiding by setting the data attribute
  document.documentElement.setAttribute('data-face-block-active', 'true');
})();
