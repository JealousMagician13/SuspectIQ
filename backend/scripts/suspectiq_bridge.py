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

LABEL_MAP = {0: "NORMAL", 1: "SUSPICIOUS"}


def _emit(payload):
    print(json.dumps(payload), flush=True)


def _progress(progress, stage):
    _emit({
        "type": "progress",
        "progress": int(progress),
        "stage": stage,
    })


def _read_frames_with_progress(detector, video_path):
    import cv2

    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path!r}")

    cap = cv2.VideoCapture(video_path)
    frames = []

    while len(frames) < detector.num_frames:
        ret, frame = cap.read()
        if not ret:
            break

        frames.append(frame)
        frame_progress = 35 + (len(frames) / detector.num_frames) * 25
        _progress(frame_progress, f"Reading frames ({len(frames)}/{detector.num_frames})")

    cap.release()
    return frames


def main():
    if len(sys.argv) < 2:
        _fail("No file path or URL provided.")

    target = sys.argv[1]

    try:
        from suspectiq import SuspectIQ  # type: ignore
    except ImportError as e:
        _fail(f"Failed to import SuspectIQ: {e}")

    try:
        _progress(5, "Starting analysis")
        detector = SuspectIQ()

        _progress(15, "Loading model")
        detector._load_models()
        _progress(35, "Model ready")

        tmp_file = None
        try:
            from suspectiq.youtube import is_youtube_url, download_video  # type: ignore

            if is_youtube_url(target):
                _progress(36, "Downloading video")
                target = download_video(target)
                tmp_file = target

            frames = _read_frames_with_progress(detector, target)
        finally:
            if tmp_file and os.path.exists(tmp_file):
                os.remove(tmp_file)

        if not frames:
            raise ValueError(
                f"Could not read any frames from {target!r}. "
                "Check that the file is a valid video."
            )

        _progress(65, "Preprocessing frames")
        frames_pp = detector._preprocess(frames)

        _progress(78, "Extracting visual features")
        feats = detector._backbone(frames_pp, training=False)

        _progress(88, "Running temporal classifier")
        import tensorflow as tf
        feats = tf.expand_dims(feats, 0)
        prob = float(detector._temporal_model(feats, training=False)[0][0])

        pred = 1 if prob >= detector.threshold else 0
        label = LABEL_MAP[pred]
        confidence = prob if pred == 1 else (1 - prob)
    except Exception as e:
        _fail(f"Prediction failed: {e}")

    label = str(label).strip().lower()  # expected: "suspicious" or "normal"
    confidence = float(confidence)

    # Derive per-class probabilities.
    # If the library exposes them directly, replace this with result.normal_probability etc.
    if label == "suspicious":
        suspicious_prob = confidence
        normal_prob = round(1.0 - confidence, 6)
    else:
        normal_prob = confidence
        suspicious_prob = round(1.0 - confidence, 6)

    output = {
        "type": "result",
        "prediction": label,
        "confidence": confidence,
        "normalProbability": normal_prob,
        "suspiciousProbability": suspicious_prob,
        "processedFrames": len(frames),
        "model": "ResNet50-BiGRU-Attention",
    }

    _emit(output)
    sys.exit(0)


def _fail(message):
    _emit({"type": "error", "error": message})
    sys.exit(1)


if __name__ == "__main__":
    main()
