use html_escape::decode_html_entities;
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

pub struct ContentChunker {
    max_chunk_size: usize,
    overlap_sentences: usize,
}

impl ContentChunker {
    // max chunk size is len of the chunk in characters
    // overlap_sentences is the number of sentences to overlap between chunks
    pub fn new(max_chunk_size: usize, overlap_sentences: usize) -> Self {
        ContentChunker {
            max_chunk_size,
            overlap_sentences,
        }
    }

    pub fn normalize(content: &str) -> String {
        let sanitized: String = content.nfc().filter(|ch| !ch.is_control()).collect();
        decode_html_entities(&sanitized).to_string()
    }

    pub fn chunk(&self, content: &str) -> Vec<String> {
        let sentences: Vec<&str> = content.unicode_sentences().collect();
        let mut chunks: Vec<String> = Vec::new();
        let mut current_chunk: Vec<&str> = Vec::new();
        let mut current_length = 0;

        for (i, &sentence) in sentences.iter().enumerate() {
            if current_length + sentence.len() > self.max_chunk_size && !current_chunk.is_empty() {
                chunks.push(Self::normalize(&current_chunk.join(" ")));

                // Keep the last 'overlap_sentences' for the next chunk
                let overlap_start = current_chunk.len().saturating_sub(self.overlap_sentences);
                current_chunk = current_chunk[overlap_start..].to_vec();
                current_length = current_chunk.iter().map(|s| s.len() + 1).sum();
            }

            current_chunk.push(sentence);
            current_length += sentence.len() + 1; // +1 for space

            // If this is the last sentence, add the final chunk
            if i == sentences.len() - 1 {
                chunks.push(Self::normalize(&current_chunk.join(" ")));
            }
        }
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
        for chunk in chunks.iter() {
            assert!(
                chunk.len() <= 2000,
                "Chunk length should be less than or equal to 2000 characters",
            );
        }
    }
}
