# Test Fixtures Guide

This guide documents the test image requirements for comprehensive face detection testing under various conditions.

## Current Test Coverage

### Existing Fixtures (tests/fixtures/images/)
- **Albert Einstein**: 4 images (mostly frontal views)
- **Carl Sagan**: 3 images (mostly frontal views)
- **Marilyn Monroe**: 1 image (non-matching control)
- **Steven Pruitt**: 1 image (non-matching control)

### Current Limitations
- Primarily frontal face views
- Similar lighting conditions (well-lit, indoor/studio)
- Limited angle variation
- No edge cases (partial faces, multiple faces per image, occlusions)

## Required Test Fixtures

### 1. Face Angles

Face detection accuracy varies significantly with face angle. We need test images covering:

#### Frontal Views (0°) ✅
- **Current:** Well covered with existing Einstein/Sagan images
- **Status:** Complete

#### 3/4 Views (45° left/right)
- **Description:** Face turned approximately 45° to the side
- **Both sides needed:** Left 3/4 and right 3/4
- **Purpose:** Test detection when one side of face is less visible
- **Expected:** Should still detect with TinyFace or SSD
- **Files needed:**
  - `albert_einstein/einstein_threequarter_left.jpg`
  - `albert_einstein/einstein_threequarter_right.jpg`
  - `carl_sagan/sagan_threequarter_left.jpg`
  - `carl_sagan/sagan_threequarter_right.jpg`

#### Profile Views (90° left/right)
- **Description:** Face turned completely to the side
- **Purpose:** Test detection limits - profiles are challenging
- **Expected:** May not detect (acceptable limitation)
- **Files needed:**
  - `albert_einstein/einstein_profile_left.jpg`
  - `albert_einstein/einstein_profile_right.jpg`
  - `carl_sagan/sagan_profile_left.jpg`
  - `carl_sagan/sagan_profile_right.jpg`

#### Looking Up/Down
- **Description:** Face tilted up (looking at ceiling) or down (looking at floor)
- **Purpose:** Test pitch angle tolerance
- **Expected:** Should detect at moderate angles (±30°)
- **Files needed:**
  - `albert_einstein/einstein_looking_up.jpg`
  - `albert_einstein/einstein_looking_down.jpg`

### 2. Lighting Conditions

Lighting significantly affects face detection accuracy.

#### Well-Lit (Indoor/Studio) ✅
- **Current:** Well covered with existing images
- **Status:** Complete

#### Backlit/Silhouette
- **Description:** Strong light source behind person (face in shadow)
- **Purpose:** Test detection with low face contrast
- **Expected:** Challenging - may require SSD detector
- **Files needed:**
  - `lighting_variations/einstein_backlit.jpg`
  - `lighting_variations/sagan_backlit.jpg`

#### Strong Shadows (Directional Light)
- **Description:** One side of face well-lit, other in shadow
- **Purpose:** Test detection with partial face visibility
- **Expected:** Should detect if features are visible
- **Files needed:**
  - `lighting_variations/einstein_shadows.jpg`
  - `lighting_variations/sagan_shadows.jpg`

#### Low Light
- **Description:** Dim lighting, low overall brightness
- **Purpose:** Test detection in poor lighting
- **Expected:** Reduced accuracy, but should detect prominent features
- **Files needed:**
  - `lighting_variations/einstein_lowlight.jpg`
  - `lighting_variations/sagan_lowlight.jpg`

#### Overexposed/Bright
- **Description:** Very bright lighting, potential washout
- **Purpose:** Test detection when facial features are less defined
- **Expected:** Should handle moderate overexposure
- **Files needed:**
  - `lighting_variations/einstein_bright.jpg`
  - `lighting_variations/sagan_bright.jpg`

### 3. Edge Cases

#### Multiple Faces
- **Description:** Multiple people in same image
- **Purpose:** Verify extension can detect and block specific person among others
- **Expected:** Should only block targeted person
- **Files needed:**
  - `edge_cases/einstein_with_others.jpg` (Einstein + non-targets)
  - `edge_cases/group_photo.jpg` (Mix of blocked and non-blocked people)

#### Partial Faces
- **Description:** Face partially cropped or occluded
- **Purpose:** Test detection with incomplete face data
- **Expected:** May not detect (acceptable)
- **Files needed:**
  - `edge_cases/einstein_partial_top.jpg` (forehead cropped)
  - `edge_cases/einstein_partial_side.jpg` (side of face cropped)

#### Occluded Faces
- **Description:** Face partially covered (glasses, hands, objects)
- **Purpose:** Test detection with obstructions
- **Expected:** Should detect if key features visible
- **Files needed:**
  - `edge_cases/einstein_with_glasses.jpg`
  - `edge_cases/einstein_hand_on_face.jpg`

#### Small Faces
- **Description:** Face occupies small portion of image
- **Purpose:** Test minimum size threshold
- **Expected:** Extension already filters <50px images
- **Files needed:**
  - `edge_cases/einstein_distant.jpg` (face <100px)
  - `edge_cases/einstein_far.jpg` (face ~50px threshold)

#### Age Variations
- **Description:** Same person at different ages
- **Purpose:** Test temporal consistency of recognition
- **Expected:** May not match across large age gaps
- **Files needed:**
  - `age_variations/einstein_young.jpg`
  - `age_variations/einstein_old.jpg`

## Directory Structure

