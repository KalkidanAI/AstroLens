from flask import Flask

app = Flask(__name__)

@app.route('/')
@app.route('/<path:path>')
def catch_all(path=''):
    return f"AstroLens Vercel is LIVE! Path requested: /{path}", 200