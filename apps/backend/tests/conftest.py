"""Pytest configuration and fixtures."""

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.database import get_db
from app.main import app
from app.models import Base

settings = get_settings()

# Use the DATABASE_URL as-is if it already points to a test database,
# otherwise append _test to the database name
if settings.database_url.endswith("_test"):
    TEST_DATABASE_URL = settings.database_url
else:
    TEST_DATABASE_URL = settings.database_url.replace("/svs_browser", "/svs_browser_test")


# Create engine once for all tests
_test_engine = None
_async_session_maker = None


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    global _test_engine, _async_session_maker

    if _test_engine is None:
        _test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
        _async_session_maker = async_sessionmaker(
            _test_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        # Create tables
        async with _test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async with _async_session_maker() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database session override."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()
