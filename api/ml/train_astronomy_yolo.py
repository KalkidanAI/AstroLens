"""
AstroLens Synthetic Dataset Generator & YOLO Model Trainer
Generates synthetic astronomical images (Moon, Jupiter, Saturn, Mars, Star, Nebula, Galaxy)
and trains a real YOLO model using Ultralytics, placing the trained weights in api/ml/model/best.pt.
"""

import os
import sys
import random
import shutil
import logging
import numpy as np
import cv2

logging.basicConfig(level=logging.INFO, format='[AstroTrainer] %(message)s')

# Class mapping
CLASSES = ['moon', 'jupiter', 'saturn', 'mars', 'star', 'nebula', 'galaxy']
CLASS_MAP = {name: idx for idx, name in enumerate(CLASSES)}

# Directory setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'model')
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')

def create_synthetic_image(width=640, height=640):
    """Generates a synthetic dark sky image with stars, nebulae, and celestial targets with bounding boxes."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    
    # 1. Dark sky radial gradient
    center_x, center_y = width // 2, height // 2
    y_coords, x_coords = np.ogrid[:height, :width]
    dist_from_center = np.sqrt((x_coords - center_x)**2 + (y_coords - center_y)**2)
    max_dist = np.sqrt(center_x**2 + center_y**2)
    bg_val = (1.0 - (dist_from_center / max_dist) * 0.5) * 15
    img[:, :, 0] = bg_val.astype(np.uint8) + random.randint(2, 8) # B
    img[:, :, 1] = bg_val.astype(np.uint8) + random.randint(1, 5) # G
    img[:, :, 2] = bg_val.astype(np.uint8) + random.randint(3, 10) # R
    
    # 2. Random background stars
    num_stars = random.randint(80, 200)
    for _ in range(num_stars):
        sx = random.randint(0, width - 1)
        sy = random.randint(0, height - 1)
        brightness = random.randint(150, 255)
        color = (brightness, brightness, random.randint(200, 255))
        cv2.circle(img, (sx, sy), random.choice([1, 1, 1, 2]), color, -1)
        
    bboxes = []
    num_objects = random.randint(1, 3)
    
    # Pick random distinct objects
    selected_classes = random.sample(CLASSES, num_objects)
    
    for cls_name in selected_classes:
        cls_id = CLASS_MAP[cls_name]
        
        # Determine size and coordinates
        box_w = random.randint(40, 110)
        box_h = random.randint(40, 110)
        
        # Avoid edge overflow
        x1 = random.randint(10, width - box_w - 10)
        y1 = random.randint(10, height - box_h - 10)
        cx, cy = x1 + box_w // 2, y1 + box_h // 2
        
        # Render object on image
        if cls_name == 'moon':
            r = min(box_w, box_h) // 2
            cv2.circle(img, (cx, cy), r, (220, 220, 210), -1)
            cv2.circle(img, (cx - r//3, cy - r//4), max(2, r//4), (170, 170, 160), -1)
            cv2.circle(img, (cx + r//4, cy + r//3), max(2, r//5), (180, 180, 170), -1)
        elif cls_name == 'jupiter':
            r = min(box_w, box_h) // 2
            cv2.circle(img, (cx, cy), r, (158, 208, 244), -1) # BGR yellowish/orange
            cv2.ellipse(img, (cx, cy), (r, max(2, r//5)), 0, 0, 360, (100, 140, 200), 2)
        elif cls_name == 'saturn':
            r = min(box_w, box_h) // 3
            cv2.circle(img, (cx, cy), r, (200, 230, 245), -1)
            cv2.ellipse(img, (cx, cy), (box_w//2, max(3, r//2)), -15, 0, 360, (180, 210, 230), 3)
        elif cls_name == 'mars':
            r = min(box_w, box_h) // 2
            cv2.circle(img, (cx, cy), r, (60, 80, 220), -1) # Reddish
        elif cls_name == 'star':
            r = min(box_w, box_h) // 4
            cv2.circle(img, (cx, cy), max(3, r), (255, 255, 255), -1)
            cv2.line(img, (cx - r*2, cy), (cx + r*2, cy), (255, 255, 255), 1)
            cv2.line(img, (cx, cy - r*2), (cx, cy + r*2), (255, 255, 255), 1)
        elif cls_name == 'nebula':
            r = min(box_w, box_h) // 2
            overlay = img.copy()
            cv2.circle(overlay, (cx, cy), r, (255, 120, 180), -1) # Magenta/Purple
            cv2.addWeighted(overlay, 0.4, img, 0.6, 0, img)
        elif cls_name == 'galaxy':
            r_x = box_w // 2
            r_y = box_h // 4
            overlay = img.copy()
            cv2.ellipse(overlay, (cx, cy), (r_x, r_y), 30, 0, 360, (230, 180, 120), -1)
            cv2.addWeighted(overlay, 0.5, img, 0.5, 0, img)
            
        # YOLO normalized bounding box [class_id, x_center, y_center, width, height]
        norm_cx = (x1 + box_w / 2.0) / width
        norm_cy = (y1 + box_h / 2.0) / height
        norm_w = box_w / float(width)
        norm_h = box_h / float(height)
        
        bboxes.append(f"{cls_id} {norm_cx:.6f} {norm_cy:.6f} {norm_w:.6f} {norm_h:.6f}")
        
    return img, bboxes

def generate_dataset(num_train=40, num_val=10):
    """Creates directory structure and generates dataset images and label files."""
    logging.info("Generating synthetic astronomical dataset...")
    
    train_img_dir = os.path.join(DATASET_DIR, 'images', 'train')
    val_img_dir = os.path.join(DATASET_DIR, 'images', 'val')
    train_lbl_dir = os.path.join(DATASET_DIR, 'labels', 'train')
    val_lbl_dir = os.path.join(DATASET_DIR, 'labels', 'val')
    
    os.makedirs(train_img_dir, exist_ok=True)
    os.makedirs(val_img_dir, exist_ok=True)
    os.makedirs(train_lbl_dir, exist_ok=True)
    os.makedirs(val_lbl_dir, exist_ok=True)
    
    # Generate train
    for i in range(num_train):
        img, bboxes = create_synthetic_image()
        img_name = f"astro_train_{i:04d}"
        cv2.imwrite(os.path.join(train_img_dir, f"{img_name}.jpg"), img)
        with open(os.path.join(train_lbl_dir, f"{img_name}.txt"), 'w') as f:
            f.write("\n".join(bboxes))
            
    # Generate val
    for i in range(num_val):
        img, bboxes = create_synthetic_image()
        img_name = f"astro_val_{i:04d}"
        cv2.imwrite(os.path.join(val_img_dir, f"{img_name}.jpg"), img)
        with open(os.path.join(val_lbl_dir, f"{img_name}.txt"), 'w') as f:
            f.write("\n".join(bboxes))
            
    # Create dataset.yaml
    yaml_content = f"""path: {os.path.abspath(DATASET_DIR)}
