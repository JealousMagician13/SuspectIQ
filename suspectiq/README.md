# SuspectIQ

> Video anomaly / suspicious-activity detection in one line.

## Installation

```bash
pip install .          # from the cloned repo
# or, once published:
pip install suspectiq
```

**Requirements:** Python ≥ 3.9, TensorFlow ≥ 2.12, OpenCV, NumPy.

---

## Quick start

```python
from suspectiq import SuspectIQ

# Load once – models are lazy-loaded on the first predict() call
detector = SuspectIQ("best_model_ucf.keras")

result = detector.predict("clip.mp4")

print(result.label)       # "NORMAL" or "SUSPICIOUS"
print(result.confidence)  # confidence for the predicted class
print(result.probability) # raw model probability (SUSPICIOUS)
```

---

## API reference

### `SuspectIQ(model_path, threshold=0.325, num_frames=16, img_size=224)`

| Parameter    | Type    | Default | Description                                      |
|--------------|---------|---------|--------------------------------------------------|
| `model_path` | `str`   | —       | Path to the `.keras` temporal model file.        |
| `threshold`  | `float` | `0.325` | Decision boundary for SUSPICIOUS classification. |
| `num_frames` | `int`   | `16`    | Frames sampled per clip.                         |
| `img_size`   | `int`   | `224`   | Frame resize dimension (height = width).         |

---

### `detector.predict(video_path) → PredictionResult`

Classify a single video file.

```python
result = detector.predict("footage.mp4")
```

Returns a `PredictionResult` with:
- `result.label`       – `"NORMAL"` or `"SUSPICIOUS"`
- `result.confidence`  – confidence for the winning class (0 – 1)
- `result.probability` – raw SUSPICIOUS probability from the model

---

### `detector.predict_batch(video_paths) → list[PredictionResult | None]`

Classify multiple videos. Failed videos return `None`.

```python
results = detector.predict_batch(["a.mp4", "b.mp4", "c.mp4"])
for path, result in zip(paths, results):
    if result:
        print(f"{path}: {result.label} ({result.confidence:.2%})")
```

---

### `detector.set_threshold(threshold)`

Adjust sensitivity at runtime without reloading models.

```python
detector.set_threshold(0.5)   # stricter – fewer SUSPICIOUS flags
detector.set_threshold(0.2)   # more sensitive – more SUSPICIOUS flags
```

---

## PredictionResult

```python
@dataclass
class PredictionResult:
    label: str        # "NORMAL" | "SUSPICIOUS"
    confidence: float # confidence for the predicted class
    probability: float # raw model output (P(SUSPICIOUS))
```

---

## Model architecture

| Stage          | Component                         |
|----------------|-----------------------------------|
| Frame sampling | OpenCV – first `num_frames` frames|
| Feature extractor | ResNet50 (ImageNet, frozen)    |
| Temporal model | Custom model with TemporalAttention|
| Output         | Sigmoid → threshold → label       |
