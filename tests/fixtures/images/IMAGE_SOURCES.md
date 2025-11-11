# Test Image Sources - Public Domain

This document provides specific sources and URLs for acquiring public domain test images.

## Quick Reference

### Best Sources Found
1. **Wikimedia Commons** - Extensive Einstein collection
2. **PICRYL** - 2,000+ Carl Sagan images, public domain
3. **Library of Congress** - 106 Einstein images, public domain
4. **NASA Images** - Carl Sagan from various programs

## Albert Einstein Images

### Wikimedia Commons Categories

**Main Portrait Collection:**
- URL: https://commons.wikimedia.org/wiki/Category:Portrait_photographs_of_Albert_Einstein
- Contains: Extensive portraits from different periods and angles
- License: Public domain / CC licenses (check individual images)
- Includes: Profile views, different ages, various settings

**General Category:**
- URL: https://commons.wikimedia.org/wiki/Albert_Einstein
- Contains: Broader collection including candids, lectures, group photos

### Library of Congress

**Digital Collection:**
- URL: https://loc.getarchive.net/topics/albert+einstein
- Contains: 106 Albert Einstein images
- License: Public domain, free for commercial use, no attribution required

**Specific Images:**
1. **Albert Einstein, 1879-1955**
   - URL: https://www.loc.gov/pictures/resource/cph.3b46036/
   - Digital ID: cph 3b46036
   - Reproduction Number: LC-USZ62-60242

2. **Dr. Albert Einstein (circa 1940)**
   - URL: https://www.loc.gov/item/2018697040/
   - Source: Harris & Ewing Collection
   - License: Public domain

### PICRYL

**Einstein Collection:**
- URL: https://picryl.com/topics/albert+einstein
- Contains: Various portrait images
- License: Free to use, no copyright restrictions

### Recommended Images by Category

#### Face Angles

**3/4 View Left:**
- Search Wikimedia for: "Einstein three quarter view" or "Einstein side angle"
- Look for images where Einstein is turned ~45° to the left

**3/4 View Right:**
- Similar search, opposite direction
- Many lecture/speaking photos show this angle

**Profile (90°):**
- Search: "Einstein profile" or "Einstein side view"
- Less common but available in candid shots

**Looking Up/Down:**
- Look in lecture photos where Einstein is at blackboard
- Group photos with people at different heights

#### Lighting Variations

**Backlit:**
- Look for outdoor photos with strong background light
- Window photos where Einstein is silhouetted

**Strong Shadows:**
- Dramatic studio portraits
- Outdoor photos with directional sun

**Low Light:**
- Evening photos
- Indoor photos without flash (pre-1940s often dimmer)

**Overexposed/Bright:**
- Outdoor sunny photos
- Flash photography from press events

#### Age Variations

**Young Einstein (1900s-1920s):**
- Search: "Einstein young" "Einstein 1905" "Einstein patent office"
- ETH Zurich archives: https://library.ethz.ch/en/locations-and-media/platforms/einstein-online/
- Ages: 20s-40s

**Middle Age Einstein (1930s-1940s):**
- Most common period in collections
- Princeton era
- Ages: 50s-60s

**Old Einstein (1950s):**
- Search: "Einstein 1950" "Einstein late"
- Final years at Princeton
- Ages: 70s

## Carl Sagan Images

### PICRYL Collection

**Main Source:**
- URL: https://picryl.com/topics/carl+sagan
- Contains: 2,079 Carl Sagan images
- License: Free to use, no copyright restrictions
- Note: Excellent variety of poses and settings

**Specific Images Mentioned:**
1. Carl Sagan standing next to Viking lander model in Death Valley, California
2. Carl Sagan at M.I.T. Kresge Auditorium
3. NASA Pioneer 10/11 mission photos (December 1973)

### NASA Image Library

**General Search:**
- URL: https://images.nasa.gov
- Search: "Carl Sagan"
- License: Public domain (U.S. government work)
- Contains: Sagan with spacecraft models, at NASA facilities

**Specific Collections:**
- Pioneer mission photos
- Voyager mission events
- Cosmos production stills (check licensing)

### Library of Congress

**Seth MacFarlane Collection:**
- Contains: Carl Sagan and Ann Druyan Archive
- Includes: Portraits and personal photos
- Note: Check individual image licenses

### Recommended Images by Category

#### Face Angles

**Various Angles:**
- PICRYL has 2,000+ images - excellent variety
- Look for:
  - Lecture photos (often 3/4 view)
  - Interview photos (various angles)
  - NASA facility photos (candid angles)

#### Age Variations

**Younger Sagan (1960s-1970s):**
- Early Cornell years
- Apollo program era
- Original Cosmos (1980)

