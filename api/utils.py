import json
import os
import shutil
import tempfile
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
TMP_DATA_DIR = os.path.join(tempfile.gettempdir(), 'astrolens_data')  # For runtime writes (Windows & Vercel /tmp)

def get_data_path(filename, writable=False):
    """Get path to a data file. Use temp dir for writable files."""
    if writable:
        tmp_path = os.path.join(TMP_DATA_DIR, filename)
        src_path = os.path.join(DATA_DIR, filename)
        # Copy from source if tmp doesn't exist yet
        if not os.path.exists(tmp_path) and os.path.exists(src_path):
            os.makedirs(TMP_DATA_DIR, exist_ok=True)
            shutil.copy2(src_path, tmp_path)
        return tmp_path
    return os.path.join(DATA_DIR, filename)

def load_json(filename):
    """Load a JSON file from runtime temp dir if modified, otherwise from data directory."""
    tmp_path = os.path.join(TMP_DATA_DIR, filename)
    if os.path.exists(tmp_path):
        path = tmp_path
    else:
        path = get_data_path(filename)
    
    if not os.path.exists(path):
        return [] if filename.endswith('s.json') else {}
        
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filename, data):
    """Save data to a JSON file in temp dir (Vercel & local development compatible)."""
    path = get_data_path(filename, writable=True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, default=str)
    return path

def generate_id(prefix=''):
    """Generate a unique ID."""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
    return f"{prefix}_{timestamp}" if prefix else timestamp

