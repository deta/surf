import asyncio
import logging
import json
import os

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
        timestamp = metadata.get('timestamp', '')
        resource_id = metadata.get('resource_id', '')
        content = context.get('context', '')

        sources_str += (
            f"\t<source>\n"
            f"\t\t<id>{source_id}</id>\n"
            f"\t\t<resource_id>{resource_id}</resource_id>\n"
            f"\t\t<content>{content}</content>\n"
            f"\t\t<metadata>\n"
            f"\t\t\t<timestamp>{timestamp}</timestamp>\n"
            f"\t\t</metadata>\n"
            f"\t</source>\n"
        )
    sources_str += "</sources>\n\n"
    return sources_str


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
    prompt = ec_app.llm.generate_prompt(query, contexts_data_for_llm_query)
    print("Prompt: ", prompt)
    messages.append(HumanMessage(content=prompt))
    return messages


async def send_message(query, session_id, number_documents, system_prompt, citations, stream, model, resource_ids) -> AsyncIterable[str]:
    ec_app = App.from_config(config=EC_APP_CONFIG)

    where = {'app_id': ec_app.config.id}
    if resource_ids != None:
        where = {'$and': [where, {"resource_id": {"$in": resource_ids}}]}

    context = ec_app.search(query, where=where, num_documents=number_documents)
    sources_str = await generate_sources_str(context)

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
