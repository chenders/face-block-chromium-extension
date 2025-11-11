# Edge Cases Test Fixtures

This directory contains test images for edge cases and challenging scenarios that may occur in real-world usage.

## Required Images

### Multiple Faces in One Image
- `einstein_with_others.jpg` - Einstein with non-target people
- `group_photo.jpg` - Mix of blocked and non-blocked people

**Purpose:** Verify selective blocking - only target person blocked
**Expected:** Should detect and block only the target person(s)
**Test:** Ensure other faces remain visible

### Partial Faces (Cropped)
- `einstein_partial_top.jpg` - Top of head cropped out
- `einstein_partial_side.jpg` - Side of face cropped out

**Purpose:** Test minimum required face area for detection
**Expected:** May not detect (acceptable limitation)
**Notes:** Real-world scenario when face is at edge of image

### Occluded Faces
- `einstein_with_glasses.jpg` - Wearing glasses
- `einstein_hand_on_face.jpg` - Hand partially covering face

**Purpose:** Test detection with obstructions
**Expected:** Should detect if key features (eyes, nose) visible
**Notes:** Common scenario in candid photos

### Small/Distant Faces
- `einstein_distant.jpg` - Face <100px
- `einstein_far.jpg` - Face ~50px (near threshold)

**Purpose:** Test minimum face size detection
**Expected:** Extension filters <50px images; may not detect small faces
**Notes:** Verify threshold behavior

## Sourcing Images

### Multiple Faces
Search for:
- Einstein at conferences/meetings
- Group photos with Einstein
- Public events, press conferences

### Creating Partial/Cropped Images
1. Take existing public domain Einstein images
2. Crop to remove portions of face
3. Save variations: top cropped, side cropped, bottom cropped
4. Document original source

### Occluded Faces
Search for:
- Einstein with glasses (common in later photos)
- Candid photos with gestures
- Photos with pipes, hands near face

### Small Faces
1. Take high-resolution public domain images
2. Resize to create distant views
3. Maintain aspect ratio
4. Create versions at: 150px, 100px, 75px, 50px

## Image Attribution Template

```markdown
### filename.jpg
- **Original Source:** [URL to original image]
- **Original License:** [License type]
- **Modifications:**
  - [Specific edits made: crop, resize, composite, etc.]
  - Derived from [original filename/source]
- **Final License:** [Same as original or more restrictive]
- **Date Added:** YYYY-MM-DD
```

## Test Expectations

| Scenario | TinyFace | SSD | Hybrid | Notes |
|----------|----------|-----|--------|-------|
| Multiple faces | ✓ | ✓ | ✓ | Should isolate target |
| Partial (top) | ✗ | ✗ | ✗ | Missing key features |
| Partial (side) | ? | ? | ? | Depends on what's visible |
| With glasses | ✓ | ✓ | ✓ | Glasses usually OK |
| Hand on face | ? | ✓ | ✓ | Depends on coverage |
| Distant (100px) | ✓ | ✓ | ✓ | Above threshold |
| Far (50px) | ✗ | ✗ | ✗ | At/below threshold |

✓ = Expected to detect
✗ = Not expected to detect
? = Uncertain, needs testing

## Creating Multiple Face Images

If you can't find suitable public domain images with multiple people, you can composite images:

### Using GIMP
1. Open public domain image of Einstein
2. Open public domain image of another person
3. Copy/paste to create layers
4. Scale and position appropriately
5. Flatten and export

### Using ImageMagick
```bash
# Composite two images side by side
convert einstein.jpg other_person.jpg +append group_photo.jpg

# Resize one image and composite onto another
convert einstein.jpg -resize 300x other_person.jpg \
  -geometry +50+50 -composite einstein_with_others.jpg
```

### Attribution for Composites
When creating composite images, document **all** source images:

```markdown
### group_photo.jpg
- **Type:** Composite image
- **Source Images:**
  1. Albert Einstein
     - Source: [URL]
     - License: Public Domain
  2. [Other Person Name]
     - Source: [URL]
     - License: [License]
- **Composition Method:** Side-by-side merge
- **Tool:** GIMP / ImageMagick
- **Date Created:** YYYY-MM-DD
```

## Image Specifications

- **Format:** JPEG (.jpg)
- **Size:** < 500KB per image
- **Dimensions:**
  - Full images: 600-1200px
  - Small face images: Create from larger source, document final size
- **Quality:** 80-90% JPEG quality

## Testing

Once images are added, run edge case tests:

```bash
npx playwright test edge-cases.spec.js
```

## Known Limitations (Document After Testing)

After running tests with these fixtures, document any discovered limitations:

- Minimum face size for reliable detection
- Maximum occlusion before detection fails
- Behavior with multiple faces (does it block all or specific?)
- Any unexpected behaviors

This information is valuable for users to understand the extension's capabilities and limitations.
