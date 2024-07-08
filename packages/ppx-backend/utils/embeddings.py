from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim

#model = SentenceTransformer('mixedbread-ai/mxbai-embed-large-v1', truncate_dim=512)
model = SentenceTransformer('all-MiniLM-L6-v2', truncate_dim=512)

def get_similar_docs(query, docs, threshold=0.5):
    # this is needed for mixedbread-ai/mxbai-embed-large-v1
    #query = f"Represent this sentence for searching relevant passages: {query}"
    docs = [query] + docs
    doc_embeddings = model.encode(docs)
    similarities = [cos_sim(doc_embeddings[0], doc_embeddings[i]) for i in range(1, len(doc_embeddings))]
    return [(doc, sim[0][0].numpy().item()) for doc, sim in zip(docs[1:], similarities) if sim[0][0] >= threshold]
