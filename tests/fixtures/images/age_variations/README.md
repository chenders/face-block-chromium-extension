# Age Variations Test Fixtures

This directory contains test images of the same individuals at different ages to test temporal consistency of face recognition.

## Purpose

Face recognition systems must decide whether to match faces across large time spans. This tests:
- Recognition across decades
- Changes due to aging (wrinkles, hair loss, etc.)
- Consistency of facial structure over time

## Required Images

### Albert Einstein
- `einstein_young.jpg` - Einstein in his 20s-30s (early career)
- `einstein_old.jpg` - Einstein in his 70s (late life)

**Era Examples:**
- Young: Patent office era (~1905), early Princeton
- Old: Late Princeton era (~1950s)

### Carl Sagan
- `sagan_young.jpg` - Sagan in his 30s-40s (Cosmos era)
- `sagan_old.jpg` - Sagan in his 50s-60s (later years)

**Era Examples:**
- Young: Early Cosmos, Cornell beginnings
- Old: Later lecture circuits, final years

## Test Scenarios

### Same-Age Matching (Baseline)
**Setup:** Train with middle-aged Einstein → Test with middle-aged Einstein
**Expected:** ✓ Should match (current behavior)

### Young → Old Cross-Age Matching
**Setup:** Train with young Einstein → Test with old Einstein
**Expected:** ? May not match (large age gap)

### Old → Young Cross-Age Matching
**Setup:** Train with old Einstein → Test with young Einstein
**Expected:** ? May not match (large age gap)

### Mixed-Age Training
**Setup:** Train with both young and old Einstein → Test with any age
**Expected:** ✓ Should improve match rate

## Sourcing Images

### Albert Einstein

**Young Einstein (1905-1920s)**
- Patent office photos
- Early academic years
- Zurich/Prague era

**Old Einstein (1940s-1950s)**
- Princeton later years
- Well-known "tongue out" era
- Final photos

**Sources:**
- Library of Congress: https://www.loc.gov/pictures/
- Wikimedia Commons: Public domain historical photos
- ETH Zurich archives (Einstein's alma mater)

### Carl Sagan

**Young Sagan (1960s-1970s)**
- Early Cornell years
- Apollo program era
- Original Cosmos (1980) era

**Old Sagan (1980s-1990s)**
- Late Cornell years
- Contact book tour era
- Final appearances

**Sources:**
- NASA Image Library: https://images.nasa.gov
- Cornell University archives
- Cosmos production stills (check licensing)

## Image Selection Criteria

### Similarity to Training Data
Choose images that are similar in quality/angle to existing training images:
- Frontal or near-frontal views
- Well-lit, clear facial features
- Professional or formal photos preferred
- Similar image quality (resolution, focus)

### Clear Age Difference
- Minimum 20-year gap between young/old
- Visible aging signs:
  - Wrinkles, facial lines
  - Hair changes (gray, thinning)
  - Skin texture changes
  - Weight/face shape changes

### Documentation
For each image, document:
- Approximate year taken
- Age of subject at time
- Any notable life events/context

## Image Attribution Template

```markdown
### einstein_young.jpg
- **Source:** [URL]
- **Year:** ~1920
- **Subject Age:** ~41 years old
- **Context:** [Event or era, e.g., "Patent office years"]
- **License:** Public Domain
- **Date Added:** YYYY-MM-DD

### einstein_old.jpg
- **Source:** [URL]
- **Year:** ~1950
- **Subject Age:** ~71 years old
- **Context:** [Event or era, e.g., "Late Princeton years"]
- **License:** Public Domain
- **Date Added:** YYYY-MM-DD
```

## Test Implementation

### Test Structure
```javascript
describe('Age Variation Tests', () => {
  test('Same age recognition (baseline)', async () => {
    // Train with middle-aged Einstein
    // Test with middle-aged Einstein
    // Should match
  });

  test('Cross-age recognition (young → old)', async () => {
    // Train with young Einstein
    // Test with old Einstein
    // May not match - document behavior
  });

  test('Mixed-age training improves recognition', async () => {
    // Train with both young and old Einstein
    // Test with various ages
    // Should improve match rate
  });
});
```

### Expected Results

| Training Data | Test Image | Expected Match | Confidence |
|---------------|------------|----------------|------------|
| Middle-aged | Middle-aged | ✓ Yes | High |
| Young | Young | ✓ Yes | High |
| Old | Old | ✓ Yes | High |
| Young | Old | ? Uncertain | Low |
| Old | Young | ? Uncertain | Low |
| Mixed ages | Any age | ✓ Improved | Medium |

## Implications for Users

### Documentation to Create
After testing, document findings in README or wiki:

1. **Age Gap Tolerance**
   - What age difference can the system handle?
   - Does it work across 10 years? 20 years? 50 years?

2. **Best Practices**
   - Recommend users provide multiple reference photos across different ages
   - Suggest updating reference photos periodically

3. **Limitations**
   - Clearly state if system doesn't handle large age gaps
   - Explain this is a known limitation of face recognition

## Image Specifications

- **Format:** JPEG (.jpg)
- **Size:** < 500KB per image
- **Dimensions:** 400-1000px
- **Quality:** 80-90% JPEG quality
- **Era:** Clear time separation (20+ years)

## Testing

Once images are added, run age variation tests:

```bash
npx playwright test age-variations.spec.js
```

## Research Notes

Document any findings from testing:

```markdown
### Findings (Date: YYYY-MM-DD)

**Age Gap Tolerance:**
- 10-year gap: [Result]
- 20-year gap: [Result]
- 40+ year gap: [Result]

**Face-api.js Model Performance:**
- TinyFace: [Observations]
- SSD: [Observations]
- Hybrid: [Observations]

**Recommendations:**
- [Best practices for users]
- [When to update reference photos]
- [How many reference photos to provide]
```

## Future Enhancements

If age-based recognition is important:
- Consider age-invariant face recognition models
- Implement age estimation pre-processing
- Allow users to specify age range tolerance
- Create age-progressive training data augmentation
