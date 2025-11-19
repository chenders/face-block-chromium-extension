import { defineConfig } from 'wxt';
import { resolve } from 'path';

export default defineConfig({
  // Enable automatic public asset copying
  experimental: {
    publicAssets: true
  },
  // Define the browsers we want to support
  webExt: {
    chromiumProfile: 'dev-chrome',
    firefoxProfile: 'dev-firefox',
    startUrls: ['https://www.google.com', 'https://nextjs.org'],
  },

  // Define manifest configuration
  manifest: {
    name: 'Face Block',
    version: '0.1.0',
    description: 'Privacy-focused extension that blocks images of specified people',
    permissions: [
      'storage',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess',
      'offscreen' // Chrome-only permission for offscreen document
    ],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': '/icon16.png',
      '32': '/icon32.png',
      '48': '/icon48.png',
      '128': '/icon128.png'
    },
    // Browser-specific settings for Firefox
    browser_specific_settings: {
      gecko: {
        id: 'face-block@groundeffectsoftware.com',
        strict_min_version: '121.0'
      }
    }
  },

  // Source directory configuration
  srcDir: 'src',

  // Entry points will be defined as we migrate files
  // entrypointsDir is relative to srcDir, so just 'entrypoints'
  entrypointsDir: 'entrypoints',

  // Public directory for static assets
  // publicDir is relative to srcDir, so just 'public'
  publicDir: 'public',

  // Browser-specific builds
  browser: 'chrome', // Default browser for development

  // Modules for code organization
  modules: [],

  // Vite configuration for advanced bundling
  vite: () => ({
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  }),
});