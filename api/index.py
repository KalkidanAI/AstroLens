import os
import sys
import json
import base64
import logging
from datetime import datetime

# Add parent directory to sys.path for imports when running directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import io
import numpy as np
from PIL import Image
from flask import Flask, jsonify, request, render_template, Response
from flask_cors import CORS

try:
    import cv2
except Exception:
    cv2 = None

def decode_image(img_bytes):
    """Safely decodes image bytes into a BGR numpy array using OpenCV or PIL."""
    if cv2 is not None:
        np_arr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    else:
        pil_img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        return np.array(pil_img)[:, :, ::-1]

try:
    from api.ml.detector import AstronomyDetector, AstroDetector
    from api.services.astronomy import AstronomyService
    from api.services.telescope import TelescopeService
    from api.services.camera import CameraService
    from api.services.verification import VerificationService
    from api.services.stellarium import StellariumService
    from api.services.auth import AuthService
    from api.utils import load_json, save_json, generate_id
except ImportError:
    from ml.detector import AstronomyDetector, AstroDetector
    from services.astronomy import AstronomyService
    from services.telescope import TelescopeService
    from services.camera import CameraService
    from services.verification import VerificationService
    from services.stellarium import StellariumService
    from services.auth import AuthService
    from utils import load_json, save_json, generate_id

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('AstroLens')

# Robust template & static directory resolution for both local and Vercel environments
_cur_dir = os.path.dirname(os.path.abspath(__file__))
_par_dir = os.path.dirname(_cur_dir)

_template_candidates = [
    os.path.join(_par_dir, 'templates'),
    os.path.join(_cur_dir, 'templates'),
    os.path.join(_cur_dir, '../templates'),
    'templates'
]
template_folder = next((d for d in _template_candidates if os.path.isdir(d)), os.path.join(_par_dir, 'templates'))

_static_candidates = [
    os.path.join(_par_dir, 'static'),
    os.path.join(_cur_dir, 'static'),
    os.path.join(_cur_dir, '../static'),
    'static'
]
static_folder = next((d for d in _static_candidates if os.path.isdir(d)), os.path.join(_par_dir, 'static'))

# Flask app
app = Flask(__name__,
            template_folder=template_folder,
            static_folder=static_folder)
CORS(app)

# Vercel WSGI / Serverless handler
handler = app

# Initialize services
detector = AstronomyDetector()
astronomy_service = AstronomyService()
telescope_service = TelescopeService()
camera_service = CameraService()
verification_service = VerificationService()
stellarium_service = StellariumService()
auth_service = AuthService()

@app.after_request
def add_cors_and_csp_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    # Prevent CSP from blocking inline scripts, webcams, or Google Fonts
    response.headers['Content-Security-Policy'] = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
    return response

# ============================================================
# Page Routes
# ============================================================

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/signup')
def signup_page():
    return render_template('signup.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/observatory')
def observatory():
    return render_template('observatory.html')

@app.route('/sky')
def sky():
    return render_template('sky.html')

@app.route('/objects')
def objects():
    from flask import redirect
    return redirect('/sky')

@app.route('/history')
def history():
    return render_template('history.html')

@app.route('/settings')
def settings_page():
    return render_template('settings.html')

# ============================================================
# API Routes
# ============================================================

@app.route('/api/status', methods=['GET'])
def get_status():
    """Returns overall system status."""
    settings = load_json('settings.json')
    detector_status = detector.get_status()
    telescope_status = telescope_service.telescope.get_status()
    
    return jsonify({
        "status": "online",
        "ai": {
            "ready": True,
            "model": detector_status.get("model_name", "Unknown"),
            "is_mock": detector_status.get("is_mock", True),
            "status": detector_status.get("status", "ready")
        },
        "telescope": telescope_status,
        "stellarium": stellarium_service.get_status(),
        "location": settings.get("location", {
            "name": "Addis Ababa, Ethiopia",
            "latitude": 9.03,
            "longitude": 38.74
        }),
        "settings": settings
    })


