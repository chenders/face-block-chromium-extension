# Chrome Web Store Screenshot Guide

This guide helps you create professional screenshots and promotional images for the Chrome Web Store listing.

## Required Screenshots

Chrome Web Store requires at least **1 screenshot** (up to 5 screenshots).

### Recommended Dimensions
- **1280 x 800 pixels** (16:10 aspect ratio) - Preferred
- **640 x 400 pixels** (16:10 aspect ratio) - Minimum

## Quick Start

### Automated Screenshot Capture

Run the automated screenshot tool:

```bash
make screenshots
```

This will capture 5 base screenshots:
1. **Popup main view** - Extension interface
2. **Add person interface** - Photo upload UI
3. **Detector modes** - Settings options
4. **Match threshold** - Configuration
5. **Example page** - Real-world usage

### Manual Capture

For custom screenshots:

1. Load extension in Chrome
2. Set window size to 1280x800
3. Take screenshot (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
4. Crop to exactly 1280x800

## Recommended Screenshots for Store Listing

### Screenshot 1: Hero Shot - Main Interface ⭐
**What to show:**
- Extension popup open
- Clean, professional interface
- "Add Person" section visible
- Match threshold slider
- Detector mode options

**Annotation ideas:**
- Arrow pointing to "Add Person" button
- Label: "Simple Privacy Protection"
- Highlight: "100% Local Processing"

### Screenshot 2: Adding a Person 📸
**What to show:**
- Name field filled in
- Photo upload button highlighted
- Example: "Enter name and upload photos"

**Annotation ideas:**
- Step numbers: "1. Enter name"
- Step numbers: "2. Upload 3-5 photos"
- Note: "All processing happens locally"

### Screenshot 3: Before/After Comparison 🔒
**What to show:**
- Split screen or side-by-side
- Left: Normal webpage with person's image
- Right: Same page with image blocked (gray placeholder)

**Annotation ideas:**
- "Before" and "After" labels
- Arrow showing the blocking action
- Text: "Seamlessly blocks matched faces"

### Screenshot 4: Settings & Configuration ⚙️
**What to show:**
- Match threshold slider
- Detector mode selection (Fast/Thorough/Hybrid)
- Export/Import buttons
- People list

**Annotation ideas:**
- Highlight "Hybrid Mode (Recommended)"
- Show threshold at 0.6 (default)
- Note: "Fine-tune detection accuracy"

### Screenshot 5: Real-World Example 🌐
**What to show:**
- Wikipedia or news site
- Multiple images on page
- Some blocked, some visible
- Extension icon in toolbar

**Annotation ideas:**
- Circle blocked images
- Arrow to extension icon
- Text: "Works on any website"

## Creating Promotional Images (Optional)

### Small Promo Tile (440 x 280)
- Simple logo/icon
- Extension name
- Tagline: "Privacy-Focused Face Blocking"

### Large Promo Tile (920 x 680)
- More detailed visual
- Key features list
- Screenshots montage

### Marquee Promo Tile (1400 x 560)
- Full feature showcase
- Multiple screenshots
- "100% Private • Local Processing • No Cloud"

## Tools for Creating/Editing Screenshots

### Free Options:
- **Figma** (Web) - Professional design tool
- **Canva** (Web) - Easy templates
- **GIMP** (Desktop) - Free Photoshop alternative
- **Preview** (Mac) - Basic annotations
- **Paint.NET** (Windows) - Simple editing

### Paid Options:
- **Adobe Photoshop** - Professional editing
- **Sketch** (Mac) - UI/UX design
- **Affinity Photo** - One-time purchase

## Screenshot Best Practices

### ✅ Do:
- Use high-quality, crisp images
- Show actual extension functionality
- Use consistent styling across screenshots
- Add helpful annotations/arrows
- Highlight privacy features
- Show before/after comparisons
- Use real-world examples

### ❌ Don't:
- Include personal information
- Use copyrighted images
- Show broken/error states
- Make false claims
- Use low-resolution images
- Include competitor names/logos
- Show placeholder/lorem ipsum text

## Adding Annotations

### Recommended Elements:
- **Arrows**: Point to key features
- **Text boxes**: Explain functionality
- **Numbers**: Show step-by-step process
- **Highlights**: Circle or underline important areas
- **Color coding**:
  - Green for positive actions
  - Blue for information
  - Orange/Yellow for settings
  - Gray for blocked content

### Font Recommendations:
- **San Francisco** (Mac/iOS native)
- **Segoe UI** (Windows native)
- **Roboto** (Clean, modern)
- **Inter** (Professional, readable)

### Color Palette:
Based on your extension's theme:
- Primary: #4A90E2 (Blue)
- Success: #7ED321 (Green)
- Warning: #F5A623 (Orange)
- Neutral: #9B9B9B (Gray)
- Background: #FFFFFF (White)

## File Naming Convention

```
01-popup-main.png          # Main interface
02-add-person.png          # Adding person workflow
03-before-after.png        # Blocking demonstration
04-settings.png            # Configuration options
05-real-world-example.png  # Live usage example
```

## Upload Checklist

Before uploading to Chrome Web Store:

- [ ] At least 1 screenshot (up to 5)
- [ ] Correct dimensions (1280x800 or 640x400)
- [ ] PNG or JPEG format
- [ ] File size under 5MB each
- [ ] No personal/sensitive information
- [ ] Professional appearance
- [ ] Shows actual extension functionality
- [ ] Annotations are clear and helpful

## Example Workflow

1. **Capture** - Run `make screenshots`
2. **Review** - Check `store-assets/screenshots/` directory
3. **Edit** - Add annotations in Figma/Canva
4. **Export** - Save as PNG at 1280x800
5. **Verify** - Check file size and dimensions
6. **Upload** - Add to Chrome Web Store Developer Dashboard

## Tips for Great Screenshots

1. **Tell a story**: Show the user journey from installation to blocking
2. **Focus on benefits**: Highlight privacy and ease of use
3. **Use real data**: Actual extension in action, not mockups
4. **Keep it simple**: Don't overcrowd with too many annotations
5. **Be consistent**: Use same font, colors, and style across all screenshots
6. **Test different sizes**: Ensure readability at smaller sizes
7. **Get feedback**: Ask others if screenshots are clear and appealing

## Resources

- [Chrome Web Store Image Guidelines](https://developer.chrome.com/docs/webstore/images/)
- [Figma](https://figma.com) - Free design tool
- [Canva](https://canva.com) - Easy graphic design
- [Unsplash](https://unsplash.com) - Free stock photos (for backgrounds)

---

**Need help?** Run `make screenshots` to auto-generate base screenshots, then edit them using your preferred tool!
