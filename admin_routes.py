from datetime import datetime

from flask import request, jsonify, current_app
from app import app, db
from app import User, Score, Reward, UserReward, Comment
import json
import os
from sqlalchemy import func, text

# -------------------- ADMINISTRACIÓN DE USUARIOS --------------------
@app.route('/admin/users', methods=['GET'])
def admin_get_users():
    users = User.query.all()
    result = [{'id': u.id, 'username': u.username} for u in users]
    return jsonify(result)

@app.route('/admin/users', methods=['POST'])
def admin_add_user():
    data = request.get_json()
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username required'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'User already exists'}), 400
    user = User(username=username)
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'User added', 'id': user.id, 'username': user.username})

@app.route('/admin/users/<int:user_id>', methods=['PUT'])
def admin_update_user(user_id):
    data = request.get_json()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.username = data.get('username', user.username)
    db.session.commit()
    return jsonify({'message': 'User updated'})

@app.route('/admin/users/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted'})

# -------------------- ADMINISTRACIÓN DE RECOMPENSAS --------------------
@app.route('/admin/rewards', methods=['GET'])
def admin_get_rewards():
    rewards = Reward.query.all()
    result = [{'id': r.id, 'name': r.name, 'cost': r.cost, 'image_url': getattr(r, 'image_url', None)} for r in rewards]
    return jsonify(result)

@app.route('/admin/rewards', methods=['POST'])
def admin_add_reward():
    # Se espera que se envíen los datos como form-data (para incluir la imagen)
    reward_id = request.form.get('id')
    name = request.form.get('name')
    cost = request.form.get('cost')
    if not all([reward_id, name, cost]):
        return jsonify({'error': 'Missing fields'}), 400
    if Reward.query.get(reward_id):
        return jsonify({'error': 'Reward already exists'}), 400
    reward = Reward(id=reward_id, name=name, cost=int(cost))
    image = request.files.get('image')
    if image:
        image_path = os.path.join('static', 'images', 'rewards', f"{reward_id}.jpg")
        image.save(image_path)
        reward.image_url = f"/static/images/rewards/{reward_id}.jpg"
    db.session.add(reward)
    db.session.commit()
    return jsonify({'message': 'Reward added', 'id': reward.id, 'name': reward.name})

