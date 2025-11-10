# Privacy Policy for Face Block Chrome Extension

**Last Updated: November 10, 2025**

## Overview

Face Block is committed to protecting your privacy. This extension is designed with privacy as a core principle - all face recognition and processing happens entirely on your local device. We do not collect, transmit, store, or share any of your personal data.

## Data Collection and Usage

### What Data We DO NOT Collect

- **No remote data collection**: We do not collect any data about you, your browsing habits, or the images you view
- **No analytics**: We do not use any analytics services or tracking tools
- **No external API calls**: All face recognition happens locally using your browser's capabilities
- **No server communication**: This extension does not communicate with any external servers
- **No user account required**: No registration, sign-up, or account creation needed

### What Data Stays Local on Your Device

The following data is stored locally on your device only:

1. **Reference Face Data**
   - Photos you upload for face recognition
   - Face descriptors (mathematical representations) extracted from those photos
   - Stored in your browser's IndexedDB
   - Never transmitted outside your device

2. **Settings**
   - Match threshold preference
   - Detector mode selection
   - Extension enabled/disabled state
   - Stored using Chrome's sync storage (synced across your Chrome instances if you're signed into Chrome)

3. **Processing Data**
   - Temporary image data during face detection
   - Cleared after processing completes
   - Never leaves your device

## How Face Recognition Works

1. You upload reference photos through the extension's interface
2. Face descriptors are extracted and stored locally in IndexedDB
3. As you browse, images on web pages are analyzed using face-api.js library running locally
4. If a match is detected, the image is replaced with a placeholder
5. All processing happens in your browser using Canvas/WebGL APIs

## Permissions Explanation

The extension requests the following Chrome permissions:

- **storage**: To save your reference faces and settings locally on your device
- **declarativeNetRequest**: To handle CORS (Cross-Origin Resource Sharing) for loading images from different domains for analysis
- **declarativeNetRequestWithHostAccess**: To apply CORS rules across all websites you visit
- **offscreen**: To run face detection in a background context (service workers don't support Canvas/WebGL APIs needed for face detection)
- **host_permissions (<all_urls>)**: To analyze images on any website you visit

**Important**: These permissions are used solely for local face detection. No data is transmitted to external servers.

## Third-Party Services

Face Block does not use any third-party services, analytics platforms, or external APIs.

The extension uses the following open-source library:
- **face-api.js**: A JavaScript library for face detection and recognition that runs entirely in your browser

## Data Retention

- All data is stored locally on your device
- Data persists until you:
  - Manually delete reference faces through the extension interface
  - Use the "Clear All Data" button in settings
  - Uninstall the extension
  - Clear your browser data

## Data Sharing

We do not share any data because we do not collect any data. Your reference faces and settings never leave your device.

## Children's Privacy

This extension does not knowingly collect any data from children or adults. All processing is local and private.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document.

## Open Source

Face Block is open source. You can review the source code to verify these privacy claims at:
[GitHub Repository URL]

## Contact

If you have questions about this privacy policy or the extension's data practices, please open an issue on our GitHub repository:
[GitHub Issues URL]

## Your Rights

Since we don't collect any data, there is no data for us to:
- Access
- Modify
- Delete
- Export
- Transfer

All your data remains under your control on your local device.

## Consent

By using Face Block, you acknowledge that:
1. You understand this extension processes images locally on your device
2. You control what reference photos you add
3. You can remove all data at any time through the extension interface
4. No data is collected or transmitted by the extension

## Security

While we don't collect data, we still prioritize security:
- All processing happens in isolated browser contexts
- Reference data is stored using browser's secure IndexedDB
- No external network requests are made
- Extension follows Chrome's security best practices

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles (no data collection = no data protection concerns)
- California Consumer Privacy Act (CCPA) (no data collection = no consumer data concerns)

---

**Summary**: Face Block is a privacy-first extension. Everything happens on your device. We don't collect, transmit, or store any of your data on external servers. Period.
