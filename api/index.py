from flask import Flask, request

app = Flask(__name__)

class VercelPathMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = environ.get('HTTP_X_MATCHED_PATH')
        if matched_path:
            environ['PATH_INFO'] = matched_path
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
    return {"status": "online"}, 200