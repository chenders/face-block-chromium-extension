#!/usr/bin/env python3
"""
Intelligent Test Image Curator (Category-Based)
================================================
Uses Wikimedia Commons categories to discover and download public domain images
for comprehensive face recognition testing.

This version uses category-based API queries which are more reliable than text search.

Usage:
    python intelligent_test_curator.py --target "Donald Trump"
"""

import os
import sys
import json
import hashlib
import requests
import time
from pathlib import Path
from datetime import datetime
from PIL import Image, ImageEnhance, ImageStat
import numpy as np
from typing import List, Dict, Optional, Tuple
import argparse
from dataclasses import dataclass, asdict
from collections import defaultdict
import re
import face_recognition
import imagehash
import cv2

# Keywords that indicate non-portrait images
NON_PORTRAIT_KEYWORDS = [
    'document', 'logo', 'signature', 'seal', 'emblem', 'coat of arms',
    'architectural', 'building', 'house', 'office', 'tower',
    'helmet', 'shoes', 'backpack', 'memo', 'letter', 'certificate',
    'icon', 'speaker', 'diagram', 'chart', 'graph',
    'accepting', 'receiving', 'award ceremony',  # Often group photos
    'with', 'and',  # Often indicates multiple people
]

@dataclass
class ImageMetadata:
    """Metadata for a curated image."""
    url: str
    filename: str
    person: str
    year: int
    estimated_age: str
    source: str
    license: str
    title: str
    context: str
    quality: str
    size: Tuple[int, int]
    is_negative: bool = False


# Category mappings for different people
PERSON_CATEGORIES = {
    "Donald Trump": {
        "main": "Portraits_of_Donald_Trump",
        "by_year": "Donald_Trump_by_year",
        "by_decade": "Donald_Trump_by_decade",
        "birth_year": 1946
    },
    "Joe Biden": {
        "main": "Joe_Biden",
        "by_year": "Joe_Biden_by_year",
        "birth_year": 1942
    },
    "Barack Obama": {
        "main": "Barack_Obama",
        "by_year": "Barack_Obama_by_year",
        "birth_year": 1961
    },
    "Mike Pence": {
        "main": "Mike_Pence",
        "birth_year": 1959
    },
    "Bill Clinton": {
        "main": "Bill_Clinton",
        "by_year": "Bill_Clinton_by_year",
        "birth_year": 1946
    },
    "George W Bush": {
        "main": "George_W._Bush",
        "birth_year": 1946
    },
}


