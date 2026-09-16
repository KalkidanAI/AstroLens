"""
AstroLens Camera Service Abstraction
Supports MockCamera (synthetic demo scene), OpenCVCamera (USB/webcam/video),
and provides clean frame capture and status interfaces.
"""

import os
import base64
import random
import logging
import io
import numpy as np
from PIL import Image, ImageDraw
from dotenv import load_dotenv

try:
    import cv2
except Exception:
    cv2 = None

load_dotenv()

logger = logging.getLogger('AstroLens.Camera')

CAMERA_MODE = os.getenv('CAMERA_MODE', 'mock').lower()


class MockCamera:
    """
    Mock Camera Feed Generator.
    Generates synthetic astronomical frame data for demo, testing, and offline modes.
    """

    def __init__(self):
        self.mode = "mock"
        self.connected = True
        self.source = "demo"
        self.width = 1920
        self.height = 1080
        self.fps = 30
        self.status = "CONNECTED"

    def connect(self, source="demo"):
        self.source = source
        self.connected = True
        self.status = "CONNECTED"
        return {
            "success": True,
            "status": "CONNECTED",
            "mode": "mock",
            "source": self.source,
            "resolution": f"{self.width}x{self.height}",
            "fps": self.fps
        }

    def disconnect(self):
        self.connected = False
        self.status = "DISCONNECTED"
        return {"success": True, "status": "DISCONNECTED", "mode": "mock"}

    def get_status(self):
        return {
            "success": True,
            "connected": self.connected,
            "status": self.status,
            "mode": self.mode,
            "source": self.source,
            "resolution": f"{self.width}x{self.height}",
            "fps": self.fps,
            "is_mock": True
        }

    def generate_demo_frame(self, target_name="Jupiter"):
        """Generates a synthetic astronomical frame image array (BGR)."""
        if cv2 is not None:
            img = np.zeros((720, 1280, 3), dtype=np.uint8)

            # Gradient dark sky
            for y in range(720):
                val = int(10 + (y / 720.0) * 15)
                img[y, :, 0] = val + 5  # B
                img[y, :, 1] = val      # G
                img[y, :, 2] = val + 2  # R

            # Random background stars
            random.seed(42)  # Consistent field
            for _ in range(120):
                sx = random.randint(0, 1279)
                sy = random.randint(0, 719)
                cv2.circle(img, (sx, sy), 1, (240, 240, 255), -1)

            # Render Jupiter target
            cx, cy = 640, 360
            r = 45
            cv2.circle(img, (cx, cy), r, (158, 208, 244), -1)  # Yellowish body
            cv2.ellipse(img, (cx, cy), (r, 8), 0, 0, 360, (100, 140, 200), 3)  # Band
            cv2.ellipse(img, (cx, cy - 12), (r - 4, 6), 0, 0, 360, (120, 160, 210), 2)  # Band 2

            # Draw moons (Galilean moons)
            cv2.circle(img, (cx - 90, cy + 5), 4, (220, 220, 240), -1)
            cv2.circle(img, (cx - 150, cy - 8), 3, (200, 200, 220), -1)
            cv2.circle(img, (cx + 110, cy + 12), 5, (230, 230, 250), -1)

            return img
        else:
            # High-performance PIL fallback without requiring OpenCV
            pil_img = Image.new('RGB', (1280, 720), color=(15, 12, 17))
            draw = ImageDraw.Draw(pil_img)
            random.seed(42)
            for _ in range(120):
                sx = random.randint(0, 1279)
                sy = random.randint(0, 719)
                draw.point((sx, sy), fill=(240, 240, 255))

            cx, cy, r = 640, 360, 45
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(244, 208, 158))
            draw.ellipse([cx - r, cy - 8, cx + r, cy + 8], outline=(200, 140, 100), width=3)
            draw.ellipse([cx - 94, cy + 1, cx - 86, cy + 9], fill=(240, 220, 220))
            draw.ellipse([cx - 153, cy - 11, cx - 147, cy - 5], fill=(220, 200, 200))
            draw.ellipse([cx + 105, cy + 7, cx + 115, cy + 17], fill=(250, 230, 230))
            return np.array(pil_img)[:, :, ::-1]

    def capture_frame(self, target_name="Jupiter"):
        """Captures frame and returns Base64 encoded string and OpenCV image array."""
        frame = self.generate_demo_frame(target_name)
        if cv2 is not None:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            b64_str = base64.b64encode(buffer).decode('utf-8')
        else:
            rgb_frame = frame[:, :, ::-1] if len(frame.shape) == 3 else frame
            pil_img = Image.fromarray(rgb_frame)
            buf = io.BytesIO()
            pil_img.save(buf, format='JPEG', quality=85)
            b64_str = base64.b64encode(buf.getvalue()).decode('utf-8')

        return {
            "success": True,
            "mode": "mock",
            "source": self.source,
            "width": 1280,
            "height": 720,
            "image_b64": b64_str,
            "frame": frame
        }


class OpenCVCamera:
    """
    OpenCV Direct USB/Webcam Capture Driver.
    Interface for live hardware camera feeds.
    """

    def __init__(self, device_index=0):
        self.mode = "opencv"
        self.device_index = device_index
        self.cap = None
        self.connected = False

    def connect(self, source="webcam"):
        try:
            dev_idx = 0 if source == "webcam" else int(source) if str(source).isdigit() else 0
            self.cap = cv2.VideoCapture(dev_idx)
            if self.cap.isOpened():
                self.connected = True
                return {"success": True, "status": "CONNECTED", "mode": "opencv", "source": source}
        except Exception as e:
            logger.error(f"OpenCV camera connection error: {e}")

        self.connected = False
        return {"success": False, "status": "ERROR", "error": "Camera device not available"}

    def disconnect(self):
        if self.cap:
            self.cap.release()
            self.cap = None
        self.connected = False
        return {"success": True, "status": "DISCONNECTED"}

    def get_status(self):
        return {
            "success": self.connected,
            "connected": self.connected,
            "mode": self.mode,
            "is_mock": False
        }

    def capture_frame(self, target_name=None):
        if not self.connected or not self.cap:
            return {"success": False, "error": "Camera disconnected"}

        ret, frame = self.cap.read()
        if not ret or frame is None:
            return {"success": False, "error": "Failed to read camera frame"}

        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64_str = base64.b64encode(buffer).decode('utf-8')
        return {
            "success": True,
            "mode": "opencv",
            "width": frame.shape[1],
            "height": frame.shape[0],
            "image_b64": b64_str,
            "frame": frame
        }


class CameraService:
    """Factory service manager for camera feeds."""

    def __init__(self, mode=None):
        self.mode = (mode or CAMERA_MODE).lower()
        self.camera = OpenCVCamera() if self.mode in ['opencv', 'usb', 'hardware'] else MockCamera()

    def get_status(self):
        return self.camera.get_status()

    def connect(self, source="demo"):
        src = str(source).lower()
        if src in ['webcam', 'usb', 'camera', '0', '1']:
            self.camera = OpenCVCamera()
            res = self.camera.connect(src)
            if not res.get("success"):
                logger.warning("Physical camera device unavailable, switching to browser WebRTC stream mode")
                self.camera = MockCamera()
                return self.camera.connect(source)
            return res
        else:
            self.camera = MockCamera()
            return self.camera.connect(source)

    def disconnect(self):
        return self.camera.disconnect()

    def capture_frame(self, target_name="Jupiter"):
        return self.camera.capture_frame(target_name)

