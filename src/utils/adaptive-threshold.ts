/**
 * Adaptive threshold calculation for personalized face matching
 * Automatically adjusts similarity thresholds based on descriptor variance
 */

export interface PersonThresholdData {
  name: string;
  baseThreshold: number;
  adaptiveThreshold: number;
  descriptorVariance: number;
  descriptorCount: number;
  confidence: number;
  lastUpdated: number;
}

export interface AdaptiveThresholdConfig {
  baseThreshold?: number; // Default similarity threshold
  minThreshold?: number; // Minimum allowed threshold
  maxThreshold?: number; // Maximum allowed threshold
  varianceWeight?: number; // How much variance affects threshold
  sampleSizeWeight?: number; // How much sample size affects confidence
  learningRate?: number; // Rate of threshold adjustment
}

const defaultConfig: AdaptiveThresholdConfig = {
  baseThreshold: 0.6,
  minThreshold: 0.4,
  maxThreshold: 0.8,
  varianceWeight: 2.0,
  sampleSizeWeight: 0.1,
  learningRate: 0.1,
};

/**
 * Calculate variance between face descriptors
 */
export function calculateDescriptorVariance(descriptors: Float32Array[]): number {
  if (descriptors.length < 2) return 0;

  const dimension = descriptors[0].length;
  const mean = new Float32Array(dimension);

  // Calculate mean descriptor
  for (const descriptor of descriptors) {
    for (let i = 0; i < dimension; i++) {
      mean[i] += descriptor[i];
    }
  }

  for (let i = 0; i < dimension; i++) {
    mean[i] /= descriptors.length;
  }

  // Calculate variance
  let totalVariance = 0;
  for (const descriptor of descriptors) {
    let distance = 0;
    for (let i = 0; i < dimension; i++) {
      const diff = descriptor[i] - mean[i];
      distance += diff * diff;
    }
    totalVariance += Math.sqrt(distance);
  }

  return totalVariance / descriptors.length;
}

/**
 * Calculate optimal threshold for a person based on their descriptor variance
 */
export function calculateAdaptiveThreshold(
  descriptors: Float32Array[],
  config: AdaptiveThresholdConfig = defaultConfig
): number {
  const {
    baseThreshold = 0.6,
    minThreshold = 0.4,
    maxThreshold = 0.8,
    varianceWeight = 2.0,
  } = config;

  if (descriptors.length < 2) {
    // Not enough data, use base threshold
    return baseThreshold;
  }

  const variance = calculateDescriptorVariance(descriptors);

  // Higher variance means we need a more lenient threshold
  // Lower variance means we can be more strict
  // Typical variance ranges from 0.2 to 0.8
  const normalizedVariance = Math.min(1, variance / 0.8);

  // Adjust threshold based on variance
  // High variance -> increase threshold (more lenient)
  // Low variance -> decrease threshold (more strict)
  const adjustment = (normalizedVariance - 0.5) * varianceWeight * 0.1;
  const adaptiveThreshold = baseThreshold + adjustment;

  // Clamp to min/max bounds
  return Math.max(minThreshold, Math.min(maxThreshold, adaptiveThreshold));
}

/**
 * Calculate confidence score for the adaptive threshold
 */
export function calculateThresholdConfidence(
  descriptorCount: number,
  variance: number,
  config: AdaptiveThresholdConfig = defaultConfig
): number {
  const { sampleSizeWeight = 0.1 } = config;

  // More samples -> higher confidence
  const sampleConfidence = Math.min(1, descriptorCount * sampleSizeWeight);

  // Lower variance -> higher confidence (more consistent data)
  const varianceConfidence = Math.max(0, 1 - variance / 0.8);

  // Combine both factors
  return sampleConfidence * 0.4 + varianceConfidence * 0.6;
}

/**
 * Update threshold based on matching feedback
 */
export function updateThresholdWithFeedback(
  currentThreshold: number,
  isCorrect: boolean,
  matchDistance: number,
  config: AdaptiveThresholdConfig = defaultConfig
): number {
  const { learningRate = 0.1, minThreshold = 0.4, maxThreshold = 0.8 } = config;

  let adjustment = 0;

  if (isCorrect) {
    // Correct match - can potentially tighten threshold
    if (matchDistance < currentThreshold - 0.1) {
      // Match was very confident, can be slightly stricter
      adjustment = -learningRate * 0.01;
    }
  } else {
    // Incorrect match or miss
    if (matchDistance > currentThreshold && matchDistance < currentThreshold + 0.1) {
      // Near miss - slightly increase threshold
      adjustment = learningRate * 0.02;
    } else if (matchDistance < currentThreshold) {
      // False positive - need stricter threshold
      adjustment = -learningRate * 0.02;
    }
  }

  const newThreshold = currentThreshold + adjustment;
  return Math.max(minThreshold, Math.min(maxThreshold, newThreshold));
}

