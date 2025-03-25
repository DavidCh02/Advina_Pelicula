import requests

# Configuración inicial
BASE_URL = "http://127.0.0.1:5000"  # URL base del servidor Flask
USER_ID = 2  # ID del usuario registrado (ajústalo según el usuario que estés usando)
CATEGORY = "accion"  # Categoría del juego (puedes cambiarla según tus necesidades)

# Función para simular puntos y guardarlos en el backend
def simulate_game_rounds(user_id, category, player_score, ai_score, rounds=10):
    for round_number in range(1, rounds + 1):
        print(f"Simulando ronda {round_number}...")
        # Simular puntos del jugador y la IA
        player_score += 2  # Incrementar puntos del jugador
        ai_score += 1  # Incrementar puntos de la IA

        # Guardar puntuaciones en el backend
        response = requests.post(
            f"{BASE_URL}/save_score",
            headers={"Content-Type": "application/json"},
            json={
                "user_id": user_id,
                "player_score": player_score,
                "ai_score": ai_score,
                "category": category
            }
        )

        if response.status_code == 200:
            print(f"Puntuaciones guardadas: Jugador={player_score}, IA={ai_score}")
        else:
            print(f"Error al guardar puntuaciones: {response.text}")
            break

    # Mostrar mensaje final
    print("Simulación completada. Puedes ver las puntuaciones en la pantalla de resultados.")

# Función para verificar la sesión del usuario
def check_session():
    response = requests.get(f"{BASE_URL}/check_session")
    if response.status_code == 200:
        data = response.json()
        if data.get("authenticated"):
            print(f"Sesión activa para el usuario: {data['user']['username']}")
            return data["user"]
    print("No hay sesión activa. Asegúrate de iniciar sesión.")
    return None

# Función principal
if __name__ == "__main__":
    # Verificar sesión del usuario
    user = check_session()
    if not user:
        print("Por favor, inicia sesión antes de ejecutar la simulación.")
        exit()

    # Simular rondas y puntos
    USER_ID = user["id"]  # Usar el ID del usuario actual
    simulate_game_rounds(USER_ID, CATEGORY, player_score=0, ai_score=0)

    # Redirigir a la pantalla de puntuaciones
    print("Redirigiendo a la pantalla de puntuaciones...")
    response = requests.get(f"{BASE_URL}/get_leaderboard")
    if response.status_code == 200:
        leaderboard = response.json()
        print("Tabla de posiciones:")
        for entry in leaderboard:
            print(f"Usuario: {entry['username']}, Jugador: {entry['player_score']}, IA: {entry['ai_score']}")
    else:
        print(f"Error al cargar la tabla de posiciones: {response.text}")