import sys, traceback
import urllib.parse
from flask import Flask, request

app = Flask(__name__)

failed_step = None

# Step 1: numpy
try:
    import numpy as np
except Exception:
    failed_step = f"numpy error: {traceback.format_exc()}"

# Step 2: PIL
if not failed_step:
    try:
        from PIL import Image, ImageDraw
    except Exception:
        failed_step = f"PIL error: {traceback.format_exc()}"

# Step 3: utils
if not failed_step:
    try:
        from api.utils import load_json, save_json, generate_id
    except Exception:
        try:
            from utils import load_json, save_json, generate_id
        except Exception:
            failed_step = f"utils error: {traceback.format_exc()}"

# Step 4: detector
if not failed_step:
    try:
        from api.ml.detector import AstronomyDetector
    except Exception:
        try:
            from ml.detector import AstronomyDetector
        except Exception:
            failed_step = f"detector error: {traceback.format_exc()}"

# Step 5: camera
if not failed_step:
    try:
        from api.services.camera import CameraService
    except Exception:
        try:
            from services.camera import CameraService
        except Exception:
            failed_step = f"camera error: {traceback.format_exc()}"

# Step 6: auth
if not failed_step:
    try:
        from api.services.auth import AuthService
    except Exception:
        try:
            from services.auth import AuthService
        except Exception:
            failed_step = f"auth error: {traceback.format_exc()}"

# Step 7: telescope, astronomy, verification, stellarium
if not failed_step:
    try:
        from api.services.telescope import TelescopeService
        from api.services.astronomy import AstronomyService
        from api.services.verification import VerificationService
        from api.services.stellarium import StellariumService
    except Exception:
        try:
            from services.telescope import TelescopeService
            from services.astronomy import AstronomyService
            from services.verification import VerificationService
            from services.stellarium import StellariumService
        except Exception:
            failed_step = f"services error: {traceback.format_exc()}"

class VercelPathMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        query_string = environ.get('QUERY_STRING', '')
        if '__path=' in query_string:
            parsed = urllib.parse.parse_qs(query_string, keep_blank_values=True)
            if '__path' in parsed:
                targets = parsed.pop('__path')
                target = targets[0] if targets else ''
                environ['PATH_INFO'] = '/' + target.lstrip('/')
                environ['QUERY_STRING'] = urllib.parse.urlencode(parsed, doseq=True)
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

@app.route('/')
@app.route('/<path:path>')
def check(path=''):
    if failed_step:
        return f"<h1>Diagnostic Error at Step:</h1><pre>{failed_step}</pre>", 500
    return f"<h1>All imports and steps succeeded!</h1><p>Path: /{path}</p>", 200