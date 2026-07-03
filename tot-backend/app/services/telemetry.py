import logging

logger = logging.getLogger(__name__)

_telemetry_configured = False


def configure_telemetry(connection_string: str | None = None) -> bool:
    """Enable Azure Monitor export when a connection string is configured."""
    global _telemetry_configured

    if _telemetry_configured:
        return True

    if not connection_string:
        return False

    from azure.monitor.opentelemetry import configure_azure_monitor
    from opentelemetry.sdk.resources import Resource

    configure_azure_monitor(
        connection_string=connection_string,
        disable_offline_storage=True,
        resource=Resource.create({"service.name": "tot-backend"}),
        instrumentation_options={
            "django": {"enabled": False},
            "flask": {"enabled": False},
            "psycopg2": {"enabled": False},
        },
    )

    _telemetry_configured = True
    logger.info("application_insights_enabled")
    return True
