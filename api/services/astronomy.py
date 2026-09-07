from datetime import datetime
import random

class AstronomyService:
    def __init__(self):
        self.is_demo = True  # Will be False when real library connected
        
        # Hardcoded realistic positions for Addis Ababa (DEMO)
        self.demo_objects = [
            {"name": "Sun", "type": "star", "base_alt": -45.0, "base_az": 0.0, "mag": -26.74},
            {"name": "Moon", "type": "moon", "base_alt": 60.0, "base_az": 180.0, "mag": -12.6},
            {"name": "Mercury", "type": "planet", "base_alt": -20.0, "base_az": 250.0, "mag": -0.4},
            {"name": "Venus", "type": "planet", "base_alt": 15.0, "base_az": 260.0, "mag": -4.4},
            {"name": "Mars", "type": "planet", "base_alt": 30.0, "base_az": 120.0, "mag": -2.0},
            {"name": "Jupiter", "type": "planet", "base_alt": 45.0, "base_az": 90.0, "mag": -2.7},
            {"name": "Saturn", "type": "planet", "base_alt": 35.0, "base_az": 150.0, "mag": 0.4},
            {"name": "Sirius", "type": "star", "base_alt": 55.0, "base_az": 170.0, "mag": -1.46},
            {"name": "Canopus", "type": "star", "base_alt": 25.0, "base_az": 190.0, "mag": -0.74},
            {"name": "Arcturus", "type": "star", "base_alt": -10.0, "base_az": 300.0, "mag": -0.05},
            {"name": "Vega", "type": "star", "base_alt": 40.0, "base_az": 45.0, "mag": 0.03},
            {"name": "Betelgeuse", "type": "star", "base_alt": 65.0, "base_az": 135.0, "mag": 0.42},
            {"name": "Rigel", "type": "star", "base_alt": 50.0, "base_az": 145.0, "mag": 0.13},
            {"name": "Polaris", "type": "star", "base_alt": 9.03, "base_az": 0.0, "mag": 1.98},
            {"name": "Orion Nebula (M42)", "type": "nebula", "base_alt": 55.0, "base_az": 140.0, "mag": 4.0},
            {"name": "Andromeda Galaxy (M31)", "type": "galaxy", "base_alt": 30.0, "base_az": 45.0, "mag": 3.4},
            {"name": "Pleiades (M45)", "type": "cluster", "base_alt": 75.0, "base_az": 80.0, "mag": 1.6},
        ]
        
    def _apply_time_variation(self, obj, dt=None):
        if dt is None:
            dt = datetime.now()
            
        # Simple pseudo-random variation based on hour
        hour_factor = dt.hour + dt.minute / 60.0
        
        # Varies by up to 15 degrees per hour
        variation = (hour_factor % 24 - 12) * 15
        
        alt = obj["base_alt"] + variation * 0.5
        if alt > 90: alt = 180 - alt
        if alt < -90: alt = -180 - alt
        
        az = (obj["base_az"] + variation * 2) % 360
        
        return {
            "name": obj["name"],
            "type": obj["type"],
            "altitude": round(alt, 2),
            "azimuth": round(az, 2),
            "magnitude": obj["mag"],
            "visible": alt > 0,
            "rise_time": "18:00", # Fixed demo values
            "set_time": "06:00",
            "is_demo": True
        }
        
    def get_visible_objects(self, latitude, longitude, dt=None):
        """Returns list of visible celestial objects."""
        if not self.is_demo:
            return [] # Implement real astro logic here
            
        results = []
        for obj in self.demo_objects:
            pos = self._apply_time_variation(obj, dt)
            if pos["visible"]:
                results.append(pos)
        return results
    
    def get_object_position(self, object_name, latitude, longitude, dt=None):
        """Returns position data for a specific object."""
        if not self.is_demo:
            return {}
            
        for obj in self.demo_objects:
            if obj["name"].lower() == object_name.lower() or object_name.lower() in obj["name"].lower():
                return self._apply_time_variation(obj, dt)
                
        return None
    
    def get_object_visibility(self, object_name, latitude, longitude, dt=None):
        """Returns visibility info."""
        pos = self.get_object_position(object_name, latitude, longitude, dt)
        if pos:
            return {"visible": pos["visible"], "altitude": pos["altitude"], "is_demo": True}
        return {"visible": False, "is_demo": True}
    
    def verify_detection(self, detected_name, latitude, longitude, dt=None):
        """
        Cross-references AI detection with astronomical data.
        Returns verification result with expected vs observed positions.
        """
        pos = self.get_object_position(detected_name, latitude, longitude, dt)
        
        if pos and pos["visible"]:
            match_score = round(random.uniform(0.7, 0.99), 2)
            return {
                "verified": True,
                "match_score": match_score,
                "expected_altitude": pos["altitude"],
                "expected_azimuth": pos["azimuth"],
                "is_demo": True
            }
            
        return {
            "verified": False,
            "match_score": 0.0,
            "is_demo": True,
            "reason": "Object not visible at current time/location"
        }
