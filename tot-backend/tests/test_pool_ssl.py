import pytest

from app.db.pool import prepare_dsn


@pytest.mark.parametrize(
    ("dsn", "force_ssl", "expect_ssl", "expect_sslmode_absent"),
    [
        (
            "postgres://tot_api:secret@localhost:5433/tot?sslmode=disable",
            None,
            False,
            True,
        ),
        (
            "postgres://tot_api:secret@host.postgres.database.azure.com:5432/tot?sslmode=require",
            None,
            True,
            True,
        ),
        (
            "postgres://tot_api:secret@host.postgres.database.azure.com:5432/tot?sslmode=verify-full",
            None,
            True,
            True,
        ),
        (
            "postgres://tot_api:secret@localhost:5433/tot",
            None,
            False,
            True,
        ),
        (
            "postgres://tot_api:secret@localhost:5433/tot?sslmode=disable",
            True,
            True,
            True,
        ),
        (
            "postgres://tot_api:secret@host.postgres.database.azure.com:5432/tot?sslmode=require",
            False,
            False,
            True,
        ),
    ],
)
def test_prepare_dsn_ssl(
    dsn: str,
    force_ssl: bool | None,
    expect_ssl: bool,
    expect_sslmode_absent: bool,
):
    clean, use_ssl = prepare_dsn(dsn, force_ssl=force_ssl)
    assert use_ssl is expect_ssl
    if expect_sslmode_absent:
        assert "sslmode" not in clean
    assert "tot_api" in clean
    assert "secret" in clean


def test_prepare_dsn_preserves_other_query_params():
    dsn = "postgres://u:p@h:5432/db?sslmode=require&application_name=tot"
    clean, use_ssl = prepare_dsn(dsn)
    assert use_ssl is True
    assert "sslmode" not in clean
    assert "application_name=tot" in clean
