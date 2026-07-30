#!/usr/bin/env python3
"""
Training script for Free Fire HUD models.

Trains two models:
1. Alive Counter CNN — classifies which number (1-48) is shown in the
   alive counter HUD region. Input: 100x60 RGB. Output: 49 classes (0-48).
2. Phase Classifier CNN — classifies game phase. Input: 224x224 RGB.
   Output: 4 classes (lobby, loading, in_game, results).

Both export to TensorFlow.js format for in-browser inference.

Usage:
  pip install tensorflow tensorflowjs pillow numpy
  python3 generate_synthetic.py --count 500 --out training_data/
  python3 train.py --data training_data/ --epochs 30
"""

import os
import json
import argparse
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras

# ============================================================
# Alive Counter Model (100x60 → 49 classes)
# ============================================================
def build_alive_counter_model():
    """Small CNN for alive counter digit recognition."""
    model = keras.Sequential([
        keras.layers.Input(shape=(60, 100, 3)),
        # Block 1
        keras.layers.Conv2D(32, 3, padding='same', activation='relu'),
        keras.layers.BatchNormalization(),
        keras.layers.MaxPooling2D(2),
        keras.layers.Dropout(0.2),
        # Block 2
        keras.layers.Conv2D(64, 3, padding='same', activation='relu'),
        keras.layers.BatchNormalization(),
        keras.layers.MaxPooling2D(2),
        keras.layers.Dropout(0.2),
        # Block 3
        keras.layers.Conv2D(128, 3, padding='same', activation='relu'),
        keras.layers.BatchNormalization(),
        keras.layers.GlobalAveragePooling2D(),
        keras.layers.Dropout(0.3),
        # Classifier
        keras.layers.Dense(128, activation='relu'),
        keras.layers.Dense(49, activation='softmax')  # 0-48 alive
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model

# ============================================================
# Phase Classifier Model (224x224 → 4 classes)
# ============================================================
def build_phase_classifier_model():
    """Small CNN for game phase classification."""
    model = keras.Sequential([
        keras.layers.Input(shape=(224, 224, 3)),
        # Block 1
        keras.layers.Conv2D(32, 3, padding='same', activation='relu'),
        keras.layers.BatchNormalization(),
        keras.layers.MaxPooling2D(2),
        # Block 2
        keras.layers.Conv2D(64, 3, padding='same', activation='relu'),
        keras.layers.BatchNormalization(),
        keras.layers.MaxPooling2D(2),
        # Block 3
        keras.layers.Conv2D(128, 3, padding='same', activation='relu'),
        keras.layers.BatchNormalization(),
        keras.layers.MaxPooling2D(2),
        # Block 4
        keras.layers.Conv2D(256, 3, padding='same', activation='relu'),
        keras.layers.BatchNormalization(),
        keras.layers.GlobalAveragePooling2D(),
        keras.layers.Dropout(0.3),
        # Classifier
        keras.layers.Dense(128, activation='relu'),
        keras.layers.Dense(4, activation='softmax')  # lobby, loading, in_game, results
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model

# ============================================================
# Data loading
# ============================================================
def load_alive_counter_data(data_dir):
    """Load alive counter images and labels."""
    labels_path = os.path.join(data_dir, "labels.json")
    with open(labels_path) as f:
        labels = json.load(f)
    
    images = []
    counts = []
    for item in labels:
        img_path = os.path.join(data_dir, item["file"])
        img = Image.open(img_path).convert('RGB').resize((100, 60))
        images.append(np.array(img) / 255.0)
        counts.append(item["alive_count"])
    
    return np.array(images), np.array(counts)

def load_phase_data(data_dir):
    """Load phase classifier images and labels."""
    labels_path = os.path.join(data_dir, "labels.json")
    with open(labels_path) as f:
        labels = json.load(f)
    
    phase_map = {"lobby": 0, "loading": 1, "in_game": 2, "results": 3}
    
    images = []
    phases = []
    for item in labels:
        img_path = os.path.join(data_dir, item["file"])
        img = Image.open(img_path).convert('RGB').resize((224, 224))
        images.append(np.array(img) / 255.0)
        phases.append(phase_map[item["phase"]])
    
    return np.array(images), np.array(phases)

# ============================================================
# Training
# ============================================================
def train_alive_counter(data_dir, epochs, out_dir):
    print("\n" + "=" * 60)
    print("Training Alive Counter Model")
    print("=" * 60)
    
    X, y = load_alive_counter_data(data_dir)
    print(f"Loaded {len(X)} images, {len(set(y))} unique alive counts")
    
    # Split 80/20
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    
    model = build_alive_counter_model()
    model.summary()
    
    # Data augmentation
    datagen = keras.preprocessing.image.ImageDataGenerator(
        rotation_range=2,
        width_shift_range=0.05,
        height_shift_range=0.05,
        zoom_range=0.1,
        brightness_range=[0.7, 1.3],
        fill_mode='constant'
    )
    datagen.fit(X_train)
    
    # Callbacks
    callbacks = [
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6),
    ]
    
    model.fit(
        datagen.flow(X_train, y_train, batch_size=32),
        validation_data=(X_val, y_val),
        epochs=epochs,
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluate
    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"\nValidation accuracy: {val_acc:.2%}")
    
    # Save
    model_path = os.path.join(out_dir, "alive_counter.h5")
    model.save(model_path)
    print(f"Model saved: {model_path}")
    
    return model, val_acc

def train_phase_classifier(data_dir, epochs, out_dir):
    print("\n" + "=" * 60)
    print("Training Phase Classifier Model")
    print("=" * 60)
    
    X, y = load_phase_data(data_dir)
    print(f"Loaded {len(X)} images, classes: {set(y)}")
    
    # Split 80/20
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    
    model = build_phase_classifier_model()
    model.summary()
    
    # Data augmentation
    datagen = keras.preprocessing.image.ImageDataGenerator(
        rotation_range=3,
        width_shift_range=0.1,
        height_shift_range=0.1,
        zoom_range=0.15,
        brightness_range=[0.6, 1.4],
        fill_mode='constant'
    )
    datagen.fit(X_train)
    
    callbacks = [
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6),
    ]
    
    model.fit(
        datagen.flow(X_train, y_train, batch_size=32),
        validation_data=(X_val, y_val),
        epochs=epochs,
        callbacks=callbacks,
        verbose=1
    )
    
    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"\nValidation accuracy: {val_acc:.2%}")
    
    model_path = os.path.join(out_dir, "phase_classifier.h5")
    model.save(model_path)
    print(f"Model saved: {model_path}")
    
    return model, val_acc

# ============================================================
# Export to TensorFlow.js
# ============================================================
def export_tfjs(model, out_dir, model_name):
    """Export Keras model to TensorFlow.js format."""
    import tensorflowjs as tfjs
    tfjs_out = os.path.join(out_dir, model_name)
    os.makedirs(tfjs_out, exist_ok=True)
    tfjs.converters.save_keras_model(model, tfjs_out)
    print(f"✅ TF.js model exported: {tfjs_out}/")
    # List output files
    for f in os.listdir(tfjs_out):
        size = os.path.getsize(os.path.join(tfjs_out, f))
        print(f"   {f} ({size/1024:.1f} KB)")

# ============================================================
# Main
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="Train Free Fire HUD models")
    parser.add_argument("--data", type=str, default="training_data", help="Training data directory")
    parser.add_argument("--epochs", type=int, default=30, help="Training epochs")
    parser.add_argument("--out", type=str, default="models", help="Output directory for trained models")
    parser.add_argument("--skip-alive", action="store_true", help="Skip alive counter training")
    parser.add_argument("--skip-phase", action="store_true", help="Skip phase classifier training")
    args = parser.parse_args()
    
    os.makedirs(args.out, exist_ok=True)
    
    print(f"TensorFlow version: {tf.__version__}")
    print(f"GPU available: {len(tf.config.list_physical_devices('GPU')) > 0}")
    
    if not args.skip_alive:
        alive_dir = os.path.join(args.data, "alive_counter")
        if os.path.exists(alive_dir):
            model, acc = train_alive_counter(alive_dir, args.epochs, args.out)
            export_tfjs(model, args.out, "alive_counter")
        else:
            print(f"⚠️  No alive counter data at {alive_dir}/")
            print(f"   Run: python3 generate_synthetic.py --out {args.data}/")
    
    if not args.skip_phase:
        phase_dir = os.path.join(args.data, "phase_classifier")
        if os.path.exists(phase_dir):
            model, acc = train_phase_classifier(phase_dir, args.epochs, args.out)
            export_tfjs(model, args.out, "phase_classifier")
        else:
            print(f"⚠️  No phase classifier data at {phase_dir}/")
    
    print("\n" + "=" * 60)
    print("✅ Training complete!")
    print("=" * 60)
    print(f"\nNext steps:")
    print(f"  1. Copy models to your web app: cp -r models/* public/models/")
    print(f"  2. The browser will auto-load the models from /models/")
    print(f"  3. Capture will use ML for alive count + phase,")
    print(f"     and only call Gemini for kill feed + results parsing")

if __name__ == "__main__":
    main()
