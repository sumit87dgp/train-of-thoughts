import logging
from enum import Enum

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.request_context import REQUEST_ID_HEADER, get_request_id

logger = logging.getLogger(__name__)


class ErrorCode(str, Enum):
    HTTP_ERROR = "HTTP_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    INVALID_TOKEN = "INVALID_TOKEN"
    INVALID_TOKEN_PAYLOAD = "INVALID_TOKEN_PAYLOAD"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    THOUGHT_NOT_FOUND = "THOUGHT_NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class APIHTTPException(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: str,
        code: ErrorCode,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


def error_body(detail: str, code: ErrorCode | str) -> dict[str, str]:
    code_value = code.value if isinstance(code, ErrorCode) else str(code)
    return {"detail": detail, "code": code_value}


def json_error(
    status_code: int,
    detail: str,
    code: ErrorCode | str,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    merged_headers = dict(headers or {})
    request_id = get_request_id()
    if request_id:
        merged_headers[REQUEST_ID_HEADER] = request_id

    return JSONResponse(
        status_code=status_code,
        content=error_body(detail, code),
        headers=merged_headers,
    )


def _request_log_extra(request: Request) -> dict[str, str]:
    return {
        "method": request.method,
        "path": request.url.path,
    }


def raise_thought_not_found() -> None:
    raise APIHTTPException(
        status_code=404,
        detail="Thought not found",
        code=ErrorCode.THOUGHT_NOT_FOUND,
    )


def raise_not_authenticated() -> None:
    raise APIHTTPException(
        status_code=401,
        detail="Not authenticated",
        code=ErrorCode.NOT_AUTHENTICATED,
        headers={"WWW-Authenticate": "Bearer"},
    )


def raise_invalid_token() -> None:
    raise APIHTTPException(
        status_code=401,
        detail="Invalid or expired token",
        code=ErrorCode.INVALID_TOKEN,
        headers={"WWW-Authenticate": "Bearer"},
    )


def raise_invalid_token_payload() -> None:
    raise APIHTTPException(
        status_code=401,
        detail="Invalid token payload",
        code=ErrorCode.INVALID_TOKEN_PAYLOAD,
        headers={"WWW-Authenticate": "Bearer"},
    )


def raise_invalid_credentials() -> None:
    raise APIHTTPException(
        status_code=401,
        detail="Incorrect username or password",
        code=ErrorCode.INVALID_CREDENTIALS,
    )


def _detail_message(detail: object) -> str:
    if isinstance(detail, str):
        return detail
    return str(detail)


async def api_http_exception_handler(
    request: Request,
    exc: APIHTTPException,
) -> JSONResponse:
    detail = _detail_message(exc.detail)
    if exc.status_code >= 500:
        logger.error(
            "api_error",
            extra={**_request_log_extra(request), "code": exc.code.value, "status_code": exc.status_code},
        )
    else:
        logger.warning(
            "api_error",
            extra={**_request_log_extra(request), "code": exc.code.value, "status_code": exc.status_code},
        )

    return json_error(
        status_code=exc.status_code,
        detail=detail,
        code=exc.code,
        headers=exc.headers,
    )


async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    logger.warning(
        "http_error",
        extra={**_request_log_extra(request), "status_code": exc.status_code},
    )
    return json_error(
        status_code=exc.status_code,
        detail=_detail_message(exc.detail),
        code=ErrorCode.HTTP_ERROR,
        headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    logger.warning(
        "validation_error",
        extra=_request_log_extra(request),
    )
    return json_error(
        status_code=422,
        detail="Validation failed",
        code=ErrorCode.VALIDATION_ERROR,
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception(
        "unhandled_error",
        extra=_request_log_extra(request),
        exc_info=exc,
    )
    return json_error(
        status_code=500,
        detail="Internal server error",
        code=ErrorCode.INTERNAL_ERROR,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(APIHTTPException, api_http_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
