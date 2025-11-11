# Lighting Variations Test Fixtures

This directory contains test images with various lighting conditions to verify face detection accuracy under challenging illumination scenarios.

## Required Images

### Backlit/Silhouette
- `einstein_backlit.jpg` - Strong backlight, face in shadow
- `sagan_backlit.jpg` - Strong backlight, face in shadow

**Purpose:** Test detection when face has low contrast vs background
**Expected:** Challenging for TinyFace, may require SSD detector
**Source:** Look for photos with window/sky backgrounds

### Strong Shadows (Directional Light)
- `einstein_shadows.jpg` - One side lit, one side in shadow
- `sagan_shadows.jpg` - One side lit, one side in shadow

**Purpose:** Test partial face visibility
**Expected:** Should detect if key features visible
**Source:** Outdoor photos, dramatic indoor lighting

### Low Light
- `einstein_lowlight.jpg` - Dim overall lighting
- `sagan_lowlight.jpg` - Dim overall lighting

**Purpose:** Test detection in poor lighting
**Expected:** Reduced accuracy but should still detect
**Source:** Evening/night photos, dimly lit interiors

### Overexposed/Bright
- `einstein_bright.jpg` - Very bright, potential washout
- `sagan_bright.jpg` - Very bright, potential washout

**Purpose:** Test when facial features are less defined
**Expected:** Should handle moderate overexposure
**Source:** Outdoor sunny photos, flash photography

## Sourcing Images

### Recommended Sources

1. **Wikimedia Commons**
   - Search: "Albert Einstein [lighting condition]"
   - Filter: Public domain or CC0
   - URL: https://commons.wikimedia.org

2. **Library of Congress**
   - Historical photos often have varied lighting
   - URL: https://www.loc.gov/pictures/

3. **NASA Archives** (for Carl Sagan)
   - URL: https://images.nasa.gov
   - Search: "Carl Sagan"

### Creating Variations

If ideal lighting conditions aren't available, you can modify existing public domain images:

1. **Backlit Effect:**
   - Increase background brightness
   - Decrease face exposure
   - Add glow/halo around subject

2. **Strong Shadows:**
   - Apply gradient mask (dark → light)
   - Increase contrast on one side

3. **Low Light:**
   - Reduce overall brightness
   - Add slight noise/grain
   - Desaturate colors slightly

4. **Overexposed:**
   - Increase brightness/exposure
   - Reduce contrast
   - Blow out some highlights

**Tools:** GIMP (free), Photoshop, or command-line tools like ImageMagick

## Image Attribution

Document each image source in this format:

```markdown
### einstein_backlit.jpg
- **Source:** [URL]
- **License:** Public Domain / CC0 / CC BY / CC BY-SA
- **Photographer:** [Name] (if applicable)
- **Modifications:** [List any edits made]
- **Date Added:** YYYY-MM-DD
```

## Test Expectations

| Image | TinyFace | SSD | Hybrid | Notes |
|-------|----------|-----|--------|-------|
| backlit | ✗ | ✓ | ✓ | Very challenging |
| shadows | ✓ | ✓ | ✓ | If features visible |
| lowlight | ? | ✓ | ✓ | Depends on severity |
| bright | ✓ | ✓ | ✓ | Moderate tolerance |

✓ = Expected to detect
✗ = Not expected to detect
? = Uncertain, needs testing

## Image Specifications

- **Format:** JPEG (.jpg)
- **Size:** < 500KB per image
- **Dimensions:** 400-1000px (width or height)
- **Quality:** 80-90% JPEG quality
- **Color:** RGB (not grayscale unless source is B&W)

## Testing

Once images are added, run lighting condition tests:

```bash
npx playwright test lighting-conditions.spec.js
```

(Test spec to be created in tests/ directory)
