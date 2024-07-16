import os
from typing import Union, List, Optional

from fastapi import APIRouter, Query, responses, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


from utils.embedchain import create_app, send_message, send_general_message, get_embedding, get_resources, oneoff_chat
from embedchain.loaders.youtube_video import YoutubeLoader
from utils.sffs import get_resource
from utils.mocks import mock_stream
from utils.query_classifier import is_query_a_question
from utils.embeddings import get_similar_docs
from utils.prompts import CREATE_APP_PROMPT, COMMAND_PROMPT, SQL_QUERY_GENERATOR_PROMPT


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

    if query.lower().startswith("general:"):
        generator = send_general_message(query, session_id, True, DEFAULT_MODEL)
        return StreamingResponse(generator)
    
    do_rag = is_query_a_question(query)
    if do_rag and rag_only:
        return responses.JSONResponse(status_code=400, content={"message": "RAG only works with non-questions"})

    generator = send_message(
        query, 
        session_id, 
        number_documents,
        system_prompt, 
        True,
        True,
        DEFAULT_MODEL,
        resource_ids_list,
        rag_only,
        do_rag
    )
    return StreamingResponse(generator)


class AppRequest(BaseModel):
    prompt: str
    contexts: List[str]
    session_id: str
    system_prompt: Optional[str] = None

@router.post("/api/v1/app")
async def handle_app(request: AppRequest):
    try:
        system_prompt = COMMAND_PROMPT
        if request.prompt.lower().startswith("app:"):
            system_prompt = CREATE_APP_PROMPT
        if request.system_prompt:
            system_prompt = request.system_prompt
        app = await create_app(request.prompt, request.session_id, system_prompt, DEFAULT_MODEL, request.contexts)
        return responses.PlainTextResponse(content=app)
    except Exception as e:
        print("Exception in creating app:", str(e))
        return str(e)

@router.get("/api/v1/sql_query")
async def handle_sql_query(query: str):
    try:
        system_prompt = SQL_QUERY_GENERATOR_PROMPT
        answer = await oneoff_chat(query, system_prompt, DEFAULT_MODEL)
        return responses.PlainTextResponse(content=answer)
    except Exception as e:
        print("Exception in generating sql query:", str(e))
        return str(e)


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

class ResourcesQueryRequest(BaseModel):
    query: str
    resource_ids: List[str]

@router.post('/api/v1/resources/query')
async def handle_get_resources(request: ResourcesQueryRequest):
    return set(await get_resources(request.query, request.resource_ids))

class SimilarDocsRequest(BaseModel):
    query: str
    docs: list[str]
    threshold: float = 0.5

@router.post("/api/v1/docs_similarity")
async def handle_get_similar_docs(request: SimilarDocsRequest):
    try:
        result = get_similar_docs(request.query, request.docs, request.threshold)
        response = []
        for doc, sim in result:
            response.append({"doc": doc, "similarity": sim})
        return response
    except Exception as e:
        print("Error in get_similar_docs:", e)
        return responses.JSONResponse(status_code=500, content={"message": str(e)})

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
