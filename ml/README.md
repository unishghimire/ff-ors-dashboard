# ORS ML Pipeline — TensorFlow.js HUD Reader

## Overview
On-device ML models for real-time Free Fire HUD extraction. Runs entirely
in the browser via WebGL — zero API calls, zero latency for most frames.

## Architecture
```
Video Frame → TF.js Models (5-10ms) → Decision
  ├─ ML confident → display result (no Gemini call)
  └─ Need detail  → Gemini OCR (2-3s, only when needed)
```

## Models

### 1. Alive Counter (100×60 → 0-48)
- Input: cropped alive counter region (top center of screen)
- Output: number of alive players (49 classes)
- Size: ~200KB
- Inference: ~5ms

### 2. Phase Classifier (224×224 → 4 classes)
- Input: downsampled full frame
- Output: lobby / loading / in_game / results
- Size: ~1MB
- Inference: ~10ms

## Getting Started

### 1. Generate synthetic training data
```bash
cd ml/
pip install Pillow numpy
python3 generate_synthetic.py --count 500 --out training_data/
```

### 2. Train the models
```bash
pip install tensorflow tensorflowjs pillow numpy
python3 train.py --data training_data/ --epochs 30
```

### 3. Copy trained models to the web app
```bash
cp -r models/alive_counter ../public/models/
cp -r models/phase_classifier ../public/models/
```

### 4. Deploy
The web app automatically loads models from `/models/` when the Capture
page is opened. If no models are found, it falls back to Gemini-only mode.

## Collecting Real Training Data

Synthetic data is a starting point. For production accuracy:

1. Open the Capture page in your browser
2. Start screen capture of a Free Fire match
3. Capture frames at key moments (different alive counts, phases)
4. Use the labeling tool (ml/collect.html — coming soon) to:
   - Crop the alive counter region
   - Label the correct number
   - Export labeled dataset

### Real data tips:
- Capture from different devices and resolutions
- Include edge cases (1 alive, 48 alive, zone transitions)
- Label at least 200 real screenshots for >95% accuracy

## When to Retrain
- Free Fire updates its HUD layout
- You add support for a new resolution
- You want to add new HUD elements (zone timer, kill feed)

## Browser Requirements
- Chrome 90+ (WebGL support for TF.js inference)
- ~2MB memory for model weights
- Models load once and persist for the session
