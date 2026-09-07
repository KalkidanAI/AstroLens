# AstroLens 🔭

**AI-Powered Astronomical Observation Platform**

> Turn Your Telescope Into an Intelligent Observatory.

AstroLens combines telescope data, computer vision, and astronomical intelligence to help identify and understand celestial objects.

## Architecture

```
Telescope/Camera Input
        ↓
Image/Video Frame
        ↓
Python ML (YOLO Architecture)
        ↓
Celestial Object Detection
        ↓
Astronomy Verification
        ↓
Dashboard Result
```

## Project Structure

```
AstroLens/
│
├── api/                          # Flask backend
│   ├── index.py                  # Main Flask app (all routes)
│   ├── utils.py                  # JSON file utilities
│   ├── ml/                       # Machine learning module
│   │   ├── __init__.py
│   │   ├── detector.py           # AstroDetector (Mock + YOLO)
│   │   └── model/                # Place best.pt here
│   │       └── README.md
│   ├── services/                 # Backend services
│   │   ├── __init__.py
│   │   ├── astronomy.py          # Celestial position engine
│   │   ├── telescope.py          # Telescope control (Mock)
│   │   └── stellarium.py         # Stellarium integration (placeholder)
│   └── data/                     # JSON data storage
│       ├── objects.json           # Celestial objects catalog
│       ├── observations.json     # Observation history
│       ├── telescope.json        # Telescope configuration
│       └── settings.json         # App settings
│
├── static/                       # Frontend assets
│   ├── css/
│   │   └── style.css             # Complete dark theme stylesheet
│   └── js/
│       ├── app.js                # Core app JS (navigation, API, toasts)
│       ├── dashboard.js          # Dashboard page logic
│       ├── observatory.js        # Observatory (camera, detection, bboxes)
│       ├── sky-map.js            # Canvas sky map
│       ├── objects.js            # Celestial objects browser
│       ├── history.js            # Observation history
│       └── settings.js           # Settings management
│
├── templates/                    # HTML templates (Jinja2)
│   ├── index.html                # Landing page
│   ├── dashboard.html            # Dashboard
│   ├── observatory.html          # Observatory (main feature)
│   ├── sky.html                  # Interactive sky map
│   ├── objects.html              # Celestial objects catalog
│   ├── history.html              # Observation history
│   └── settings.html             # Configuration
│
├── requirements.txt
├── vercel.json                   # Vercel deployment config
├── .env.example                  # Environment variable template
├── .gitignore
└── README.md
```

## Installation

### Prerequisites
- Python 3.10+
- pip

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd AstroLens

# Create virtual environment (optional)
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running Locally

```bash
python api/index.py
```

Open: **http://localhost:5000**

## Features

### Pages
| Page | Description |
|------|-------------|
| **Home** | Landing page with feature overview |
| **Dashboard** | System status, sky overview, recommended targets |
| **Observatory** | Camera feed + AI detection + astronomy verification |
| **Sky Map** | Interactive canvas sky map with clickable objects |
| **Objects** | Celestial objects catalog with filtering |
| **History** | Observation log with details |
| **Settings** | Location, telescope, AI, display configuration |

### Observatory Input Sources
| Input | Description |
|-------|-------------|
| **Demo Feed** | Synthetic astronomy scene with Jupiter, Saturn, Moon |
| **Webcam** | Browser camera access |
| **Image File** | Upload astronomy images |
| **Video File** | Upload astronomy video |
| **Celestron** | *(Future)* Physical telescope camera |

## ML Setup

### Current: Mock Detector (DEMO)
The application ships with a Mock Detector that generates simulated detections. All mock results are clearly labeled as **DEMO**.

### Adding Your YOLO Model

1. Train your YOLO model using Ultralytics
2. Place `best.pt` in: `api/ml/model/best.pt`
3. Restart the server
4. The app will automatically detect and use the YOLO model

```
Potential YOLO classes:
moon, mercury, venus, mars, jupiter, saturn,
star, constellation, nebula, galaxy, comet, asteroid
```

