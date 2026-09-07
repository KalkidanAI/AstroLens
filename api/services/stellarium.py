"""
AstroLens Stellarium Service
Client for Stellarium Remote Control HTTP API (http://localhost:8090)
Includes 3-second timeouts on all requests, parameter validation,
degree-to-radian conversions, and clean error handling without raw stack traces.
"""

import os
import math
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

# Logger setup
logger = logging.getLogger('AstroLens.Stellarium')

# Base URL from environment variable or default
STELLARIUM_URL = os.getenv('STELLARIUM_URL', os.getenv('STELLARIUM_HOST', 'http://localhost:8090'))
if not STELLARIUM_URL.startswith('http'):
    STELLARIUM_URL = f"http://{STELLARIUM_URL}"

DEFAULT_TIMEOUT = 3.0  # Strict 3-second timeout for all HTTP requests


class StellariumClient:
    """Stellarium Remote Control HTTP API Client."""

    def __init__(self, base_url=None, timeout=DEFAULT_TIMEOUT):
        self.base_url = (base_url or STELLARIUM_URL).rstrip('/')
        self.timeout = timeout

    def check_connection(self):
        """Checks if Stellarium Remote Control API is reachable."""
        try:
            res = requests.get(f"{self.base_url}/api/main/status", timeout=self.timeout)
            return res.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def get_status(self):
        """
        GET /api/main/status
        Retrieves current location, time, view, field of view, and selection info.
        """
        try:
            res = requests.get(f"{self.base_url}/api/main/status", timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                location = data.get("location", {})
                time_info = data.get("time", {})
                selectioninfo = data.get("selectioninfo", "")
                view_info = data.get("view", {})

                return {
                    "connected": True,
                    "location": {
                        "name": location.get("name", "Unknown"),
                        "latitude": location.get("latitude", None),
                        "longitude": location.get("longitude", None),
                        "altitude": location.get("altitude", None),
                        "planet": location.get("planet", "Earth")
                    },
                    "time": {
                        "local": time_info.get("local", ""),
                        "utc": time_info.get("utc", ""),
                        "jday": time_info.get("jday", None),
                        "gmtShift": time_info.get("gmtShift", 0)
                    },
                    "view": {
                        "fov": view_info.get("fov", None)
                    },
                    "selected_object": selectioninfo.strip() if isinstance(selectioninfo, str) else "",
                    "url": self.base_url
                }
        except requests.exceptions.RequestException as e:
            logger.debug(f"Stellarium connection error: {e}")

        return {
            "connected": False,
            "error": "Stellarium is not running or Remote Control plugin is disabled.",
            "url": self.base_url
        }

    def find_object(self, name):
        """
        GET /api/objects/find?str=<name>
        Searches for celestial objects in Stellarium.
        """
        if not name or not str(name).strip():
            return {"error": "Parameter 'name' is required and cannot be empty."}

        try:
            res = requests.get(f"{self.base_url}/api/objects/find", params={"str": name.strip()}, timeout=self.timeout)
            if res.status_code == 200:
                try:
                    return res.json()
                except Exception:
                    # Plain text response fallback
                    return [res.text.strip()] if res.text else []
            return {"error": f"Stellarium API returned HTTP {res.status_code}"}
        except requests.exceptions.RequestException as e:
            logger.error(f"Stellarium find_object error: {e}")
            return {
                "connected": False,
                "error": "Unable to communicate with Stellarium. Make sure Stellarium is running."
            }

    def get_object_info(self, name):
        """
        GET /api/objects/info?name=<name>&format=json
        Retrieves detailed astronomical info for a named object.
        """
        if not name or not str(name).strip():
            return {"error": "Parameter 'name' is required and cannot be empty."}

        try:
            res = requests.get(
                f"{self.base_url}/api/objects/info",
                params={"name": name.strip(), "format": "json"},
                timeout=self.timeout
            )
            if res.status_code == 200:
                return res.json()
            return {"error": f"Stellarium API returned HTTP {res.status_code}"}
        except requests.exceptions.RequestException as e:
            logger.error(f"Stellarium get_object_info error: {e}")
            return {
                "connected": False,
                "error": "Unable to communicate with Stellarium."
            }

    def focus_object(self, name, mode="zoom"):
        """
        POST /api/main/focus
        Selects and focuses an object in Stellarium view.
        """
        if not name or not str(name).strip():
            return {"error": "Parameter 'name' is required and cannot be empty."}

        try:
            payload = {"target": name.strip(), "mode": mode}
            res = requests.post(f"{self.base_url}/api/main/focus", data=payload, timeout=self.timeout)
            if res.status_code == 200:
                return {
                    "success": True,
                    "target": name,
                    "mode": mode,
                    "message": f"Focused on {name} in Stellarium"
                }
            return {"error": f"Stellarium API returned HTTP {res.status_code}"}
        except requests.exceptions.RequestException as e:
            logger.error(f"Stellarium focus_object error: {e}")
            return {
                "connected": False,
                "error": "Unable to communicate with Stellarium."
            }

    def get_view(self):
        """
        GET /api/main/view
        Retrieves current view settings (fov, altAz, etc.).
        """
        try:
            res = requests.get(f"{self.base_url}/api/main/view", params={"coord": "altAz"}, timeout=self.timeout)
            if res.status_code == 200:
                return res.json()
            return {"error": f"Stellarium API returned HTTP {res.status_code}"}
        except requests.exceptions.RequestException as e:
            logger.error(f"Stellarium get_view error: {e}")
            return {
                "connected": False,
                "error": "Unable to communicate with Stellarium."
            }

    def set_view(self, azimuth_deg, altitude_deg):
        """
        POST /api/main/view
        Converts azimuth and altitude from degrees to radians before posting to Stellarium.
        Stellarium expects: az (radians), alt (radians).
        """
        try:
            az_deg = float(azimuth_deg)
            alt_deg = float(altitude_deg)
        except (ValueError, TypeError):
            return {"error": "Azimuth and Altitude must be valid numeric values in degrees."}

        try:
            # Convert degrees to radians for Stellarium API
            az_rad = math.radians(az_deg)
            alt_rad = math.radians(alt_deg)

            payload = {"az": az_rad, "alt": alt_rad}
            res = requests.post(f"{self.base_url}/api/main/view", data=payload, timeout=self.timeout)
            if res.status_code == 200:
                return {
                    "success": True,
                    "azimuth_deg": az_deg,
                    "altitude_deg": alt_deg,
                    "azimuth_rad": az_rad,
                    "altitude_rad": alt_rad,
                    "message": "Stellarium view updated successfully."
                }
            return {"error": f"Stellarium API returned HTTP {res.status_code}"}
        except requests.exceptions.RequestException as e:
            logger.error(f"Stellarium set_view error: {e}")
            return {
                "connected": False,
                "error": "Unable to communicate with Stellarium."
            }


class StellariumService:
    """Wrapper class used by Flask backend."""

    def __init__(self, base_url=None):
        self.client = StellariumClient(base_url=base_url)

    def get_status(self):
        return self.client.get_status()

    def check_connection(self):
        return self.client.check_connection()

    def find(self, name):
        return self.client.find_object(name)

    def get_object(self, name):
        return self.client.get_object_info(name)

    def focus(self, name, mode="zoom"):
        return self.client.focus_object(name, mode)

    def get_view(self):
        return self.client.get_view()

    def set_view(self, azimuth_deg, altitude_deg):
        return self.client.set_view(azimuth_deg, altitude_deg)
