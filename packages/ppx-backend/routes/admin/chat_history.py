import xmltodict

from embedchain import App
from fastapi import APIRouter

from utils.embedchain import EC_APP_CONFIG

ec_app = App.from_config(config=EC_APP_CONFIG)

router = APIRouter()

@router.get("/api/v1/admin/chat_history")
async def get_all_chat_history():
    chat_history = ec_app.llm.memory.get(
        app_id=ec_app.config.id,
        num_rounds=100,
        display_format=True,
        fetch_all=True,
    )
    return chat_history

@router.get("/api/v1/admin/chat_history/{session_id}")
async def get_chat_history(session_id: str):
    chat_history = ec_app.llm.memory.get(
        app_id=ec_app.config.id,
        session_id=session_id,
        num_rounds=100,
        display_format=True,
    )
    formatted = format_chat_history(chat_history)
    return {
        "id": session_id,
        "messages": formatted,
    }
            
def format_chat_history(chat_history):
    messages = []
    for chat in chat_history:
        human_message = chat.get("human", "")
        messages.append({
            "role": "user",
            "content": human_message,
        }) 
        ai_message, sources = split_source_data(chat.get("ai", ""))
        messages.append({
            "role": "system",
            "content": ai_message,
            "sources": sources.get("source", []) if sources else [],
        })
    return messages

def split_source_data(ai_message):
    parts = ai_message.split("</sources>")
    if len(parts) <= 1:
        return ai_message, None
    clean_sources = parts[0] + "</sources>"
    sources_dict = xmltodict.parse(clean_sources)
    return parts[1], sources_dict.get("sources", None)