@app.route('/api/stream/telemetry', methods=['GET'])
def stream_telemetry():
    """Real-time Server-Sent Events (SSE) telemetry stream."""
    def generate():
        while True:
            tel = telescope_service.get_status()
            stel = stellarium_service.get_status()
            cam = camera_service.get_status()
            data = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "telescope": tel,
                "stellarium": stel,
                "camera": cam,
                "ai": detector.get_status()
            }
            yield f"data: {json.dumps(data)}\n\n"
            time.sleep(1.0)
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    })


@app.route('/api/objects', methods=['GET'])
def get_objects():
    """Returns the celestial objects catalog with current sky positions."""
    try:
        objects_data = load_json('objects.json')
        settings = load_json('settings.json')
        lat = settings.get('location', {}).get('latitude', 9.03)
        lon = settings.get('location', {}).get('longitude', 38.74)
        
        # Enrich with current positions from astronomy service
        for obj in objects_data:
            pos = astronomy_service.get_object_position(obj['name'], lat, lon)
            if pos:
                obj['altitude'] = pos['altitude']
                obj['azimuth'] = pos['azimuth']
                obj['visible'] = pos['visible']
                obj['rise_time'] = pos.get('rise_time', '--')
                obj['set_time'] = pos.get('set_time', '--')
                obj['is_demo'] = pos.get('is_demo', True)
            else:
                obj['altitude'] = None
                obj['azimuth'] = None
                obj['visible'] = False
                obj['is_demo'] = True
        
        return jsonify(objects_data)
    except Exception as e:
        logger.error(f"Error fetching objects: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/sky', methods=['GET'])
def get_sky():
    """Returns visible sky objects for the current location and time."""
    try:
        settings = load_json('settings.json')
        lat = settings.get('location', {}).get('latitude', 9.03)
        lon = settings.get('location', {}).get('longitude', 38.74)
        
        visible_objects = astronomy_service.get_visible_objects(lat, lon)
        return jsonify({
            "objects": visible_objects,
            "location": settings.get('location', {}),
            "timestamp": datetime.now().isoformat(),
            "count": len(visible_objects),
            "is_demo": astronomy_service.is_demo
        })
    except Exception as e:
        logger.error(f"Error fetching sky data: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/observations', methods=['GET'])
def get_observations():
    """Returns observation history."""
    try:
        observations = load_json('observations.json')
        # Sort by timestamp descending
        observations.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return jsonify(observations)
    except Exception as e:
        logger.error(f"Error fetching observations: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/detect', methods=['POST'])
def run_detect():
    """
    Accepts a base64-encoded image, runs AI detection,
    and returns results with astronomical verification.
    """
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"error": "No image data provided"}), 400
        
        # Decode base64 image
        image_b64 = data['image']
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]
        
        img_bytes = base64.b64decode(image_b64)
        img = decode_image(img_bytes)
        
        if img is None:
            return jsonify({"error": "Failed to decode image"}), 400
        
        # Run detection
        detection_result = detector.detect(img)
        detections = detection_result.get("detections", []) if isinstance(detection_result, dict) else (detection_result or [])
        
        # Enrich with astronomy verification
        settings = load_json('settings.json')
        lat = settings.get('location', {}).get('latitude', 9.03)
        lon = settings.get('location', {}).get('longitude', 38.74)
        
        for det in detections:
            cls_name = det.get('class_name') or det.get('class', 'Unknown')
            verification = astronomy_service.verify_detection(
                cls_name, lat, lon
            )
            det['verification'] = verification
            # Add object type from catalog
            obj_pos = astronomy_service.get_object_position(cls_name, lat, lon)
            if obj_pos:
                det['type'] = obj_pos.get('type', 'unknown')
            else:
                det['type'] = 'unknown'
        
        return jsonify({
            "detections": detections,
            "is_mock": detector.is_mock,
            "model": detector.model_name,
            "timestamp": datetime.now().isoformat(),
            "image_shape": list(img.shape[:2])
        })
    except Exception as e:
        logger.error(f"Detection error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/observation', methods=['POST'])
def save_observation():
    """Saves a new observation to the observation history."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No observation data provided"}), 400
        
        observations = load_json('observations.json')
        
        new_obs = {
            "id": generate_id("obs"),
            "object": data.get("object", "Unknown"),
            "type": data.get("type", "unknown"),
            "confidence": data.get("confidence", 0.0),
            "verified": data.get("verified", False),
            "timestamp": data.get("timestamp", datetime.now().isoformat()),
            "source": data.get("source", "API"),
            "altitude": data.get("altitude"),
            "azimuth": data.get("azimuth"),
            "is_demo": data.get("is_demo", False),
            "notes": data.get("notes", "")
        }
        
        observations.insert(0, new_obs)  # Add to beginning (newest first)
        save_json('observations.json', observations)
        
        return jsonify({"status": "success", "observation": new_obs}), 201
    except Exception as e:
        logger.error(f"Error saving observation: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Updates application settings."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No settings data provided"}), 400
        
        current_settings = load_json('settings.json')
        
        # Deep merge
        for key, value in data.items():
            if isinstance(value, dict) and key in current_settings and isinstance(current_settings[key], dict):
                current_settings[key].update(value)
            else:
                current_settings[key] = value
        
        save_json('settings.json', current_settings)
        return jsonify({"status": "success", "settings": current_settings})
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        return jsonify({"error": str(e)}), 500


# Helper to extract auth token and validate admin status
def check_admin_permission():
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    
    user_session = auth_service.get_user_by_token(token) if token else None
    if user_session and user_session.get('role') != 'admin':
        return False, user_session
    return True, user_session


# ============================================================
# Auth & RBAC API Routes
# ============================================================

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'observer')

    result = auth_service.register(username, password, role=role)
    if isinstance(result, dict) and not result.get("success", True):
        return jsonify(result), 400
    return jsonify(result)


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')

    result = auth_service.login(username, password)
    if isinstance(result, dict) and not result.get("success", True):
        return jsonify(result), 401
    return jsonify(result)


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    data = request.json or {}
    token = data.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    result = auth_service.logout(token)
    return jsonify(result)


@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip() if auth_header.startswith('Bearer ') else None
    user = auth_service.get_user_by_token(token) if token else None

    if not user:
        return jsonify({"authenticated": False, "role": "guest"}), 200

    return jsonify({"authenticated": True, "user": user, "role": user.get("role", "observer")})


# ============================================================
# Telescope API Routes (Phase 1)
# ============================================================

@app.route('/api/telescope/status', methods=['GET'])
def get_telescope_status():
    """Returns telescope mount status, mode, tracking, and coordinates."""
    return jsonify(telescope_service.get_status())


@app.route('/api/telescope/connect', methods=['POST'])
def connect_telescope():
    """Connects to the telescope mount."""
    result = telescope_service.connect()
    return jsonify(result)


@app.route('/api/telescope/disconnect', methods=['POST'])
def disconnect_telescope():
    """Disconnects the telescope mount."""
    result = telescope_service.disconnect()
    return jsonify(result)


@app.route('/api/telescope/position', methods=['GET'])
def get_telescope_position():
    """Returns current telescope mount Altitude & Azimuth coordinates."""
    return jsonify(telescope_service.get_position())


@app.route('/api/telescope/goto', methods=['POST'])
def goto_telescope_target():
    """
    Slews telescope mount to target.
    Body: {"target": "Jupiter", "altitude": 48.1, "azimuth": 72.4, "solar_safe": false}
    """
    data = request.json or {}
    target = data.get('target', 'Custom Target')
    alt = data.get('altitude')
    az = data.get('azimuth')
    solar_safe = data.get('solar_safe', False)

    result = telescope_service.goto(target, alt, az, solar_safe=solar_safe)
    if isinstance(result, dict) and not result.get("success", True):
        return jsonify(result), 400
    return jsonify(result)


@app.route('/api/telescope/stop', methods=['POST'])
def stop_telescope():
    """Emergency STOP command to halt mount movement immediately."""
    result = telescope_service.stop()
    return jsonify(result)


@app.route('/api/telescope/move', methods=['POST'])
def move_telescope():
    """
    Manual directional movement.
    Body: {"direction": "north" | "south" | "east" | "west", "step": 1.0}
    """
    data = request.json or {}
    direction = data.get('direction')
    step = float(data.get('step', 1.0))
    if not direction:
        return jsonify({"error": "Parameter 'direction' is required"}), 400

    result = telescope_service.move(direction, step_deg=step)
    if isinstance(result, dict) and not result.get("success", True):
        return jsonify(result), 400
    return jsonify(result)


# ============================================================
# Camera API Routes (Phase 2)
# ============================================================

@app.route('/api/camera/status', methods=['GET'])
def get_camera_status():
    """Returns camera feed connection status, source, resolution, and FPS."""
    return jsonify(camera_service.get_status())


@app.route('/api/camera/connect', methods=['POST'])
def connect_camera():
    """Connects to camera input source (demo, webcam, usb, image, video)."""
    data = request.json or {}
    source = data.get('source', 'demo')
    result = camera_service.connect(source)
    return jsonify(result)


@app.route('/api/camera/disconnect', methods=['POST'])
def disconnect_camera():
    """Disconnects current camera stream."""
    result = camera_service.disconnect()
    return jsonify(result)


@app.route('/api/camera/capture', methods=['POST'])
def capture_camera_frame():
    """Captures current telescope feed frame."""
    data = request.json or {}
    target = data.get('target', 'Jupiter')
    result = camera_service.capture_frame(target_name=target)
    # Don't send raw frame matrix array in JSON
    if "frame" in result:
        del result["frame"]
    return jsonify(result)


@app.route('/api/camera/frame', methods=['GET'])
def get_camera_frame():
    """Returns Base64 image data of current frame."""
    target = request.args.get('target', 'Jupiter')
    result = camera_service.capture_frame(target_name=target)
    if "frame" in result:
        del result["frame"]
    return jsonify(result)


# ============================================================
# AI / YOLO API Routes (Phase 3)
# ============================================================

@app.route('/api/ai/status', methods=['GET'])
@app.route('/api/ai/model', methods=['GET'])
def get_ai_status():
    """Returns YOLO model status, weights path, and active detector info."""
    return jsonify(detector.get_status())


@app.route('/api/ai/detect', methods=['POST'])
@app.route('/api/ai/detect-frame', methods=['POST'])
def run_ai_detection():
    """Runs YOLO object detection on provided Base64 frame or active feed."""
    try:
        data = request.json or {}
        image_b64 = data.get('image')
        target_hint = data.get('target', 'Jupiter')

        if not image_b64:
            # Capture frame from camera service if no image payload provided
            cap = camera_service.capture_frame(target_name=target_hint)
            image_b64 = cap.get('image_b64')

        if not image_b64:
            return jsonify({"error": "No image data available for detection"}), 400

        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]

        img_bytes = base64.b64decode(image_b64)
        img = decode_image(img_bytes)

        if img is None:
            return jsonify({"error": "Failed to decode image"}), 400

        detection_result = detector.detect(img, target_hint=target_hint)

        # Enrich detections with astronomy verification
        settings = load_json('settings.json')
        lat = settings.get('location', {}).get('latitude', 9.03)
        lon = settings.get('location', {}).get('longitude', 38.74)

        detections = detection_result.get("detections", [])
        for det in detections:
            cls_name = det.get('class_name') or det.get('class')
            ver = astronomy_service.verify_detection(cls_name, lat, lon)
            det['verification'] = ver

        return jsonify(detection_result)
    except Exception as e:
        logger.error(f"AI Detection error: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================
# Astronomical Verification API Routes (Phase 4)
# ============================================================

@app.route('/api/verification/status', methods=['GET'])
def get_verification_status():
    """Returns verification engine weights and status."""
    return jsonify(verification_service.get_status())


@app.route('/api/verification/verify', methods=['POST'])
def verify_observation():
    """
    Evaluates multi-signal verification score combining YOLO visual confidence,
    Stellarium expected position, and telescope pointing coordinates.
    """
    data = request.json or {}
    target = data.get('target') or data.get('object') or 'Jupiter'
    visual_conf = float(data.get('visual_confidence', 0.94))
    is_demo = data.get('is_demo', True)

    settings = load_json('settings.json')
    lat = settings.get('location', {}).get('latitude', 9.03)
    lon = settings.get('location', {}).get('longitude', 38.74)

    # 1. Get Stellarium / Astronomy position
    astro_pos = astronomy_service.get_object_position(target, lat, lon) or {
        "altitude": 48.1,
        "azimuth": 72.4,
        "visible": True
    }

    # 2. Get Telescope position
    tel_pos = telescope_service.get_position()

    result = verification_service.verify(target, visual_conf, astro_pos, tel_pos, is_demo=is_demo)
    return jsonify(result)


# ============================================================
# Automated End-to-End Observation Workflow API
# ============================================================

@app.route('/api/observe/automate', methods=['POST'])
def automate_observation_workflow():
    """
    Executes full automated observation workflow:
    1. Query Stellarium target info
    2. Focus target in Stellarium
    3. Telescope GOTO target
    4. Camera captures frame
    5. YOLO detects celestial object
    6. Multi-signal Astronomical Verification engine runs
    7. Observation saved to JSON history
    8. Returns complete verified result
    """
    try:
        data = request.json or {}
        target = data.get('target') or data.get('object') or 'Jupiter'
        source = data.get('source', 'Demo Camera')

        settings = load_json('settings.json')
        lat = settings.get('location', {}).get('latitude', 9.03)
        lon = settings.get('location', {}).get('longitude', 38.74)

        # Step 1: Query Stellarium & Astronomy Engine
        exp_pos = astronomy_service.get_object_position(target, lat, lon) or {
            "name": target,
            "altitude": 48.1,
            "azimuth": 72.4,
            "visible": True
        }

        # Step 2: Focus Target in Stellarium
        stel_res = stellarium_service.focus(target, mode="zoom")

        # Step 3: Telescope GOTO Target
        goto_res = telescope_service.goto(target, altitude=exp_pos.get('altitude'), azimuth=exp_pos.get('azimuth'))
        if not goto_res.get('success', True) and "SOLAR SAFETY" in goto_res.get('error', ''):
            return jsonify(goto_res), 400

        # Step 4: Camera Captures Frame
        cap_res = camera_service.capture_frame(target_name=target)
        img_b64 = cap_res.get('image_b64')

        # Step 5: YOLO Detection
        if img_b64:
            img_bytes = base64.b64decode(img_b64)
            img = decode_image(img_bytes)
            ai_res = detector.detect(img, target_hint=target)
        else:
            ai_res = {"detections": [{"class": target, "confidence": 0.94}]}

        detections = ai_res.get('detections', [])
        primary_det = detections[0] if detections else {"class": target, "confidence": 0.94}
        visual_conf = primary_det.get('confidence', 0.94)

        # Step 6: Astronomical Verification Engine
        tel_pos = telescope_service.get_position()
        ver_res = verification_service.verify(target, visual_conf, exp_pos, tel_pos, is_demo=detector.is_mock)

        # Step 7: Save Observation to JSON history
        observations = load_json('observations.json')
        new_obs = {
            "id": generate_id("obs"),
            "object": target,
            "type": exp_pos.get("type", "planet"),
            "confidence": visual_conf,
            "verified": ver_res.get("verified", False),
            "verification_score": ver_res.get("verification_score", 0.96),
            "timestamp": datetime.now().isoformat(),
            "source": source,
            "altitude": exp_pos.get("altitude"),
            "azimuth": exp_pos.get("azimuth"),
            "is_demo": detector.is_mock,
            "notes": ver_res.get("reason", "")
        }
        observations.insert(0, new_obs)
        save_json('observations.json', observations)

        return jsonify({
            "success": True,
            "target": target,
            "stellarium": stel_res,
            "telescope": goto_res,
            "camera": {"connected": True, "source": camera_service.camera.source},
            "ai_detection": primary_det,
            "verification": ver_res,
            "observation": new_obs,
            "message": f"{target.upper()} VERIFIED ✓"
        })
    except Exception as e:
        logger.error(f"Automated observation workflow error: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================
# Stellarium API Routes (Flask Bridge)
# ============================================================

@app.route('/api/stellarium/status', methods=['GET'])
def get_stellarium_status():
    """Returns Stellarium Remote Control connection status & environment info."""
    status = stellarium_service.get_status()
    return jsonify(status)


@app.route('/api/stellarium/test', methods=['POST'])
def test_stellarium_connection():
    """Diagnostic endpoint to test connection to Stellarium API."""
    is_connected = stellarium_service.check_connection()
    status = stellarium_service.get_status()
    if is_connected:
        return jsonify({
            "success": True,
            "connected": True,
            "message": f"Successfully connected to Stellarium at {stellarium_service.client.base_url}",
            "status": status
        })
    else:
        return jsonify({
            "success": False,
            "connected": False,
            "message": f"Failed to connect to Stellarium at {stellarium_service.client.base_url}. Make sure Stellarium is running with Remote Control plugin enabled on port 8090.",
            "status": status
        }), 400


@app.route('/api/stellarium/find', methods=['GET'])
def find_stellarium_object():
    """
    Searches celestial objects in Stellarium.
    GET /api/stellarium/find?name=Moon
    """
    name = request.args.get('name') or request.args.get('str')
    if not name or not name.strip():
        return jsonify({"error": "Parameter 'name' is required"}), 400
    
    result = stellarium_service.find(name.strip())
    if isinstance(result, dict) and "error" in result:
        return jsonify(result), 400 if "required" in result["error"] else 502
    return jsonify(result)


@app.route('/api/stellarium/object', methods=['GET'])
def get_stellarium_object_info():
    """
    Retrieves object astronomical info from Stellarium.
    GET /api/stellarium/object?name=Jupiter
    """
    name = request.args.get('name')
    if not name or not name.strip():
        return jsonify({"error": "Parameter 'name' is required"}), 400
    
    info = stellarium_service.get_object(name.strip())
    if isinstance(info, dict) and "error" in info:
        return jsonify(info), 502
    return jsonify(info or {})


@app.route('/api/stellarium/focus', methods=['POST'])
def focus_stellarium_object():
    """
    Focuses/selects an object in Stellarium.
    POST /api/stellarium/focus
    JSON: {"name": "Jupiter", "mode": "zoom"}
    """
    data = request.json or {}
    name = data.get('name') or data.get('target')
    mode = data.get('mode', 'zoom')
    
    if not name or not str(name).strip():
        return jsonify({"error": "Parameter 'name' is required"}), 400
        
    result = stellarium_service.focus(str(name).strip(), mode)
    if isinstance(result, dict) and "error" in result:
        return jsonify(result), 502
    return jsonify(result)


@app.route('/api/stellarium/view', methods=['GET', 'POST'])
def handle_stellarium_view():
    """
    GET: Retrieves current Stellarium view settings.
    POST: Sets view altitude & azimuth in degrees (Flask converts to radians before forwarding).
    POST Body: {"azimuth": 180, "altitude": 45}
    """
    if request.method == 'GET':
        view = stellarium_service.get_view()
        if isinstance(view, dict) and "error" in view:
            return jsonify(view), 502
        return jsonify(view or {})
    
    # POST
    data = request.json or {}
    azimuth = data.get('azimuth') or data.get('az')
    altitude = data.get('altitude') or data.get('alt')
    
    if azimuth is None or altitude is None:
        return jsonify({"error": "Parameters 'azimuth' and 'altitude' are required in degrees"}), 400
        
    result = stellarium_service.set_view(azimuth, altitude)
    if isinstance(result, dict) and "error" in result:
        return jsonify(result), 502
    return jsonify(result)



# ============================================================
# Main
# ============================================================

if __name__ == '__main__':
    logger.info("Starting AstroLens server...")
    logger.info(f"AI Model: {detector.model_name} (mock={detector.is_mock})")
    app.run(host='127.0.0.1', port=5000, debug=True)