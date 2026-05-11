"""
Unit tests for SuspectIQ.
Run with:  pytest tests/
"""

import pytest
from unittest.mock import MagicMock, patch
import numpy as np

from suspectiq import SuspectIQ, PredictionResult


# ---------------------------------------------------------------------------
# PredictionResult
# ---------------------------------------------------------------------------

def test_prediction_result_repr():
    r = PredictionResult(label="SUSPICIOUS", confidence=0.85, probability=0.85)
    assert "SUSPICIOUS" in repr(r)
    assert "0.8500" in repr(r)


# ---------------------------------------------------------------------------
# SuspectIQ – constructor
# ---------------------------------------------------------------------------

def test_default_params():
    d = SuspectIQ("model.keras")
    assert d.threshold == 0.325
    assert d.num_frames == 16
    assert d.img_size == 224


def test_custom_params():
    d = SuspectIQ("model.keras", threshold=0.5, num_frames=8, img_size=112)
    assert d.threshold == 0.5
    assert d.num_frames == 8
    assert d.img_size == 112


# ---------------------------------------------------------------------------
# set_threshold
# ---------------------------------------------------------------------------

def test_set_threshold_valid():
    d = SuspectIQ("model.keras")
    d.set_threshold(0.6)
    assert d.threshold == 0.6


def test_set_threshold_invalid():
    d = SuspectIQ("model.keras")
    with pytest.raises(ValueError, match="between 0.0 and 1.0"):
        d.set_threshold(1.5)


# ---------------------------------------------------------------------------
# predict – missing video file
# ---------------------------------------------------------------------------

def test_predict_missing_video(tmp_path):
    d = SuspectIQ("model.keras")
    d._temporal_model = MagicMock()  # skip model loading
    d._backbone = MagicMock()

    with pytest.raises(FileNotFoundError):
        d._read_frames(str(tmp_path / "nonexistent.mp4"))


# ---------------------------------------------------------------------------
# predict – empty frame list raises ValueError
# ---------------------------------------------------------------------------

def test_predict_empty_frames():
    d = SuspectIQ("model.keras")
    d._temporal_model = MagicMock()
    d._backbone = MagicMock()

    with patch.object(d, "_load_models"), \
         patch.object(d, "_read_frames", return_value=[]):
        with pytest.raises(ValueError, match="Could not read any frames"):
            d.predict("fake.mp4")


# ---------------------------------------------------------------------------
# predict – normal flow
# ---------------------------------------------------------------------------

def _make_fake_frame(h=224, w=224):
    return np.zeros((h, w, 3), dtype=np.uint8)


def test_predict_suspicious():
    d = SuspectIQ("model.keras", threshold=0.325)
    d._temporal_model = MagicMock()
    d._backbone = MagicMock()

    fake_frames = [_make_fake_frame() for _ in range(16)]

    with patch.object(d, "_load_models"), \
         patch.object(d, "_read_frames", return_value=fake_frames), \
         patch.object(d, "_infer", return_value=0.9):
        result = d.predict("fake.mp4")

    assert result.label == "SUSPICIOUS"
    assert result.probability == pytest.approx(0.9)
    assert result.confidence == pytest.approx(0.9)


def test_predict_normal():
    d = SuspectIQ("model.keras", threshold=0.325)
    d._temporal_model = MagicMock()
    d._backbone = MagicMock()

    fake_frames = [_make_fake_frame() for _ in range(16)]

    with patch.object(d, "_load_models"), \
         patch.object(d, "_read_frames", return_value=fake_frames), \
         patch.object(d, "_infer", return_value=0.1):
        result = d.predict("fake.mp4")

    assert result.label == "NORMAL"
    assert result.confidence == pytest.approx(0.9)   # 1 - 0.1


# ---------------------------------------------------------------------------
# predict_batch
# ---------------------------------------------------------------------------

def test_predict_batch_partial_failure():
    d = SuspectIQ("model.keras")

    call_count = 0

    def mock_predict(path):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise ValueError("bad video")
        return PredictionResult("NORMAL", 0.9, 0.1)

    with patch.object(d, "_load_models"), \
         patch.object(d, "predict", side_effect=mock_predict):
        results = d.predict_batch(["a.mp4", "b.mp4", "c.mp4"])

    assert results[0] is not None
    assert results[1] is None  # failed video → None
    assert results[2] is not None
