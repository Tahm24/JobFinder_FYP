from flask import Flask, request, jsonify
import spacy

# Loaded trained spacy model local
nlp = spacy.load("/Users/admin/Desktop/api_nerEndpoints/ner_model (1)") 
print(nlp.get_pipe("ner").labels)
app = Flask(__name__)

@app.route("/extract", methods=["POST"])
def extract_entities():
    data = request.get_json()
    text = data.get("text", "")
    
    doc = nlp(text)
    entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]

    return jsonify({"entities": entities})

if __name__ == "__main__":
    app.run(debug=True)
