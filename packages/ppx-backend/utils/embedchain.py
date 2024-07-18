import asyncio
import logging
import os

from string import Template
from typing import AsyncIterable, List, Union


from embedchain import App
from embedchain.config import BaseLlmConfig
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
from langchain_community.chat_models.openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

HUGGINGFACE_PROVIDER = "huggingface"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "mixedbread-ai/mxbai-embed-large-v1")
LLM_MODEL = os.getenv("LLM_MODEL", "meta-llama/Meta-Llama-3-8B")
TOP_P = float(os.getenv("TOP_P", "0.1"))

EC_APP_CONFIG = {
    "app": {
        "config": {
            "id": "embedchain-demo-app",
        }
    },
    "llm": {
        "provider": HUGGINGFACE_PROVIDER,
        "config" : {
            "model": LLM_MODEL,
            "top_p": TOP_P,
        }
    },
    "embedder": {
        "provider": HUGGINGFACE_PROVIDER,
        "config": {
            "model": EMBEDDING_MODEL,
        },
    },
}

async def generate_sources_str(contexts):
    """Generate a string of unique source URLs from the sources metadata."""
    sources_str = "<sources>\n"
    for idx, context in enumerate(contexts, 1):
        source_id = idx
        metadata = context.get('metadata', {})
        hash = metadata.get('hash', '')
        timestamp = metadata.get('timestamp', '')
        resource_id = metadata.get('resource_id', '')
        url = metadata.get('url', '').removesuffix('/')
        # TODO: why is this local?
        if url == 'local': url = ''

        # TODO: we don't use the content from the source at the moment
        # later might be useful to add it to the sources
        # content = context.get('context', '')
        content = ""

        sources_str += (
            f"\t<source>\n"
            f"\t\t<id>{source_id}</id>\n"
            f"\t\t<hash>{hash}</hash>\n"
            f"\t\t<resource_id>{resource_id}</resource_id>\n"
            f"\t\t<content>{content}</content>\n"
            f"\t\t<metadata>\n"
            f"\t\t\t<timestamp>{timestamp}</timestamp>\n"
            f"\t\t\t<url>{url}</url>\n"
            f"\t\t</metadata>\n"
            f"\t</source>\n"
        )
    sources_str += "</sources>\n\n"
    return sources_str

def generate_contents_str(contexts):
    contents_str = "<answer>\n <h2> Chunks: </h2>\n<ul>\n"
    yield contents_str
    for idx, context in enumerate(contexts, 1):
        content = context.get('context', '')
        contents_str = f"<li> <strong>{idx}.</strong> {content} <citation>{idx}</citation></li>\n"
        yield contents_str
    contents_str = "</ul>\n</answer>\n"
    yield contents_str


async def prepare_contexts_for_llm_query(ec_app, query, config, citations, where):
    """Retrieve contexts from the database and prepare them for the LLM query."""
    contexts = ec_app._retrieve_from_database(input_query=query, config=config, where=where, citations=citations)
    if citations and contexts and isinstance(contexts[0], tuple):
        return [context[0] for context in contexts]
    return contexts


async def generate_messages(ec_app, query, contexts_data_for_llm_query, config, system_prompt):
    """Generate messages to be used in the LLM query."""
    messages = []
    sprompt = system_prompt or config.system_prompt
    if sprompt:
        messages.append(SystemMessage(content=system_prompt))
    prompt = ec_app.llm.generate_prompt(contexts_data_for_llm_query, query)
    print("Prompt: ", prompt)
    messages.append(HumanMessage(content=prompt))
    return messages

async def create_app(query, session_id, system_prompt, model, contexts) -> str:
    ec_app = App.from_config(config=EC_APP_CONFIG)

    ec_app.llm.config.prompt = Template(system_prompt)
    ec_app.llm.update_history(app_id=ec_app.config.id, session_id=session_id)
    config = BaseLlmConfig(model=model, stream=False, api_key=os.environ["OPENAI_API_KEY"])
    prompt = ec_app.llm.generate_prompt(contexts, input_query=None)
    messages = [SystemMessage(content=prompt), HumanMessage(content=query.removeprefix("app:").removeprefix("App:"))]
    kwargs = {
        "model": model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "model_kwargs": {"top_p": config.top_p} if config.top_p else {},
        "api_key": config.api_key,
    }
    msg = ChatOpenAI(**kwargs).invoke(messages)
    answer = msg.content
    # TODO: why is this like this for god's sake
    if isinstance(answer, list):
        answer = answer[0]
    if isinstance(answer, dict):
        answer = answer.get("content", "")
    ec_app.llm.add_history(ec_app.config.id, query, answer, session_id=session_id)
    return answer

