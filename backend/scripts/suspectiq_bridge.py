#!/usr/bin/env python3
"""
suspectiq_bridge.py

Thin CLI wrapper around the SuspectIQ library.
Called by the Node.js analysis worker as a child process.

Usage:
    python suspectiq_bridge.py <file_path_or_url>

Stdout (always JSON):
    Success:
        {
          "prediction": "suspicious" | "normal",
          "confidence": 0.913,
          "normalProbability": 0.087,
          "suspiciousProbability": 0.913,
          "model": "ResNet50-BiGRU-Attention"
        }

    Error:
        { "error": "Human-readable message" }

Exit codes:
    0 — success
    1 — error (details in stdout JSON)
"""

import sys
import json
import os

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

def main():
    if len(sys.argv) < 2:
        _fail("No file path or URL provided.")

    target = sys.argv[1]

    try:
        from suspectiq import SuspectIQ  # type: ignore
    except ImportError as e:
        _fail(f"Failed to import SuspectIQ: {e}")

    try:
        detector = SuspectIQ()
        result = detector.predict(target)
    except Exception as e:
        _fail(f"Prediction failed: {e}")

    label = str(result.label).strip().lower()  # expected: "suspicious" or "normal"
    confidence = float(result.confidence)

    # Derive per-class probabilities.
    # If the library exposes them directly, replace this with result.normal_probability etc.
    if label == "suspicious":
        suspicious_prob = confidence
        normal_prob = round(1.0 - confidence, 6)
    else:
        normal_prob = confidence
        suspicious_prob = round(1.0 - confidence, 6)

    output = {
        "prediction": label,
        "confidence": confidence,
        "normalProbability": normal_prob,
        "suspiciousProbability": suspicious_prob,
        "model": "ResNet50-BiGRU-Attention",
    }

    print(json.dumps(output))
    sys.exit(0)


def _fail(message):
    print(json.dumps({"error": message}))
    sys.exit(1)


if __name__ == "__main__":
    main()
