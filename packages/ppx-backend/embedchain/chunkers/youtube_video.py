import hashlib

from typing import Optional

from langchain.text_splitter import RecursiveCharacterTextSplitter

from embedchain.chunkers.base_chunker import BaseChunker
from embedchain.config.add_config import ChunkerConfig
from embedchain.helpers.json_serializable import register_deserializable


@register_deserializable
class YoutubeVideoChunker(BaseChunker):
    """Chunker for Youtube video."""

    def __init__(self, config: Optional[ChunkerConfig] = None):
        if config is None:
            config = ChunkerConfig(chunk_size=2000, chunk_overlap=0, length_function=len)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap,
            length_function=config.length_function,
        )
        super().__init__(text_splitter)

    def create_chunks(self, loader, src, app_id=None, config: Optional[ChunkerConfig] = None):
        """
        Loads data and chunks it.

        :param loader: The loader whose `load_data` method is used to create
        the raw data.
        :param src: The data to be handled by the loader. Can be a URL for
        remote sources or local content for local loaders.
        :param app_id: App id used to generate the doc_id.
        """
        documents = []
        chunk_ids = []
        id_map = {}
        min_chunk_size = config.min_chunk_size if config is not None else 1
        data_result = loader.load_data(src)
        data_records = data_result["data"]
        doc_id = data_result["doc_id"]
        # Prefix app_id in the document id if app_id is not None to
        # distinguish between different documents stored in the same
        # elasticsearch or opensearch index
        doc_id = f"{app_id}--{doc_id}" if app_id is not None else doc_id
        metadatas = []
        for data in data_records:
            content = data["content"]

            metadata = data["meta_data"]
            # add data type to meta data to allow query using data type
            metadata["data_type"] = "youtube_video" 
            metadata["doc_id"] = doc_id

            transcript_pieces = metadata.get("transcript_pieces", []).copy()
            del metadata["transcript_pieces"]

            # TODO: Currently defaulting to the src as the url. This is done intentianally since some
            # of the data types like 'gmail' loader doesn't have the url in the meta data.
            url = metadata.get("url", src)

            chunks = self.get_chunks(content)
            transcript_index = 0
            for chunk in chunks:
                chunk_id = hashlib.sha256((chunk + url).encode()).hexdigest()
                chunk_id = f"{app_id}--{chunk_id}" if app_id is not None else chunk_id
                if id_map.get(chunk_id) is None and len(chunk) >= min_chunk_size:
                    id_map[chunk_id] = True
                    chunk_ids.append(chunk_id)
                    documents.append(chunk)
                    if transcript_index < len(transcript_pieces):
                        chunk_start_timestamp = transcript_pieces[transcript_index].get("start", 0)
                        transcript_chunk = ""
                        for i in range(transcript_index, len(transcript_pieces)):
                            tp = transcript_pieces[i].get("text", "")
                            transcript_chunk += tp
                            if len(transcript_chunk) >= len(chunk):
                                metadata["timestamp"] = chunk_start_timestamp
                                transcript_index = i
                                break
                    metadatas.append(metadata.copy())
        
        return {
            "documents": documents,
            "ids": chunk_ids,
            "metadatas": metadatas,
            "doc_id": doc_id,
        }

    def get_chunks(self, content):
        """
        Returns chunks using text splitter instance.

        Override in child class if custom logic.
        """
        return self.text_splitter.split_text(content)



    
