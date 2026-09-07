# AstroLens YOLO Model Directory

Place your trained YOLO model file (`best.pt`) in this directory (`api/ml/model/best.pt`).

## Automated Model Training

You can automatically generate a synthetic astronomy dataset and train a real YOLO model by running:

```bash
python api/ml/train_astronomy_yolo.py
```

This script will:
1. Generate synthetic dark sky images containing Moon, Jupiter, Saturn, Mars, Star, Nebula, and Galaxy objects with YOLO labels.
2. Train a YOLOv8 model using `ultralytics`.
3. Save the resulting weights directly to `api/ml/model/best.pt`.

Once `best.pt` exists in this folder, AstroLens automatically loads and runs inference with `YOLODetector`.

