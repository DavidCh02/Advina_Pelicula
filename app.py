from flask import Flask, request, jsonify, render_template, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import json
import random
import requests
from functools import wraps
import os
from sqlalchemy import text

# Inicializa la aplicación Flask
app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Clave secreta para la gestión de sesión

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
    
from flask import Flask
app = Flask(__name__, static_folder="static", static_url_path="/static")

# -------------------- MODELOS DE BASE DE DATOS --------------------

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    scores = db.relationship('Score', backref='user', lazy=True)
    # Relación para comentarios (opcional, para acceder desde el usuario)
    comentarios = db.relationship('Comment', backref='user', lazy=True)

class Score(db.Model):
    __tablename__ = 'scores'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    player_score = db.Column(db.Integer, nullable=False)
    ai_score = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Reward(db.Model):
    __tablename__ = 'rewards'
    id = db.Column(db.String(50), primary_key=True)  # IDs como 'meme1', 'card1', etc.
    name = db.Column(db.String(100), nullable=False)
    cost = db.Column(db.Integer, nullable=False)

class UserReward(db.Model):
    __tablename__ = 'user_rewards'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reward_id = db.Column(db.String(50), db.ForeignKey('rewards.id'), nullable=False)
    date_redeemed = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', backref='rewards_claimed', lazy=True)
    reward = db.relationship('Reward', backref='users_claimed', lazy=True)

# -------------------- NUEVO MODELO: Comment --------------------
class Comment(db.Model):
    __tablename__ = 'comentarios'
    id = db.Column(db.Integer, primary_key=True)
    comentario = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Crear las tablas en la base de datos
with app.app_context():
    db.create_all()

# -------------------- RUTAS --------------------
MOVIES_FILE = 'emojis.json'
@app.route('/')
def index():
    return render_template('index.html')
@app.route('/admin')
def admin_panel():
    # Sólo para pruebas, en producción deberías proteger esta ruta con autenticación
    return render_template('admin.html')



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

    # Almacenar la información del usuario en la sesión
    session['user_id'] = user.id
    session['username'] = user.username

    return jsonify({'id': user.id, 'username': user.username})

@app.route('/check_session')
def check_session():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            # Obtener el puntaje total del usuario
            total_score = db.session.query(db.func.sum(Score.player_score)).filter_by(user_id=user.id).scalar() or 0
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'total_score': total_score
                }
            })
    return jsonify({'authenticated': False})

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

    score = Score.query.filter_by(user_id=user_id, category=category).first()
    if score:
        score.player_score = player_score
        score.ai_score = ai_score
    else:
        score = Score(
            user_id=user_id,
            player_score=player_score,
            ai_score=ai_score,
            category=category
        )
        db.session.add(score)

    db.session.commit()
    return jsonify({'message': 'Puntuación guardada correctamente'})

@app.route('/get_rewards')
def get_rewards():
    rewards = Reward.query.all()
    return jsonify([{'id': r.id, 'name': r.name, 'cost': r.cost} for r in rewards])

@app.route('/rewards')
def rewards():
    return render_template('rewards.html')

@app.route('/redeem_reward', methods=['POST'])
def redeem_reward():
    if 'user_id' not in session:
        return jsonify({'error': 'No has iniciado sesión'}), 401
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Datos inválidos'}), 400
        user_id = data.get('user_id')
        reward_id = data.get('reward_id')
        cost = data.get('cost')
        if not all([user_id, reward_id, cost]):
            return jsonify({'error': 'Datos incompletos'}), 400

        reward = Reward.query.filter(Reward.id == reward_id).first()
        if not reward:
            return jsonify({'error': 'Recompensa no encontrada'}), 404

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        total_score = db.session.query(db.func.sum(Score.player_score)).filter_by(user_id=user_id).scalar() or 0
        if total_score < cost:
            return jsonify({'error': 'Puntos insuficientes'}), 400

        existing_reward = UserReward.query.filter_by(
            user_id=user_id,
            reward_id=reward_id
        ).first()
        if existing_reward:
            return jsonify({'error': 'Ya tienes esta recompensa'}), 400

        try:
            scores = Score.query.filter_by(user_id=user_id).all()
            if not scores:
                return jsonify({'error': 'No se encontró el puntaje del usuario'}), 404

            points_to_deduct = cost
            for score in scores:
                score_ratio = score.player_score / total_score
                points_from_this_score = int(points_to_deduct * score_ratio)
                score.player_score = max(0, score.player_score - points_from_this_score)

            user_reward = UserReward(user_id=user_id, reward_id=reward_id)
            db.session.add(user_reward)
            db.session.commit()

            remaining_points = db.session.query(db.func.sum(Score.player_score)).filter_by(user_id=user_id).scalar() or 0
            return jsonify({
                'message': 'Recompensa canjeada exitosamente',
                'remaining_points': remaining_points
            })
        except Exception as e:
            db.session.rollback()
            app.logger.error(f'Error al procesar la recompensa: {str(e)}')
            return jsonify({'error': 'Error al procesar la recompensa'}), 500
    except Exception as e:
        db.session.rollback()
        app.logger.error(f'Error en redeem_reward: {str(e)}')
        return jsonify({'error': 'Error interno del servidor'}), 500

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

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

# -------------------- RUTA PARA COMENTARIOS --------------------

@app.route('/submit_comment', methods=['POST'])
def submit_comment():
    try:
        data = request.get_json()
        comentario_text = data.get('comentario')

        if not comentario_text or not comentario_text.strip():
            return jsonify({'status': 'error', 'message': 'El comentario no puede estar vacío'}), 400

        # Verificar si el usuario está autenticado mediante la sesión
        if 'user_id' not in session:
            return jsonify({'status': 'error', 'message': 'Usuario no autenticado'}), 401

        user_id = session['user_id']
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'status': 'error', 'message': 'Usuario no encontrado'}), 404

        # Crear la instancia del comentario y guardarlo en la base de datos
        comment = Comment(comentario=comentario_text, user_id=user_id)
        db.session.add(comment)
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Comentario insertado correctamente',
            'user_id': user_id,
            'user_name': user.username
        })
    except Exception as e:
        app.logger.error(f"Error al insertar comentario: {e}")
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

from admin_routes import *

if __name__ == '__main__':
    app.run(debug=True)
