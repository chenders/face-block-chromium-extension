/**
 * Visual debugging overlay for Face Block extension
 * Shows real-time face detection status and statistics
 */

export interface DetectionInfo {
  img: HTMLImageElement;
  blocked: boolean;
  facesDetected: number;
  matches?: Array<{
    label: string;
    distance: number;
    confidence?: number;
  }>;
  processingTime?: number;
  error?: string;
}

export class DebugOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private enabled: boolean = false;
  private stats = {
    imagesProcessed: 0,
    imagesBlocked: 0,
    totalFaces: 0,
    avgProcessingTime: 0,
    processingTimes: [] as number[],
  };
  private activeDetections = new Map<HTMLImageElement, DetectionInfo>();
  private animationFrame: number | null = null;

  constructor() {
    // Check if debugging is enabled
    this.enabled = typeof localStorage !== 'undefined' && localStorage.getItem('faceblock-debug') === 'true';

    if (!this.enabled) return;

    // Create canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'faceblock-debug-overlay';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '999999';
    this.canvas.style.opacity = '1';
    document.body.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }
    this.ctx = ctx;

    // Set up resize handler
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('scroll', () => this.render(), { passive: true });

    // Create stats panel
    this.createStatsPanel();

    // Start render loop
    this.startRenderLoop();

    console.log('🎨 Face Block Debug Overlay enabled');
  }

  /**
   * Enable or disable the overlay
   */
  static toggle(): boolean {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available');
      return false;
    }
    const current = localStorage.getItem('faceblock-debug') === 'true';
    const newState = !current;
    localStorage.setItem('faceblock-debug', newState ? 'true' : 'false');

    if (newState) {
      console.log('🎨 Debug overlay enabled. Reload page to see overlay.');
    } else {
      console.log('🎨 Debug overlay disabled. Reload page to remove overlay.');
    }

    return newState;
  }

  /**
   * Check if overlay is enabled
   */
  static isEnabled(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('faceblock-debug') === 'true';
  }

  /**
   * Resize canvas to match window
   */
  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.render();
  }

  /**
   * Create stats panel
   */
  private createStatsPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'faceblock-stats-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      z-index: 999999;
      min-width: 250px;
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;

    panel.innerHTML = `
      <div style="margin-bottom: 10px; font-size: 14px; font-weight: bold; color: #4CAF50;">
        🔍 Face Block Debug
      </div>
      <div id="faceblock-stats-content"></div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
        <button id="faceblock-debug-clear" style="
          background: #2196F3;
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 5px;
        ">Clear</button>
        <button id="faceblock-debug-close" style="
          background: #f44336;
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    document.body.appendChild(panel);

    // Add event listeners
    document.getElementById('faceblock-debug-clear')?.addEventListener('click', () => {
      this.clear();
    });

    document.getElementById('faceblock-debug-close')?.addEventListener('click', () => {
      this.disable();
    });

    this.updateStatsPanel();
  }

  /**
   * Update stats panel content
   */
  private updateStatsPanel(): void {
    const content = document.getElementById('faceblock-stats-content');
    if (!content) return;

    const avgTime =
      this.stats.processingTimes.length > 0
        ? (
            this.stats.processingTimes.reduce((a, b) => a + b, 0) /
            this.stats.processingTimes.length
          ).toFixed(2)
        : '0';

    const blockRate =
      this.stats.imagesProcessed > 0
        ? ((this.stats.imagesBlocked / this.stats.imagesProcessed) * 100).toFixed(1)
        : '0';

    content.innerHTML = `
      <div style="margin-bottom: 8px;">
        <span style="color: #888;">Processed:</span>
        <span style="float: right; color: #4CAF50;">${this.stats.imagesProcessed}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="color: #888;">Blocked:</span>
        <span style="float: right; color: #f44336;">${this.stats.imagesBlocked}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="color: #888;">Block Rate:</span>
        <span style="float: right; color: #FFC107;">${blockRate}%</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="color: #888;">Total Faces:</span>
        <span style="float: right; color: #2196F3;">${this.stats.totalFaces}</span>
      </div>
      <div>
        <span style="color: #888;">Avg Time:</span>
        <span style="float: right; color: #9C27B0;">${avgTime}ms</span>
      </div>
    `;
  }

  /**
   * Start render loop
   */
  private startRenderLoop(): void {
    const render = () => {
      this.render();
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  /**
   * Stop render loop
   */
  private stopRenderLoop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Add detection result
   */
  addDetection(img: HTMLImageElement, info: DetectionInfo): void {
    if (!this.enabled) return;

    this.activeDetections.set(img, info);

    // Update stats
    this.stats.imagesProcessed++;
    if (info.blocked) {
      this.stats.imagesBlocked++;
    }
    if (info.facesDetected > 0) {
      this.stats.totalFaces += info.facesDetected;
    }
    if (info.processingTime) {
      this.stats.processingTimes.push(info.processingTime);
      // Keep only last 100 times for average
      if (this.stats.processingTimes.length > 100) {
        this.stats.processingTimes.shift();
      }
    }

    this.updateStatsPanel();
  }

  /**
   * Render overlay
   */
  private render(): void {
    if (!this.enabled || !this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw detection overlays
    this.activeDetections.forEach((info, img) => {
      if (!document.body.contains(img)) {
        // Remove if image no longer in DOM
        this.activeDetections.delete(img);
        return;
      }

      this.drawDetectionOverlay(img, info);
    });
  }

  /**
   * Draw detection overlay for an image
   */
  private drawDetectionOverlay(img: HTMLImageElement, info: DetectionInfo): void {
    const rect = img.getBoundingClientRect();

    // Skip if image is not visible
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      return;
    }

    // Draw border
    this.ctx.strokeStyle = info.blocked
      ? '#f44336'
      : info.facesDetected > 0
        ? '#4CAF50'
        : info.error
          ? '#FF9800'
          : '#2196F3';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);

    // Draw corner indicators
    const cornerSize = 15;
    this.ctx.fillStyle = this.ctx.strokeStyle;

    // Top-left corner
    this.ctx.fillRect(rect.left - 2, rect.top - 2, cornerSize, 3);
    this.ctx.fillRect(rect.left - 2, rect.top - 2, 3, cornerSize);

    // Top-right corner
    this.ctx.fillRect(rect.right - cornerSize + 2, rect.top - 2, cornerSize, 3);
    this.ctx.fillRect(rect.right - 1, rect.top - 2, 3, cornerSize);

    // Bottom-left corner
    this.ctx.fillRect(rect.left - 2, rect.bottom - 1, cornerSize, 3);
    this.ctx.fillRect(rect.left - 2, rect.bottom - cornerSize + 2, 3, cornerSize);

    // Bottom-right corner
    this.ctx.fillRect(rect.right - cornerSize + 2, rect.bottom - 1, cornerSize, 3);
    this.ctx.fillRect(rect.right - 1, rect.bottom - cornerSize + 2, 3, cornerSize);

    // Draw info box
    const infoBoxHeight = 60;
    const infoBoxY = rect.top - infoBoxHeight - 5;
    const finalY = infoBoxY < 0 ? rect.bottom + 5 : infoBoxY;

    // Info box background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(rect.left, finalY, Math.min(rect.width, 250), infoBoxHeight);

    // Info box border
    this.ctx.strokeStyle = this.ctx.strokeStyle;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(rect.left, finalY, Math.min(rect.width, 250), infoBoxHeight);

    // Info text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '11px Monaco, monospace';

    let yOffset = finalY + 15;
    const xOffset = rect.left + 8;

    // Status
    const status = info.blocked
      ? '🚫 BLOCKED'
      : info.facesDetected > 0
        ? '✅ DETECTED'
        : info.error
          ? '⚠️ ERROR'
          : '⏳ PROCESSING';
    this.ctx.fillText(status, xOffset, yOffset);
    yOffset += 14;

    // Faces detected
    this.ctx.fillText(`Faces: ${info.facesDetected || 0}`, xOffset, yOffset);
    yOffset += 14;

    // Match info
    if (info.matches && info.matches.length > 0) {
      const match = info.matches[0];
      const confidence = match.confidence || (1 - match.distance) * 100;
      this.ctx.fillText(`Match: ${match.label} (${confidence.toFixed(0)}%)`, xOffset, yOffset);
    } else if (info.processingTime) {
      this.ctx.fillText(`Time: ${info.processingTime.toFixed(1)}ms`, xOffset, yOffset);
    }

    // Draw face rectangles if available
    // Note: This would require face coordinates from the detection
  }

  /**
   * Clear all detections
   */
  clear(): void {
    this.activeDetections.clear();
    this.stats = {
      imagesProcessed: 0,
      imagesBlocked: 0,
      totalFaces: 0,
      avgProcessingTime: 0,
      processingTimes: [],
    };
    this.updateStatsPanel();
    this.render();
  }

  /**
   * Disable overlay
   */
  disable(): void {
    this.enabled = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('faceblock-debug', 'false');
    }
    this.stopRenderLoop();
    this.canvas.remove();
    document.getElementById('faceblock-stats-panel')?.remove();
  }

  /**
   * Check if image is being tracked
   */
  isTracking(img: HTMLImageElement): boolean {
    return this.activeDetections.has(img);
  }

  /**
   * Remove tracking for an image
   */
  removeTracking(img: HTMLImageElement): void {
    this.activeDetections.delete(img);
  }
}

// Export singleton instance
let debugOverlayInstance: DebugOverlay | null = null;

export function getDebugOverlay(): DebugOverlay | null {
  if (!debugOverlayInstance && typeof document !== 'undefined' && DebugOverlay.isEnabled()) {
    debugOverlayInstance = new DebugOverlay();
  }
  return debugOverlayInstance;
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).FaceBlockDebug = {
    toggle: () => DebugOverlay.toggle(),
    isEnabled: () => DebugOverlay.isEnabled(),
    clear: () => getDebugOverlay()?.clear(),
    disable: () => getDebugOverlay()?.disable(),
  };

  console.log(
    '🐛 Face Block Debug Overlay available. Use window.FaceBlockDebug.toggle() to enable/disable'
  );
}
