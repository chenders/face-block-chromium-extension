/**
 * Structured logging system for Face Block extension
 * Provides consistent, filterable, and performant logging
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  NONE = 5
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

export class Logger {
  private level: LogLevel;
  private context: string;
  private buffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  private performanceMarks = new Map<string, number>();

  constructor(context: string) {
    this.context = context;
    this.level = this.getLogLevel();

    // Set up log level change listener
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'faceblock-loglevel') {
          this.level = this.getLogLevel();
          this.info('Log level changed', { newLevel: LogLevel[this.level] });
        }
      });
    }
  }

  private getLogLevel(): LogLevel {
    // Check localStorage first (for runtime changes)
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('faceblock-loglevel');
      if (stored) {
        const level = parseInt(stored);
        if (!isNaN(level)) return level;
      }
    }

    // Check if development mode
    const isDev = process.env.NODE_ENV === 'development' ||
                  (typeof chrome !== 'undefined' && chrome.runtime.getManifest().version.includes('dev'));

    return isDev ? LogLevel.DEBUG : LogLevel.WARN;
  }

  /**
   * Set log level dynamically
   */
  static setGlobalLogLevel(level: LogLevel): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('faceblock-loglevel', level.toString());
    }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Format log message with context
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const levelStr = LogLevel[level].padEnd(5);
    const timestamp = new Date().toISOString().split('T')[1];
    return `[${timestamp}][${levelStr}][${this.context}] ${message}`;
  }

  /**
   * Store log entry in buffer for later retrieval
   */
  private bufferLog(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      context: this.context,
      message,
      data
    };

    this.buffer.push(entry);

    // Maintain buffer size limit
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Trace level logging (most verbose)
   */
  trace(message: string, data?: any): void {
    if (this.level <= LogLevel.TRACE) {
      const formatted = this.formatMessage(LogLevel.TRACE, message, data);
      console.log(formatted, data ? data : '');
      this.bufferLog(LogLevel.TRACE, message, data);
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, data);
      console.log(formatted, data ? data : '');
      this.bufferLog(LogLevel.DEBUG, message, data);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      const formatted = this.formatMessage(LogLevel.INFO, message, data);
      console.info(formatted, data ? data : '');
      this.bufferLog(LogLevel.INFO, message, data);
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      const formatted = this.formatMessage(LogLevel.WARN, message, data);
      console.warn(formatted, data ? data : '');
      this.bufferLog(LogLevel.WARN, message, data);
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | any, data?: any): void {
    if (this.level <= LogLevel.ERROR) {
      const formatted = this.formatMessage(LogLevel.ERROR, message, data);

      if (error instanceof Error) {
        console.error(formatted, error, data ? data : '');
        this.bufferLog(LogLevel.ERROR, message, {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name
          },
          ...data
        });
      } else {
        console.error(formatted, error ? error : '', data ? data : '');
        this.bufferLog(LogLevel.ERROR, message, { error, ...data });
      }
    }
  }

  /**
   * Performance timing helpers
   */
  time(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      this.performanceMarks.set(label, performance.now());
      console.time(`[${this.context}] ${label}`);
    }
  }

  timeEnd(label: string): number | undefined {
    if (this.level <= LogLevel.DEBUG) {
      console.timeEnd(`[${this.context}] ${label}`);

      const start = this.performanceMarks.get(label);
      if (start) {
        const duration = performance.now() - start;
        this.performanceMarks.delete(label);
        this.debug(`${label} completed`, { duration: `${duration.toFixed(2)}ms` });
        return duration;
      }
    }
    return undefined;
  }

  /**
   * Measure async operation
   */
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.time(label);
    try {
      const result = await fn();
      this.timeEnd(label);
      return result;
    } catch (error) {
      this.timeEnd(label);
      throw error;
    }
  }

  /**
   * Group related logs
   */
  group(label: string, collapsed = false): void {
    if (this.level <= LogLevel.DEBUG) {
      const formatted = this.formatMessage(LogLevel.DEBUG, label);
      collapsed ? console.groupCollapsed(formatted) : console.group(formatted);
    }
  }

  groupEnd(): void {
    if (this.level <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`);
  }

  /**
   * Get buffered logs (for debugging/reporting)
   */
  getBuffer(filter?: {
    level?: LogLevel;
    since?: number;
    context?: string;
  }): LogEntry[] {
    let filtered = [...this.buffer];

    if (filter) {
      if (filter.level !== undefined) {
        filtered = filtered.filter(entry => entry.level >= filter.level!);
      }
      if (filter.since !== undefined) {
        filtered = filtered.filter(entry => entry.timestamp >= filter.since!);
      }
      if (filter.context !== undefined) {
        filtered = filtered.filter(entry => entry.context.includes(filter.context!));
      }
    }

    return filtered;
  }

  /**
   * Export logs as formatted string
   */
  exportLogs(filter?: { level?: LogLevel; since?: number }): string {
    const logs = this.getBuffer(filter);
    return logs.map(entry => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const level = LogLevel[entry.level];
      const data = entry.data ? JSON.stringify(entry.data) : '';
      return `${timestamp} [${level}] [${entry.context}] ${entry.message} ${data}`;
    }).join('\n');
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.buffer = [];
    this.performanceMarks.clear();
  }

  /**
   * Table logging for structured data
   */
  table(data: any[], columns?: string[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.table(data, columns);
    }
  }

  /**
   * Assert with logging
   */
  assert(condition: boolean, message: string, data?: any): void {
    if (!condition) {
      this.error(`Assertion failed: ${message}`, undefined, data);
      if (this.level <= LogLevel.DEBUG) {
        console.assert(condition, message, data);
      }
    }
  }
}

/**
 * Global logger instances for different contexts
 */
export const loggers = {
  content: new Logger('Content'),
  background: new Logger('Background'),
  popup: new Logger('Popup'),
  offscreen: new Logger('Offscreen'),
  firefox: new Logger('Firefox')
};

/**
 * Helper function to create a logger for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

/**
 * Development utilities
 */
export const LoggerUtils = {
  /**
   * Enable verbose logging
   */
  enableVerbose(): void {
    Logger.setGlobalLogLevel(LogLevel.TRACE);
    console.log('🔍 Face Block: Verbose logging enabled');
  },

  /**
   * Disable all logging
   */
  disableLogging(): void {
    Logger.setGlobalLogLevel(LogLevel.NONE);
    console.log('🔇 Face Block: Logging disabled');
  },

  /**
   * Show current log level
   */
  showLogLevel(): void {
    const level = localStorage.getItem('faceblock-loglevel');
    const levelName = level ? LogLevel[parseInt(level)] : 'DEFAULT';
    console.log(`📊 Face Block: Current log level: ${levelName}`);
  },

  /**
   * Export logs to clipboard
   */
  async exportToClipboard(filter?: { level?: LogLevel; since?: number }): Promise<void> {
    const logs = Object.values(loggers)
      .flatMap(logger => logger.getBuffer(filter))
      .sort((a, b) => a.timestamp - b.timestamp);

    const formatted = logs.map(entry => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const level = LogLevel[entry.level];
      const data = entry.data ? JSON.stringify(entry.data) : '';
      return `${timestamp} [${level}] [${entry.context}] ${entry.message} ${data}`;
    }).join('\n');

    await navigator.clipboard.writeText(formatted);
    console.log('📋 Face Block: Logs copied to clipboard');
  },

  /**
   * Show performance summary
   */
  showPerformanceSummary(): void {
    const logs = Object.values(loggers)
      .flatMap(logger => logger.getBuffer({ level: LogLevel.DEBUG }))
      .filter(entry => entry.data?.duration);

    const summary = logs.reduce((acc, entry) => {
      const label = entry.message.replace(' completed', '');
      if (!acc[label]) {
        acc[label] = { count: 0, total: 0, avg: 0 };
      }
      const duration = parseFloat(entry.data.duration);
      acc[label].count++;
      acc[label].total += duration;
      acc[label].avg = acc[label].total / acc[label].count;
      return acc;
    }, {} as Record<string, { count: number; total: number; avg: number }>);

    console.table(summary);
  }
};

// Expose utilities to window for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).FaceBlockLogger = LoggerUtils;
  console.log('🐛 Face Block Logger utilities available at window.FaceBlockLogger');
}