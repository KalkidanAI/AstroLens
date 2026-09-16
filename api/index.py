import urllib.parse
from flask import Flask, request, jsonify

app = Flask(__name__)

class VercelPathMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        query_string = environ.get('QUERY_STRING', '')
        if '__path=' in query_string:
            parsed = urllib.parse.parse_qs(query_string)
            if '__path' in parsed and parsed['__path']:
                target = parsed['__path'][0]
                environ['PATH_INFO'] = '/' + target.lstrip('/')
            else:
                environ['PATH_INFO'] = '/'
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

@app.route('/')
def home():
    return "Home Page OK!", 200

@app.route('/dashboard')
def dashboard():
    return "Dashboard Page OK!", 200

@app.route('/api/status')
def status():
    return jsonify({"status": "online", "message": "AstroLens Vercel is working!"}), 200