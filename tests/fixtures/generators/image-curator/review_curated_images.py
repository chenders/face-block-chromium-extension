#!/usr/bin/env python3
"""
Interactive Image Review Tool
==============================
Review and approve/reject curated images before final processing.

Usage:
    python review_curated_images.py --input test-data/trump/pending_review
"""

import os
import sys
import argparse
from pathlib import Path
from PIL import Image
import json
from typing import List, Dict
import face_recognition
import cv2
import numpy as np


def draw_face_boxes(image_path: str) -> np.ndarray:
    """Draw bounding boxes around detected faces."""
    # Load image
    image = face_recognition.load_image_file(image_path)

    # Detect faces
    face_locations = face_recognition.face_locations(image)

    # Draw boxes
    for (top, right, bottom, left) in face_locations:
        cv2.rectangle(image, (left, top), (right, bottom), (0, 255, 0), 2)

    return image


def display_image_info(image_path: Path):
    """Display information about an image."""
    img = Image.open(image_path)
    width, height = img.size

    print(f"\n{'='*60}")
    print(f"Image: {image_path.name}")
    print(f"Size: {width}x{height} pixels")
    print(f"{'='*60}")


def review_images(pending_dir: Path, output_base: Path):
    """Interactive review of pending images."""
    pending_dir = Path(pending_dir)
    output_base = Path(output_base)

    # Find all images
    image_files = sorted(list(pending_dir.glob('*.jpg')) + list(pending_dir.glob('*.png')))

    if not image_files:
        print("No images found in pending_review directory.")
        return

    print(f"\n🖼️  Found {len(image_files)} images to review\n")
    print("Commands:")
    print("  k - Keep (approve)")
    print("  r - Reject (delete)")
    print("  s - Skip (review later)")
    print("  q - Quit review\n")

    # Statistics
    stats = {'kept': 0, 'rejected': 0, 'skipped': 0}

    # Create output directories
    approved_dir = output_base / 'source_images'
    rejected_dir = output_base / 'rejected'
    approved_dir.mkdir(parents=True, exist_ok=True)
    rejected_dir.mkdir(parents=True, exist_ok=True)

    for i, image_path in enumerate(image_files, 1):
        try:
            # Display info
            display_image_info(image_path)

            # Show face detection
            print("\nDetecting faces...")
            image_rgb = face_recognition.load_image_file(str(image_path))
            face_locations = face_recognition.face_locations(image_rgb)

            if face_locations:
                print(f"✓ Found {len(face_locations)} face(s)")
                for j, (top, right, bottom, left) in enumerate(face_locations, 1):
                    width = right - left
                    height = bottom - top
                    print(f"  Face {j}: {width}x{height} pixels")
            else:
                print("⚠ No faces detected")

            # Open image for visual review (requires display)
            try:
                img = Image.open(image_path)
                # Resize if too large
                max_size = (800, 800)
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                img.show()
            except:
                print("(Could not display image - headless environment)")

            # Get user decision
            while True:
                decision = input(f"\n[{i}/{len(image_files)}] Keep/Reject/Skip/Quit? (k/r/s/q): ").lower().strip()

                if decision == 'k':
                    # Move to approved
                    dest_path = approved_dir / image_path.name
                    image_path.rename(dest_path)
                    stats['kept'] += 1
                    print(f"✓ Kept: {image_path.name}")
                    break

                elif decision == 'r':
                    # Move to rejected
                    dest_path = rejected_dir / image_path.name
                    image_path.rename(dest_path)
                    stats['rejected'] += 1
                    print(f"✗ Rejected: {image_path.name}")
                    break

                elif decision == 's':
                    # Skip - leave in pending
                    stats['skipped'] += 1
                    print(f"→ Skipped: {image_path.name}")
                    break

                elif decision == 'q':
                    print("\nQuitting review...")
                    print_stats(stats, i - 1, len(image_files))
                    return

                else:
                    print("Invalid choice. Please enter k, r, s, or q.")

        except KeyboardInterrupt:
            print("\n\nReview interrupted by user.")
            print_stats(stats, i - 1, len(image_files))
            return
        except Exception as e:
            print(f"Error processing {image_path.name}: {e}")
            continue

    # Final summary
    print("\n" + "="*60)
    print("REVIEW COMPLETE!")
    print_stats(stats, len(image_files), len(image_files))


def print_stats(stats: Dict, reviewed: int, total: int):
    """Print review statistics."""
    print("="*60)
    print(f"Reviewed: {reviewed}/{total}")
    print(f"  Kept: {stats['kept']}")
    print(f"  Rejected: {stats['rejected']}")
    print(f"  Skipped: {stats['skipped']}")
    print("="*60)


def main():
    parser = argparse.ArgumentParser(description='Review curated test images')
    parser.add_argument('--input', type=str, required=True,
                       help='Path to pending_review directory')
    parser.add_argument('--output', type=str, required=True,
                       help='Base output directory')

    args = parser.parse_args()

    pending_dir = Path(args.input)
    output_base = Path(args.output)

    if not pending_dir.exists():
        print(f"Error: Directory not found: {pending_dir}")
        return 1

    review_images(pending_dir, output_base)

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
