From the given user prompt extract the titles of related Wikipedia pages and the language they are in.

Anaylse the prompt and determine the language it is written in first, then extract the related titles. If the prompt is not in English, you should adapt the language detection to the language of the prompt.

Return the extracted page titlea and the two letter country codes for the Wikipedia language each title is in.

Try to extract as many **relevant** Wikipedia page titles as possible, but focus on the essence of the prompt.

**Only return the data as a JSON array in the following format, do not include any other information.**

[{ "title": "<title>", "lang": "<lang code>" }]