train: images/train
val: images/val

names:
"""
    for idx, name in enumerate(CLASSES):
        yaml_content += f"  {idx}: {name}\n"
        
    yaml_path = os.path.join(DATASET_DIR, 'dataset.yaml')
    with open(yaml_path, 'w') as f:
        f.write(yaml_content)
        
    logging.info(f"Dataset generated successfully at {DATASET_DIR}")
    return yaml_path

def train_yolo():
    """Trains YOLO model on the generated dataset and saves to api/ml/model/best.pt."""
    try:
        from ultralytics import YOLO
    except ImportError:
        logging.error("ultralytics package is not installed! Run: pip install ultralytics")
        return False
        
    yaml_path = generate_dataset(num_train=50, num_val=10)
    
    logging.info("Starting Ultralytics YOLO training...")
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # Load base model (YOLOv8 nano)
    model = YOLO('yolov8n.pt')
    
    # Train
    results = model.train(
        data=yaml_path,
        epochs=8,
        imgsz=320,
        batch=8,
        project=os.path.join(BASE_DIR, 'runs'),
        name='astrolens_yolo',
        exist_ok=True,
        verbose=True
    )
    
    # Best model path
    trained_best = os.path.join(BASE_DIR, 'runs', 'astrolens_yolo', 'weights', 'best.pt')
    target_best = os.path.join(MODEL_DIR, 'best.pt')
    
    if os.path.exists(trained_best):
        shutil.copy2(trained_best, target_best)
        logging.info(f"SUCCESS! Trained YOLO model saved to: {target_best}")
        return True
    else:
        logging.error("Training completed but best.pt was not found.")
        return False

if __name__ == '__main__':
    train_yolo()
