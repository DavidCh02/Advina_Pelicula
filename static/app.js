


let currentUser = null;
let currentCategory = null;
let playerScore = 0;
let aiScore = 0;
let currentRound = 1;
let playedCategories = new Set();


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

    // Actualizar el nombre de la categoría en la interfaz
    const categoryDisplay = document.getElementById('current-category');
    if (categoryDisplay) {
        categoryDisplay.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    }

    // Guardar la categoría jugada y almacenarla en localStorage
    playedCategories.add(category);
    localStorage.setItem('playedCategories', JSON.stringify([...playedCategories]));

    // Buscar y eliminar el botón de la categoría seleccionada
    document.querySelectorAll('.category-button').forEach(button => {
        if (button.getAttribute('data-category') === category) {
            button.remove(); // Elimina el botón del DOM
        }
    });

    checkRemainingCategories();
    showScreen('game-screen');
    await startPlayerTurn();
}







// Agregar variable para almacenar emojis usados
let usedEmojis = [];

async function startPlayerTurn() {
    try {
        let newMovie;
        let attempts = 0;
        do {
            const response = await fetch('/get_movie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: currentCategory })
            });
            newMovie = await response.json();
            attempts++;
        } while (usedEmojis.includes(newMovie.emojis) && attempts < 10); // Intentar hasta 10 veces

        if (!usedEmojis.includes(newMovie.emojis)) {
            usedEmojis.push(newMovie.emojis);
            document.getElementById('movie-emojis').textContent = newMovie.emojis;

            const optionsContainer = document.getElementById('movie-options');
            optionsContainer.innerHTML = '';
            const shuffledOptions = [...newMovie.options].sort(() => Math.random() - 0.5);
            shuffledOptions.forEach(option => {
                const button = document.createElement('button');
                button.className = 'movie-option';
                button.textContent = option;
                button.onclick = () => checkAnswer(option, newMovie.correct_answer);
                optionsContainer.appendChild(button);
            });
            document.getElementById('player-turn').style.display = 'block';
            document.getElementById('ai-turn').style.display = 'none';
        } else {
            showPopup('Error al generar emojis únicos', false);
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
    // Limpiar emojis seleccionados
    document.getElementById('selected-emojis').textContent = '';

    try {
        let newMovie;
        let attempts = 0;
        do {
            const response = await fetch('/get_movie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: currentCategory })
            });
            newMovie = await response.json();
            attempts++;
        } while (usedEmojis.includes(newMovie.emojis) && attempts < 10);

        if (!usedEmojis.includes(newMovie.emojis)) {
            usedEmojis.push(newMovie.emojis);
            document.getElementById('ai-turn').style.display = 'block';
            document.getElementById('player-turn').style.display = 'none';
        } else {
            showPopup('Error al generar emojis únicos para IA', false);
        }
    } catch (error) {
        console.error('Error al obtener película para la IA:', error);
        showPopup('Error al generar emojis para la IA', false);
    }
}

function resetGame() {
    usedEmojis = []; // Limpiar lista de emojis usados
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
        removeLastEmojiBtn.textContent = 'Eliminar emoji ❌';
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
        showPopup('La IA falló, que mal :c ', true);
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
    playerScore = 0;
    aiScore = 0;
    currentRound = 1;
    resetGame();
    showScreen('category-screen');

    // Verificar y eliminar las categorías jugadas
    document.querySelectorAll('.category-button').forEach(button => {
        let category = button.getAttribute('data-category');
        if (playedCategories.has(category)) {
            button.remove();
        }
    });

    checkRemainingCategories();
}


function checkRemainingCategories() {
    const remainingCategories = document.querySelectorAll('.category-button');

    if (remainingCategories.length === 0) {
        // Mostrar mensaje de que no hay más categorías
        document.getElementById('category-screen').innerHTML = `
            <h1>😢 No hay más categorías disponibles</h1>
            <p>Has jugado todas las categorías. ¡Gracias por jugar!</p>
                    `;
    }
}


