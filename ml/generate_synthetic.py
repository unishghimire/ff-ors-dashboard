#!/usr/bin/env python3
"""
Synthetic training data generator for Free Fire HUD OCR.

Generates fake Free Fire HUD crops to bootstrap model training
before real screenshots are collected. Renders alive counter,
zone phase, and full-frame phase classification images.

Usage:
  pip install Pillow numpy
  python3 generate_synthetic.py --count 500 --out training_data/

The synthetic data won't match real Free Fire perfectly, but it
gives the model a starting point. Fine-tune with real screenshots
using the labeling tool (collect.html) for production accuracy.
"""

import os
import json
import random
import argparse
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# === Free Fire HUD style constants ===
# These approximate the real Free Fire HUD colors/fonts.
# The real game uses specific fonts, but we use bold sans-serif
# as a reasonable approximation. Fine-tuning with real data fixes the gap.

HUD_BG_COLORS = [
    (15, 20, 30, 160),    # dark blue translucent
    (20, 25, 35, 170),
    (10, 15, 25, 180),
    (25, 30, 40, 150),
]

ALIVE_TEXT_COLOR = (255, 255, 255, 255)     # white
ALIVE_BG_COLOR = (0, 0, 0, 120)             # semi-transparent black pill
ZONE_COLORS = [
    (255, 100, 100, 255),    # red zone
    (255, 180, 50, 255),     # orange zone
    (100, 200, 255, 255),    # blue zone
]

# Font sizes relative to crop dimensions
try:
    FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    ImageFont.truetype(FONT_PATH, 10)  # test if available
except:
    FONT_PATH = None  # fall back to default

def get_font(size):
    if FONT_PATH:
        return ImageFont.truetype(FONT_PATH, size)
    return ImageFont.load_default()

def random_game_bg(w, h):
    """Generate a random game-like background (dark, noisy)."""
    img = Image.new('RGB', (w, h))
    pixels = img.load()
    for x in range(w):
        for y in range(h):
            # Dark gradient with noise
            base = random.randint(15, 60)
            r = base + random.randint(-10, 10)
            g = base + random.randint(-10, 10)
            b = base + random.randint(-5, 15)
            pixels[x, y] = (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
    # Add some random lighter patches (explosions, terrain)
    for _ in range(random.randint(2, 8)):
        cx, cy = random.randint(0, w), random.randint(0, h)
        radius = random.randint(10, 60)
        brightness = random.randint(40, 120)
        for x in range(max(0, cx-radius), min(w, cx+radius)):
            for y in range(max(0, cy-radius), min(h, cy+radius)):
                dist = math.sqrt((x-cx)**2 + (y-cy)**2)
                if dist < radius:
                    factor = 1 - dist/radius
                    r, g, b = pixels[x, y]
                    pixels[x, y] = (
                        min(255, int(r + brightness * factor)),
                        min(255, int(g + brightness * factor * 0.8)),
                        min(255, int(b + brightness * factor * 0.5)),
                    )
    return img

def generate_alive_counter_crop(out_dir, idx):
    """Generate a synthetic alive counter crop (100x60 pixels)."""
    alive_count = random.randint(1, 48)
    
    # Create game-like background
    img = random_game_bg(100, 60).convert('RGBA')
    
    # Draw semi-transparent black pill background (like Free Fire)
    overlay = Image.new('RGBA', (100, 60), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # Pill shape for alive counter (centered top)
    pill_w = random.randint(35, 50)
    pill_h = random.randint(18, 26)
    pill_x = (100 - pill_w) // 2
    pill_y = random.randint(5, 15)
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], 
                          radius=8, fill=(0, 0, 0, random.randint(100, 160)))
    
    # Sometimes add a small icon to the left of the number
    if random.random() > 0.5:
        icon_x = pill_x + 4
        icon_y = pill_y + (pill_h - 8) // 2
        draw.ellipse([icon_x, icon_y, icon_x + 8, icon_y + 8], 
                    fill=(255, 255, 255, random.randint(150, 200)))
    
    # Draw the number (white, bold, centered)
    text = str(alive_count)
    font_size = random.randint(12, 16)
    font = get_font(font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_x = pill_x + (pill_w - text_w) // 2
    text_y = pill_y + (pill_h - text_h) // 2 - 1
    
    # Add slight text shadow
    draw.text((text_x + 1, text_y + 1), text, font=font, fill=(0, 0, 0, 200))
    draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))
    
    # Merge overlay
    img = Image.alpha_composite(img, overlay)
    
    # Add slight blur/noise to simulate compression
    if random.random() > 0.7:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.8)))
    
    # Save
    img.convert('RGB').save(os.path.join(out_dir, f"alive_{idx:04d}.jpg"), quality=85)
    
    return {
        "file": f"alive_{idx:04d}.jpg",
        "alive_count": alive_count
    }

