import os
from typing import Union

from fastapi import APIRouter, Query, responses, Response
from fastapi.responses import StreamingResponse

from embedchain.loaders.youtube_video import YoutubeLoader

from utils.embedchain import send_message
from utils.embedchain import get_embedding
from utils.sffs import get_resource
from utils.embedchain import get_resources
from utils.mocks import mock_stream


router = APIRouter()

DEFAULT_MODEL = "gpt-4o"
DB_PATH = os.getenv("DB_PATH", "")

@router.get("/api/v1/chat")
async def handle_chat(
    query: str,
    session_id: str = Query(None),
    number_documents: int = 5,
    system_prompt: str = Query(None),
    mock: bool = False,
    rag_only: bool = False,
    resource_ids: Union[str, None] = None
):
    """
    Handles a chat request to the Embedchain app.
    Accepts 'query' and 'session_id' as query parameters.
    """
    if mock:
        return StreamingResponse(mock_stream())
    resource_ids_list = resource_ids.split(',') if resource_ids != None else None

    generator = send_message(
        query, 
        session_id, 
        number_documents,
        system_prompt, 
        True,
        True,
        DEFAULT_MODEL,
        resource_ids_list,
        rag_only
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

@router.get('/api/v1/resources')
async def handle_get_resources(query: str, resource_ids: Union[str, None] = None):
    resource_ids_list = resource_ids.split(',') if resource_ids != None else None
    return set(await get_resources(query, resource_ids_list))

@router.get("/api/v1/transcripts/youtube")
async def handle_get_youtube_transcript(url: str, response: Response):
    try:
        loader = YoutubeLoader.from_youtube_url(url)
        result = loader.load()
        if len(result) == 0:
            print("failed to load youtube transcript from url: ", url, ", result len 0")
            response.status_code = 404
            return {"detail": "no transcript found"}
        transcript = result[0]
        return {
            "transcript": transcript.page_content,
            "metadata": transcript.metadata
        }
    except Exception as e:
            print("failed to load youtube transcript from url: ", url, e)
            response.status_code = 500
            return {"detail": e}
    

@router.get("/")
async def root():
    return responses.RedirectResponse(url="/docs")