async def oneoff_chat(query, system_prompt, model) -> str:
    ec_app = App.from_config(config=EC_APP_CONFIG)

    ec_app.llm.config.prompt = Template(system_prompt)
    config = BaseLlmConfig(model=model, stream=False, api_key=os.environ["OPENAI_API_KEY"])
    prompt = ec_app.llm.generate_prompt([], input_query=query)
    messages = [SystemMessage(content=prompt)]
    kwargs = {
        "model": model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "model_kwargs": {"top_p": config.top_p} if config.top_p else {},
        "api_key": config.api_key,
    }
    msg = ChatOpenAI(**kwargs).invoke(messages)
    answer = msg.content
    # TODO: why is this like this for god's sake
    if isinstance(answer, list):
        answer = answer[0]
    if isinstance(answer, dict):
        answer = answer.get("content", "")
    return answer


async def send_general_message(query, session_id, stream, model) -> AsyncIterable[str]:
    ec_app = App.from_config(config=EC_APP_CONFIG)
    
    ec_app.llm.update_history(app_id=ec_app.config.id, session_id=session_id)
    callback = AsyncIteratorCallbackHandler()

    config = BaseLlmConfig(model=model, stream=stream, callbacks=[callback], api_key=os.environ["OPENAI_API_KEY"])
    messages = await generate_messages(ec_app, query, [], config, "You are a helpful assistant. Please help the user with their query.")

    kwargs = {
        "model": model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "model_kwargs": {"top_p": config.top_p} if config.top_p else {},
        "streaming": stream,
        "callbacks": [callback],
        "api_key": config.api_key,
    }

    llm_task = asyncio.create_task(ChatOpenAI(**kwargs).agenerate(messages=[messages]))
    generated_answer = "<sources></sources>"
    try:
        yield generated_answer
        async for token in callback.aiter():
            yield token
            generated_answer += token
    except Exception as e:
        logging.exception(f"Caught exception: {e}")
    finally:
        # add conversation in memory
        ec_app.llm.add_history(ec_app.config.id, query, generated_answer, session_id=session_id)
        callback.done.set()
    await llm_task

async def send_message(query, session_id, number_documents, system_prompt, citations, stream, model, resource_ids, rag_only, do_rag) -> AsyncIterable[str]:
    ec_app = App.from_config(config=EC_APP_CONFIG)

    where = {'app_id': ec_app.config.id}
    if resource_ids is not None:
        where = {'$and': [where, {"resource_id": {"$in": resource_ids}}]}

    contexts = {}
    if do_rag:
        contexts = ec_app.search(query, where=where, num_documents=number_documents)
    else:
        # TODO: not have hardcoded collection name
        data = ec_app.db.client.get_collection("embedchain_store").get(
            include=["documents", "metadatas"], 
            where=where,
        )
        contexts = [{"context": doc, "metadata": meta} for doc, meta in zip(data['documents'], data['metadatas'])]

    sources_str = await generate_sources_str(contexts)
    
    if rag_only:
        generated_answer = sources_str
        yield sources_str
        for chunk in generate_contents_str(contexts):
            yield chunk
            generated_answer += chunk
        ec_app.llm.add_history(ec_app.config.id, query, generated_answer, session_id=session_id)
        return


    ec_app.llm.update_history(app_id=ec_app.config.id, session_id=session_id)
    callback = AsyncIteratorCallbackHandler()

    config = BaseLlmConfig(model=model, stream=stream, callbacks=[callback], api_key=os.environ["OPENAI_API_KEY"])

    contexts_data_for_llm_query = await prepare_contexts_for_llm_query(ec_app, query, config, citations, where=where)
    messages = await generate_messages(ec_app, query, contexts_data_for_llm_query, config, system_prompt)

    kwargs = {
        "model": model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "model_kwargs": {"top_p": config.top_p} if config.top_p else {},
        "streaming": stream,
        "callbacks": [callback],
        "api_key": config.api_key,
    }

    llm_task = asyncio.create_task(ChatOpenAI(**kwargs).agenerate(messages=[messages]))

    generated_answer = sources_str
    try:
        yield sources_str
        async for token in callback.aiter():
            yield token
            generated_answer += token
    except Exception as e:
        logging.exception(f"Caught exception: {e}")
    finally:
        # add conversation in memory
        ec_app.llm.add_history(ec_app.config.id, query, generated_answer, session_id=session_id)
        callback.done.set()
    await llm_task

async def get_embedding(data: str) -> list[float]:
    ec_app = App.from_config(config=EC_APP_CONFIG)
    return ec_app.embedding_model.to_embeddings(data)

async def get_resources(query: str, resource_ids: Union[List[str], None]) -> list[float]:
    ec_app = App.from_config(config=EC_APP_CONFIG)

    where = {'app_id': ec_app.config.id}
    if resource_ids != None:
        where = {'$and': [where, {"resource_id": {"$in": resource_ids}}]}

    contexts = ec_app.search(query, where=where, num_documents=100)
    resource_ids = [(context.get('metadata', {}).get('resource_id'), context.get('metadata', {}).get('score')) for context in contexts]
    resource_ids = [rid for (rid, score) in resource_ids if rid is not None and score is not None and score < 300]

    return resource_ids