@app.route('/admin/rewards/<string:reward_id>', methods=['PUT'])
def admin_update_reward(reward_id):
    data = request.get_json()
    reward = Reward.query.get(reward_id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404
    reward.name = data.get('name', reward.name)
    reward.cost = data.get('cost', reward.cost)
    db.session.commit()
    return jsonify({'message': 'Reward updated'})

@app.route('/admin/rewards/<string:reward_id>', methods=['DELETE'])
def admin_delete_reward(reward_id):
    reward = Reward.query.get(reward_id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404
    db.session.delete(reward)
    db.session.commit()
    return jsonify({'message': 'Reward deleted'})

@app.route('/admin/rewards/<string:reward_id>/image', methods=['POST'])
def admin_upload_reward_image(reward_id):
    reward = Reward.query.get(reward_id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404
    image = request.files.get('image')
    if not image:
        return jsonify({'error': 'No image provided'}), 400
    image_path = os.path.join('static', 'images', 'rewards', f"{reward_id}.jpg")
    image.save(image_path)
    reward.image_url = f"/static/images/rewards/{reward_id}.jpg"
    db.session.commit()
    return jsonify({'message': 'Image updated'})

# -------------------- ADMINISTRACIÓN DE COMENTARIOS --------------------
@app.route('/admin/comments', methods=['GET'])
def admin_get_comments():
    comments = Comment.query.all()
    result = []
    for c in comments:
        result.append({
            'id': c.id,
            'comentario': c.comentario,
            'created_at': c.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            'user_id': c.user_id,
            'user_name': c.user.username if c.user else None
        })
    return jsonify(result)

@app.route('/admin/comments/<int:comment_id>', methods=['DELETE'])
def admin_delete_comment(comment_id):
    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    db.session.delete(comment)
    db.session.commit()
    return jsonify({'message': 'Comment deleted'})

# -------------------- ADMINISTRACIÓN DE LEADERBOARD --------------------
@app.route('/admin/leaderboard', methods=['GET'])
def admin_get_leaderboard():
    scores = db.session.query(
        User.id,
        User.username,
        func.sum(Score.player_score).label('total_player_score'),
        func.sum(Score.ai_score).label('total_ai_score')
    ).join(Score).group_by(User.id, User.username).order_by(text('total_player_score DESC')).all()
    result = []
    for s in scores:
        result.append({
            'user_id': s[0],
            'username': s[1],
            'player_score': s[2],
            'ai_score': s[3]
        })
    return jsonify(result)

@app.route('/admin/leaderboard/<int:user_id>', methods=['PUT'])
def admin_update_score(user_id):
    data = request.get_json()
    new_score = data.get('player_score')
    if new_score is None:
        return jsonify({'error': 'player_score is required'}), 400
    score = Score.query.filter_by(user_id=user_id).first()
    if not score:
        return jsonify({'error': 'Score not found'}), 404
    score.player_score = new_score
    db.session.commit()
    return jsonify({'message': 'Score updated'})

import json
import uuid

MOVIES_FILE = 'emojis.json'

def load_movies_data():
    with open(MOVIES_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Asignar un ID único si la película no lo tiene
    for category, movies_list in data.items():
        for movie in movies_list:
            if "id" not in movie:
                movie["id"] = str(uuid.uuid4())

    return data

def save_movies_data(data):
    with open(MOVIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/admin/movies', methods=['GET'])
def admin_get_movies():
    data = load_movies_data()
    movies = []
    for category, movies_list in data.items():
        for movie in movies_list:
            movie['category'] = category
            movies.append(movie)
    return jsonify(movies)

@app.route('/admin/movies', methods=['POST'])
def admin_add_movie():
    data = request.get_json()
    category = data.get('category')
    emojis = data.get('emojis')
    options = data.get('options')
    title = data.get('title')
    if not all([category, emojis, options, title]):
        return jsonify({'error': 'Missing fields'}), 400
    movies_data = load_movies_data()
    if category not in movies_data:
        movies_data[category] = []
    movies_data[category].append({
        'title': title,
        'emojis': emojis,
        'options': options
    })
    save_movies_data(movies_data)
    return jsonify({'message': 'Movie added'})

@app.route('/admin/movies/<int:movie_index>', methods=['PUT'])
def admin_update_movie(movie_index):
    data = request.get_json()
    new_emojis = data.get('emojis')
    new_options = data.get('options')
    new_title = data.get('title')
    new_category = data.get('category')
    movies_data = load_movies_data()
    flat = []
    for cat, movies_list in movies_data.items():
        for m in movies_list:
            m['category'] = cat
            flat.append(m)
    if movie_index < 0 or movie_index >= len(flat):
        return jsonify({'error': 'Movie index out of range'}), 404
    movie = flat[movie_index]
    movie['emojis'] = new_emojis if new_emojis is not None else movie['emojis']
    movie['options'] = new_options if new_options is not None else movie['options']
    movie['title'] = new_title if new_title is not None else movie['title']
    movie['category'] = new_category if new_category is not None else movie['category']
    new_data = {}
    for m in flat:
        cat = m['category']
        if cat not in new_data:
            new_data[cat] = []
        movie_copy = {k: m[k] for k in m if k != 'category'}
        new_data[cat].append(movie_copy)
    save_movies_data(new_data)
    return jsonify({'message': 'Movie updated'})

@app.route('/admin/movies/<int:movie_index>', methods=['DELETE'])
def admin_delete_movie(movie_index):
    movies_data = load_movies_data()
    flat = []
    for cat, movies_list in movies_data.items():
        for m in movies_list:
            m['category'] = cat
            flat.append(m)
    if movie_index < 0 or movie_index >= len(flat):
        return jsonify({'error': 'Movie index out of range'}), 404
    del flat[movie_index]
    new_data = {}
    for m in flat:
        cat = m['category']
        if cat not in new_data:
            new_data[cat] = []
        movie_copy = {k: m[k] for k in m if k != 'category'}
        new_data[cat].append(movie_copy)
    save_movies_data(new_data)
    return jsonify({'message': 'Movie deleted'})

# ---------- ADMINISTRACIÓN DE EMOJI DEL DÍA ----------

EMOJI_FILE = os.path.join('static', 'data', 'emoji_descriptions.json')

@app.route('/admin/emoji', methods=['GET'])
def admin_get_emoji():
    try:
        with open(EMOJI_FILE, 'r', encoding='utf-8') as f:
            emoji_data = json.load(f)
        return jsonify(emoji_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/emoji', methods=['POST'])
def admin_add_emoji():
    data = request.get_json()
    category = data.get('category')
    emoji_char = data.get('emoji')
    description = data.get('description')
    if not all([category, emoji_char, description]):
        return jsonify({'error': 'Missing fields'}), 400
    try:
        with open(EMOJI_FILE, 'r', encoding='utf-8') as f:
            emoji_data = json.load(f)
    except Exception:
        emoji_data = {}
    if category not in emoji_data:
        emoji_data[category] = []
    emoji_data[category].append({
        'emoji': emoji_char,
        'description': description
    })
    with open(EMOJI_FILE, 'w', encoding='utf-8') as f:
        json.dump(emoji_data, f, ensure_ascii=False, indent=2)
    return jsonify({'message': 'Emoji added'})

# Las rutas PUT y DELETE para emojis se pueden implementar de manera similar
# Por ejemplo:
@app.route('/admin/emoji/<string:category>/<int:index>', methods=['PUT'])
def admin_update_emoji(category, index):
    data = request.get_json()
    try:
        with open(EMOJI_FILE, 'r', encoding='utf-8') as f:
            emoji_data = json.load(f)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    if category not in emoji_data or index < 0 or index >= len(emoji_data[category]):
        return jsonify({'error': 'Emoji not found'}), 404
    entry = emoji_data[category][index]
    entry['emoji'] = data.get('emoji', entry['emoji'])
    entry['description'] = data.get('description', entry['description'])
    with open(EMOJI_FILE, 'w', encoding='utf-8') as f:
        json.dump(emoji_data, f, ensure_ascii=False, indent=2)
    return jsonify({'message': 'Emoji updated'})

@app.route('/admin/emoji/<string:category>/<int:index>', methods=['DELETE'])
def admin_delete_emoji(category, index):
    try:
        with open(EMOJI_FILE, 'r', encoding='utf-8') as f:
            emoji_data = json.load(f)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    if category not in emoji_data or index < 0 or index >= len(emoji_data[category]):
        return jsonify({'error': 'Emoji not found'}), 404
    del emoji_data[category][index]
    with open(EMOJI_FILE, 'w', encoding='utf-8') as f:
        json.dump(emoji_data, f, ensure_ascii=False, indent=2)
    return jsonify({'message': 'Emoji deleted'})

# ---------- ADMINISTRACIÓN DE DATOS CURIOSOS (FUN FACTS) ----------

FUNFACTS_FILE = os.path.join('static', 'data', 'fun_facts.json')

@app.route('/admin/funfacts', methods=['GET'])
def admin_get_funfacts():
    try:
        with open(FUNFACTS_FILE, 'r', encoding='utf-8') as f:
            fun_data = json.load(f)
        return jsonify(fun_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/funfacts', methods=['POST'])
def admin_add_funfact():
    data = request.get_json()
    category = data.get('category')
    fact = data.get('fact')
    if not all([category, fact]):
        return jsonify({'error': 'Missing fields'}), 400
    try:
        with open(FUNFACTS_FILE, 'r', encoding='utf-8') as f:
            fun_data = json.load(f)
    except Exception:
        fun_data = {}
    if category not in fun_data:
        fun_data[category] = []
    fun_data[category].append(fact)
    with open(FUNFACTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(fun_data, f, ensure_ascii=False, indent=2)
    return jsonify({'message': 'Fun Fact added'})

@app.route('/admin/funfacts/<string:category>/<int:index>', methods=['PUT'])
def admin_update_funfact(category, index):
    data = request.get_json()
    try:
        with open(FUNFACTS_FILE, 'r', encoding='utf-8') as f:
            fun_data = json.load(f)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    if category not in fun_data or index < 0 or index >= len(fun_data[category]):
        return jsonify({'error': 'Fun Fact not found'}), 404
    fun_data[category][index] = data.get('fact', fun_data[category][index])
    with open(FUNFACTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(fun_data, f, ensure_ascii=False, indent=2)
    return jsonify({'message': 'Fun Fact updated'})

@app.route('/admin/funfacts/<string:category>/<int:index>', methods=['DELETE'])
def admin_delete_funfact(category, index):
    try:
        with open(FUNFACTS_FILE, 'r', encoding='utf-8') as f:
            fun_data = json.load(f)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    if category not in fun_data or index < 0 or index >= len(fun_data[category]):
        return jsonify({'error': 'Fun Fact not found'}), 404
    del fun_data[category][index]
    with open(FUNFACTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(fun_data, f, ensure_ascii=False, indent=2)
    return jsonify({'message': 'Fun Fact deleted'})

@app.route('/admin/datos', methods=['GET'])
def admin_get_datos():
    try:
        emoji_file = os.path.join(current_app.root_path, 'static', 'data', 'emoji_descriptions.json')
        funfacts_file = os.path.join(current_app.root_path, 'static', 'data', 'fun_facts.json')
        with open(emoji_file, 'r', encoding='utf-8') as f:
            emoji_data = json.load(f)
        with open(funfacts_file, 'r', encoding='utf-8') as f:
            fun_data = json.load(f)
        # Si los archivos no están anidados en claves específicas, devuélvelos directamente:
        return jsonify({
            'emoji_descriptions': emoji_data,  # O si deseas asignar un nombre, ajusta aquí
            'fun_facts': fun_data
        })
    except Exception as e:
        current_app.logger.error("Error loading datos: %s", e)
        return jsonify({'error': str(e)}), 500

@app.route('/admin/rewards', methods=['GET'])
def get_user_rewards():  # Cambié el nombre de la función
    with open('static/data/rewards_log.json', 'r', encoding='utf-8') as f:
        rewards = json.load(f)
    return jsonify(rewards)



REWARDS_LOG_FILE = 'static/data/rewards_log.json'

@app.route('/admin/rewards/redeem', methods=['POST'])
def process_redeem_reward():  # Cambié el nombre de la función
    data = request.get_json()
    user_id = data.get('user_id')
    reward = data.get('reward')

    if not user_id or not reward:
        return jsonify({'error': 'Faltan datos'}), 400

    with open('static/data/rewards_log.json', 'r+', encoding='utf-8') as f:
        rewards_log = json.load(f)
        rewards_log.append({'user_id': user_id, 'reward': reward})

        f.seek(0)
        json.dump(rewards_log, f, ensure_ascii=False, indent=2)

    return jsonify({'message': 'Recompensa canjeada exitosamente'})



def load_rewards_log():
    try:
        with open(REWARDS_LOG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_rewards_log(data):
    with open(REWARDS_LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@app.route('/admin/rewards/redeemed', methods=['GET'])
def admin_get_redeemed_rewards():
    redeemed_rewards = db.session.query(
        User.username,
        Reward.name,
        UserReward.date_redeemed  # ✅ Usa el nombre correcto del campo
    ).join(UserReward, User.id == UserReward.user_id) \
        .join(Reward, Reward.id == UserReward.reward_id) \
        .order_by(UserReward.date_redeemed.desc()).all()

    result = [
        {"user": row.username, "reward": row.name, "timestamp": row.date_redeemed.strftime("%Y-%m-%d %H:%M:%S")}
        for row in redeemed_rewards
    ]

    return jsonify(result)