```
tests/fixtures/images/
├── albert_einstein/
│   ├── einstein1.jpg              # Existing: frontal view
│   ├── einstein2.jpg              # Existing: frontal view
│   ├── einstein3.jpg              # Existing: side angle
│   ├── einstein4.jpg              # Existing: frontal view
│   ├── einstein_threequarter_left.jpg    # NEW
│   ├── einstein_threequarter_right.jpg   # NEW
│   ├── einstein_profile_left.jpg         # NEW
│   ├── einstein_profile_right.jpg        # NEW
│   ├── einstein_looking_up.jpg           # NEW
│   ├── einstein_looking_down.jpg         # NEW
│   └── test_urls.md               # Existing
├── carl_sagan/
│   ├── carl_sagan1.jpg            # Existing
│   ├── carl_sagan2.jpg            # Existing
│   ├── carl_sagan3.jpg            # Existing
│   ├── sagan_threequarter_left.jpg       # NEW
│   ├── sagan_threequarter_right.jpg      # NEW
│   ├── sagan_profile_left.jpg            # NEW
│   ├── sagan_profile_right.jpg           # NEW
│   └── test_urls.md               # Existing
├── lighting_variations/           # NEW
│   ├── einstein_backlit.jpg
│   ├── einstein_shadows.jpg
│   ├── einstein_lowlight.jpg
│   ├── einstein_bright.jpg
│   ├── sagan_backlit.jpg
│   ├── sagan_shadows.jpg
│   ├── sagan_lowlight.jpg
│   ├── sagan_bright.jpg
│   └── README.md
├── edge_cases/                    # NEW
│   ├── einstein_with_others.jpg
│   ├── group_photo.jpg
│   ├── einstein_partial_top.jpg
│   ├── einstein_partial_side.jpg
│   ├── einstein_with_glasses.jpg
│   ├── einstein_hand_on_face.jpg
│   ├── einstein_distant.jpg
│   ├── einstein_far.jpg
│   └── README.md
├── age_variations/                # NEW
│   ├── einstein_young.jpg
│   ├── einstein_old.jpg
│   ├── sagan_young.jpg
│   ├── sagan_old.jpg
│   └── README.md
├── marilyn_monroe.jpg             # Existing
└── steven_pruitt.jpg              # Existing
```

## Sourcing Test Images

### Legal Requirements
All test images must be:
- Public domain, OR
- Creative Commons licensed (CC0, CC BY, CC BY-SA), OR
- Fair use for testing purposes

### Recommended Sources

#### 1. Wikimedia Commons
- URL: https://commons.wikimedia.org
- License: Mix of public domain and CC licenses
- Filter by license: Search → Advanced → License filter

#### 2. Library of Congress
- URL: https://www.loc.gov/pictures/
- License: Many public domain historical images
- Good for historical figures (Einstein, etc.)

#### 3. NASA Images
- URL: https://images.nasa.gov
- License: Public domain (U.S. government work)
- Good for Carl Sagan (astronomer)

#### 4. Creating Test Images
For edge cases that require specific conditions:
- Use image editing tools to modify existing public domain images
- Apply lighting adjustments, crops, rotations
- Document transformations in README files

### Attribution
Track image sources in markdown files:
- Original source URL
- License type
- Photographer/creator (if applicable)
- Any modifications made

## Test Implementation

### Test Spec Structure

Each test category should have a dedicated spec file:

```
tests/
├── face-angles.spec.js           # NEW: Test angle variations
├── lighting-conditions.spec.js   # NEW: Test lighting variations
├── edge-cases.spec.js            # NEW: Test edge cases
├── age-variations.spec.js        # NEW: Test temporal consistency
```

### Expected Results Matrix

| Condition | TinyFace | SSD | Hybrid | Notes |
|-----------|----------|-----|--------|-------|
| Frontal (0°) | ✓ | ✓ | ✓ | Current baseline |
| 3/4 View (45°) | ✓ | ✓ | ✓ | Should detect |
| Profile (90°) | ✗ | ? | ? | May not detect |
| Looking Up/Down | ✓ | ✓ | ✓ | Moderate angles |
| Backlit | ✗ | ✓ | ✓ | Challenging |
| Strong Shadows | ✓ | ✓ | ✓ | Depends on severity |
| Low Light | ? | ✓ | ✓ | Reduced accuracy |
| Overexposed | ✓ | ✓ | ✓ | Moderate tolerance |
| Multiple Faces | ✓ | ✓ | ✓ | Should isolate target |
| Partial Face | ✗ | ✗ | ✗ | Acceptable limitation |
| Occluded | ? | ? | ? | Depends on occlusion |
| Small Face | ✗ | ✗ | ✗ | Below threshold |

✓ = Expected to detect
✗ = Not expected to detect
? = Uncertain, needs testing

## Next Steps

1. **Create directory structure**
   ```bash
   mkdir -p tests/fixtures/images/{lighting_variations,edge_cases,age_variations}
   ```

2. **Source images**
   - Search Wikimedia Commons for Einstein at different angles
   - Search NASA archives for Sagan variations
   - Document sources in README files

3. **Create modified images**
   - Use photo editing to create lighting variations
   - Create cropped versions for edge cases
   - Document transformations

4. **Implement tests**
   - Write test specs for each category
   - Set appropriate expectations based on matrix
   - Document known limitations

5. **Update documentation**
   - Update main README with test coverage
   - Document any findings about detection limits
   - Add recommendations for users

## Performance Considerations

- Keep test images under 500KB each
- Total fixture size should remain under 10MB
- Consider using lower resolution for edge case images
- Profile all new tests to ensure reasonable execution time

## Maintenance

- Review test fixtures quarterly
- Update if face-api.js models improve
- Add new edge cases as discovered
- Keep licenses up to date
