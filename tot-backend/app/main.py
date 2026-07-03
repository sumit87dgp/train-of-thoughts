from app.config import settings
from app.services.logging_config import configure_logging
from app.services.telemetry import configure_telemetry

configure_logging(settings.log_level, settings.log_format)
configure_telemetry(settings.applicationinsights_connection_string)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.tags import router as tags_router
from app.api.thoughts import router as thoughts_router
from app.db.pool import close_pool, create_pool
from app.middleware.request_context import RequestContextMiddleware
from app.services.errors import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_pool()
    yield
    await close_pool()


app = FastAPI(title="Train of Thoughts API", lifespan=lifespan)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestContextMiddleware)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(thoughts_router)
app.include_router(tags_router)
