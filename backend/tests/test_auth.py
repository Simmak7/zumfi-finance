"""Tests for the auth feature: register, login, duplicate email, wrong password, /me."""

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from features.auth.service import AuthService
from features.auth.models import User


async def test_register_creates_user(db_session: AsyncSession):
    user = await AuthService.register(
        db_session, email="new@test.com", password="securepass", display_name="New"
    )
    assert user.id is not None
    assert user.email == "new@test.com"
    assert user.display_name == "New"
    assert user.password_hash != "securepass"  # hashed


async def test_register_without_display_name(db_session: AsyncSession):
    user = await AuthService.register(
        db_session, email="minimal@test.com", password="pass123"
    )
    assert user.email == "minimal@test.com"
    assert user.display_name is None


async def test_register_duplicate_email(db_session: AsyncSession):
    await AuthService.register(db_session, email="dup@test.com", password="pass1")
    with pytest.raises(HTTPException) as exc_info:
        await AuthService.register(db_session, email="dup@test.com", password="pass2")
    assert exc_info.value.status_code == 400
    assert "already registered" in exc_info.value.detail


async def test_login_returns_token(db_session: AsyncSession):
    await AuthService.register(db_session, email="login@test.com", password="mypass")
    result = await AuthService.login(db_session, email="login@test.com", password="mypass")
    assert isinstance(result, dict)
    assert "access_token" in result
    assert "refresh_token" in result
    assert "expires_in" in result
    assert len(result["access_token"]) > 20  # JWT tokens are long


async def test_login_wrong_password(db_session: AsyncSession):
    await AuthService.register(db_session, email="wrong@test.com", password="correct")
    with pytest.raises(HTTPException) as exc_info:
        await AuthService.login(db_session, email="wrong@test.com", password="incorrect")
    assert exc_info.value.status_code == 401


async def test_login_nonexistent_email(db_session: AsyncSession):
    with pytest.raises(HTTPException) as exc_info:
        await AuthService.login(db_session, email="ghost@test.com", password="any")
    assert exc_info.value.status_code == 401


@pytest.mark.skip(reason="Rate limiter requires Redis connection in test env")
async def test_me_endpoint(client):
    """GET /auth/me returns the authenticated user."""
    resp = await client.get("/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"
    assert "id" in data


@pytest.mark.skip(reason="Rate limiter requires Redis connection in test env")
async def test_me_without_auth(test_app):
    """GET /auth/me without token returns 401."""
    import httpx

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=test_app),
        base_url="http://test",
    ) as ac:
        resp = await ac.get("/auth/me")
    assert resp.status_code == 401