def generate_phase_image(out_dir, idx):
    """Generate a synthetic full-frame phase classification image (224x224 pixels)."""
    phase = random.choice(["lobby", "loading", "in_game", "results"])
    img = random_game_bg(224, 224).convert('RGBA')
    overlay = Image.new('RGBA', (224, 224), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    if phase == "lobby":
        # Lobby: lighter background, "WAITING" or "READY" text
        for y in range(224):
            for x in range(224):
                r, g, b = overlay.getpixel((x, y))
                overlay.putpixel((x, y), (r + 20, g + 20, b + 10, 255))
        draw = ImageDraw.Draw(overlay)
        font = get_font(20)
        text = random.choice(["WAITING", "READY", "TAP TO START"])
        bbox = draw.textbbox((0, 0), text, font=font)
        draw.text(((224 - (bbox[2]-bbox[0])) // 2, 100), text, font=font, fill=(255, 255, 255, 255))
        
    elif phase == "loading":
        # Loading: dark with progress bar
        draw.rectangle([50, 100, 174, 115], fill=(40, 40, 40, 200))
        progress = random.randint(20, 200)
        draw.rectangle([52, 102, 52 + progress, 113], fill=(255, 165, 0, 255))
        
    elif phase == "in_game":
        # In game: HUD elements visible
        # Alive counter top center
        draw.rounded_rectangle([87, 5, 137, 28], radius=6, fill=(0, 0, 0, 140))
        font = get_font(14)
        draw.text((97, 8), str(random.randint(1, 48)), font=font, fill=(255, 255, 255, 255))
        # Zone timer top right
        draw.rounded_rectangle([190, 5, 220, 25], radius=4, fill=(0, 0, 0, 120))
        # Minimap bottom right
        draw.rounded_rectangle([180, 180, 220, 220], radius=4, fill=(20, 30, 40, 180))
        
    elif phase == "results":
        # Results: standings table
        draw.rectangle([20, 30, 204, 200], fill=(15, 20, 30, 220))
        draw.line([20, 50, 204, 50], fill=(255, 165, 0, 200), width=2)
        font = get_font(14)
        for i in range(5):
            y = 60 + i * 28
            draw.text((30, y), f"#{i+1}", font=font, fill=(255, 165, 0, 255))
            draw.text((60, y), f"Team{i+1}", font=font, fill=(255, 255, 255, 200))
            draw.text((160, y), str(random.randint(0, 30)), font=font, fill=(255, 255, 255, 200))
    
    img = Image.alpha_composite(img, overlay)
    img.convert('RGB').save(os.path.join(out_dir, f"phase_{idx:04d}.jpg"), quality=85)
    
    return {
        "file": f"phase_{idx:04d}.jpg",
        "phase": phase
    }

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic Free Fire HUD training data")
    parser.add_argument("--count", type=int, default=500, help="Number of images per category")
    parser.add_argument("--out", type=str, default="training_data", help="Output directory")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()
    
    random.seed(args.seed)
    
    # Generate alive counter data
    alive_dir = os.path.join(args.out, "alive_counter")
    os.makedirs(alive_dir, exist_ok=True)
    alive_labels = []
    for i in range(args.count):
        label = generate_alive_counter_crop(alive_dir, i)
        alive_labels.append(label)
    with open(os.path.join(alive_dir, "labels.json"), "w") as f:
        json.dump(alive_labels, f, indent=2)
    print(f"✅ Generated {args.count} alive counter images → {alive_dir}/")
    
    # Generate phase classifier data
    phase_dir = os.path.join(args.out, "phase_classifier")
    os.makedirs(phase_dir, exist_ok=True)
    phase_labels = []
    for i in range(args.count):
        label = generate_phase_image(phase_dir, i)
        phase_labels.append(label)
    with open(os.path.join(phase_dir, "labels.json"), "w") as f:
        json.dump(phase_labels, f, indent=2)
    print(f"✅ Generated {args.count} phase classifier images → {phase_dir}/")
    
    print(f"\nDone! {args.count * 2} total images generated.")
    print(f"Next: python3 train.py --data {args.out}/")

if __name__ == "__main__":
    main()