/**
 * Analyze all persons and calculate their adaptive thresholds
 */
export function calculateAllAdaptiveThresholds(
  referenceFaces: any[],
  config: AdaptiveThresholdConfig = defaultConfig
): Map<string, PersonThresholdData> {
  const thresholds = new Map<string, PersonThresholdData>();

  for (const person of referenceFaces) {
    const descriptors = person.descriptors || [];
    const name = person.name || person.label;

    if (!name || descriptors.length === 0) continue;

    const variance = calculateDescriptorVariance(descriptors);
    const adaptiveThreshold = calculateAdaptiveThreshold(descriptors, config);
    const confidence = calculateThresholdConfidence(descriptors.length, variance, config);

    thresholds.set(name, {
      name,
      baseThreshold: config.baseThreshold || 0.6,
      adaptiveThreshold,
      descriptorVariance: variance,
      descriptorCount: descriptors.length,
      confidence,
      lastUpdated: Date.now(),
    });
  }

  return thresholds;
}

/**
 * Get threshold for a specific person or fall back to base
 */
export function getPersonThreshold(
  personName: string,
  thresholds: Map<string, PersonThresholdData>,
  baseThreshold = 0.6
): number {
  const data = thresholds.get(personName);
  return data?.adaptiveThreshold || baseThreshold;
}

/**
 * Analyze threshold performance and suggest adjustments
 */
export interface ThresholdAnalysis {
  person: string;
  currentThreshold: number;
  suggestedThreshold: number;
  reason: string;
  metrics: {
    falsePositives: number;
    falseNegatives: number;
    accuracy: number;
  };
}

export function analyzeThresholdPerformance(
  matchHistory: Array<{
    person: string;
    distance: number;
    correct: boolean;
    timestamp: number;
  }>,
  currentThresholds: Map<string, PersonThresholdData>
): ThresholdAnalysis[] {
  const analysis: ThresholdAnalysis[] = [];
  const personMetrics = new Map<string, any>();

  // Group matches by person
  for (const match of matchHistory) {
    if (!personMetrics.has(match.person)) {
      personMetrics.set(match.person, {
        falsePositives: 0,
        falseNegatives: 0,
        correctMatches: 0,
        distances: [],
      });
    }

    const metrics = personMetrics.get(match.person);
    metrics.distances.push(match.distance);

    if (match.correct) {
      metrics.correctMatches++;
    } else if (match.distance < (currentThresholds.get(match.person)?.adaptiveThreshold || 0.6)) {
      metrics.falsePositives++;
    } else {
      metrics.falseNegatives++;
    }
  }

  // Analyze each person's metrics
  for (const [person, metrics] of personMetrics) {
    const total = metrics.correctMatches + metrics.falsePositives + metrics.falseNegatives;
    const accuracy = metrics.correctMatches / total;
    const currentThreshold = currentThresholds.get(person)?.adaptiveThreshold || 0.6;

    let suggestedThreshold = currentThreshold;
    let reason = 'Threshold is optimal';

    if (metrics.falsePositives > metrics.falseNegatives * 2) {
      // Too many false positives - need stricter threshold
      const avgFalsePositiveDistance =
        metrics.distances
          .filter((d: number) => d < currentThreshold)
          .reduce((a: number, b: number) => a + b, 0) / metrics.falsePositives || 0;
      suggestedThreshold = avgFalsePositiveDistance - 0.05;
      reason = 'Too many false positives - stricter threshold recommended';
    } else if (metrics.falseNegatives > metrics.falsePositives * 2) {
      // Too many false negatives - need more lenient threshold
      const avgFalseNegativeDistance =
        metrics.distances
          .filter((d: number) => d >= currentThreshold)
          .reduce((a: number, b: number) => a + b, 0) / metrics.falseNegatives || 0;
      suggestedThreshold = avgFalseNegativeDistance + 0.05;
      reason = 'Too many false negatives - more lenient threshold recommended';
    }

    analysis.push({
      person,
      currentThreshold,
      suggestedThreshold: Math.max(0.4, Math.min(0.8, suggestedThreshold)),
      reason,
      metrics: {
        falsePositives: metrics.falsePositives,
        falseNegatives: metrics.falseNegatives,
        accuracy,
      },
    });
  }

  return analysis;
}

/**
 * Export threshold data for persistence
 */
export function exportThresholds(thresholds: Map<string, PersonThresholdData>): string {
  const data = Array.from(thresholds.values());
  return JSON.stringify(data, null, 2);
}

/**
 * Import threshold data from storage
 */
export function importThresholds(jsonData: string): Map<string, PersonThresholdData> {
  const data = JSON.parse(jsonData);
  const thresholds = new Map<string, PersonThresholdData>();

  for (const item of data) {
    thresholds.set(item.name, item);
  }

  return thresholds;
}
