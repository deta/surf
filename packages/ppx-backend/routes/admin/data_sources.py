import json

from embedchain import App
from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from routes.admin.utils import (set_env_variables, unset_env_variables,
                                validate_json)
from utils.embedchain import EC_APP_CONFIG

router = APIRouter()
ec_app = App.from_config(config=EC_APP_CONFIG)


class DataSourceModel(BaseModel):
    dataType: str
    dataValue: str
    metadata: str
    envVariables: str


@router.get("/api/v1/admin/data_sources")
async def get_all_data_sources():
    data_sources = ec_app.get_data_sources()
    response = data_sources
    for i in response:
        i.update({"app_id": ec_app.config.id})
    return response


@router.get("/api/v1/admin/data_sources/{source_id}")
async def get_data_source(source_id: str, response: Response):
    try:
        data_source = ec_app.db.client.get_collection("embedchain_store").get(
            include=["metadatas", "documents"],
            where={"hash": source_id}
        )
        if len(data_source) == 0 :
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"message": "Data source not found."}

        return {
            "content": data_source["documents"][0], 
            "metadata": data_source["metadatas"][0]
        }
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"message": f"An error occurred: {str(e)}."}


@router.post("/api/v1/admin/data_sources", status_code=201)
async def add_data_source(data_source: DataSourceModel, response: Response):
    """
    Adds a new source to the Embedchain app.
    """
    data_type = data_source.dataType
    data_value = data_source.dataValue
    metadata = data_source.metadata
    env_variables = data_source.envVariables

    # Validate json metadata
    params = {"source": data_value, "data_type": data_type}
    if metadata and not validate_json(metadata):
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"message": "Invalid metadata. Enter a valid JSON object."}
    else:
        params["metadata"] = json.loads(metadata)

    if env_variables and not validate_json(env_variables):
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"message": "Invalid environment variables. Enter a valid JSON object."}

    if data_type == 'text':
        params['metadata']['url'] = 'local'

    try:
        set_env_variables(env_variables)
        ec_app.add(**params)
        unset_env_variables(env_variables)
        return {"message": f"Data of {data_type=} added successfully."}
    except Exception as e:
        message = f"An error occurred: Error message: {str(e)}." # noqa:E501
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"message": message}

#TODO: not have collection name default to embedchain_store
@router.delete("/api/v1/admin/data_sources", status_code=200)
async def delete_data_source(resource_id: str, response:Response, collection_name: str="embedchain_store"):
    try:
        collection = ec_app.db.client.get_collection(collection_name)
        data = collection.get(include=["metadatas"], where={"resource_id": resource_id})
        if len(data) == 0:
            return {"message": "Resource deleted successfully."}

        for metadata in data["metadatas"]:
            ec_app.delete(metadata["hash"])
        
        return {"message": "Resource deleted successfully."}
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        print(f"failed to delete resource {resource_id} from collection {collection_name}: {str(e)}") # noqa:E501
        return {"message": f"An error occurred: {str(e)}."}