### Detector Architecture
```python
AstroDetector (factory)
├── MockDetector      # Returns demo detections (current)
└── YOLODetector      # Wraps ultralytics YOLO (when best.pt exists)
```

## Camera / Telescope Input

### Input Architecture
```
TelescopeInput (abstraction)
├── WebcamInput       # Browser getUserMedia
├── ImageInput        # File upload
├── VideoInput        # File upload
├── DemoInput         # Synthetic scene
└── CelestronInput    # (Future) Physical telescope
```

### Telescope Integration
The `TelescopeService` in `api/services/telescope.py` provides:
- `connect()` / `disconnect()`
- `get_status()`
- `goto(altitude, azimuth)`
- `set_target(name, altitude, azimuth)`

Currently uses `MockTelescope`. To connect a real Celestron:
1. Implement `CelestronTelescope` class with the same interface
2. Use libraries like `python-celestron` or ASCOM/INDI drivers
3. Swap `MockTelescope` for `CelestronTelescope` in `TelescopeService.__init__`

### Stellarium Integration
`api/services/stellarium.py` is a placeholder for future Stellarium HTTP API integration.
- Stellarium Remote Control plugin runs on `localhost:8090`
- The service is structured to connect when implemented

## Astronomy Engine
`api/services/astronomy.py` provides:
- `get_visible_objects(lat, lon, dt)` — Current visible objects
- `get_object_position(name, lat, lon, dt)` — Object alt/az
- `get_object_visibility(name, lat, lon, dt)` — Visibility check
- `verify_detection(name, lat, lon, dt)` — Cross-reference AI with astronomy

Currently uses demo data. Future integration with:
- **Astropy** — Professional astronomy calculations
- **Skyfield** — High-precision ephemeris

## JSON Storage

### Development
JSON files in `api/data/` are read directly from the repository.

### Runtime Writes
New observations and settings changes are written to `/tmp/astrolens_data/` (Vercel-compatible).

### Future Migration
The storage abstraction in `api/utils.py` (`load_json`, `save_json`) can be replaced with:
- Vercel KV
- Supabase
- Firebase
- PostgreSQL

## API Endpoints

### Page Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Landing page |
| GET | `/dashboard` | Dashboard |
| GET | `/observatory` | Observatory |
| GET | `/sky` | Sky map |
| GET | `/objects` | Objects catalog |
| GET | `/history` | Observation history |
| GET | `/settings` | Settings |

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | System status |
| GET | `/api/objects` | Celestial objects (with positions) |
| GET | `/api/sky` | Visible sky objects |
| GET | `/api/observations` | Observation history |
| POST | `/api/detect` | Run AI detection on image |
| POST | `/api/observation` | Save observation |
| POST | `/api/settings` | Update settings |
| GET | `/api/telescope/status` | Telescope status |
| POST | `/api/telescope/connect` | Connect telescope |
| POST | `/api/telescope/disconnect` | Disconnect telescope |

## Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

The `vercel.json` is pre-configured to:
- Route all requests through `api/index.py`
- Serve static files from `/static/`

**Note:** Runtime file writes use `/tmp/` which is ephemeral on Vercel. For persistent storage in production, integrate a database service.

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
FLASK_ENV=development
SECRET_KEY=your-secret-key
MODEL_PATH=api/ml/model/best.pt
```

## Next Steps: Connecting Real Telescope

1. **Get a Celestron telescope** with USB/WiFi control
2. **Install telescope drivers** (ASCOM on Windows, INDI on Linux)
3. **Implement `CelestronTelescope`** class in `telescope.py`
4. **Connect camera**: Use OpenCV `VideoCapture` with telescope camera
5. **Train YOLO model**: Collect astronomy images, label with target classes, train with Ultralytics
6. **Place `best.pt`** in `api/ml/model/`
7. **Integrate Astropy/Skyfield** for real position calculations
8. **Connect Stellarium** via Remote Control plugin

## License

This project is under development.

---

**AstroLens** — Intelligent Observatory
