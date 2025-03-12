


let currentUser = null;
let currentCategory = null;
let playerScore = 0;
let aiScore = 0;
let currentRound = 1;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showPopup(message, isSuccess) {
    const popup = document.getElementById('feedback-popup');
    popup.textContent = message;
    popup.style.background = isSuccess ? '#34a853' : '#ea4335';
    popup.style.color = 'white';
    popup.style.display = 'block';
    setTimeout(() => {
        popup.style.display = 'none';
    }, 2000);
}

async function register() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        showPopup('Por favor ingresa un nombre de usuario', false);
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        if (response.ok) {
            currentUser = data;
            showScreen('category-screen');
        } else {
            showPopup(data.error || 'Error al registrar usuario', false);
        }
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        showPopup('Error al conectar con el servidor', false);
    }
}

async function selectCategory(category) {
    currentCategory = category;
    playerScore = 0;
    aiScore = 0;
    currentRound = 1;
    updateScores();

    // Mostrar la categoría seleccionada
    document.getElementById('current-category').textContent = category.charAt(0).toUpperCase() + category.slice(1);

    showScreen('game-screen');
    await startPlayerTurn();
}

async function startPlayerTurn() {
    try {
        const response = await fetch('/get_movie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: currentCategory })
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('movie-emojis').textContent = data.emojis;
            const optionsContainer = document.getElementById('movie-options');
            optionsContainer.innerHTML = '';

            // Mezclar opciones
            const shuffledOptions = [...data.options].sort(() => Math.random() - 0.5);

            shuffledOptions.forEach(option => {
                const button = document.createElement('button');
                button.className = 'movie-option';
                button.textContent = option;
                button.onclick = () => checkAnswer(option, data.correct_answer);
                optionsContainer.appendChild(button);
            });

            document.getElementById('player-turn').style.display = 'block';
            document.getElementById('ai-turn').style.display = 'none';
        } else {
            showPopup(data.error || 'Error al obtener película', false);
        }
    } catch (error) {
        console.error('Error al obtener película:', error);
        showPopup('Error al conectar con el servidor', false);
    }
}

async function checkAnswer(selected, correct) {
    if (selected === correct) {
        playerScore += 2;
        showPopup('¡Correcto! +2 puntos', true);
    } else {
        aiScore += 1;
        showPopup(`Incorrecto. La respuesta era: ${correct}`, false);
    }

    updateScores();
    await saveScore();

    if (currentRound < 10) {
        currentRound++;
        await startAITurn();
    } else {
        endGame();
    }
}

async function startAITurn() {
    try {
        const response = await fetch('/get_movie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: currentCategory })
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('ai-turn').style.display = 'block';
            document.getElementById('player-turn').style.display = 'none';
        }
    } catch (error) {
        console.error('Error al obtener película para la IA:', error);
        showPopup('Error al generar emojis para la IA', false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const emojiPicker = document.querySelector('emoji-picker');
    const selectedEmojis = document.getElementById('selected-emojis');

    if (emojiPicker && selectedEmojis) {
        // Manejar clic en emojis
        emojiPicker.addEventListener('emoji-click', (e) => {
            selectedEmojis.textContent += e.detail.unicode;
        });

        // Agregar botón para eliminar el último emoji
        const removeLastEmojiBtn = document.createElement('button');
        removeLastEmojiBtn.textContent = 'Eliminar último emoji';
        removeLastEmojiBtn.classList.add('emoji-remove-btn');
        removeLastEmojiBtn.onclick = () => {
            const text = selectedEmojis.textContent;
            if (text.length > 0) {
                selectedEmojis.textContent = text.slice(0, -2); // Eliminar el último emoji
            }
        };

        // Agregar el botón debajo del selector de emojis
        document.getElementById('emoji-picker-container').appendChild(removeLastEmojiBtn);
    }
});

async function submitEmojis() {
    // Obtener los emojis del div correcto (selected-emojis)
    const emojis = document.getElementById('selected-emojis').innerText.trim();
    if (!emojis) {
        showPopup('Por favor selecciona emojis', false);
        return;
    }
    try {
        const response = await fetch('/ai_guess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emojis })
        });
        if (!response.ok) {
            throw new Error(`Error al obtener respuesta de la IA: ${response.statusText}`);
        }
        const data = await response.json();
        document.getElementById('ai-guess-result').textContent = `La IA adivina: ${data.guess}`;
        document.getElementById('ai-evaluation').style.display = 'block';
        document.getElementById('emoji-panel').style.display = 'none';
        document.getElementById('ai-turn').style.display = 'block';
    } catch (error) {
        console.error('Error al obtener respuesta de la IA:', error);
    }
}

async function evaluateAI(isCorrect) {
    if (isCorrect) {
        aiScore += 2;
        showPopup('¡La IA acertó! +2 puntos', false);
    } else {
        playerScore += 1;
        showPopup('La IA falló. +1 punto para ti', true);
    }

    updateScores();
    await saveScore();

    document.getElementById('ai-guess-result').textContent = '';
    document.getElementById('ai-evaluation').style.display = 'none';

    if (currentRound < 10) {
        currentRound++;
        await startPlayerTurn();
    } else {
        endGame();
    }
}

async function saveScore() {
    try {
        console.log('Guardando puntuaciones:', {
            user_id: currentUser.id,
            player_score: playerScore,
            ai_score: aiScore,
            category: currentCategory
        });
        const response = await fetch('/save_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                player_score: playerScore,
                ai_score: aiScore,
                category: currentCategory
            })
        });

        if (!response.ok) {
            console.error('Error al guardar puntuación:', await response.text());
        }
    } catch (error) {
        console.error('Error al guardar puntuación:', error);
        showPopup('Error al guardar puntuación', false);
    }
}

function updateScores() {
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('ai-score').textContent = aiScore;
    document.getElementById('round-number').textContent = currentRound;
}

async function endGame() {
    document.getElementById('final-player-score').textContent = playerScore;
    document.getElementById('final-ai-score').textContent = aiScore;

    try {
        const response = await fetch('/get_leaderboard');
        const leaderboard = await response.json();

        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '';

        leaderboard.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.username}</td>
                <td>${entry.player_score}</td>
                <td>${entry.ai_score}</td>
            `;
            leaderboardBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar tabla de posiciones:', error);
        showPopup('Error al cargar tabla de posiciones', false);
    }

    showScreen('results-screen');
}

function playAgain() {
    currentCategory = null;
    playerScore = 0;
    aiScore = 0;
    currentRound = 1;
    showScreen('category-screen');
}
