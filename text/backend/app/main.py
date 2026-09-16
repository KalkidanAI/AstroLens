from fastapi import FastAPI
from app.config import get_settings
from app.core.middleware import setup_middleware
from app.core.exceptions import setup_exception_handlers
from app.api.v1.router import api_router

def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        description="Your Personal AI Communication Assistant",
        version="0.1.0",
    )
    setup_middleware(app)
    setup_exception_handlers(app)
    app.include_router(api_router)
    
    @app.get("/health")
    async def health():
        return {"status": "healthy", "app": settings.app_name}
    
    return app

app = create_app()
