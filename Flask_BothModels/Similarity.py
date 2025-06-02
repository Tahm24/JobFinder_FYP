from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, util
import torch

app = Flask(__name__)

# Loaded local model from laptop
model = SentenceTransformer("/Users/admin/Desktop/SimilarityEndpoint/cv_matcher_model")

@app.route("/similarity", methods=["POST"])
def compute_similarity():
    data = request.get_json()
    cv_text = data.get("cv", "")
    job_text = data.get("job", "")

    if not cv_text or not job_text:
        return jsonify({"error": "Missing 'cv' or 'job' in request."}), 400

    # Split / encode
    cv_segments = [s for s in cv_text.split('\n') if s.strip()]
    job_segments = [s for s in job_text.split('\n') if s.strip()]

    cv_embeds = model.encode(cv_segments, convert_to_tensor=True)
    job_embeds = model.encode(job_segments, convert_to_tensor=True)

    sim_matrix = util.cos_sim(cv_embeds, job_embeds).cpu().numpy()
    max_sim = float(sim_matrix.max()) * 100

    return jsonify({"similarity": round(max_sim, 2)})

if __name__ == "__main__":
    app.run(debug=True, port=5001)