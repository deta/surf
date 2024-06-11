import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import api
from routes.admin import chat_history, data_sources, vector_stores

load_dotenv(".env")

app = FastAPI(title="Embedchain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router)
app.include_router(data_sources.router)
app.include_router(chat_history.router)
app.include_router(vector_stores.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="info",
                reload=True, timeout_keep_alive=600)