class WikimediaSearcher:
    """Searches Wikimedia Commons using categories."""

    def __init__(self):
        self.api_url = "https://commons.wikimedia.org/w/api.php"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TestImageCurator/2.0 (Educational Face Recognition Testing)'
        })

    def get_category_members(self, category: str, member_type: str = 'file', limit: int = 100) -> List[Dict]:
        """Get members of a category."""
        print(f"  Fetching from Category:{category}...")

        params = {
            'action': 'query',
            'format': 'json',
            'generator': 'categorymembers',
            'gcmtitle': f'Category:{category}',
            'gcmtype': member_type,
            'gcmlimit': min(limit, 50),
            'prop': 'imageinfo',
            'iiprop': 'url|size|extmetadata|timestamp',
            'iiurlwidth': 800,
        }

        results = []
        continue_token = None

        while len(results) < limit:
            if continue_token:
                params['gcmcontinue'] = continue_token

            try:
                response = self.session.get(self.api_url, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()

                if 'query' not in data or 'pages' not in data['query']:
                    break

                for page in data['query']['pages'].values():
                    if 'imageinfo' in page and len(page['imageinfo']) > 0:
                        results.append({
                            'title': page['title'],
                            'pageid': page['pageid'],
                            'imageinfo': page['imageinfo'][0]
                        })

                # Check for continuation
                if 'continue' in data and 'gcmcontinue' in data['continue']:
                    continue_token = data['continue']['gcmcontinue']
                    time.sleep(0.3)  # Rate limiting
                else:
                    break

            except Exception as e:
                print(f"    ⚠ Error: {e}")
                break

        return results

    def get_subcategories(self, category: str) -> List[str]:
        """Get subcategories of a category."""
        params = {
            'action': 'query',
            'format': 'json',
            'list': 'categorymembers',
            'cmtitle': f'Category:{category}',
            'cmtype': 'subcat',
            'cmlimit': 50
        }

        try:
            response = self.session.get(self.api_url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            if 'query' in data and 'categorymembers' in data['query']:
                # Extract category names (remove "Category:" prefix)
                return [member['title'].replace('Category:', '')
                       for member in data['query']['categorymembers']]

        except Exception as e:
            print(f"  ⚠ Error getting subcategories: {e}")

        return []


class ImageAnalyzer:
    """Analyzes images to categorize them."""

    @staticmethod
    def extract_year(item: Dict) -> Optional[int]:
        """Extract year from image metadata."""
        # Try DateTimeOriginal first
        try:
            extmeta = item['imageinfo'].get('extmetadata', {})
            date_orig = extmeta.get('DateTimeOriginal', {}).get('value', '')
            if date_orig:
                match = re.search(r'(\d{4})', date_orig)
                if match:
                    return int(match.group(1))
        except:
            pass

        # Try timestamp
        try:
            timestamp = item['imageinfo'].get('timestamp', '')
            if timestamp:
                return int(timestamp[:4])
        except:
            pass

        # Try title
        try:
            title = item.get('title', '')
            match = re.search(r'(19|20)\d{2}', title)
            if match:
                return int(match.group(0))
        except:
            pass

        return None

    @staticmethod
    def categorize_by_year(year: int, birth_year: int) -> str:
        """Categorize age based on year."""
        if year < birth_year:
            return 'unknown'

        age = year - birth_year
        if age < 45:
            return 'young'
        elif age < 65:
            return 'middle'
        else:
            return 'old'

    @staticmethod
    def is_public_domain(item: Dict) -> bool:
        """Check if image is public domain or compatible license."""
        try:
            extmeta = item['imageinfo'].get('extmetadata', {})

            license_short = extmeta.get('LicenseShortName', {}).get('value', '').lower()
            license_url = extmeta.get('LicenseUrl', {}).get('value', '').lower()
            usage_terms = extmeta.get('UsageTerms', {}).get('value', '').lower()
            copyrighted = extmeta.get('Copyrighted', {}).get('value', '').lower()
            license_type = extmeta.get('License', {}).get('value', '').lower()

            all_text = f"{license_short} {license_url} {usage_terms} {copyrighted} {license_type}"

            # Public domain keywords
            pd_keywords = ['public domain', 'cc0', 'pd-', 'government work']
            if any(keyword in all_text for keyword in pd_keywords):
                return True

            # Also accept CC-BY licenses (attribution required but usable)
            if 'cc-by' in all_text or 'cc by' in all_text:
                return True

            return False

        except:
            return False

    @staticmethod
    def estimate_quality(width: int, height: int) -> str:
        """Estimate image quality from dimensions."""
        pixels = width * height
        if pixels > 1_000_000:
            return 'high'
        elif pixels > 300_000:
            return 'medium'
        else:
            return 'low'

    @staticmethod
    def is_likely_portrait(item: Dict) -> bool:
        """Check if image title/description suggests it's a portrait."""
        title = item.get('title', '').lower()

        # Check for non-portrait keywords
        for keyword in NON_PORTRAIT_KEYWORDS:
            if keyword in title:
                return False

        # If it has 'portrait' in the name, it's likely good
        if 'portrait' in title or 'headshot' in title or 'official' in title:
            return True

        return True  # Default to accepting unless filtered out


class ImageValidator:
    """Validates images for face recognition testing."""

    def __init__(self):
        self.seen_hashes = set()
        self.seen_urls = set()

    def validate_has_face(self, image_path: str, min_face_size: float = 0.10) -> bool:
        """
        Check if image contains at least one detectable face.

        Args:
            image_path: Path to image file
            min_face_size: Minimum face size relative to image (0.10 = 10% of image)

        Returns:
            True if at least one face is detected with sufficient size
        """
        try:
            # Load image
            image = face_recognition.load_image_file(image_path)
            h, w = image.shape[:2]

            # Detect faces
            face_locations = face_recognition.face_locations(image)

            if not face_locations:
                return False

            # Check if any face is prominent enough
            for (top, right, bottom, left) in face_locations:
                face_width = right - left
                face_height = bottom - top
                face_area = face_width * face_height
                image_area = w * h

                # Face should be at least min_face_size of the image
                if face_area / image_area >= min_face_size:
                    return True

            return False

        except Exception as e:
            print(f"    ⚠ Face detection error: {str(e)[:50]}")
            return False

    def calculate_perceptual_hash(self, image_path: str) -> str:
        """Calculate perceptual hash of image for duplicate detection."""
        try:
            img = Image.open(image_path)
            # Use average hash (fast and effective for near-duplicates)
            ahash = imagehash.average_hash(img, hash_size=16)
            return str(ahash)
        except Exception as e:
            print(f"    ⚠ Hash calculation error: {str(e)[:50]}")
            return ""

    def is_duplicate(self, image_path: str, url: str, similarity_threshold: int = 5) -> bool:
        """
        Check if image is a duplicate based on URL and perceptual hash.

        Args:
            image_path: Path to image file
            url: Source URL of image
            similarity_threshold: Maximum hamming distance to consider duplicate

        Returns:
            True if image is likely a duplicate
        """
        # Check URL first (exact duplicate)
        if url in self.seen_urls:
            return True

        # Calculate perceptual hash
        img_hash = self.calculate_perceptual_hash(image_path)
        if not img_hash:
            return False

        # Check against seen hashes
        for seen_hash in self.seen_hashes:
            try:
                # Calculate hamming distance
                distance = imagehash.hex_to_hash(img_hash) - imagehash.hex_to_hash(seen_hash)
                if distance <= similarity_threshold:
                    return True
            except:
                continue

        # Not a duplicate - record it
        self.seen_urls.add(url)
        self.seen_hashes.add(img_hash)
        return False


class IntelligentTestCurator:
    """Main curator class using category-based discovery."""

    def __init__(self, target_person: str = "Donald Trump", output_dir: str = "test_images"):
        self.target = target_person
        self.output_dir = Path(output_dir)
        self.cache_dir = Path('.image_cache')
        self.searcher = WikimediaSearcher()
        self.analyzer = ImageAnalyzer()
        self.validator = ImageValidator()

        # Get person config
        self.person_config = PERSON_CATEGORIES.get(target_person, {
            "main": target_person.replace(' ', '_'),
            "birth_year": 1950  # Default
        })

        # Create directory structure
        self.dirs = {
            'raw': self.output_dir / 'raw',  # Initial downloads
            'pending_review': self.output_dir / 'pending_review',  # After validation
            'source': self.output_dir / 'source_images',  # Approved final images
            'age': self.output_dir / 'age_variations',
            'lighting': self.output_dir / 'lighting_variations',
            'quality': self.output_dir / 'quality_variations',
            'false_positives': self.output_dir / 'false_positives',
            'cache': self.cache_dir
        }

        for dir_path in self.dirs.values():
            dir_path.mkdir(parents=True, exist_ok=True)

        self.metadata_log: List[ImageMetadata] = []
        self.validation_stats = {
            'downloaded': 0,
            'no_face': 0,
            'duplicate': 0,
            'non_portrait': 0,
            'passed': 0
        }
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TestImageCurator/2.0'
        })

    def curate_target_person(self, max_total: int = 50):
        """Curate a diverse set of images for the target person."""
        print(f"\n{'='*60}")
        print(f"CURATING TEST IMAGES FOR: {self.target}")
        print(f"{'='*60}\n")

        # Get images from main category
        main_category = self.person_config.get('main')
        print(f"🔍 Searching Category:{main_category}...")

        raw_results = self.searcher.get_category_members(main_category, limit=max_total * 3)

        print(f"  ✓ Found {len(raw_results)} images")

        # Filter to public domain
        pd_results = [r for r in raw_results if self.analyzer.is_public_domain(r)]
        print(f"  ✓ {len(pd_results)} public domain/CC-BY images")

        # Filter likely non-portrait images by title
        portrait_results = [r for r in pd_results if self.analyzer.is_likely_portrait(r)]
        filtered_count = len(pd_results) - len(portrait_results)
        if filtered_count > 0:
            print(f"  ✓ Filtered {filtered_count} likely non-portrait images")
        pd_results = portrait_results

        if len(pd_results) < 10:
            print(f"  ⚠ Warning: Limited results. Trying subcategories...")
            # Try to get more from subcategories
            subcats = self.searcher.get_subcategories(main_category)
            print(f"  Found {len(subcats)} subcategories")

            for subcat in subcats[:5]:  # Try first 5 subcategories
                more_results = self.searcher.get_category_members(subcat, limit=20)
                more_pd = [r for r in more_results if self.analyzer.is_public_domain(r)]
                pd_results.extend(more_pd)
                if len(pd_results) >= max_total:
                    break

            pd_results = pd_results[:max_total * 2]  # Limit total

        # Categorize and select diverse subset
        categorized = self._categorize_results(pd_results)
        selected = self._select_diverse_subset(categorized, max_total)

        # Download selected images
        downloaded = self._download_images(selected)

        print(f"\n✓ Downloaded {len(downloaded)} diverse images of {self.target}")

        return downloaded

    def curate_negative_examples(self, people: List[str], per_person: int = 10):
        """Download images of other people for false positive testing."""
        print(f"\n{'='*60}")
        print(f"CURATING NEGATIVE EXAMPLES (False Positive Testing)")
        print(f"{'='*60}\n")

        all_negatives = []

        for person in people:
            print(f"📥 {person}...")

            # Get person config
            person_config = PERSON_CATEGORIES.get(person, {
                "main": person.replace(' ', '_'),
                "birth_year": 1950
            })

            main_category = person_config.get('main')

            # Get images
            raw_results = self.searcher.get_category_members(main_category, limit=per_person * 2)
            pd_results = [r for r in raw_results if self.analyzer.is_public_domain(r)]

            # Select subset
            selected = pd_results[:per_person]

            # Download
            for i, result in enumerate(selected):
                try:
                    metadata = self._create_metadata(result, person, person_config['birth_year'], is_negative=True)
                    image = self._download_single_image(metadata)

                    if image:
                        # Save to false_positives directory
                        safe_person = person.replace(' ', '_').lower()
                        filename = f"{safe_person}_{i+1:03d}.jpg"
                        path = self.dirs['false_positives'] / filename
                        image.save(path, 'JPEG', quality=90)

                        all_negatives.append(metadata)
                        print(f"  ✓ {filename}")

                except Exception as e:
                    print(f"  ✗ Error: {str(e)[:50]}")
                    continue

        print(f"\n✓ Downloaded {len(all_negatives)} negative examples")
        return all_negatives

    def _categorize_results(self, results: List[Dict]) -> Dict[str, List[Dict]]:
        """Categorize results by decade."""
        categorized = defaultdict(list)

        print("\n📊 Categorizing images...")

        for result in results:
            try:
                year = self.analyzer.extract_year(result)
                if not year:
                    year = 2020  # Default

                decade = (year // 10) * 10

                result['_year'] = year
                result['_decade'] = decade
                categorized[decade].append(result)

            except Exception as e:
                continue

        # Print distribution
        for decade in sorted(categorized.keys()):
            count = len(categorized[decade])
            print(f"  {decade}s: {count} images")

        return dict(categorized)

    def _select_diverse_subset(self, categorized: Dict[str, List[Dict]], max_total: int) -> List[Dict]:
        """Select a diverse subset ensuring coverage across decades."""
        print(f"\n🎯 Selecting diverse subset (target: {max_total} images)...")

        if not categorized:
            return []

        # Calculate how many per decade
        num_decades = len(categorized)
        per_decade = max_total // num_decades
        remainder = max_total % num_decades

        selected = []

        # Get images from each decade
        for i, (decade, images) in enumerate(sorted(categorized.items())):
            # Give remainder to earlier decades
            take = per_decade + (1 if i < remainder else 0)
            take = min(take, len(images))
            selected.extend(images[:take])

        print(f"  ✓ Selected {len(selected)} images")
        return selected[:max_total]

    def _create_metadata(self, result: Dict, person: str, birth_year: int, is_negative: bool = False) -> ImageMetadata:
        """Create metadata object from result."""
        info = result['imageinfo']
        year = result.get('_year', 2020)

        # Extract metadata
        title = result.get('title', 'Unknown')
        url = info.get('thumburl', info.get('url', ''))
        width = info.get('thumbwidth', info.get('width', 800))
        height = info.get('thumbheight', info.get('height', 600))

        # Get license
        extmeta = info.get('extmetadata', {})
        license_info = extmeta.get('LicenseShortName', {}).get('value', 'Unknown')

        # Analyze
        age_category = self.analyzer.categorize_by_year(year, birth_year)
        quality = self.analyzer.estimate_quality(width, height)

        # Create filename
        safe_person = person.replace(' ', '_').replace('.', '').lower()
        safe_title = re.sub(r'[^a-zA-Z0-9_-]', '', title.replace(' ', '_'))[:40]
        filename = f"{safe_person}_{year}_{safe_title}.jpg"

        return ImageMetadata(
            url=url,
            filename=filename,
            person=person,
            year=year,
            estimated_age=age_category,
            source='Wikimedia Commons',
            license=license_info,
            title=title,
            context='portrait',
            quality=quality,
            size=(width, height),
            is_negative=is_negative
        )

    def _download_single_image(self, metadata: ImageMetadata) -> Optional[Image.Image]:
        """Download a single image."""
        try:
            # Check cache
            cache_hash = hashlib.md5(metadata.url.encode()).hexdigest()
            cache_path = self.cache_dir / f"{cache_hash}.jpg"

            if cache_path.exists():
                return Image.open(cache_path).convert('RGB')

            # Download
            response = self.session.get(metadata.url, timeout=30, stream=True)
            response.raise_for_status()

            # Save to cache
            with open(cache_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            # Open and return
            image = Image.open(cache_path).convert('RGB')
            return image

        except Exception as e:
            return None

    def _download_images(self, selected: List[Dict]) -> List[ImageMetadata]:
        """Download and validate images."""
        print(f"\n⬇️  Downloading and validating {len(selected)} images...")

        downloaded = []
        birth_year = self.person_config['birth_year']

        for i, result in enumerate(selected, 1):
            try:
                metadata = self._create_metadata(result, self.target, birth_year)
                image = self._download_single_image(metadata)

                if not image:
                    continue

                self.validation_stats['downloaded'] += 1

                # Save to raw directory first
                raw_path = self.dirs['raw'] / metadata.filename
                image.save(raw_path, 'JPEG', quality=95)

                # Validate: Check for duplicates
                if self.validator.is_duplicate(str(raw_path), metadata.url):
                    print(f"  [{i}/{len(selected)}] ⊘ DUPLICATE: {metadata.filename[:50]}")
                    self.validation_stats['duplicate'] += 1
                    raw_path.unlink()  # Delete duplicate
                    continue

                # Validate: Check for face
                if not self.validator.validate_has_face(str(raw_path)):
                    print(f"  [{i}/{len(selected)}] ⊘ NO_FACE: {metadata.filename[:50]}")
                    self.validation_stats['no_face'] += 1
                    raw_path.unlink()  # Delete non-face image
                    continue

                # Passed validation - move to pending_review
                pending_path = self.dirs['pending_review'] / metadata.filename
                raw_path.rename(pending_path)

                self.validation_stats['passed'] += 1
                downloaded.append(metadata)

                year_display = f"{metadata.year}" if metadata.year else "Unknown"
                print(f"  [{i}/{len(selected)}] ✓ {year_display} - {metadata.filename[:50]}")

            except Exception as e:
                print(f"  [{i}/{len(selected)}] ✗ Error: {str(e)[:50]}")
                self.validation_stats['downloaded'] += 1  # Count as attempt
                continue

        # Print validation summary
        print(f"\n📊 Validation Summary:")
        print(f"   Downloaded: {self.validation_stats['downloaded']}")
        print(f"   Passed: {self.validation_stats['passed']}")
        print(f"   Rejected (duplicates): {self.validation_stats['duplicate']}")
        print(f"   Rejected (no face): {self.validation_stats['no_face']}")

        return downloaded

    def create_lighting_variations(self, source_images: List[ImageMetadata]):
        """Create synthetic lighting variations."""
        if not source_images:
            return

        print(f"\n💡 Creating lighting variations...")

        # Select representatives
        representatives = source_images[:min(5, len(source_images))]

        for metadata in representatives:
            try:
                source_path = self.dirs['source'] / metadata.filename
                if not source_path.exists():
                    continue

                image = Image.open(source_path)
                base_name = source_path.stem

                # Backlit
                backlit = self._apply_backlight(image)
                backlit.save(self.dirs['lighting'] / f"{base_name}_backlit.jpg", 'JPEG', quality=90)

                # Low light
                lowlight = self._apply_lowlight(image)
                lowlight.save(self.dirs['lighting'] / f"{base_name}_lowlight.jpg", 'JPEG', quality=90)

                # Bright
                bright = self._apply_bright(image)
                bright.save(self.dirs['lighting'] / f"{base_name}_bright.jpg", 'JPEG', quality=90)

                # Shadows
                shadows = self._apply_shadows(image)
                shadows.save(self.dirs['lighting'] / f"{base_name}_shadows.jpg", 'JPEG', quality=90)

                print(f"  ✓ {base_name[:40]}... (4 variations)")

            except Exception as e:
                continue

    def _apply_backlight(self, image: Image.Image) -> Image.Image:
        """Apply backlight effect."""
        img_array = np.array(image).astype(float)
        h, w = img_array.shape[:2]

        center_y, center_x = h // 2, w // 2
        Y, X = np.ogrid[:h, :w]
        dist = np.sqrt((X - center_x)**2 + (Y - center_y)**2)
        max_dist = np.sqrt(center_x**2 + center_y**2)

        backlight = (dist / max_dist) ** 1.5
        shadow = 0.3 + (backlight * 0.4)
        img_array = img_array * shadow[:, :, np.newaxis]
        img_array = img_array + (backlight[:, :, np.newaxis] * 30)

        return Image.fromarray(np.clip(img_array, 0, 255).astype(np.uint8))

    def _apply_lowlight(self, image: Image.Image) -> Image.Image:
        """Apply low light effect."""
        enhancer = ImageEnhance.Brightness(image)
        dimmed = enhancer.enhance(0.4)
        enhancer = ImageEnhance.Contrast(dimmed)
        return enhancer.enhance(0.85)

    def _apply_bright(self, image: Image.Image) -> Image.Image:
        """Apply bright/overexposed effect."""
        enhancer = ImageEnhance.Brightness(image)
        bright = enhancer.enhance(1.8)
        enhancer = ImageEnhance.Contrast(bright)
        return enhancer.enhance(0.6)

    def _apply_shadows(self, image: Image.Image) -> Image.Image:
        """Apply directional shadows."""
        img_array = np.array(image).astype(float)
        h, w = img_array.shape[:2]

        gradient = np.linspace(1.2, 0.2, w)
        gradient_2d = np.tile(gradient, (h, 1))
        img_array = img_array * gradient_2d[:, :, np.newaxis]

        return Image.fromarray(np.clip(img_array, 0, 255).astype(np.uint8))

    def create_quality_variations(self, source_images: List[ImageMetadata]):
        """Create quality variations."""
        if not source_images:
            return

        print(f"\n📐 Creating quality variations...")

        for metadata in source_images[:min(5, len(source_images))]:
            try:
                source_path = self.dirs['source'] / metadata.filename
                if not source_path.exists():
                    continue

                image = Image.open(source_path)
                base_name = source_path.stem

                # Small
                small = image.copy()
                small.thumbnail((200, 200), Image.Resampling.LANCZOS)
                canvas = Image.new('RGB', (800, 800), (240, 240, 240))
                canvas.paste(small, ((800 - small.width) // 2, (800 - small.height) // 2))
                canvas.save(self.dirs['quality'] / f"{base_name}_small.jpg", 'JPEG', quality=90)

                # Compressed
                compressed = image.copy()
                compressed.save(self.dirs['quality'] / f"{base_name}_compressed.jpg", 'JPEG', quality=20)

                # Cropped
                w, h = image.size
                cropped = image.crop((0, int(h * 0.3), w, h))
                cropped.save(self.dirs['quality'] / f"{base_name}_cropped.jpg", 'JPEG', quality=90)

                print(f"  ✓ {base_name[:40]}... (3 variations)")

            except Exception as e:
                continue

    def save_metadata(self):
        """Save comprehensive metadata."""
        print(f"\n💾 Saving metadata...")

        # JSON
        metadata_path = self.output_dir / 'image_metadata.json'
        with open(metadata_path, 'w') as f:
            json.dump([asdict(m) for m in self.metadata_log], f, indent=2)

        # Markdown summary
        summary_path = self.output_dir / 'CURATION_SUMMARY.md'
        with open(summary_path, 'w') as f:
            f.write(f"# Test Image Curation Summary\n\n")
            f.write(f"**Target Person:** {self.target}\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
            f.write(f"**Total Images:** {len(self.metadata_log)}\n\n")

            # By age
            f.write("## Age Distribution\n\n")
            age_counts = defaultdict(int)
            for m in self.metadata_log:
                if not m.is_negative:
                    age_counts[m.estimated_age] += 1

            for age in ['young', 'middle', 'old']:
                f.write(f"- {age.title()}: {age_counts[age]} images\n")

            # By decade
            f.write("\n## Decade Distribution\n\n")
            decade_counts = defaultdict(int)
            for m in self.metadata_log:
                if not m.is_negative and m.year:
                    decade = (m.year // 10) * 10
                    decade_counts[decade] += 1

            for decade in sorted(decade_counts.keys()):
                f.write(f"- {decade}s: {decade_counts[decade]} images\n")

            # Negatives
            f.write(f"\n## Negative Examples\n\n")
            negative_count = sum(1 for m in self.metadata_log if m.is_negative)
            f.write(f"- Total: {negative_count} images\n\n")

            unique_people = set(m.person for m in self.metadata_log if m.is_negative)
            for person in sorted(unique_people):
                count = sum(1 for m in self.metadata_log if m.is_negative and m.person == person)
                f.write(f"  - {person}: {count} images\n")

        print(f"  ✓ Saved to {summary_path}")

    def run(self, negative_examples: Optional[List[str]] = None):
        """Main execution."""
        print(f"\n{'='*60}")
        print("INTELLIGENT TEST IMAGE CURATOR")
        print(f"{'='*60}\n")

        # Curate target
        target_images = self.curate_target_person(max_total=50)

        # Create variations
        if target_images:
            self.create_lighting_variations(target_images)
            self.create_quality_variations(target_images)

        # Curate negatives
        if negative_examples:
            self.curate_negative_examples(negative_examples, per_person=10)

        # Save metadata
        self.save_metadata()

        print(f"\n{'='*60}")
        print("✓ CURATION COMPLETE!")
        print(f"{'='*60}\n")
        print(f"Output directory: {self.output_dir}/\n")
        print("Results:")
        print(f"  source_images/       - {len(list(self.dirs['source'].glob('*.jpg')))} originals")
        print(f"  age_variations/      - {len(list(self.dirs['age'].glob('*.jpg')))} age-categorized")
        print(f"  lighting_variations/ - {len(list(self.dirs['lighting'].glob('*.jpg')))} lighting variations")
        print(f"  quality_variations/  - {len(list(self.dirs['quality'].glob('*.jpg')))} quality variations")
        print(f"  false_positives/     - {len(list(self.dirs['false_positives'].glob('*.jpg')))} negative examples")


def main():
    parser = argparse.ArgumentParser(description='Curate test images for face recognition testing')
    parser.add_argument('--target', type=str, default='Donald Trump', help='Target person')
    parser.add_argument('--negative-examples', type=str,
                       default='Joe Biden,Mike Pence,Barack Obama,Bill Clinton',
                       help='Comma-separated list of people for false positive testing')
    parser.add_argument('--output-dir', type=str, default='test_images', help='Output directory')
    parser.add_argument('--max-images', type=int, default=50, help='Maximum target images')

    args = parser.parse_args()

    negative_people = [p.strip() for p in args.negative_examples.split(',') if p.strip()]

    curator = IntelligentTestCurator(target_person=args.target, output_dir=args.output_dir)
    curator.run(negative_examples=negative_people)

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
