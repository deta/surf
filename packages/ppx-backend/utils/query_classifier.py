from transformers import AutoTokenizer, AutoModelForSequenceClassification

tokenizer = AutoTokenizer.from_pretrained("shahrukhx01/question-vs-statement-classifier")

model = AutoModelForSequenceClassification.from_pretrained("shahrukhx01/question-vs-statement-classifier")

def is_query_a_question(query: str):
    inputs = tokenizer(query, return_tensors="pt")
    outputs = model(**inputs)
    probs = outputs.logits.softmax(dim=1)
    print(probs)
    return probs[0][1].item() > 0.5
