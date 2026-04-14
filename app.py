from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from flask_cors import CORS
import json, os, datetime

app = Flask(__name__)
app.secret_key = "cybersec-game-2025"
CORS(app)

# ── Load questions ────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def load_questions():
    path = os.path.join(DATA_DIR, "questions.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_translations():
    path = os.path.join(DATA_DIR, "translations.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ── Load leaderboard (file-based, no DB needed) ───────────────────────────────
LB_FILE = os.path.join(DATA_DIR, "leaderboard.json")

def load_leaderboard():
    if not os.path.exists(LB_FILE):
        return {"beginner": [], "advanced": []}
    with open(LB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_leaderboard(lb):
    with open(LB_FILE, "w", encoding="utf-8") as f:
        json.dump(lb, f, ensure_ascii=False, indent=2)

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    lang = request.args.get("lang") or request.cookies.get("lang", "en")
    supported = ["en", "fr", "es", "hi", "ar"]
    if lang not in supported:
        lang = "en"
    translations = load_translations()
    t = translations.get(lang, translations["en"])
    resp = render_template("index.html", lang=lang, t=t,
                            dir="rtl" if lang == "ar" else "ltr")
    from flask import make_response
    r = make_response(resp)
    r.set_cookie("lang", lang, max_age=365*24*3600)
    return r

@app.route("/api/questions")
def api_questions():
    lang = request.args.get("lang", "en")
    difficulty = request.args.get("difficulty", "beginner")
    questions = load_questions()
    lang_data = questions.get(lang, questions["en"])
    diff_data = lang_data.get(difficulty, lang_data["beginner"])
    return jsonify(diff_data)

@app.route("/api/leaderboard", methods=["GET"])
def api_get_leaderboard():
    difficulty = request.args.get("difficulty", "beginner")
    lb = load_leaderboard()
    return jsonify(lb.get(difficulty, []))

@app.route("/api/leaderboard", methods=["POST"])
def api_post_leaderboard():
    data = request.get_json()
    username  = data.get("username", "Anonymous")[:30]
    difficulty = data.get("difficulty", "beginner")
    score     = int(data.get("score", 0))
    lb = load_leaderboard()
    if difficulty not in lb:
        lb[difficulty] = []
    lb[difficulty].append({
        "username": username,
        "score": score,
        "date": datetime.datetime.now().strftime("%d/%m/%Y")
    })
    lb[difficulty].sort(key=lambda x: x["score"], reverse=True)
    lb[difficulty] = lb[difficulty][:20]
    save_leaderboard(lb)
    return jsonify({"status": "ok", "rank": next(
        (i+1 for i, e in enumerate(lb[difficulty]) if e["username"]==username and e["score"]==score), 1
    )})

if __name__ == "__main__":
    print("🛡  Game of Cybersecurity → http://localhost:5000")
    app.run(0)
