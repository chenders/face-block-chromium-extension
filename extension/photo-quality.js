// photo-quality.js - Photo quality analysis for face recognition

/**
 * Analyzes a face detection result and returns comprehensive quality metrics
 * @param {Object} detection - face-api.js detection result with landmarks and descriptor
 * @param {HTMLImageElement} image - Original image element for size calculations
 * @returns {Object} Quality analysis including score, issues, and recommendations
 */
function analyzePhotoQuality(detection, image) {
  if (!detection) {
    return {
      valid: false,
      score: 0,
      issues: ['no-face-detected'],
      recommendations: ['No face detected. Ensure the person\'s face is clearly visible.'],
      category: 'invalid'
    };
  }

  const metrics = {
    confidence: detection.detection.score,
    faceSize: calculateFaceSize(detection.detection.box, image),
    angle: calculateFaceAngle(detection.landmarks),
    landmarkQuality: assessLandmarkQuality(detection.landmarks),
    imageQuality: assessImageQuality(detection.detection.box, image)
  };

  const score = calculateCompositeScore(metrics);
  const issues = identifyIssues(metrics);
  const recommendations = generateRecommendations(metrics, issues);
  const category = classifyPhotoType(metrics.angle);

  return {
    valid: true,
    score,
    metrics,
    issues,
    recommendations,
    category,
    descriptor: detection.descriptor,
    landmarks: detection.landmarks.positions,
    boundingBox: detection.detection.box
  };
}

/**
 * Calculate what percentage of the image the face occupies
 * Optimal range: 20-60% of image area
 */
function calculateFaceSize(box, image) {
  const faceArea = box.width * box.height;
  const imageArea = image.naturalWidth * image.naturalHeight;
  const percentage = (faceArea / imageArea) * 100;

  return {
    percentage,
    width: box.width,
    height: box.height,
    optimal: percentage >= 20 && percentage <= 60
  };
}

/**
 * Calculate face angle (yaw, pitch, roll) from facial landmarks
 * Yaw: left/right turn, Pitch: up/down tilt, Roll: head tilt
 */
function calculateFaceAngle(landmarks) {
  const positions = landmarks.positions;

  // Get key landmark positions
  const leftEye = getLandmarkCenter(positions, 36, 41); // Left eye
  const rightEye = getLandmarkCenter(positions, 42, 47); // Right eye
  const nose = positions[30]; // Nose tip
  const jawLeft = positions[0]; // Left jaw
  const jawRight = positions[16]; // Right jaw

  // Calculate yaw (left/right turn) based on eye distance ratio
  const leftEyeToNose = distance(leftEye, nose);
  const rightEyeToNose = distance(rightEye, nose);
  const eyeRatio = Math.min(leftEyeToNose, rightEyeToNose) / Math.max(leftEyeToNose, rightEyeToNose);
  const yaw = (1 - eyeRatio) * 90 * (leftEyeToNose > rightEyeToNose ? 1 : -1);

  // Calculate roll (head tilt) based on eye line angle
  const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
  const roll = eyeAngle;

  // Calculate pitch (up/down) based on nose position relative to eyes
  const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
  const faceHeight = distance(eyeCenter, positions[8]); // Eye to chin
  const noseToEyeRatio = (nose.y - eyeCenter.y) / faceHeight;
  const pitch = noseToEyeRatio * 60; // Rough pitch estimate

  return {
    yaw: Math.round(yaw),
    pitch: Math.round(pitch),
    roll: Math.round(roll),
    isFrontal: Math.abs(yaw) < 20 && Math.abs(pitch) < 15
  };
}

/**
 * Get center point of a landmark range
 */
