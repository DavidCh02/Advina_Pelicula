from flask import Flask, request, jsonify, render_template, app
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import json
import random
import requests

from flask import Flask

# Inicializa la aplicación Flask
app = Flask(__name__)
from sqlalchemy import create_engine

# Configuración de la base de datos con SSL para pg8000
DB_URL = "postgresql+pg8000://ultimo_humano_user:q83MoA2qaSlEbzKce2WnkXEt9z5LjfOO@dpg-cv4959qj1k6c738evoog-a.oregon-postgres.render.com/ultimo_humano"

app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "connect_args": {
        "ssl_context": True  # Habilita SSL para pg8000
    }
}

db = SQLAlchemy(app)
# Gemini API configuration
GEMINI_API_KEY = "AIzaSyCe7CKTouKq-4BuAZ2G62pWD1q55nii4Kg"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# Load movie data
with open('emojis.json', 'r', encoding='utf-8') as f:
    movies_data = json.load(f)


# Database Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    scores = db.relationship('Score', backref='user', lazy=True)


class Score(db.Model):
    __tablename__ = 'scores'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    player_score = db.Column(db.Integer, nullable=False)
    ai_score = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# Create database tables
with app.app_context():
    db.create_all()


# Routes
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({'error': 'Username is required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400

    user = User(username=username)
    db.session.add(user)
    db.session.commit()

    return jsonify({'id': user.id, 'username': user.username})


@app.route('/get_movie', methods=['POST'])
def get_movie():
    data = request.get_json()
    category = data.get('category')

    if category not in movies_data and category != 'aleatorio':
        return jsonify({'error': 'Invalid category'}), 400

    if category == 'aleatorio':
        category = random.choice(list(movies_data.keys()))

    movie = random.choice(movies_data[category])
    return jsonify({
        'emojis': movie['emojis'],
        'options': movie['options'],
        'correct_answer': movie['title']
    })


@app.route('/ai_guess', methods=['POST'])
def ai_guess():
    data = request.get_json()
    emojis = data.get('emojis')

    if not emojis:
        return jsonify({'error': 'Emojis are required'}), 400

    # Prepare prompt for Gemini API
    prompt = f"Adivina el título de la película basada en estos emojis: {emojis}. Responde solo con el título Español-latino."

    try:
        response = requests.post(
            GEMINI_URL,
            headers={
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY
            },
            json={
                'contents': [{'parts': [{'text': prompt}]}]
            }
        )

        if response.status_code == 200:
            ai_response = response.json()
            movie_guess = ai_response['candidates'][0]['content']['parts'][0]['text'].strip()
            return jsonify({'guess': movie_guess})
        else:
            return jsonify({'error': 'AI API error'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/save_score', methods=['POST'])
def save_score():
    data = request.get_json()
    user_id = data.get('user_id')
    player_score = data.get('player_score')
    ai_score = data.get('ai_score')
    category = data.get('category')

    if not all([user_id, player_score is not None, ai_score is not None, category]):
        return jsonify({'error': 'Datos incompletos'}), 400

    # Buscar un registro existente
    score = Score.query.filter_by(user_id=user_id, category=category).first()

    if score:
        # Actualizar puntajes acumulados
        score.player_score = player_score
        score.ai_score = ai_score
    else:
        # Crear un nuevo registro
        score = Score(
            user_id=user_id,
            player_score=player_score,
            ai_score=ai_score,
            category=category
        )
        db.session.add(score)

    db.session.commit()
    return jsonify({'message': 'Puntuación guardada correctamente'})


@app.route('/get_leaderboard')
def get_leaderboard():
    scores = db.session.query(
        User.username,
        db.func.sum(Score.player_score).label('total_player_score'),
        db.func.sum(Score.ai_score).label('total_ai_score')
    ).join(Score).group_by(User.username) \
        .order_by(db.text('total_player_score DESC')).all()

    return jsonify([
        {
            'username': score[0],
            'player_score': int(score[1]),
            'ai_score': int(score[2])
        } for score in scores
    ])


@app.route('/leaderboard')
def leaderboard():
    scores = db.session.query(
        User.username,
        db.func.sum(Score.player_score).label('total_player_score'),
        db.func.sum(Score.ai_score).label('total_ai_score')
    ).join(Score).group_by(User.username) \
        .order_by(db.text('total_player_score DESC')).all()

    return jsonify([
        {
            'username': score[0],
            'player_score': int(score[1]),
            'ai_score': int(score[2])
        } for score in scores
    ])


if __name__ == '__main__':
    app.run(debug=True)