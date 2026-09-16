"""
AstroLens Multi-Signal Astronomical Verification Engine
Combines YOLO Visual Evidence, Stellarium Astronomical Ephemeris,
and Telescope Pointing Alignment to produce independent verification scores.
"""

import os
import math
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('AstroLens.Verification')

def _safe_float(val, default):
    try:
        if val is not None and str(val).strip() != '':
            return float(val)
    except (ValueError, TypeError):
        pass
    return default

VISUAL_WEIGHT = _safe_float(os.getenv('VISUAL_WEIGHT'), 0.40)
POSITION_WEIGHT = _safe_float(os.getenv('POSITION_WEIGHT'), 0.35)
TELESCOPE_WEIGHT = _safe_float(os.getenv('TELESCOPE_WEIGHT'), 0.25)


class VerificationEngine:
    """
    Multi-Signal Verification Engine.
    Evaluates visual computer vision confidence against astronomical ephemeris and telescope pointing.
    """

    def __init__(self, visual_weight=VISUAL_WEIGHT, position_weight=POSITION_WEIGHT, telescope_weight=TELESCOPE_WEIGHT):
        self.visual_weight = visual_weight
        self.position_weight = position_weight
        self.telescope_weight = telescope_weight

    def calculate_angular_error(self, exp_alt, exp_az, obs_alt, obs_az):
        """Calculates spherical coordinate error distance in degrees."""
        if exp_alt is None or exp_az is None or obs_alt is None or obs_az is None:
            return 999.0

        alt_diff = abs(exp_alt - obs_alt)
        az_diff = abs(exp_az - obs_az)
        if az_diff > 180.0:
            az_diff = 360.0 - az_diff

        # Spherical distance approximation
        return math.sqrt(alt_diff**2 + (az_diff * math.cos(math.radians((exp_alt + obs_alt) / 2.0)))**2)

    def verify_observation(self, target_name, visual_confidence, expected_pos, telescope_pos, is_demo=False):
        """
        Runs multi-signal verification logic.
        
        Params:
          target_name (str): Target celestial object name
          visual_confidence (float): YOLO detection confidence score (0.0 to 1.0)
          expected_pos (dict): {"altitude": float, "azimuth": float, "visible": bool}
          telescope_pos (dict): {"altitude": float, "azimuth": float, "status": str}
        """
        visual_score = float(visual_confidence or 0.0)

        # 1. Astronomical Position Match
        exp_alt = expected_pos.get('altitude') if expected_pos else None
        exp_az = expected_pos.get('azimuth') if expected_pos else None
        is_visible = expected_pos.get('visible', True) if expected_pos else True

        # 2. Telescope Pointing Coordinates
        tel_alt = telescope_pos.get('altitude') if telescope_pos else exp_alt
        tel_az = telescope_pos.get('azimuth') if telescope_pos else exp_az

        # Pointing Error Calculation
        pointing_error = self.calculate_angular_error(exp_alt, exp_az, tel_alt, tel_az)
        pointing_match = pointing_error <= 5.0
        pointing_score = max(0.0, 1.0 - (pointing_error / 10.0)) if exp_alt is not None else 0.85

        # Position Score
        astronomical_match = is_visible and (exp_alt is not None and exp_alt > 0)
        position_score = 1.0 if astronomical_match else 0.2

        # Combined Multi-Signal Verification Score
        total_score = (
            (visual_score * self.visual_weight) +
            (position_score * self.position_weight) +
            (pointing_score * self.telescope_weight)
        )
        total_score = round(min(1.0, max(0.0, total_score)), 2)

        verified = (total_score >= 0.70) and astronomical_match

        # Construct explanation
        if verified:
            reason = (
                f"Visual detection ({(visual_score * 100):.0f}%) is consistent with "
                f"expected astronomical position (Alt {exp_alt if exp_alt is not None else '--'}°, "
                f"Az {exp_az if exp_az is not None else '--'}°) and telescope alignment (Error {pointing_error:.1f}°)."
            )
        elif not is_visible:
            reason = f"Object '{target_name}' is currently below the local horizon."
        else:
            reason = f"Positional error ({pointing_error:.1f}°) exceeds acceptable astronomical threshold."

        return {
            "success": True,
            "object": target_name,
            "visual_confidence": round(visual_score, 2),
            "astronomical_match": astronomical_match,
            "pointing_match": pointing_match,
            "pointing_error_deg": round(pointing_error, 2),
            "expected_altitude": exp_alt,
            "expected_azimuth": exp_az,
            "telescope_altitude": tel_alt,
            "telescope_azimuth": tel_az,
            "verification_score": total_score,
            "verified": verified,
            "reason": reason,
            "is_demo": is_demo,
            "weights": {
                "visual": self.visual_weight,
                "position": self.position_weight,
                "telescope": self.telescope_weight
            }
        }


class VerificationService:
    def __init__(self):
        self.engine = VerificationEngine()

    def get_status(self):
        return {
            "status": "ready",
            "weights": {
                "visual": self.engine.visual_weight,
                "position": self.engine.position_weight,
                "telescope": self.engine.telescope_weight
            }
        }

    def verify(self, target_name, visual_confidence, expected_pos, telescope_pos, is_demo=False):
        return self.engine.verify_observation(target_name, visual_confidence, expected_pos, telescope_pos, is_demo)