function getLandmarkCenter(positions, startIdx, endIdx) {
  const points = positions.slice(startIdx, endIdx + 1);
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Assess landmark quality based on symmetry and spacing
 */
function assessLandmarkQuality(landmarks) {
  const positions = landmarks.positions;

  // Check for symmetry between left and right side
  const leftEyeWidth = getLandmarkSpread(positions, 36, 39);
  const rightEyeWidth = getLandmarkSpread(positions, 42, 45);
  const eyeSymmetry = Math.min(leftEyeWidth, rightEyeWidth) / Math.max(leftEyeWidth, rightEyeWidth);

  // Check landmark spread (facial features should be well-distributed)
  const faceWidth = distance(positions[0], positions[16]);
  const eyeDistance = distance(getLandmarkCenter(positions, 36, 41), getLandmarkCenter(positions, 42, 47));
  const featureSpread = eyeDistance / faceWidth;

  const symmetryScore = eyeSymmetry * 100;
  const spreadScore = featureSpread * 200; // Normalize to 0-100 range

  return {
    symmetry: Math.round(symmetryScore),
    spread: Math.round(Math.min(spreadScore, 100)),
    overall: Math.round((symmetryScore + Math.min(spreadScore, 100)) / 2)
  };
}

/**
 * Calculate spread of landmarks in a range
 */
function getLandmarkSpread(positions, startIdx, endIdx) {
  const points = positions.slice(startIdx, endIdx + 1);
  const xValues = points.map(p => p.x);
  return Math.max(...xValues) - Math.min(...xValues);
}

/**
 * Assess overall image quality
 */
function assessImageQuality(box, image) {
  // Check if face is well-positioned in the frame
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const imageCenterX = image.naturalWidth / 2;
  const imageCenterY = image.naturalHeight / 2;

  const offsetX = Math.abs(centerX - imageCenterX) / imageCenterX;
  const offsetY = Math.abs(centerY - imageCenterY) / imageCenterY;
  const centering = 100 * (1 - Math.max(offsetX, offsetY));

  // Check resolution quality
  const facePixels = box.width * box.height;
  const resolutionQuality = Math.min(facePixels / 10000, 1) * 100; // 100x100 face is optimal

  return {
    centering: Math.round(Math.max(centering, 0)),
    resolution: Math.round(resolutionQuality),
    overall: Math.round((Math.max(centering, 0) + resolutionQuality) / 2)
  };
}

/**
 * Calculate composite quality score (0-100)
 */
function calculateCompositeScore(metrics) {
  const weights = {
    confidence: 0.30,      // 30% - Face detection confidence
    faceSize: 0.20,        // 20% - Optimal face size
    frontal: 0.15,         // 15% - Frontal vs profile
    landmarks: 0.15,       // 15% - Landmark quality
    imageQuality: 0.20     // 20% - Resolution and centering
  };

  // Confidence score (0-100)
  const confidenceScore = metrics.confidence * 100;

  // Face size score (optimal is 20-60%)
  let faceSizeScore = 0;
  if (metrics.faceSize.percentage < 10) {
    faceSizeScore = metrics.faceSize.percentage * 5; // Very small
  } else if (metrics.faceSize.percentage < 20) {
    faceSizeScore = 50 + (metrics.faceSize.percentage - 10) * 3; // Small
  } else if (metrics.faceSize.percentage <= 60) {
    faceSizeScore = 100; // Optimal
  } else if (metrics.faceSize.percentage <= 80) {
    faceSizeScore = 100 - (metrics.faceSize.percentage - 60) * 2; // Large
  } else {
    faceSizeScore = Math.max(0, 60 - (metrics.faceSize.percentage - 80) * 3); // Very large
  }

  // Frontal score (prefer frontal, penalize extreme angles)
  const angleScore = metrics.angle.isFrontal ? 100 : Math.max(0, 100 - Math.abs(metrics.angle.yaw) * 2);

  // Landmark quality score
  const landmarkScore = metrics.landmarkQuality.overall;

  // Image quality score
  const imageScore = metrics.imageQuality.overall;

  // Weighted average
  const composite =
    confidenceScore * weights.confidence +
    faceSizeScore * weights.faceSize +
    angleScore * weights.frontal +
    landmarkScore * weights.landmarks +
    imageScore * weights.imageQuality;

  return Math.round(Math.max(0, Math.min(100, composite)));
}

/**
 * Identify specific issues with the photo
 */
function identifyIssues(metrics) {
  const issues = [];

  // Confidence issues
  if (metrics.confidence < 0.7) {
    issues.push('low-confidence');
  }

  // Size issues
  if (metrics.faceSize.percentage < 15) {
    issues.push('face-too-small');
  } else if (metrics.faceSize.percentage > 70) {
    issues.push('face-too-large');
  }

  // Angle issues
  if (Math.abs(metrics.angle.yaw) > 35) {
    issues.push('extreme-angle');
  } else if (Math.abs(metrics.angle.yaw) > 20) {
    issues.push('side-angle');
  }

  if (Math.abs(metrics.angle.pitch) > 20) {
    issues.push('head-tilt-vertical');
  }

  if (Math.abs(metrics.angle.roll) > 15) {
    issues.push('head-tilt-horizontal');
  }

  // Landmark issues
  if (metrics.landmarkQuality.symmetry < 80) {
    issues.push('asymmetric-features');
  }

  // Image quality issues
  if (metrics.imageQuality.resolution < 50) {
    issues.push('low-resolution');
  }

  if (metrics.imageQuality.centering < 50) {
    issues.push('off-center');
  }

  return issues;
}

/**
 * Generate actionable recommendations based on metrics and issues
 */
function generateRecommendations(metrics, issues) {
  const recommendations = [];

  if (issues.includes('face-too-small')) {
    recommendations.push('Crop closer to the face or use a photo where the face is larger');
  } else if (issues.includes('face-too-large')) {
    recommendations.push('Include more of the head/shoulders in the frame');
  }

  if (issues.includes('extreme-angle')) {
    recommendations.push('Try to use a more frontal photo for better matching');
  } else if (issues.includes('side-angle')) {
    recommendations.push('This side-angle photo is good for coverage variety');
  }

  if (issues.includes('head-tilt-vertical')) {
    recommendations.push('Face is tilted up/down - a straight-on photo works better');
  }

  if (issues.includes('head-tilt-horizontal')) {
    recommendations.push('Head is tilted - straighten for better detection');
  }

  if (issues.includes('low-confidence')) {
    recommendations.push('Detection confidence is low - ensure face is clearly visible');
  }

  if (issues.includes('low-resolution')) {
    recommendations.push('Use a higher resolution photo');
  }

  if (issues.includes('off-center')) {
    recommendations.push('Center the face in the frame');
  }

  if (issues.includes('asymmetric-features')) {
    recommendations.push('Possible occlusion or poor lighting - check for sunglasses, hands, or shadows');
  }

  // If no issues, give positive feedback
  if (issues.length === 0) {
    if (metrics.angle.isFrontal) {
      recommendations.push('Excellent frontal photo! This will help block most images.');
    } else {
      recommendations.push('Good quality photo with unique angle - adds variety to coverage.');
    }
  }

  return recommendations;
}

/**
 * Classify photo type based on angle
 */
function classifyPhotoType(angle) {
  if (angle.isFrontal) {
    return 'frontal';
  } else if (Math.abs(angle.yaw) > 35) {
    return angle.yaw > 0 ? 'right-profile' : 'left-profile';
  } else {
    return angle.yaw > 0 ? 'right-angle' : 'left-angle';
  }
}

/**
 * Analyze coverage of a set of photos
 * Returns assessment of diversity and recommendations
 */
function analyzeCoverage(photoAnalyses) {
  const valid = photoAnalyses.filter(p => p.valid);

  if (valid.length === 0) {
    return {
      score: 0,
      frontalCount: 0,
      angleCount: 0,
      profileCount: 0,
      averageQuality: 0,
      recommendations: ['No valid photos detected. Please select photos with clear visible faces.']
    };
  }

  // Count photo types
  const frontalCount = valid.filter(p => p.category === 'frontal').length;
  const angleCount = valid.filter(p => p.category.includes('angle')).length;
  const profileCount = valid.filter(p => p.category.includes('profile')).length;

  // Calculate average quality
  const averageQuality = Math.round(
    valid.reduce((sum, p) => sum + p.score, 0) / valid.length
  );

  // Calculate coverage score
  let coverageScore = 0;
  coverageScore += Math.min(frontalCount * 30, 60); // Up to 60 points for frontals
  coverageScore += Math.min(angleCount * 20, 30);    // Up to 30 points for angles
  coverageScore += Math.min(profileCount * 10, 10);  // Up to 10 points for profiles

  // Generate recommendations
  const recommendations = [];

  if (frontalCount === 0) {
    recommendations.push('⚠️ Add at least 2-3 frontal photos for best results');
  } else if (frontalCount < 2) {
    recommendations.push('Add 1-2 more frontal photos for better coverage');
  } else {
    recommendations.push(`✓ Good frontal coverage (${frontalCount} photos)`);
  }

  if (angleCount === 0 && profileCount === 0) {
    recommendations.push('Consider adding 1-2 side-angle photos for variety');
  } else {
    recommendations.push(`✓ Good angle variety (${angleCount + profileCount} photos)`);
  }

  if (valid.length < 3) {
    recommendations.push('Upload 3-6 total photos for optimal blocking');
  } else if (valid.length > 8) {
    recommendations.push('You have many photos - you can remove some lower-quality ones');
  } else {
    recommendations.push(`✓ Good photo count (${valid.length} photos)`);
  }

  return {
    score: Math.round(coverageScore),
    frontalCount,
    angleCount,
    profileCount,
    averageQuality,
    recommendations,
    totalValid: valid.length
  };
}

/**
 * Estimate blocking effectiveness based on photo quality and coverage
 * Returns percentage estimate (0-100)
 */
function estimateEffectiveness(photoAnalyses) {
  const coverage = analyzeCoverage(photoAnalyses);

  if (coverage.totalValid === 0) {
    return 0;
  }

  // Base effectiveness on quality and coverage
  const qualityFactor = coverage.averageQuality / 100;
  const coverageFactor = coverage.score / 100;
  const countFactor = Math.min(coverage.totalValid / 5, 1); // Optimal is 5 photos

  // Weighted combination
  const effectiveness = (
    qualityFactor * 0.4 +
    coverageFactor * 0.4 +
    countFactor * 0.2
  ) * 100;

  return Math.round(effectiveness);
}
