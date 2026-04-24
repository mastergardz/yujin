from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import init_db
from routers import chat, teams, config, rooms, workspace

app = FastAPI(title="Yujin AI Secretary")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(teams.router)
app.include_router(config.router)
app.include_router(rooms.router)
app.include_router(workspace.router)

@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/")
async def root():
    return {"message": "Yujin AI Secretary is running"}
