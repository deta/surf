import os
from fastapi import APIRouter, Query, responses
from fastapi.responses import StreamingResponse

from utils.embedchain import send_message
from utils.embedchain import get_embedding
from utils.sffs import get_resource

router = APIRouter()

DEFAULT_MODEL = "gpt-4o"
DB_PATH = os.getenv("DB_PATH")

@router.get("/api/v1/chat")
async def handle_chat(query: str, session_id: str = Query(None), number_documents: int = 5, system_prompt: str = Query(None)):
    """
    Handles a chat request to the Embedchain app.
    Accepts 'query' and 'session_id' as query parameters.
    """
    generator = send_message(
        query, 
        session_id, 
        number_documents,
        system_prompt, 
        True,
        True,
        DEFAULT_MODEL,
    )
    return StreamingResponse(generator)

@router.post("/api/v1/embeddings")
async def handle_embeddings(data: str):
    """
    Handles a request to get embeddings for a given string.
    Accepts 'data' as a POST parameter.
    """
    return await get_embedding(data)

@router.get("/api/v1/resources/{resource_id}")
async def handle_get_resource(resource_id):
    resource = get_resource(resource_id, DB_PATH)
    if not resource:
        return responses.JSONResponse(status_code=404, content={"message": "Resource not found"})
    return resource


@router.get("/")
async def root():
    return responses.RedirectResponse(url="/docs")
