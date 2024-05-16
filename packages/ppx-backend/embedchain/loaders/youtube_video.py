from typing import Optional, Union, Sequence, Any, List

import hashlib

from urllib.parse import parse_qs, urlparse

from langchain_core.documents import Document
from embedchain.helpers.json_serializable import register_deserializable
from embedchain.loaders.base_loader import BaseLoader
from embedchain.utils.misc import clean_string

ALLOWED_SCHEMAS = {"http", "https"}
ALLOWED_NETLOCK = {
    "youtu.be",
    "m.youtube.com",
    "youtube.com",
    "www.youtube.com",
    "www.youtube-nocookie.com",
    "vid.plus",
}

def _parse_video_id(url: str) -> Optional[str]:
    """Parse a youtube url and return the video id if valid, otherwise None."""
    parsed_url = urlparse(url)

    if parsed_url.scheme not in ALLOWED_SCHEMAS:
        return None

    if parsed_url.netloc not in ALLOWED_NETLOCK:
        return None

    path = parsed_url.path

    if path.endswith("/watch"):
        query = parsed_url.query
        parsed_query = parse_qs(query)
        if "v" in parsed_query:
            ids = parsed_query["v"]
            video_id = ids if isinstance(ids, str) else ids[0]
        else:
            return None
    else:
        path = parsed_url.path.lstrip("/")
        video_id = path.split("/")[-1]

    if len(video_id) != 11:  # Video IDs are 11 characters long
        return None

    return video_id


class YoutubeLoader(BaseLoader):
    """Load `YouTube` transcripts."""

    def __init__(
        self,
        video_id: str,
        add_video_info: bool = False,
        language: Union[str, Sequence[str]] = "en",
        translation: Optional[str] = None,
        continue_on_failure: bool = False,
    ):
        """Initialize with YouTube video ID."""
        self.video_id = video_id
        self.add_video_info = add_video_info
        self.language = language
        if isinstance(language, str):
            self.language = [language]
        else:
            self.language = language
        self.translation = translation
        self.transcript_format = "text"
        self.continue_on_failure = continue_on_failure

    @staticmethod
    def extract_video_id(youtube_url: str) -> str:
        """Extract video id from common YT urls."""
        video_id = _parse_video_id(youtube_url)
        if not video_id:
            raise ValueError(
                f"Could not determine the video ID for the URL {youtube_url}"
            )
        return video_id

    @classmethod
    def from_youtube_url(cls, youtube_url: str, **kwargs: Any):
        """Given youtube URL, load video."""
        video_id = cls.extract_video_id(youtube_url)
        return cls(video_id, **kwargs)

    def load(self) -> List[Document]:
        """Load documents."""
        try:
            from youtube_transcript_api import (
                NoTranscriptFound,
                TranscriptsDisabled,
                YouTubeTranscriptApi,
            )
        except ImportError:
            raise ImportError(
                "Could not import youtube_transcript_api python package. "
                "Please install it with `pip install youtube-transcript-api`."
            )

        metadata = {"source": self.video_id}

        if self.add_video_info:
            # Get more video meta info
            # Such as title, description, thumbnail url, publish_date
            video_info = self._get_video_info()
            metadata.update(video_info)

        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(self.video_id)
        except TranscriptsDisabled:
            return []

        try:
            transcript = transcript_list.find_transcript(self.language)
        except NoTranscriptFound:
            transcript = transcript_list.find_transcript(["en"])

        if self.translation is not None:
            transcript = transcript.translate(self.translation)

        transcript_pieces = transcript.fetch()
        metadata["transcript_pieces"] = transcript_pieces
        transcript = " ".join([t["text"].strip(" ") for t in transcript_pieces])
        return [Document(page_content=transcript, metadata=metadata)]
        
    def _get_video_info(self) -> dict:
        """Get important video information.

        Components are:
            - title
            - description
            - thumbnail url,
            - publish_date
            - channel_author
            - and more.
        """
        try:
            from pytube import YouTube

        except ImportError:
            raise ImportError(
                "Could not import pytube python package. "
                "Please install it with `pip install pytube`."
            )
        yt = YouTube(f"https://www.youtube.com/watch?v={self.video_id}")
        video_info = {
            "title": yt.title or "Unknown",
            "description": yt.description or "Unknown",
            "view_count": yt.views or 0,
            "thumbnail_url": yt.thumbnail_url or "Unknown",
            "publish_date": yt.publish_date.strftime("%Y-%m-%d %H:%M:%S")
            if yt.publish_date
            else "Unknown",
            "length": yt.length or 0,
            "author": yt.author or "Unknown",
        }
        return video_info

@register_deserializable
class YoutubeVideoLoader(BaseLoader):
    def load_data(self, url):
        """Load data from a Youtube video."""
        loader = YoutubeLoader.from_youtube_url(url, add_video_info=True)
        doc = loader.load()
        output = []
        if not len(doc):
            raise ValueError(f"No data found for url: {url}")
        content = doc[0].page_content
        content = clean_string(content)
        metadata = doc[0].metadata
        metadata["url"] = url

        output.append(
            {
                "content": content,
                "meta_data": metadata,
            }
        )
        doc_id = hashlib.sha256((content + url).encode()).hexdigest()
        return {
            "doc_id": doc_id,
            "data": output,
        }
