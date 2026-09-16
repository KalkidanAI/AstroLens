import time
import uuid
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

logger = logging.getLogger(__name__)

def setup_middleware(app: FastAPI):
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests_and_add_id(request: Request, call_next):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        response = await call_next(request)
        
        duration = time.time() - start_time
        response.headers["X-Request-ID"] = request_id
        
        logger.info(
            f"Method: {request.method} Path: {request.url.path} "
            f"Status: {response.status_code} Duration: {duration:.3f}s RequestID: {request_id}"
        )
        
        return response
