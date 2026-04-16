import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from realtime import sio, register_lifespan_handlers
from routers import auth, trust, face, admin, blast_radius, remediation, analyze, telemetry

fastapi_app = FastAPI(title="Agenticzero API", version="2.4.1")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_lifespan_handlers(fastapi_app)

fastapi_app.include_router(auth.router, prefix="/api")
fastapi_app.include_router(trust.router, prefix="/api")
fastapi_app.include_router(face.router, prefix="/api")
fastapi_app.include_router(admin.router, prefix="/api")
fastapi_app.include_router(blast_radius.router, prefix="/api")
fastapi_app.include_router(remediation.router, prefix="/api")
fastapi_app.include_router(analyze.router, prefix="/api")
fastapi_app.include_router(telemetry.router, prefix="/api")


@fastapi_app.get("/")
async def root():
    return {
        "service": "Agenticzero - Zero Trust Platform",
        "version": "2.4.1",
        "status": "operational",
    }


@fastapi_app.get("/api/health")
async def health():
    return {"status": "healthy"}


app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")
