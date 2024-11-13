use html_escape::decode_html_entities;
use tracing::{debug, info, instrument, trace, warn};
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug)]
pub struct ContentChunker {
    max_chunk_size: usize,
    overlap_sentences: usize,
}

impl ContentChunker {
    #[instrument(level = "trace")]
    pub fn new(max_chunk_size: usize, overlap_sentences: usize) -> Self {
        info!(
            "Creating new ContentChunker with max_chunk_size={}, overlap_sentences={}",
            max_chunk_size, overlap_sentences
        );
        ContentChunker {
            max_chunk_size,
            overlap_sentences,
        }
    }

    #[instrument(level = "trace", skip(content), fields(content_length = content.len()))]
    pub fn normalize(content: &str) -> String {
        debug!("Normalizing content of length {}", content.len());

        let original_len = content.len();

        let sanitized: String = content.nfc().filter(|ch| !ch.is_control()).collect();
        trace!(
            "After NFC normalization and control char filtering: length={}",
            sanitized.len()
        );

        let decoded = decode_html_entities(&sanitized).to_string();

        debug!(
            "Normalization complete. Length changes: {} -> {} -> {}",
            original_len,
            sanitized.len(),
            decoded.len()
        );

        decoded
    }

    #[instrument(level = "trace", skip(self, content), fields(content_length = content.len()))]
    pub fn chunk(&self, content: &str) -> Vec<String> {
        debug!(
            "Starting content chunking. Content length: {}, max_chunk_size: {}, overlap_sentences: {}",
            content.len(),
            self.max_chunk_size,
            self.overlap_sentences
        );

        let sentences: Vec<&str> = content.unicode_sentences().collect();
        debug!("Split content into {} sentences", sentences.len());

        let mut chunks: Vec<String> = Vec::new();
        let mut current_chunk: Vec<&str> = Vec::new();
        let mut current_length = 0;

        for (i, &sentence) in sentences.iter().enumerate() {
            trace!(
                "Processing sentence {}/{}. Length: {}",
                i + 1,
                sentences.len(),
                sentence.len()
            );

            if current_length + sentence.len() > self.max_chunk_size && !current_chunk.is_empty() {
                let chunk_text = Self::normalize(&current_chunk.join(" "));
                debug!(
                    "Chunk size limit reached. Creating chunk {} with {} sentences, length: {}",
                    chunks.len() + 1,
                    current_chunk.len(),
                    chunk_text.len()
                );
                chunks.push(chunk_text);

                // Keep overlap sentences
                let overlap_start = current_chunk.len().saturating_sub(self.overlap_sentences);
                let overlapped_sentences = current_chunk[overlap_start..].to_vec();
                trace!(
                    "Keeping {} sentences for overlap",
                    overlapped_sentences.len()
                );

                current_chunk = overlapped_sentences;
                current_length = current_chunk.iter().map(|s| s.len() + 1).sum();

                debug!(
                    "New chunk started with {} overlapped sentences, current length: {}",
                    current_chunk.len(),
                    current_length
                );
            }

            current_chunk.push(sentence);
            current_length += sentence.len() + 1; // +1 for space

            // Handle final chunk
            if i == sentences.len() - 1 {
                let final_chunk = Self::normalize(&current_chunk.join(" "));
                debug!(
                    "Creating final chunk {} with {} sentences, length: {}",
                    chunks.len() + 1,
                    current_chunk.len(),
                    final_chunk.len()
                );
                chunks.push(final_chunk);
            }
        }

        for (i, chunk) in chunks.iter().enumerate() {
            if chunk.len() > self.max_chunk_size {
                warn!(
                    "Chunk {} exceeds max_chunk_size: {} > {}",
                    i + 1,
                    chunk.len(),
                    self.max_chunk_size
                );
            }
        }

        debug!(
            "Chunking complete. Created {} chunks from {} sentences",
            chunks.len(),
            sentences.len()
        );

        chunks
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanity_chunker() {
        let chunker = ContentChunker::new(100, 1);
        let content = "Within endurance running comes two different types of respiration. The more prominent side that runners experience more frequently is aerobic respiration. This occurs when oxygen is present, and the body can utilize oxygen to help generate energy and muscle activity. On the other side, anaerobic respiration occurs when the body is deprived of oxygen, and this is common towards the final stretch of races when there is a drive to speed up to a greater intensity. Overall, both types of respiration are used by endurance runners quite often but are very different from each other. \n

        Among mammals, humans are well adapted for running significant distances, particularly so among primates. The capacity for endurance running is also found in migratory ungulates and a limited number of terrestrial carnivores, such as bears, dogs, wolves, and hyenas.

        In modern human society, long-distance running has multiple purposes: people may engage in it for physical exercise, for recreation, as a means of travel, as a competitive sport, for economic reasons, or cultural reasons. Long-distance running can also be used as a means to improve cardiovascular health";

        let chunks = chunker.chunk(content);
        for (_i, chunk) in chunks.iter().enumerate() {
            assert!(
                chunk.len() <= 2000,
                "Chunk length should be less than or equal to 2000 characters",
            );
        }
    }
}
