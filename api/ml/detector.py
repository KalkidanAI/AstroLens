"""
AstroLens Astronomical Object Detector (Ultralytics YOLO Architecture)
Supports AstronomyDetector & AstroDetector wrappers, pretrained/custom YOLO models,
and fallback MockDetector with target classes: Moon, Mercury, Venus, Mars, Jupiter, Saturn, Star, Nebula, Galaxy.
"""

import os
import random
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('AstroLens.ML')

YOLO_MODEL_PATH = os.getenv('YOLO_MODEL_PATH', os.path.join(os.path.dirname(__file__), 'model', 'best.pt'))
INITIAL_CLASSES = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Star', 'Nebula', 'Galaxy']


class MockDetector:
    """
    MOCK / DEMO Astronomy Detector.
    Generates simulated detection results when physical ML model or hardware is unavailable.
    """

    def __init__(self):
        self.classes = INITIAL_CLASSES

    def detect(self, image, target_hint="Jupiter"):
        """Returns 1-3 random detections formatted for AstroLens pipeline."""
        height, width = image.shape[:2] if hasattr(image, 'shape') else (720, 1280)

        # Primary detection matches target hint or Jupiter
        main_class = target_hint if target_hint in self.classes else "Jupiter"
        confidence = round(random.uniform(0.88, 0.97), 2)

        box_w = random.randint(80, 140)
        box_h = random.randint(80, 140)
        x1 = (width - box_w) // 2
        y1 = (height - box_h) // 2

        detections = [{
            "class": main_class,
            "class_name": main_class,
            "confidence": confidence,
            "bbox": {
                "x": x1,
                "y": y1,
                "width": box_w,
                "height": box_h,
                "x1": x1,
                "y1": y1,
                "x2": x1 + box_w,
                "y2": y1 + box_h
            },
            "is_mock": True
        }]

        # Optional second star/secondary object detection
        if random.random() > 0.4:
            sec_class = random.choice(['Star', 'Moon', 'Saturn'])
            sec_w, sec_h = random.randint(30, 70), random.randint(30, 70)
            sec_x1 = random.randint(20, width - sec_w - 20)
            sec_y1 = random.randint(20, height - sec_h - 20)
            detections.append({
                "class": sec_class,
                "class_name": sec_class,
                "confidence": round(random.uniform(0.75, 0.92), 2),
                "bbox": {
                    "x": sec_x1,
                    "y": sec_y1,
                    "width": sec_w,
                    "height": sec_h,
                    "x1": sec_x1,
                    "y1": sec_y1,
                    "x2": sec_x1 + sec_w,
                    "y2": sec_y1 + sec_h
                },
                "is_mock": True
            })

        return detections


class YOLODetector:
    """Wraps Ultralytics YOLO model for real astronomy object detection."""

    def __init__(self, model_path):
        self.model_path = model_path
        self.model = None

        if not os.path.exists(model_path):
            logger.warning(f"YOLO model file not found at {model_path}")
        else:
            try:
                from ultralytics import YOLO
                self.model = YOLO(model_path)
                logger.info(f"YOLO model loaded successfully from {model_path}")
            except ImportError:
                logger.warning("ultralytics package not installed. YOLODetector requires ultralytics.")
            except Exception as e:
                logger.warning(f"Failed to load YOLO model: {e}")

    def detect(self, image):
        if not self.model:
            return []

        height, width = image.shape[:2] if hasattr(image, 'shape') else (720, 1280)
        results = self.model(image)
        detections = []

        for result in results:
            boxes = result.boxes
            for i in range(len(boxes)):
                box = boxes[i]
                cls_idx = int(box.cls.item())
                conf = float(box.conf.item())
                xyxy = box.xyxy[0].tolist()

                class_name = result.names[cls_idx] if (result.names and cls_idx in result.names) else f"Class_{cls_idx}"
                x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])

                detections.append({
                    "class": class_name,
                    "class_name": class_name,
                    "confidence": round(conf, 2),
                    "bbox": {
                        "x": x1,
                        "y": y1,
                        "width": x2 - x1,
                        "height": y2 - y1,
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2
                    },
                    "is_mock": False
                })

        return detections


class AstronomyDetector:
    """Factory/Wrapper for detection models with graceful fallback."""

    def __init__(self, model_path=None):
        self.model_path = model_path or YOLO_MODEL_PATH
        self.model_name = "Mock Detector (DEMO)"
        self.is_mock = True

        if os.path.exists(self.model_path):
            try:
                yolo = YOLODetector(self.model_path)
                if yolo.model is not None:
                    self.detector = yolo
                    self.is_mock = False
                    self.model_name = "AstroLens YOLO (Trained)"
                else:
                    self.detector = MockDetector()
            except Exception as e:
                logger.warning(f"Fallback to MockDetector: {e}")
                self.detector = MockDetector()
        else:
            self.detector = MockDetector()

    def detect(self, image, target_hint="Jupiter"):
        """Runs object detection and returns structured API result."""
        height, width = image.shape[:2] if hasattr(image, 'shape') else (720, 1280)
        
        if self.is_mock:
            detections = self.detector.detect(image, target_hint=target_hint)
        else:
            detections = self.detector.detect(image)

        return {
            "success": True,
            "detections": detections,
            "is_mock": self.is_mock,
            "model_name": self.model_name,
            "timestamp": datetime.now().isoformat(),
            "image_width": width,
            "image_height": height,
            "count": len(detections)
        }

    def get_status(self):
        return {
            "model_name": self.model_name,
            "model_path": self.model_path,
            "is_mock": self.is_mock,
            "status": "ready" if not self.is_mock else "AI MODEL NOT INSTALLED (MOCK ACTIVE)"
        }


# Alias for backward compatibility
AstroDetector = AstronomyDetector
