/**
 * Priority queue for efficient image processing
 * Prioritizes visible images and processes them first
 */

export interface QueuedImage {
  img: HTMLImageElement;
  priority: number;
  timestamp: number;
}

export class ImageProcessQueue {
  private maxConcurrent: number;
  private queue: QueuedImage[] = [];
  private processing = 0;
  private processCallback: (img: HTMLImageElement) => Promise<void>;
  private processedImages = new Set<string>();

  constructor(processCallback: (img: HTMLImageElement) => Promise<void>, maxConcurrent = 8) {
    this.maxConcurrent = maxConcurrent;
    this.processCallback = processCallback;
  }

  /**
   * Add image to queue with calculated priority
   */
  add(img: HTMLImageElement): void {
    // Skip if already processed or queued
    const imgKey = this.getImageKey(img);
    if (this.processedImages.has(imgKey)) {
      return;
    }

    // Check if already in queue
    if (this.queue.some(item => this.getImageKey(item.img) === imgKey)) {
      return;
    }

    const priority = this.calculatePriority(img);

    this.queue.push({
      img,
      priority,
      timestamp: Date.now(),
    });

    // Sort by priority (highest first)
    this.queue.sort((a, b) => {
      // First sort by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by timestamp (older first)
      return a.timestamp - b.timestamp;
    });

    this.process();
  }

  /**
   * Calculate priority based on visibility and size
   */
  private calculatePriority(img: HTMLImageElement): number {
    const rect = img.getBoundingClientRect();
    const viewport = {
      top: 0,
      bottom: window.innerHeight,
      left: 0,
      right: window.innerWidth,
    };

    // Check if image is visible in viewport
    const isVisible =
      rect.bottom > viewport.top &&
      rect.top < viewport.bottom &&
      rect.right > viewport.left &&
      rect.left < viewport.right;

    // Calculate how much of the image is visible
    const visibleHeight = Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top);
    const visibleWidth = Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left);
    const visibleArea = Math.max(0, visibleHeight) * Math.max(0, visibleWidth);

    // Image dimensions
    const imageArea = (img.naturalWidth || img.width) * (img.naturalHeight || img.height);
    const isLarge = imageArea > 50000; // > 50k pixels

    // Distance from viewport center
    const centerY = rect.top + rect.height / 2;
    const viewportCenterY = viewport.bottom / 2;
    const distanceFromCenter = Math.abs(centerY - viewportCenterY);

    let priority = 0;

    // Highest priority for visible images
    if (isVisible) {
      priority += 10000;
      // Bonus for fully visible images
      priority += visibleArea;
    }

    // Above the fold (near top) gets higher priority
    if (rect.top < viewport.bottom && rect.top >= 0) {
      priority += 5000 - rect.top;
    }

    // Large images get priority (likely main content)
    if (isLarge) {
      priority += 1000;
    }

    // Images just below viewport (likely next to scroll into view)
    if (rect.top >= viewport.bottom && rect.top < viewport.bottom + 500) {
      priority += 500 - (rect.top - viewport.bottom);
    }

    // Penalize images far from viewport center
    priority -= distanceFromCenter * 0.1;

    // Profile pictures (small square images) get slight boost
    const aspectRatio = img.width / img.height;
    if (aspectRatio > 0.9 && aspectRatio < 1.1 && imageArea < 20000) {
      priority += 200;
    }

    return Math.max(0, priority);
  }

  /**
   * Process queue with concurrency limit
   */
  private async process(): Promise<void> {
    while (this.processing < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      const imgKey = this.getImageKey(item.img);

      // Skip if already processed
      if (this.processedImages.has(imgKey)) {
        continue;
      }

      this.processing++;
      this.processedImages.add(imgKey);

      // Process image
      this.processCallback(item.img)
        .catch(error => {
          console.error('Error processing image:', error);
          // Remove from processed set so it can be retried
          this.processedImages.delete(imgKey);
        })
        .finally(() => {
          this.processing--;
          // Continue processing queue
          this.process();
        });
    }
  }

  /**
   * Generate unique key for image
   */
  private getImageKey(img: HTMLImageElement): string {
    return img.src || img.dataset.src || `img_${img.offsetTop}_${img.offsetLeft}`;
  }

  /**
   * Update priorities when viewport changes (scroll/resize)
   */
  updatePriorities(): void {
    // Recalculate priorities for queued images
    this.queue.forEach(item => {
      item.priority = this.calculatePriority(item.img);
    });

    // Re-sort queue
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queued: number;
    processing: number;
    processed: number;
    totalCapacity: number;
  } {
    return {
      queued: this.queue.length,
      processing: this.processing,
      processed: this.processedImages.size,
      totalCapacity: this.maxConcurrent,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.processing = 0;
    this.processedImages.clear();
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.maxConcurrent = 0;
  }

  /**
   * Resume processing
   */
  resume(maxConcurrent = 8): void {
    this.maxConcurrent = maxConcurrent;
    this.process();
  }
}
