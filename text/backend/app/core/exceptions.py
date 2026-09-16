from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

class ReplyAIException(Exception):
    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code

class NotFoundException(ReplyAIException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(detail, 404)

class UnauthorizedException(ReplyAIException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(detail, 401)

class ForbiddenException(ReplyAIException):
    def __init__(self, detail: str = "Not authorized"):
        super().__init__(detail, 403)

class BadRequestException(ReplyAIException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(detail, 400)

class TelegramException(ReplyAIException):
    def __init__(self, detail: str):
        super().__init__(detail, 400)

class AIProviderException(ReplyAIException):
    def __init__(self, detail: str):
        super().__init__(detail, 502)

def setup_exception_handlers(app: FastAPI):
    @app.exception_handler(ReplyAIException)
    async def replyai_exception_handler(request: Request, exc: ReplyAIException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "status_code": exc.status_code},
        )
