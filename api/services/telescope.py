"""
AstroLens Telescope Service & Control Abstraction
Supports MockTelescope, CelestronTelescope (ASCOM/INDI ready),
Emergency STOP safety controls, and Solar Observation Safety Guards.
"""

import os
import logging
import math
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('AstroLens.Telescope')

TELESCOPE_MODE = os.getenv('TELESCOPE_MODE', 'mock').lower()


class MockTelescope:
    """
    Mock Telescope Mount Simulation.
    Simulates mount slewing, positioning, target tracking, and directional offset.
    """

    def __init__(self):
        self.mode = "mock"
        self.connected = True
        self.status = "CONNECTED"  # CONNECTED, DISCONNECTED, SLEWING, TRACKING, ERROR
        self.altitude = 48.1
        self.azimuth = 72.4
        self.target = "Jupiter"
        self.slewing = False
        self.tracking = True
        self.model_name = "Mock Mount Simulation (CPC 1100)"

    def connect(self):
        self.connected = True
        self.status = "CONNECTED"
        return {"success": True, "status": "CONNECTED", "mode": "mock", "message": "Connected to Mock Telescope Mount"}

    def disconnect(self):
        self.connected = False
        self.status = "DISCONNECTED"
        self.tracking = False
        self.slewing = False
        return {"success": True, "status": "DISCONNECTED", "mode": "mock", "message": "Disconnected Mock Telescope Mount"}

    def get_status(self):
        return {
            "success": True,
            "connected": self.connected,
            "status": self.status,
            "mode": self.mode,
            "model": self.model_name,
            "altitude": round(self.altitude, 2),
            "azimuth": round(self.azimuth, 2),
            "target": self.target,
            "slewing": self.slewing,
            "tracking": self.tracking,
            "is_mock": True
        }

    def get_position(self):
        return {
            "altitude": round(self.altitude, 2),
            "azimuth": round(self.azimuth, 2),
            "tracking": self.tracking,
            "target": self.target
        }

    def goto_target(self, target_name, altitude=None, azimuth=None, solar_safe=False):
        """
        Slews telescope mount to target coordinates.
        Includes Solar Observation Safety Guard.
        """
        if not self.connected:
            return {"success": False, "error": "Telescope mount is disconnected", "status": "DISCONNECTED"}

        # Solar Safety Guard
        if target_name and ("sun" in target_name.lower() or "solar" in target_name.lower()):
            if not solar_safe:
                logger.warning("Solar GOTO blocked due to missing solar filter confirmation!")
                return {
                    "success": False,
                    "error": "SOLAR SAFETY GUARD: Direct solar observations require certified solar-safe filter equipment.",
                    "status": "BLOCKED"
                }

        self.target = target_name or "Custom Coordinates"
        if altitude is not None:
            self.altitude = float(altitude)
        if azimuth is not None:
            self.azimuth = float(azimuth)

        self.slewing = False
        self.tracking = True
        self.status = "TRACKING"

        return {
            "success": True,
            "mode": "mock",
            "connected": True,
            "target": self.target,
            "altitude": round(self.altitude, 2),
            "azimuth": round(self.azimuth, 2),
            "status": "GOTO_COMPLETE",
            "message": f"Telescope slewed and tracking target: {self.target}"
        }

    def stop(self):
        """Emergency STOP command."""
        self.slewing = False
        self.tracking = False
        self.status = "STOPPED"
        return {
            "success": True,
            "status": "STOPPED",
            "message": "EMERGENCY STOP EXECUTED. Telescope movement halted."
        }

    def move(self, direction, step_deg=1.0):
        """Manual directional movement (north, south, east, west)."""
        if not self.connected:
            return {"success": False, "error": "Telescope mount is disconnected"}

        direction = str(direction).lower()
        if direction == "north":
            self.altitude = min(90.0, self.altitude + step_deg)
        elif direction == "south":
            self.altitude = max(-90.0, self.altitude - step_deg)
        elif direction == "east":
            self.azimuth = (self.azimuth + step_deg) % 360.0
        elif direction == "west":
            self.azimuth = (self.azimuth - step_deg) % 360.0
        else:
            return {"success": False, "error": f"Invalid move direction: {direction}"}

        return {
            "success": True,
            "direction": direction,
            "altitude": round(self.altitude, 2),
            "azimuth": round(self.azimuth, 2),
            "status": "MOVED"
        }


class CelestronTelescope:
    """
    Physical Celestron CPC Computerized Telescope Driver Abstraction (ASCOM / INDI ready).
    Placeholder driver ready for physical hardware connection.
    """

    def __init__(self, port=None):
        self.mode = "celestron"
        self.connected = False
        self.status = "DISCONNECTED"
        self.model_name = "Celestron CPC Computerized Telescope"
        self.port = port or os.getenv('TELESCOPE_PORT', 'COM3')

    def connect(self):
        # Hardware ASCOM / INDI serial connection stub
        logger.info(f"Attempting connection to physical Celestron mount on {self.port}...")
        self.connected = False
        self.status = "ERROR"
        return {
            "success": False,
            "connected": False,
            "status": "ERROR",
            "mode": "celestron",
            "error": f"Physical Celestron telescope mount not detected on {self.port}. Ensure mount power & USB cable are connected."
        }

    def disconnect(self):
        self.connected = False
        self.status = "DISCONNECTED"
        return {"success": True, "status": "DISCONNECTED", "mode": "celestron"}

    def get_status(self):
        return {
            "success": self.connected,
            "connected": self.connected,
            "status": self.status,
            "mode": self.mode,
            "model": self.model_name,
            "port": self.port,
            "is_mock": False,
            "error": None if self.connected else f"Physical mount disconnected on {self.port}"
        }

    def get_position(self):
        return {"altitude": 0.0, "azimuth": 0.0, "tracking": False, "target": None}

    def goto_target(self, target_name, altitude=None, azimuth=None, solar_safe=False):
        return {"success": False, "error": "Celestron mount is disconnected"}

    def stop(self):
        return {"success": True, "status": "STOPPED"}

    def move(self, direction, step_deg=1.0):
        return {"success": False, "error": "Celestron mount is disconnected"}


class TelescopeService:
    """Factory service manager for telescope mounts."""

    def __init__(self, mode=None):
        active_mode = (mode or TELESCOPE_MODE).lower()
        if active_mode in ['ascom', 'indi', 'celestron', 'hardware']:
            self.telescope = CelestronTelescope()
        else:
            self.telescope = MockTelescope()

    def get_status(self):
        return self.telescope.get_status()

    def connect(self):
        return self.telescope.connect()

    def disconnect(self):
        return self.telescope.disconnect()

    def get_position(self):
        return self.telescope.get_position()

    def goto(self, target_name, altitude=None, azimuth=None, solar_safe=False):
        return self.telescope.goto_target(target_name, altitude, azimuth, solar_safe)

    def stop(self):
        return self.telescope.stop()

    def move(self, direction, step_deg=1.0):
        return self.telescope.move(direction, step_deg)
