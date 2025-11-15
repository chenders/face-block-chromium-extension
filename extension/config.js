// Configuration and utilities for the extension

// Debug mode - set to true for verbose logging, false for production
const DEBUG_MODE = false;

/**
 * Debug logger - only logs when DEBUG_MODE is enabled
 * @param {...any} args - Arguments to log
 */
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log('[Face Block Debug]', ...args);
  }
}

/**
 * Info logger - always logs informational messages
 * @param {...any} args - Arguments to log
 */
function infoLog(...args) {
  console.info('[Face Block]', ...args);
}

/**
 * Warning logger - always logs warnings
 * @param {...any} args - Arguments to log
 */
function warnLog(...args) {
  console.warn('[Face Block Warning]', ...args);
}

/**
 * Error logger - always logs errors
 * @param {...any} args - Arguments to log
 */
function errorLog(...args) {
  console.error('[Face Block Error]', ...args);
}
