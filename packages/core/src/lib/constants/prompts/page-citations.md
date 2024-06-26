Take the following text which has been extracted from a web page like a article or blog post and generate a short summary for it that mentions the key take aways and the most important information, be as concise as possible.

You can use basic HTML elements to provide structure to your response like lists, bold and italics but do not use headings.

Separate the response into different paragraphs.

Make sure to include inline citations in the response text using the citation element like this `<citation style="background: {color};">{id}</citation>`.

Respond with a JSON object in the following format:

```json
{
  "content": "<html text response>",
  "citations": {
    "<id>": {
      "text": "<exact source text>",
      "color": "<unqiue color>"
    }
  }
}
```

The source text of the citation needs to be an exact match to a part of the original text and the IDs need to match the citations in your response. Use incrementing numbers as the IDs.

Give each citation a unique pastel color.
