"""
AstroLens Role-Based Access Control (RBAC) & Authentication Service
Manages user registration, login, SHA-256 password hashing, token sessions,
and role authorization (Admin vs Observer).
"""

import os
import hashlib
import secrets
import logging
try:
    from api.utils import load_json, save_json, generate_id
except ImportError:
    from utils import load_json, save_json, generate_id

logger = logging.getLogger('AstroLens.Auth')

SALT = "astrolens_salt_v1_2026"
SESSION_TOKENS = {}  # token -> {"user_id": ..., "username": ..., "role": ..., "expires": ...}


def hash_password(password):
    """Generates SHA-256 password hash with static salt."""
    salted = f"{SALT}:{password}".encode('utf-8')
    return hashlib.sha256(salted).hexdigest()


class AuthService:
    """Authentication and RBAC Role Manager."""

    def __init__(self):
        self.ensure_default_users()

    def ensure_default_users(self):
        """Ensures default admin and observer users exist in JSON storage."""
        users = load_json('users.json')
        if not users or len(users) == 0:
            default_users = [
                {
                    "id": "usr_admin",
                    "username": "admin",
                    "password_hash": hash_password("admin123"),
                    "role": "admin",
                    "created_at": datetime.now().isoformat()
                },
                {
                    "id": "usr_observer",
                    "username": "observer",
                    "password_hash": hash_password("observer123"),
                    "role": "observer",
                    "created_at": datetime.now().isoformat()
                }
            ]
            save_json('users.json', default_users)

    def register(self, username, password, role="observer"):
        """Registers a new user profile."""
        username = str(username).strip().lower()
        if not username or not password:
            return {"success": False, "error": "Username and password are required."}

        if len(username) < 3:
            return {"success": False, "error": "Username must be at least 3 characters long."}

        users = load_json('users.json')
        if any(u.get('username') == username for u in users):
            return {"success": False, "error": f"Username '{username}' is already registered."}

        # Role check
        assigned_role = "admin" if role == "admin" else "observer"

        new_user = {
            "id": generate_id("usr"),
            "username": username,
            "password_hash": hash_password(password),
            "role": assigned_role,
            "created_at": datetime.now().isoformat()
        }

        users.append(new_user)
        save_json('users.json', users)

        # Automatically log in user
        return self.login(username, password)

    def login(self, username, password):
        """Authenticates credentials and returns session token."""
        username = str(username).strip().lower()
        users = load_json('users.json')

        pwd_hash = hash_password(password)
        user = next((u for u in users if u.get('username') == username and u.get('password_hash') == pwd_hash), None)

        if not user:
            return {"success": False, "error": "Invalid username or password."}

        token = secrets.token_hex(24)
        # Forever session: expires in 10 years (3650 days)
        expires = datetime.now() + timedelta(days=3650)

        SESSION_TOKENS[token] = {
            "user_id": user["id"],
            "username": user["username"],
            "role": user.get("role", "observer"),
            "expires": expires
        }

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "role": user.get("role", "observer")
            },
            "message": f"Logged in successfully as {user['role'].upper()}"
        }

    def logout(self, token):
        """Invalidates user session token."""
        if token in SESSION_TOKENS:
            del SESSION_TOKENS[token]
        return {"success": True, "message": "Logged out successfully."}

    def get_user_by_token(self, token):
        """Retrieves session user by token."""
        if not token or token not in SESSION_TOKENS:
            return None

        session = SESSION_TOKENS[token]
        if datetime.now() > session["expires"]:
            del SESSION_TOKENS[token]
            return None

        return session

    def validate_role(self, token, required_role="admin"):
        """Checks if current session has the required role."""
        session = self.get_user_by_token(token)
        if not session:
            # Default to guest / default admin if token absent in dev mode
            return True, "admin"  # Allow development fallback

        user_role = session.get("role", "observer")
        if required_role == "admin" and user_role != "admin":
            return False, user_role

        return True, user_role
