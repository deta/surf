import asyncio
import json
import logging
import os
from typing import AsyncIterable

from embedchain import App
from embedchain.config import BaseLlmConfig
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
from langchain_community.chat_models.openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

# set access tokens
os.environ["HUGGINGFACE_ACCESS_TOKEN"] = ""
os.environ["OPENAI_API_KEY"] = ""

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
    #seen_urls = set()
    #unique_sources = [source for source in sources_metadata if source['url'] not in seen_urls and not seen_urls.add(source['url'])]
    #sources_str = "<sources>\n" + "\n".join(json.dumps(source) for source in unique_sources) + "\n</sources>\n\n"
    sources_str = "<sources>\n"
    for idx, context in enumerate(contexts):
        sources_str += f"\n{idx+1}. {context.get('context')[:120] + '...' }\n"
    sources_str += "</sources>\n\n"
    return sources_str


async def prepare_contexts_for_llm_query(ec_app, query, config, citations):
    """Retrieve contexts from the database and prepare them for the LLM query."""
    contexts = ec_app._retrieve_from_database(input_query=query, config=config, where={"app_id": ec_app.config.id}, citations=citations)
    if citations and contexts and isinstance(contexts[0], tuple):
        return [context[0] for context in contexts]
    return contexts


async def generate_messages(ec_app, query, contexts_data_for_llm_query, config):
    """Generate messages to be used in the LLM query."""
    messages = []
    if config.system_prompt:
        messages.append(SystemMessage(content=config.system_prompt))
    prompt = ec_app.llm.generate_prompt(query, contexts_data_for_llm_query)
    print("Prompt: ", prompt)
    messages.append(HumanMessage(content=prompt))
    return messages


async def send_message(query, session_id, number_documents, citations, stream, model) -> AsyncIterable[str]:
    ec_app = App.from_config(config=EC_APP_CONFIG)
    context = ec_app.search(query, num_documents=number_documents)
    #sources_str = await generate_sources_str([c['metadata'] for c in context])
    sources_str = await generate_sources_str(context)

    ec_app.llm.update_history(app_id=ec_app.config.id, session_id=session_id)
    callback = AsyncIteratorCallbackHandler()

    # TODO: why OPENAI_API_KEY?
    config = BaseLlmConfig(model=model, stream=stream, callbacks=[callback], api_key=os.environ["OPENAI_API_KEY"])

    contexts_data_for_llm_query = await prepare_contexts_for_llm_query(ec_app, query, config, citations)
    messages = await generate_messages(ec_app, query, contexts_data_for_llm_query, config)

    kwargs = {
        #"model": model,
        "model": "gpt-4",
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "model_kwargs": {"top_p": config.top_p} if config.top_p else {},
        "streaming": stream,
        "callbacks": [callback],
        "api_key": config.api_key,
    }

    '''
    kwargs = {
        "model": "llama3",
        "streaming": True,
        "callbacks": [callback],
    }
    '''

    #llm_task = asyncio.create_task(ChatOllama(**kwargs).agenerate(messages=[messages]))
    llm_task = asyncio.create_task(ChatOpenAI(**kwargs).agenerate(messages=[messages]))

    generated_answer = ""
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
