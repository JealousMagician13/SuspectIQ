"""
SuspectIQ – Video anomaly / suspicious-activity detection library.

Quick start
-----------
>>> from suspectiq import SuspectIQ
>>> detector = SuspectIQ("best_model_ucf.keras")
>>> result = detector.predict("clip.mp4")
>>> print(result.label, result.confidence)
"""

from .detector import PredictionResult, SuspectIQ
from .layers import TemporalAttention

__all__ = ["SuspectIQ", "PredictionResult", "TemporalAttention"]
__version__ = "1.0.2"
