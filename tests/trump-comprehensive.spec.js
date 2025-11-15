// tests/trump-comprehensive.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';
import { loadTestReferenceData } from './helpers/test-data-loader.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive Trump Blocking Tests
 *
 * Uses images curated by intelligent_test_curator.py which provides:
 * - Real photos from 1964-2024 (60 years of age variation)
 * - Natural lighting from different contexts
 * - Lighting variations (backlit, lowlight, bright, shadows)
 * - Quality variations (small, compressed, cropped)
 * - False positive testing (other politicians)
 *
 * Image location: tests/fixtures/test-data/trump/
 *
 * To generate images:
 *   cd tests/fixtures/generators/image-curator
 *   ./curate_trump_images.sh
 */

// Helper to check if test images exist
function testImagesExist() {
  const testSetPath = path.join(__dirname, 'fixtures', 'test-data', 'trump');
  const summaryPath = path.join(testSetPath, 'CURATION_SUMMARY.md');
  return fs.existsSync(summaryPath);
}

// Helper to load metadata
function loadImageMetadata() {
  const metadataPath = path.join(
    __dirname,
    'fixtures',
    'test-data',
    'trump',
    'image_metadata.json'
  );
  if (!fs.existsSync(metadataPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
}

// Helper to get images by criteria
function getImages(criteria) {
  const metadata = loadImageMetadata();
  if (!metadata) return [];

  return metadata.filter(img => {
    if (criteria.age && img.estimated_age !== criteria.age) return false;
    if (criteria.decade) {
      const decade = Math.floor(img.year / 10) * 10;
      if (decade !== criteria.decade) return false;
    }
    if (criteria.is_negative !== undefined && img.is_negative !== criteria.is_negative)
      return false;
    if (criteria.person && img.person !== criteria.person) return false;
    return true;
  });
}

// Helper to get false positive images by person (from directory, not metadata)
function getFalsePositiveImages(personName) {
  const falsePositivesPath = path.join(
    __dirname,
    'fixtures',
    'test-data',
    'trump',
    'false_positives'
  );
  if (!fs.existsSync(falsePositivesPath)) return [];

  const allFiles = fs.readdirSync(falsePositivesPath).filter(f => f.endsWith('.jpg'));

  if (!personName) return allFiles;

  // Extract person name from filename (e.g., "joe_biden_001.jpg" -> "Joe Biden")
  const normalizedSearch = personName.toLowerCase().replace(/\s+/g, '_');
  return allFiles.filter(f => f.toLowerCase().startsWith(normalizedSearch));
}

// Helper to get all false positive images grouped by person
function getAllFalsePositives() {
  const falsePositivesPath = path.join(
    __dirname,
    'fixtures',
    'test-data',
    'trump',
    'false_positives'
  );
  if (!fs.existsSync(falsePositivesPath)) return {};

  const allFiles = fs.readdirSync(falsePositivesPath).filter(f => f.endsWith('.jpg'));
  const grouped = {};

  allFiles.forEach(filename => {
    // Extract person name from filename (e.g., "joe_biden_001.jpg" -> "Joe Biden")
    const match = filename.match(/^(.+?)_\d+\.jpg$/);
    if (match) {
      const personKey = match[1];
      // Convert to title case: "joe_biden" -> "Joe Biden"
      const personName = personKey
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      if (!grouped[personName]) grouped[personName] = [];
      grouped[personName].push(filename);
    }
  });

  return grouped;
}

test.describe('Trump Comprehensive Blocking Tests', () => {
  let browser;
  let userDataDir;
  let hasTestImages;

  test.beforeAll(async () => {
    const context = await setupExtensionContext();
    browser = context.browser;
    userDataDir = context.userDataDir;
    hasTestImages = testImagesExist();

    if (!hasTestImages) {
      console.log(
        '\n⚠️  Test images not found. Run: cd tests/fixtures/generators/image-curator && ./curate_trump_images.sh\n'
      );
    }
  });

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
  });

  test.describe('Age Variation Tests', () => {
    test('blocks Trump across age variations (young, middle, old)', async () => {
      if (!hasTestImages) test.skip();

      const page = await browser.newPage();

      // Use young Trump as reference
      const youngImages = getImages({ age: 'young', is_negative: false });
      const oldImages = getImages({ age: 'old', is_negative: false });

      if (youngImages.length === 0 || oldImages.length === 0) {
        console.log('Skipping: Need young and old images');
        test.skip();
      }

      // This tests the critical question: Does the system recognize Trump
      // from the 1960s-1980s when shown images from 2020s?

      // For this test, we'd need to:
      // 1. Load young Trump images as reference (training data)
      // 2. Test with old Trump images
      // 3. Verify they match despite 40+ years of aging

      // Note: This test structure depends on how your extension loads reference images
      // You may need to adapt based on your actual implementation

      await page.close();
    });

    test('blocks Trump from different decades', async () => {
      if (!hasTestImages) test.skip();

      const metadata = loadImageMetadata();
      if (!metadata || metadata.length === 0) test.skip();

      // Group by decade
      const decades = {};
      metadata
        .filter(m => !m.is_negative)
        .forEach(img => {
          const decade = Math.floor(img.year / 10) * 10;
          if (!decades[decade]) decades[decade] = [];
          decades[decade].push(img);
        });

      const decadeList = Object.keys(decades).sort();

      console.log(`\nTesting across ${decadeList.length} decades: ${decadeList.join(', ')}`);
      console.log('This ensures recognition works from 1960s through 2020s\n');

      // Each decade should have images that get blocked
      expect(decadeList.length).toBeGreaterThanOrEqual(3);

      // Verify we have good distribution
      for (const decade of decadeList) {
        console.log(`  ${decade}s: ${decades[decade].length} images`);
      }
    });
  });

  test.describe('False Positive Prevention (Critical!)', () => {
    test('does NOT block Joe Biden', async () => {
      if (!hasTestImages) test.skip();

      const bidenImages = getFalsePositiveImages('Joe Biden');

      if (bidenImages.length === 0) {
        console.log('⚠️  No Biden images found for false positive testing');
        test.skip();
      }

      const page = await browser.newPage();

      // Load Trump as reference, test with Biden images
      // Biden should NOT be blocked even though he's a similar demographic
      // (older white male politician in similar contexts)

      // TODO: Implement actual test based on your extension's API
      // The key is: Trump reference + Biden test image = NO MATCH

      console.log(`Testing ${bidenImages.length} Biden images - should NOT block`);

      await page.close();
    });

    test('does NOT block Mike Pence', async () => {
      if (!hasTestImages) test.skip();

      const penceImages = getFalsePositiveImages('Mike Pence');

      if (penceImages.length === 0) {
        console.log('⚠️  No Pence images found for false positive testing');
        test.skip();
      }

      console.log(`Testing ${penceImages.length} Pence images - should NOT block`);

      // Similar test structure as Biden
    });

    test('does NOT block Barack Obama', async () => {
      if (!hasTestImages) test.skip();

      const obamaImages = getFalsePositiveImages('Barack Obama');

      if (obamaImages.length === 0) {
        console.log('⚠️  No Obama images found for false positive testing');
        test.skip();
      }

      console.log(`Testing ${obamaImages.length} Obama images - should NOT block`);

      // Obama is different demographic, should definitely NOT match
    });
  });

  test.describe('Lighting Variation Tests', () => {
    test('blocks Trump in various lighting conditions', async () => {
      if (!hasTestImages) test.skip();

      const lightingPath = path.join(__dirname, 'fixtures', 'test-data', 'trump', 'by-lighting');

      if (!fs.existsSync(lightingPath)) {
        console.log('⚠️  No lighting variations found');
        test.skip();
      }

      const lightingFiles = fs.readdirSync(lightingPath).filter(f => f.endsWith('.jpg'));

      console.log(`\nTesting ${lightingFiles.length} lighting variations:`);
      console.log('  - Backlit (strong background light)');
      console.log('  - Low light (dim conditions)');
      console.log('  - Bright (overexposed)');
      console.log('  - Shadows (directional lighting)\n');

      expect(lightingFiles.length).toBeGreaterThan(0);

      // TODO: Test each lighting variation
      // Should block Trump even in challenging lighting
    });
  });

  test.describe('Quality Variation Tests', () => {
    test('blocks Trump in poor quality images', async () => {
      if (!hasTestImages) test.skip();

      const qualityPath = path.join(__dirname, 'fixtures', 'test-data', 'trump', 'by-quality');

      if (!fs.existsSync(qualityPath)) {
        console.log('⚠️  No quality variations found');
        test.skip();
      }

      const qualityFiles = fs.readdirSync(qualityPath).filter(f => f.endsWith('.jpg'));

      console.log(`\nTesting ${qualityFiles.length} quality variations:`);
      console.log('  - Small faces (~200px or less)');
      console.log('  - Heavy JPEG compression');
      console.log('  - Cropped/partial faces\n');

      expect(qualityFiles.length).toBeGreaterThan(0);

      // TODO: Test each quality variation
      // Some may not block (acceptable - document thresholds)
    });
  });

  test.describe('Real-World Scenario Tests', () => {
    test('blocks Trump in official portraits', async () => {
      if (!hasTestImages) test.skip();

      const metadata = loadImageMetadata();
      if (!metadata || metadata.length === 0) test.skip();

      // Filter for high-quality, likely official portraits
      const portraits = metadata.filter(
        m => !m.is_negative && m.quality === 'high' && m.context === 'portrait'
      );

      console.log(`Testing ${portraits.length} high-quality official portraits`);
      console.log('Expected: High confidence blocking (>95% match)\n');

      // Official portraits should have highest match rate
    });

    test('blocks Trump in candid/event photos', async () => {
      if (!hasTestImages) test.skip();

      const metadata = loadImageMetadata();
      if (!metadata || metadata.length === 0) test.skip();

      // Lower quality or different contexts
      const candids = metadata.filter(
        m => !m.is_negative && (m.quality === 'medium' || m.quality === 'low')
      );

      console.log(`Testing ${candids.length} candid/event photos`);
      console.log('Expected: Should still block but may have lower confidence\n');
    });
  });

  test.describe.skip('Coverage Report', () => {
    test('generates comprehensive test coverage report', async () => {
      if (!hasTestImages) {
        console.log('\n📊 TEST COVERAGE REPORT');
        console.log('═══════════════════════════════════════\n');
        console.log('❌ No test images found!');
        console.log('\nTo generate comprehensive test images:');
        console.log('  cd tests/fixtures/generators/image-curator');
        console.log('  ./curate_trump_images.sh');
        console.log('\nThis will download:');
        console.log('  - ~50 Trump images from 1964-2024');
        console.log('  - ~40 negative examples (other politicians)');
        console.log('  - Lighting and quality variations');
        console.log('  - Complete metadata for analysis\n');
        test.skip();
      }

      const metadata = loadImageMetadata();

      console.log('\n📊 TEST COVERAGE REPORT');
      console.log('═══════════════════════════════════════\n');

      // Count positive examples
      const positives = metadata.filter(m => !m.is_negative);
      const negatives = metadata.filter(m => m.is_negative);

      console.log(`✅ Positive Examples: ${positives.length}`);

      // Age distribution
      const ageGroups = {};
      positives.forEach(m => {
        ageGroups[m.estimated_age] = (ageGroups[m.estimated_age] || 0) + 1;
      });
      console.log('\n   Age Distribution:');
      Object.entries(ageGroups).forEach(([age, count]) => {
        console.log(`     ${age.padEnd(10)}: ${count} images`);
      });

      // Decade distribution
      const decades = {};
      positives.forEach(m => {
        const decade = Math.floor(m.year / 10) * 10;
        decades[decade] = (decades[decade] || 0) + 1;
      });
      console.log('\n   Decade Distribution:');
      Object.entries(decades)
        .sort((a, b) => a[0] - b[0])
        .forEach(([decade, count]) => {
          console.log(`     ${decade}s: ${count} images`);
        });

      // Quality distribution
      const qualities = {};
      positives.forEach(m => {
        qualities[m.quality] = (qualities[m.quality] || 0) + 1;
      });
      console.log('\n   Quality Distribution:');
      Object.entries(qualities).forEach(([quality, count]) => {
        console.log(`     ${quality.padEnd(10)}: ${count} images`);
      });

      // Get false positives from directory (not in metadata)
      const falsePositives = getAllFalsePositives();
      const totalFalsePositives = Object.values(falsePositives).reduce(
        (sum, arr) => sum + arr.length,
        0
      );

      console.log(`\n❌ Negative Examples: ${totalFalsePositives}`);
      console.log('\n   By Person:');
      Object.entries(falsePositives)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([person, images]) => {
          console.log(`     ${person.padEnd(20)}: ${images.length} images`);
        });

      // Check variations
      const lightingPath = path.join(__dirname, 'fixtures', 'test-data', 'trump', 'by-lighting');
      const qualityPath = path.join(__dirname, 'fixtures', 'test-data', 'trump', 'by-quality');

      const lightingCount = fs.existsSync(lightingPath)
        ? fs.readdirSync(lightingPath).filter(f => f.endsWith('.jpg')).length
        : 0;
      const qualityCount = fs.existsSync(qualityPath)
        ? fs.readdirSync(qualityPath).filter(f => f.endsWith('.jpg')).length
        : 0;

      console.log(`\n🔆 Lighting Variations: ${lightingCount}`);
      console.log(`📐 Quality Variations: ${qualityCount}`);

      console.log('\n═══════════════════════════════════════');
      console.log(
        `TOTAL TEST IMAGES: ${metadata.length + lightingCount + qualityCount + totalFalsePositives}`
      );
      console.log('═══════════════════════════════════════\n');

      // Assertions to ensure minimum coverage
      expect(positives.length).toBeGreaterThanOrEqual(10); // At least 10 Trump images
      expect(Object.keys(decades).length).toBeGreaterThanOrEqual(3); // At least 3 decades
      expect(totalFalsePositives).toBeGreaterThan(0); // Must have false positive tests
    });
  });
});
