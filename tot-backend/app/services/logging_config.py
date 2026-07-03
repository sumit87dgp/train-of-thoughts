import json
import logging
from datetime import datetime, timezone


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        from app.request_context import get_request_id

        record.request_id = get_request_id() or "-"  # type: ignore[attr-defined]
        return True


class JsonLogFormatter(logging.Formatter):
    _RECORD_SKIP = frozenset(
        {
            "args",
            "created",
            "exc_info",
            "exc_text",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "module",
            "msecs",
            "message",
            "msg",
            "name",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "stack_info",
            "thread",
            "threadName",
            "taskName",
        }
    )
    _EXTRA_KEYS = frozenset(
        {"method", "path", "status_code", "duration_ms", "code", "request_id"}
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }

        for key in self._EXTRA_KEYS:
            value = getattr(record, key, None)
            if value is not None and value != "-":
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging(log_level: str = "INFO", log_format: str = "text") -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)

    handler = logging.StreamHandler()
    handler.setLevel(level)
    handler.addFilter(RequestIdFilter())

    if log_format.lower() == "json":
        handler.setFormatter(JsonLogFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"
            )
        )

    root.addHandler(handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
