import os
from contextlib import asynccontextmanager
from pathlib import Path

from asyncpg import Pool, create_pool
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routes.files import router as files_router
from .routes.auth import router as auth_router


async def get_pool() -> Pool:
    return await create_pool(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ["POSTGRES_PORT"],
        user=os.environ["POSTGRES_APP_ROLE"],
        password=os.environ["POSTGRES_APP_PASSWORD"],
        database=os.environ["POSTGRES_DB"],
        min_size=int(os.environ.get("POSTGRES_POOL_MIN_SIZE", "5")),
        max_size=int(os.environ.get("POSTGRES_POOL_MAX_SIZE", "20")),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await get_pool()
    yield
    await app.state.pool.close()


app = FastAPI(title="Secure Drive", lifespan=lifespan)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")

if os.environ.get("SERVE_FRONTEND", "0") == "1":
    dist_dir = os.environ.get("FRONTEND_DIST", "")
    if dist_dir:
        dist_path = Path(dist_dir).resolve()
        if dist_path.exists():
            app.mount(
                "/", StaticFiles(directory=str(dist_path), html=True), name="frontend"
            )
else:
    frontend_port = os.environ.get("FRONTEND_PORT")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:" + str(frontend_port),
            "http://127.0.0.1:" + str(frontend_port),
            os.environ.get("BASE_URL", ""),
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    pass
