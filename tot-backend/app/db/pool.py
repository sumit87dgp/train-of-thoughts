from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None

# libpq sslmodes that require a TLS connection for Azure / production Postgres.
_SSL_REQUIRED_MODES = frozenset({"require", "verify-ca", "verify-full"})


def prepare_dsn(dsn: str, *, force_ssl: bool | None = None) -> tuple[str, bool]:
    """Return (dsn for asyncpg, whether to enable SSL).

    asyncpg does not honor libpq ``sslmode`` query params the way ``psql`` does.
    We strip ``sslmode`` from the DSN and pass ``ssl=True`` to ``create_pool`` when needed.
    """
    parsed = urlparse(dsn)
    query = parse_qs(parsed.query, keep_blank_values=True)
    sslmode_values = query.pop("sslmode", [])
    sslmode = sslmode_values[0].lower() if sslmode_values else None

    if force_ssl is True:
        use_ssl = True
    elif force_ssl is False:
        use_ssl = False
    elif sslmode in _SSL_REQUIRED_MODES:
        use_ssl = True
    elif sslmode in ("disable", "allow"):
        use_ssl = False
    else:
        use_ssl = False

    clean_query = urlencode({k: v[0] for k, v in query.items()}, doseq=False)
    clean_dsn = urlunparse(parsed._replace(query=clean_query))
    return clean_dsn, use_ssl


async def create_pool() -> asyncpg.Pool:
    global _pool
    force_ssl: bool | None = None
    if settings.database_ssl is True:
        force_ssl = True
    elif settings.database_ssl is False:
        force_ssl = False

    dsn, use_ssl = prepare_dsn(settings.database_url, force_ssl=force_ssl)
    kwargs: dict = {"dsn": dsn, "min_size": 1, "max_size": 5}
    if use_ssl:
        kwargs["ssl"] = True
    _pool = await asyncpg.create_pool(**kwargs)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialized")
    return _pool
