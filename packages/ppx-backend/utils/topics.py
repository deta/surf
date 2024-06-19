from bertopic import BERTopic
from sklearn.feature_extraction.text import CountVectorizer#, ENGLISH_STOP_WORDS as STOP_WORDS

from gensim.parsing.preprocessing import STOPWORDS as STOP_WORDS 
from gensim.utils import simple_preprocess
from gensim.models import LdaModel
from gensim.corpora import Dictionary

STOP_WORDS = STOP_WORDS.union({"uh", "like", "just", "yeah"})

def bertopic_model(min_topic_size=1, top_n_words=10):
    topic_model = BERTopic(
        min_topic_size=min_topic_size,
        top_n_words=top_n_words,
        vectorizer_model=CountVectorizer(stop_words=list(STOP_WORDS))
    )
    return topic_model

def lda_preprocess(text):
    result = []
    for token in simple_preprocess(text):
        if token not in STOP_WORDS and len(token) > 3:
            result.append(token)
    return result

def preprocess_documents(documents):
    return [lda_preprocess(doc) for doc in documents]

def lda_model_all_docs(documents, num_topics=10, passes=10):
    processed_docs = preprocess_documents(documents)
    dictionary = Dictionary(processed_docs)
    corpus = [dictionary.doc2bow(doc) for doc in processed_docs]

    lda_model = LdaModel(corpus=corpus, id2word=dictionary, num_topics=num_topics, passes=passes)
    return corpus, dictionary, lda_model

def lda_model(document, num_topics=10, passes=10):
    processed_docs = preprocess_documents([document])
    dictionary = Dictionary(processed_docs)
    corpus = [dictionary.doc2bow(doc) for doc in processed_docs]

    lda_model = LdaModel(corpus=corpus, id2word=dictionary, num_topics=num_topics, passes=passes)
    return corpus, dictionary, lda_model
