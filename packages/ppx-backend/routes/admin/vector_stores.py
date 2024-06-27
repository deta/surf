# TODO: save models to disk and reload them

import pyLDAvis
import pyLDAvis.gensim_models as gensimvis
import numpy as np

from embedchain import App
from umap import UMAP
from fastapi import APIRouter, Response, Query
from fastapi.responses import JSONResponse

from utils.embedchain import EC_APP_CONFIG
from utils.topics import bertopic_model, lda_model, lda_model_all_docs, clean_bert_topic
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

#TODO : figure out why combining docs produces no topics
# might be the document length
@router.get("/api/v1/admin/collections/chromadb/{collection_name}/topics/bertopic")
async def get_collection_topics_bertopic(
        collection_name: str, 
        minimum_topics: Optional[int] = Query(None, ge=2, le=100),
        nr_topics: Optional[int] = Query(None, ge=2),
        top_n_words: Optional[int] = Query(None, ge=1, le=20),
        visualize: Optional[bool] = False,
        prob_threshold: Optional[float] = Query(None, ge=0.1, le=1.0)
    ):
    collection = ec_app.db.client.get_collection(collection_name)
    collection_data = collection.get(
            include=["documents", "metadatas", "embeddings"]
    )
    documents, metadatas, embeddings = collection_data['documents'], collection_data['metadatas'], collection_data['embeddings']
    resource_ids = [m.get("resource_id") for m in metadatas]

    if len(documents) == 0:
        return Response(content="No documents found", media_type="text/html")

    if not minimum_topics:
        minimum_topics = 2
    if not top_n_words:
        top_n_words = 15
    if not prob_threshold:
        prob_threshold = 0.3

    topic_model = bertopic_model(min_topic_size=minimum_topics, top_n_words=top_n_words, nr_topics=nr_topics)

    embeddings = np.array(embeddings)
    topic_model.fit_transform(documents, embeddings=embeddings)

    if visualize:
        try:
            topic_info = topic_model.get_topic_info()
            cleaned_topics = {}
            for index, row in enumerate(topic_info[['Name']].itertuples(index=False)):
                cleaned_topics[index] = clean_bert_topic(row[0])
            topic_model.set_topic_labels(cleaned_topics)
            graph = topic_model.visualize_documents(
                docs=resource_ids, 
                embeddings=embeddings,
                hide_annotations=True,
                custom_labels=True,
                width=2000,
                height=1350
            )
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

    reduced_embeddings = UMAP(n_neighbors=10, n_components=2, min_dist=0.0, metric='cosine', random_state=42).fit_transform(embeddings)
    documents_info = topic_model.get_document_info(documents, metadata={'Position': reduced_embeddings.tolist(), 'Resource Ids': resource_ids})

    print(documents_info.head(10))
    res = []
    for index, row in enumerate(documents_info[['Topic', 'Name', 'Probability', 'Position', 'Resource Ids']].itertuples(index=False)):
        topic, name, prob, position, resource_id = row[0], row[1], row[2], row[3], row[4]
        # TODO: why does this happen?
        if name.startswith("-1"):
            continue
        if prob < prob_threshold:
            continue
        res.append({
            "doc_id": index,
            "topic_id": topic,
            "name": clean_bert_topic(name),
            "probability": prob,
            "x": position[0],
            "y": position[1],
            "resource_id": resource_id
        })
    return JSONResponse(content=res)


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