**Older Sagan (1980s-1990s):**
- Late Cornell years
- Contact book tour
- Final public appearances

## Download Instructions

### From Wikimedia Commons

1. Navigate to image page
2. Click "More details" or image thumbnail
3. Look for "This file" section on right
4. Click download size (recommend "Original file")
5. Check license information
6. Save with descriptive filename

### From PICRYL

1. Click on desired image
2. Click "Download" button
3. Select size (recommend high-resolution)
4. Image is automatically downloaded
5. License info displayed on page

### From Library of Congress

1. Click on image
2. Look for "Download this image" section
3. Select TIFF or JPEG format
4. Choose size (recommend medium-large)
5. Click download link

### From NASA

1. Navigate to images.nasa.gov
2. Search for subject
3. Click on desired image
4. Click "Download" button
5. Select resolution
6. License: Public domain (U.S. government)

## Image Processing After Download

### Resize for Tests

```bash
# Using ImageMagick (if installed)
convert original.jpg -resize 800x800\> resized.jpg

# Maintain aspect ratio, max 800px on either dimension
# Don't upscale if smaller
```

### Create Variations

**For lighting tests (using ImageMagick):**

```bash
# Create backlit effect
convert original.jpg -fill black -colorize 40% -brightness-contrast -20x30 backlit.jpg

# Create low-light version
convert original.jpg -brightness-contrast -30x0 lowlight.jpg

# Create overexposed version
convert original.jpg -brightness-contrast +30x-10 bright.jpg

# Add strong shadows (gradient)
convert original.jpg \
  \( +clone -sparse-color barycentric "0,0 black 100%,0 white" \) \
  -compose multiply -composite shadows.jpg
```

**For angle tests:**

```bash
# Crop to create partial face
convert original.jpg -gravity North -crop 100%x75% partial_top.jpg
convert original.jpg -gravity East -crop 70%x100% partial_side.jpg
```

## Attribution Template

When adding images to the repository, document in README:

```markdown
### filename.jpg
- **Source:** [Full URL]
- **Original Title:** [Original filename/title]
- **Date/Era:** [Approximate year]
- **License:** Public Domain / CC0 / CC BY / CC BY-SA
- **Repository:** Wikimedia Commons / PICRYL / Library of Congress / NASA
- **Downloaded:** YYYY-MM-DD
- **Modifications:** [None / Resized / Lighting adjusted / Cropped]
```

## Legal Compliance

### Public Domain Criteria

An image is public domain if:
1. Copyright has expired (pre-1928 in US)
2. Created by US federal government (NASA)
3. Explicitly released to public domain (CC0)
4. No copyright claimed by creator

### Wikimedia Verification

1. Check "Licensing" section on image page
2. Look for: "Public domain" or "CC0"
3. Acceptable CC licenses: CC BY, CC BY-SA
4. Avoid: "Fair use", "All rights reserved"

### NASA Images

- All NASA images are public domain unless noted
- Some images include private individuals (check)
- Contractor images may have different licenses

## Batch Download Tips

### Using wget (Terminal)

```bash
# Download single image
wget -O einstein_portrait.jpg "https://example.com/image.jpg"

# Download multiple (create urls.txt first)
wget -i urls.txt
```

### Image Quality Recommendations

- **Minimum resolution:** 400x400 pixels
- **Preferred resolution:** 800x800 to 1200x1200
- **Format:** JPEG (PNG for images with transparency)
- **Quality:** 80-90% JPEG quality
- **Size limit:** < 500KB per image (for repository)

## Next Steps

1. **Visit the sources** listed above
2. **Search for specific conditions** using keywords
3. **Download images** following instructions
4. **Document sources** using attribution template
5. **Process if needed** (resize, adjust)
6. **Add to test fixtures** with proper documentation
7. **Remove test.skip** from corresponding tests

## Troubleshooting

**Can't find specific angle/lighting:**
- Try broader search terms
- Check multiple sources
- Consider creating variations from existing images

**Unsure about license:**
- When in doubt, don't use it
- Stick to clearly marked public domain
- Library of Congress is safest bet

**Need help with image processing:**
- GIMP (free) - graphical interface
- ImageMagick (command line) - batch processing
- Online tools - Photopea.com (free Photoshop alternative)

## Quick Start Recommendations

**Start with these for fastest results:**

1. **Einstein - General Use:**
   - Library of Congress: https://www.loc.gov/pictures/resource/cph.3b46036/
   - Clearly public domain, good quality

2. **Sagan - General Use:**
   - PICRYL: https://picryl.com/topics/carl+sagan
   - 2,000+ images, all public domain

3. **Variety/Options:**
   - Wikimedia Commons (both subjects)
   - Widest variety of angles and conditions
