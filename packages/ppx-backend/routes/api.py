from typing import Union

from fastapi import APIRouter, Query, responses
from fastapi.responses import StreamingResponse

from utils.embedchain import send_message
from utils.embedchain import get_embedding

router = APIRouter()

DEFAULT_MODEL = "gpt-4o"


@router.get("/api/v1/chat")
async def handle_chat(
    query: str,
    session_id: str = Query(None),
    number_documents: int = 5,
    system_prompt: str = Query(None),
    resource_ids: Union[str, None] = None
):
    """
    Handles a chat request to the Embedchain app.
    Accepts 'query' and 'session_id' as query parameters.
    """
    resource_ids = resource_ids.split(',') if resource_ids != None else None
    generator = send_message(
        query, 
        session_id, 
        number_documents,
        system_prompt, 
        True,
        True,
        DEFAULT_MODEL,
        resource_ids,
    )
    return StreamingResponse(generator)

@router.post("/api/v1/embeddings")
async def handle_embeddings(data: str):
    """
    Handles a request to get embeddings for a given string.
    Accepts 'data' as a POST parameter.
    """
    return await get_embedding(data)


@router.get("/")
async def root():
    return responses.RedirectResponse(url="/docs")
