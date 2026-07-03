from unittest.mock import MagicMock, patch

import pytest

import app.services.telemetry as telemetry_module
from app.services.telemetry import configure_telemetry


@pytest.fixture(autouse=True)
def reset_telemetry_state():
    telemetry_module._telemetry_configured = False
    yield
    telemetry_module._telemetry_configured = False


def test_configure_telemetry_noop_without_connection_string():
    with patch(
        "azure.monitor.opentelemetry.configure_azure_monitor",
        create=True,
    ) as mock_configure:
        assert configure_telemetry(None) is False
        assert configure_telemetry("") is False
        mock_configure.assert_not_called()


def test_configure_telemetry_enables_when_connection_string_set():
    mock_configure = MagicMock()
    with patch(
        "azure.monitor.opentelemetry.configure_azure_monitor",
        mock_configure,
        create=True,
    ):
        assert configure_telemetry("InstrumentationKey=test-key") is True
        mock_configure.assert_called_once()
        kwargs = mock_configure.call_args.kwargs
        assert kwargs["connection_string"] == "InstrumentationKey=test-key"
        assert kwargs["disable_offline_storage"] is True
        assert kwargs["instrumentation_options"]["psycopg2"]["enabled"] is False


def test_configure_telemetry_is_idempotent():
    mock_configure = MagicMock()
    with patch(
        "azure.monitor.opentelemetry.configure_azure_monitor",
        mock_configure,
        create=True,
    ):
        assert configure_telemetry("InstrumentationKey=test-key") is True
        assert configure_telemetry("InstrumentationKey=test-key") is True
        mock_configure.assert_called_once()
