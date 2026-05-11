from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .layers import TemporalAttention
from .youtube import is_youtube_url, download_video

# Default model bundled inside the package at suspectiq/models/
_BUNDLED_MODEL = Path(__file__).parent / "models" / "best_model_ucf.keras"


@dataclass
class PredictionResult:
    """
    Holds the output of a single video prediction.

    Attributes:
        label:       Human-readable class label ("NORMAL" or "SUSPICIOUS").
        confidence:  Confidence score for the predicted class (0.0 – 1.0).
        probability: Raw model output probability (likelihood of SUSPICIOUS).
    """

    label: str
    confidence: float
    probability: float

    def __repr__(self) -> str:
        return (
            f"PredictionResult("
            f"label={self.label!r}, "
            f"confidence={self.confidence:.4f}, "
            f"probability={self.probability:.4f})"
        )


class SuspectIQ:
    """
    High-level interface for video anomaly / suspicious-activity detection.

    Parameters
    ----------
    model_path : str, optional
        Path to a ``.keras`` temporal model file. If omitted, the model
        bundled inside the package (``suspectiq/models/``) is used automatically.
    threshold : float, optional
        Decision threshold for the SUSPICIOUS class. Default is ``0.325``.
    num_frames : int, optional
        Number of frames sampled from each video clip. Default is ``16``.
    img_size : int, optional
        Height / width to which each frame is resized before inference.
        Default is ``224``.

    Examples
    --------
    Zero-config usage (bundled model)::

        from suspectiq import SuspectIQ

        detector = SuspectIQ()               # ← no path needed
        result = detector.predict("clip.mp4")
        print(result.label, result.confidence)

    Custom model::

        detector = SuspectIQ("my_retrained_model.keras")
        for r in results:
            print(r)
    """

    LABEL_MAP = {0: "NORMAL", 1: "SUSPICIOUS"}

    def __init__(
        self,
        model_path: Optional[str] = None,
        threshold: float = 0.325,
        num_frames: int = 16,
        img_size: int = 224,
    ) -> None:
        self.model_path = model_path or str(_BUNDLED_MODEL)
        self.threshold = threshold
        self.num_frames = num_frames
        self.img_size = img_size

        self._temporal_model = None
        self._backbone = None

    # ------------------------------------------------------------------
    # Lazy model loading
    # ------------------------------------------------------------------

    def _load_models(self) -> None:
        """Lazy-load TensorFlow / Keras models on first use."""
        if self._temporal_model is not None:
            return

        try:
            import tensorflow as tf
            from tensorflow.keras.models import load_model
            from tensorflow.keras.applications import ResNet50
        except ImportError as exc:
            raise ImportError(
                "TensorFlow is required. Install it with:\n"
                "  pip install tensorflow"
            ) from exc

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Model file not found: {self.model_path!r}\n"
                "Make sure the path is correct."
            )

        self._temporal_model = load_model(
            self.model_path,
            compile=False,
            custom_objects={
                "TemporalAttention": TemporalAttention,
                "CriminalDetector>TemporalAttention": TemporalAttention,
            },
        )

        self._backbone = ResNet50(
            include_top=False,
            weights="imagenet",
            pooling="avg",
            input_shape=(self.img_size, self.img_size, 3),
        )
        self._backbone.trainable = False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _read_frames(self, video_path: str) -> list[np.ndarray]:
        """Read up to ``num_frames`` frames from a video file."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path!r}")

        cap = cv2.VideoCapture(video_path)
        frames: list[np.ndarray] = []

        while len(frames) < self.num_frames:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)

        cap.release()
        return frames

    def _preprocess(self, frames: list[np.ndarray]) -> "np.ndarray":
        """Resize, pad, and normalise a list of BGR frames."""
        from tensorflow.keras.applications.resnet50 import preprocess_input

        processed = []
        for f in frames:
            f = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
            f = cv2.resize(f, (self.img_size, self.img_size))
            processed.append(f.astype(np.float32))

        # Repeat last frame if the clip is shorter than num_frames
        while len(processed) < self.num_frames:
            processed.append(processed[-1])

        arr = np.stack(processed[: self.num_frames])  # (T, H, W, 3)
        return preprocess_input(arr)

    def _infer(self, frames_pp: "np.ndarray") -> float:
        """Extract ResNet50 features, then run the temporal model."""
        import tensorflow as tf

        feats = self._backbone(frames_pp, training=False)  # (T, D)
        feats = tf.expand_dims(feats, 0)                   # (1, T, D)
        prob = float(self._temporal_model(feats, training=False)[0][0])
        return prob

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, video_path: str) -> PredictionResult:
        """
        Classify a single video clip.

        Parameters
        ----------
        video_path : str
            Path to the video file (any format supported by OpenCV).

        Returns
        -------
        PredictionResult
            Dataclass with ``label``, ``confidence``, and ``probability``.

        Raises
        ------
        FileNotFoundError
            If the video or model file does not exist.
        ValueError
            If no frames could be read from the video.
        """
        self._load_models()

        tmp_file = None
        if is_youtube_url(video_path):
            print(f"[SuspectIQ] Downloading YouTube video...")
            video_path = download_video(video_path)
            tmp_file = video_path
            print(f"[SuspectIQ] Downloaded to: {video_path}")

        try:
            frames = self._read_frames(video_path)
        finally:
            # Clean up the temp file after reading frames
            if tmp_file and os.path.exists(tmp_file):
                os.remove(tmp_file)
        if not frames:
            raise ValueError(
                f"Could not read any frames from {video_path!r}. "
                "Check that the file is a valid video."
            )

        frames_pp = self._preprocess(frames)
        prob = self._infer(frames_pp)

        pred = 1 if prob >= self.threshold else 0
        label = self.LABEL_MAP[pred]
        confidence = prob if pred == 1 else (1 - prob)

        return PredictionResult(label=label, confidence=confidence, probability=prob)

    def predict_batch(
        self, video_paths: list[str]
    ) -> list[Optional[PredictionResult]]:
        """
        Classify multiple video clips in sequence.

        Parameters
        ----------
        video_paths : list[str]
            List of paths to video files.

        Returns
        -------
        list[PredictionResult | None]
            Results in the same order as ``video_paths``. ``None`` is
            returned for any video that fails to process.
        """
        self._load_models()

        results: list[Optional[PredictionResult]] = []
        for path in video_paths:
            try:
                results.append(self.predict(path))
            except Exception as exc:  # noqa: BLE001
                print(f"[SuspectIQ] Warning – skipping {path!r}: {exc}")
                results.append(None)

        return results

    def set_threshold(self, threshold: float) -> None:
        """
        Adjust the decision threshold at runtime.

        Parameters
        ----------
        threshold : float
            New threshold in the range ``[0, 1]``. Lower values make the
            detector more sensitive (more SUSPICIOUS predictions).
        """
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("Threshold must be between 0.0 and 1.0.")
        self.threshold = threshold
