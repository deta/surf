import numpy as np
import pyLDAvis
import pyLDAvis.gensim_models as gensimvis

from embedchain import App
from fastapi import APIRouter, Response, Query

from utils.embedchain import EC_APP_CONFIG
from utils.topics import bertopic_model, lda_model, lda_model_all_docs
from typing import Optional

router = APIRouter()
ec_app = App.from_config(config=EC_APP_CONFIG)


@router.get("/api/v1/admin/collections")
async def get_all_collections():
    # Currently only works for ChromaDB but can be extended easily
    # for other vector stores as well
    collections = ec_app.db.client.list_collections()
    responses = [c.dict() for c in collections]
    return responses


@router.get("/api/v1/admin/collections/chromadb/{collection_name}")
async def get_collection_details(collection_name: str):
    collection = ec_app.db.client.get_collection(collection_name) 
    collection_data = collection.get()
    metadatas, documents = collection_data['metadatas'], collection_data['documents']
    collated_data = []
    for i in zip(metadatas, documents):
        collated_data.append({
            "metadata": i[0],
            "document": i[1]
        })
    response = {"details": collection.dict(), "data": collated_data}
    return response

@router.get("/api/v1/admin/collections/chromadb/{collection_name}/topics/bertopic")
async def get_collection_topics_bertopic(
        collection_name: str, 
        minimum_topics: Optional[int] = Query(None, ge=2, le=100),
        top_n_words: Optional[int] = Query(None, ge=1, le=20),
    ):
    collection = ec_app.db.client.get_collection(collection_name)
    collection_data = collection.get(
            include=["documents", "metadatas"]
    )
    documents, metadatas  = collection_data['documents'], collection_data['metadatas']

    #TODO : figure out why combining docs produces no topics
    '''
    docs = {}
    for i in zip(documents, metadatas):
        resource_id = i[1].get("resource_id")
        if docs.get(resource_id):
            docs[resource_id] += f" {i[0]}"
        else:
            docs[resource_id] = i[0]

    combined_docs = []
    for _, v in docs.items():
        combined_docs.append(v)
    '''

    if len(documents) == 0:
        return Response(content="No documents found", media_type="text/html")

    if not minimum_topics:
        minimum_topics = 2
    if not top_n_words:
        top_n_words = 10
    topic_model = bertopic_model(min_topic_size=minimum_topics, top_n_words=top_n_words)
    topic_model.fit_transform(documents)
    
    # TODO: how to reduce topics?
    '''
    if num_topics:
        topic_model.reduce_topics(documents, nr_topics=num_topics)
    '''
    try:
        graph = topic_model.visualize_topics()
        #graph = topic_model.visualize_documents(combined_docs)
        return Response(content=graph.to_html(), media_type="text/html")
    except Exception as e:
        print("error, failed to visualize bert topics:", e)
        topic_info = topic_model.get_topic_info()
        topic_info.drop('Representative_Docs', axis=1, inplace=True)
        result = """
            Failed to visualize topics (can happen when there is too few data), here are the topics list
            <br/>
            <strong> Note: Topic -1 is the default topic for documents that do not fit into any topic </strong>
            <br/>
        """
        result += topic_info.to_html() 
        return Response(content=result, media_type="text/html")


@router.get("/api/v1/admin/collections/chromadb/{collection_name}/topics/lda")
async def get_collection_topics_lda(collection_name: str, num_topics: int = 10, passes: int = 10):
    collection = ec_app.db.client.get_collection(collection_name)
    collection_data = collection.get(
            include=["documents", "metadatas"] 
    )

    documents, metadatas = collection_data['documents'], collection_data['metadatas']

    if len(documents) == 0:
        return Response(content="No documents found", media_type="text/html")

    docs = {}
    for i in zip(documents, metadatas):
        resource_id = i[1].get("resource_id")
        if docs.get(resource_id):
            docs[resource_id] += f" {i[0]}"
        else:
            docs[resource_id] = i[0]

    combined_docs = []
    for _, v in docs.items():
        combined_docs.append(v)
    
    corpus, dictionary, topic_model = lda_model_all_docs(combined_docs, num_topics=num_topics, passes=passes)
    '''
    topics = topic_model.show_topics(num_topics=num_topics, num_words=10)
    for idx, topic in topics:
        t = 'Topic: {} \n Words: {}'.format(idx, topic) 
    doc_topic_dist = [topic_model.get_document_topics(bow) for bow in corpus]
    for i, topic_dist in enumerate(doc_topic_dist):
        t = f"Document {i} topic distribution: {topic_dist}"
    '''
    vis = gensimvis.prepare(topic_model, corpus, dictionary)
    return Response(pyLDAvis.prepared_data_to_html(vis), media_type="text/html") 
