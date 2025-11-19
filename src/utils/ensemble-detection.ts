/**
 * Multi-model ensemble detection for improved accuracy
 * Combines predictions from multiple face detection models
 */

export interface ModelDetection {
  model: string;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  descriptor?: Float32Array;
  landmarks?: any;
}

export interface EnsembleDetection {
  confidence: number;
  consensusScore: number;
  models: string[];
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  descriptor?: Float32Array;
  detections: ModelDetection[];
}

/**
 * Ensemble configuration
 */
export interface EnsembleConfig {
  minConsensus?: number; // Minimum number of models that must agree (default: 1)
  iouThreshold?: number; // IoU threshold for matching detections (default: 0.5)
  confidenceWeights?: Record<string, number>; // Model-specific confidence weights
  combineDescriptors?: boolean; // Whether to average descriptors (default: true)
}

const defaultConfig: EnsembleConfig = {
  minConsensus: 1,
  iouThreshold: 0.5,
  confidenceWeights: {
    TinyFaceDetector: 0.4,
    SsdMobilenetv1: 0.6,
  },
  combineDescriptors: true,
};

/**
 * Calculate Intersection over Union (IoU) for two bounding boxes
 */
function calculateIoU(box1: any, box2: any): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  if (x2 < x1 || y2 < y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return intersection / union;
}

/**
 * Combine multiple detections using ensemble voting
 */
export function combineDetections(
  detections: ModelDetection[],
  config: EnsembleConfig = defaultConfig
): EnsembleDetection[] {
  if (detections.length === 0) return [];

  const ensembles: EnsembleDetection[] = [];
  const used = new Set<number>();

  // Group detections by spatial proximity
  for (let i = 0; i < detections.length; i++) {
    if (used.has(i)) continue;

    const group: ModelDetection[] = [detections[i]];
    used.add(i);

    // Find all detections that overlap with this one
    for (let j = i + 1; j < detections.length; j++) {
      if (used.has(j)) continue;

      const iou = calculateIoU(detections[i].box, detections[j].box);
      if (iou >= (config.iouThreshold || 0.5)) {
        group.push(detections[j]);
        used.add(j);
      }
    }

    // Check if group meets minimum consensus
    if (group.length >= (config.minConsensus || 1)) {
      const ensemble = createEnsemble(group, config);
      ensembles.push(ensemble);
    }
  }

  // Sort by confidence
  return ensembles.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Create ensemble detection from grouped detections
 */
function createEnsemble(group: ModelDetection[], config: EnsembleConfig): EnsembleDetection {
  const weights = config.confidenceWeights || {};

  // Calculate weighted average box
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedWidth = 0;
  let weightedHeight = 0;
  let weightedConfidence = 0;

  for (const detection of group) {
    const weight = weights[detection.model] || 1.0;
    const confidence = detection.confidence * weight;

    weightedX += detection.box.x * confidence;
    weightedY += detection.box.y * confidence;
    weightedWidth += detection.box.width * confidence;
    weightedHeight += detection.box.height * confidence;
    weightedConfidence += confidence;
    totalWeight += confidence;
  }

  const avgBox = {
    x: weightedX / totalWeight,
    y: weightedY / totalWeight,
    width: weightedWidth / totalWeight,
    height: weightedHeight / totalWeight,
  };

  // Combine descriptors if available
  let combinedDescriptor: Float32Array | undefined;
  if (config.combineDescriptors) {
    const descriptors = group.filter(d => d.descriptor).map(d => d.descriptor!);

    if (descriptors.length > 0) {
      combinedDescriptor = averageDescriptors(descriptors);
    }
  }

  // Calculate consensus score (how many models agreed)
  const consensusScore = group.length / Object.keys(weights).length;

  return {
    confidence: weightedConfidence / totalWeight,
    consensusScore,
    models: group.map(d => d.model),
    box: avgBox,
    descriptor: combinedDescriptor,
    detections: group,
  };
}

/**
 * Average multiple face descriptors
 */
function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  if (descriptors.length === 0) return new Float32Array(0);
  if (descriptors.length === 1) return descriptors[0];

  const length = descriptors[0].length;
  const averaged = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const descriptor of descriptors) {
      sum += descriptor[i];
    }
    averaged[i] = sum / descriptors.length;
  }

  // Normalize the averaged descriptor
  let norm = 0;
  for (let i = 0; i < length; i++) {
    norm += averaged[i] * averaged[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < length; i++) {
      averaged[i] /= norm;
    }
  }

  return averaged;
}

/**
 * Voting-based ensemble detection
 * Uses majority voting to determine final detection
 */
export function majorityVoting(detections: ModelDetection[], threshold = 0.5): boolean {
  if (detections.length === 0) return false;

  const votes = detections.filter(d => d.confidence >= threshold).length;
  return votes > detections.length / 2;
}

/**
 * Weighted voting based on model reliability
 */
export function weightedVoting(
  detections: ModelDetection[],
  weights: Record<string, number>,
  threshold = 0.5
): boolean {
  if (detections.length === 0) return false;

  let totalWeight = 0;
  let weightedVotes = 0;

  for (const detection of detections) {
    const weight = weights[detection.model] || 1.0;
    totalWeight += weight;

    if (detection.confidence >= threshold) {
      weightedVotes += weight;
    }
  }

  return weightedVotes > totalWeight / 2;
}

/**
 * Calculate ensemble confidence using different strategies
 */
export function calculateEnsembleConfidence(
  detections: ModelDetection[],
  strategy: 'average' | 'weighted' | 'max' | 'min' = 'weighted',
  weights?: Record<string, number>
): number {
  if (detections.length === 0) return 0;

  switch (strategy) {
    case 'average':
      return detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

    case 'weighted':
      if (!weights) {
        return calculateEnsembleConfidence(detections, 'average');
      }
      let totalWeight = 0;
      let weightedSum = 0;
      for (const detection of detections) {
        const weight = weights[detection.model] || 1.0;
        totalWeight += weight;
        weightedSum += detection.confidence * weight;
      }
      return weightedSum / totalWeight;

    case 'max':
      return Math.max(...detections.map(d => d.confidence));

    case 'min':
      return Math.min(...detections.map(d => d.confidence));

    default:
      return 0;
  }
}

/**
 * Non-Maximum Suppression for ensemble detections
 */
export function nonMaximumSuppression(
  ensembles: EnsembleDetection[],
  iouThreshold = 0.5
): EnsembleDetection[] {
  if (ensembles.length <= 1) return ensembles;

  // Sort by confidence
  const sorted = [...ensembles].sort((a, b) => b.confidence - a.confidence);
  const kept: EnsembleDetection[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;

    kept.push(sorted[i]);

    // Suppress all overlapping detections
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;

      const iou = calculateIoU(sorted[i].box, sorted[j].box);
      if (iou >= iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

/**
 * Dynamic consensus adjustment based on detection difficulty
 */
export function adjustConsensusThreshold(
  imageMetrics: {
    brightness: number;
    contrast: number;
    blur: number;
  },
  baseThreshold = 1
): number {
  // Lower consensus requirement for difficult images
  let adjustment = 0;

  // Very dark or very bright images
  if (imageMetrics.brightness < 50 || imageMetrics.brightness > 200) {
    adjustment -= 0.5;
  }

  // Low contrast
  if (imageMetrics.contrast < 30) {
    adjustment -= 0.5;
  }

  // Blurry images
  if (imageMetrics.blur > 0.7) {
    adjustment -= 0.5;
  }

  return Math.max(1, baseThreshold + adjustment);
}
