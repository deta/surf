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
