let currentUser = null;
let currentCategory = null;
let playerScore = 0;
let aiScore = 0;
let currentRound = 1;
let playedCategories = new Set();
let isProcessing = false; // Flag global para bloquear acciones concurrentes

// Función de debounce para evitar múltiples ejecuciones rápidas
function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    if (timeoutId) return; // Si ya se programó, ignorar nuevos clics
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

function showScreen(screenId) {
  const screen = document.getElementById(screenId);
  if (!screen) {
    console.error(`Screen element ${screenId} not found`);
    return;
  }
  document.querySelectorAll('.screen').forEach(screen => {
    if (screen) screen.classList.remove('active');
  });
  screen.classList.add('active');
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

  // Actualizar la interfaz
  const categoryDisplay = document.getElementById('current-category');
  if (categoryDisplay) {
    categoryDisplay.textContent = category.charAt(0).toUpperCase() + category.slice(1);
  }

  playedCategories.add(category);
  localStorage.setItem('playedCategories', JSON.stringify([...playedCategories]));

  // Eliminar el botón de la categoría seleccionada para evitar clics duplicados
  document.querySelectorAll('.category-button').forEach(button => {
    if (button.getAttribute('data-category') === category) {
      button.disabled = true;
      button.classList.add('disabled');
    }
  });

  checkRemainingCategories();
  showScreen('game-screen');
  await startPlayerTurn();
}

let usedEmojis = [];

async function startPlayerTurn() {
  if (isProcessing) return;
  isProcessing = true;
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
      document.getElementById('movie-emojis').textContent = newMovie.emojis;

      const optionsContainer = document.getElementById('movie-options');
      optionsContainer.innerHTML = '';
      const shuffledOptions = [...newMovie.options].sort(() => Math.random() - 0.5);
      shuffledOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = 'movie-option';
        button.textContent = option;
        // Se utiliza debounce para prevenir múltiples clics en la opción
        button.onclick = debounce(() => checkAnswer(option, newMovie.correct_answer), 500);
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
  } finally {
    isProcessing = false;
  }
}

async function checkAnswer(selected, correct) {
    if (isProcessing) return;
    isProcessing = true;

    // Deshabilitar botones de respuesta
    document.querySelectorAll('.movie-option').forEach(button => button.disabled = true);

    try {
        if (selected === correct) {
            playerScore += 4;
            showPopup('¡Correcto! +4 puntos', true);
        } else {
            aiScore += 2;
            showPopup(`Incorrecto. La respuesta era: ${correct}`, false);
        }

        updateScores();
        await saveScore();

        if (currentRound < 5) {
            setTimeout(startAITurn, 1500); // Inicia el turno de la IA con un pequeño delay
        } else {
            await endGame();
        }
    } catch (error) {
        console.error('Error:', error);
        showPopup('Error al procesar la respuesta', false);
    } finally {
        isProcessing = false;
    }
}



async function startAITurn() {
    if (isProcessing) return; // 🚨 Evita llamadas múltiples
    isProcessing = true;

    console.log("🔄 Turno de la IA iniciado... esperando emojis del usuario.");

    const aiTurn = document.getElementById('ai-turn');
    const playerTurn = document.getElementById('player-turn');
    const aiEvaluation = document.getElementById('ai-evaluation');
    const aiGuessResult = document.getElementById('ai-guess-result');
    const selectedEmojis = document.getElementById('selected-emojis');

    if (!aiTurn || !playerTurn || !aiEvaluation || !aiGuessResult || !selectedEmojis) {
        console.error("⚠️ Error: Elementos del DOM no encontrados.");
        showPopup("Error en el juego. Recarga la página.", false);
        isProcessing = false;
        return;
    }

    // ✅ Mostrar pantalla de la IA y ocultar la del jugador
    aiTurn.style.display = 'block';
    playerTurn.style.display = 'none';

    // ✅ Limpiar posibles datos previos
    aiGuessResult.textContent = "";
    aiEvaluation.style.display = "none";
    selectedEmojis.textContent = ""; // Borra emojis previos

    console.log("✅ Turno de la IA listo. Esperando emojis del usuario...");

    isProcessing = false; // Permitir que el usuario seleccione emojis y los envíe
}



function resetGame() {
  usedEmojis = [];
}

document.addEventListener('DOMContentLoaded', () => {
  const emojiPicker = document.querySelector('emoji-picker');
  const selectedEmojis = document.getElementById('selected-emojis');

  if (emojiPicker && selectedEmojis) {
    emojiPicker.addEventListener('emoji-click', (e) => {
      selectedEmojis.textContent += e.detail.unicode;
    });

    const removeLastEmojiBtn = document.createElement('button');
    removeLastEmojiBtn.textContent = 'Eliminar emoji ❌';
    removeLastEmojiBtn.classList.add('emoji-remove-btn');
    removeLastEmojiBtn.onclick = () => {
      const text = selectedEmojis.textContent;
      if (text.length > 0) {
        selectedEmojis.textContent = text.slice(0, -2);
      }
    };
    document.getElementById('emoji-picker-container').appendChild(removeLastEmojiBtn);
  }
});

async function submitEmojis() {
    if (isProcessing) return; // 🚨 Evita múltiples llamadas
    isProcessing = true;

    console.log("🚀 Enviando emojis para que la IA adivine...");

    const selectedEmojis = document.getElementById('selected-emojis').innerText.trim();
    const aiGuessResult = document.getElementById('ai-guess-result');
    const aiEvaluation = document.getElementById('ai-evaluation');

    if (!selectedEmojis) {
        showPopup('❌ Por favor selecciona emojis antes de enviarlos.', false);
        isProcessing = false;
        return;
    }

    try {
        const response = await fetch('/ai_guess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emojis: selectedEmojis })
        });

        if (!response.ok) {
            throw new Error(`Error en la API: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ La IA adivinó:", data.guess);

        // ✅ Mostrar resultado de la IA
        aiGuessResult.textContent = `🎥 La IA adivina: ${data.guess}`;
        aiEvaluation.style.display = "block"; // ✅ Mostrar botones de evaluación

    } catch (error) {
        console.error('⚠️ Error al obtener respuesta de la IA:', error);
        showPopup('Error al conectar con el servidor.', false);
    } finally {
        isProcessing = false; // 🔄 Permitir que se haga otra acción después
    }
}





async function evaluateAI(isCorrect) {
    if (isProcessing) return;
    isProcessing = true;

    // Ocultar panel de evaluación
    document.getElementById('ai-evaluation').style.display = 'none';

    try {
        if (isCorrect) {
            aiScore += 4;
            showPopup('¡La IA acertó! +4 puntos', false);
        } else {
            playerScore += 2;
            showPopup('La IA falló, que mal :c', true);
        }

        updateScores();
        await saveScore();

        if (currentRound < 5) {
            currentRound++; // La ronda solo avanza aquí
            setTimeout(startPlayerTurn, 1500); // Regresa al jugador
        } else {
            await endGame();
        }
    } catch (error) {
        console.error('Error:', error);
        showPopup('Error al procesar la evaluación', false);
    } finally {
        isProcessing = false;
    }
}



async function saveScore() {
  try {
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

  // Eliminar botones de categorías ya jugadas
  document.querySelectorAll('.category-button').forEach(button => {
    let category = button.getAttribute('data-category');
    if (playedCategories.has(category)) {
      button.disabled = true;
      button.classList.add('disabled');
    }
  });

  checkRemainingCategories();
}

function checkRemainingCategories() {
  const categoryButtons = document.querySelectorAll('.category-button');
  if (categoryButtons.length === 0) {
    const categoryScreen = document.getElementById('category-screen');
    const message = document.createElement('div');
    message.className = 'no-categories-message';
    message.innerHTML = '<p>No hay más categorías disponibles.<br>Has jugado todas las categorías. ¡Gracias por jugar!</p>';
    categoryScreen.appendChild(message);
    document.querySelector('.logout-container').style.display = 'block';
    const rewardsBtn = document.querySelector('.rewards-btn');
    if (rewardsBtn) {
      rewardsBtn.style.display = 'block';
    }
  }
}

function backToGame() {
  showScreen('game-screen');
}

async function showRewardsScreen() {
  const rewardsContainer = document.getElementById('rewards-container');
  rewardsContainer.innerHTML = '';

  try {
    const response = await fetch('/get_rewards');
    const rewards = await response.json();

    rewards.forEach(reward => {
      const rewardItem = document.createElement('div');
      rewardItem.classList.add('reward-item');
      rewardItem.innerHTML = `
        <p>${reward.name} - ${reward.cost} puntos</p>
        <button onclick="redeemReward(${reward.id}, ${reward.cost})">Canjear</button>
      `;
      rewardsContainer.appendChild(rewardItem);
    });
    showScreen('rewards-screen');
  } catch (error) {
    console.error('Error al obtener recompensas:', error);
  }
}

async function redeemReward(rewardId, cost) {
  if (isProcessing) return;
  isProcessing = true;

  // Validar puntos antes de enviar
  if (playerScore < cost) {
    showPopup('No tienes suficientes puntos', false);
    isProcessing = false;
    return;
  }

  try {
    const response = await fetch('/redeem_reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id, reward_id: rewardId })
    });

    const data = await response.json();
    if (response.ok) {
      playerScore = data.remaining_points;
      updateScores();
      showPopup('¡Recompensa canjeada!', true);
      await showRewardsScreen();
    } else {
      showPopup(data.error, false);
    }
  } catch (error) {
    console.error('Error al canjear recompensa:', error);
  } finally {
    isProcessing = false;
  }
}

async function logout() {
  try {
    const response = await fetch('/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      currentUser = null;
      playerScore = 0;
      aiScore = 0;
      currentRound = 1;
      playedCategories.clear();
      localStorage.removeItem('playedCategories');
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    showPopup('Error al cerrar sesión', false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/check_session');
    const data = await response.json();
    if (data.authenticated) {
      currentUser = data.user;
      const savedCategories = localStorage.getItem('playedCategories');
      if (savedCategories) {
        playedCategories = new Set(JSON.parse(savedCategories));
        document.querySelectorAll('.category-button').forEach(button => {
          if (playedCategories.has(button.getAttribute('data-category'))) {
            button.disabled = true;
            button.classList.add('disabled');
          }
        });
        checkRemainingCategories();
      }
      showScreen('category-screen');
    } else {
      showScreen('register-screen');
    }
  } catch (error) {
    console.error('Error al verificar sesión:', error);
    showScreen('register-screen');
  }
});
const aiEvaluation = document.getElementById('ai-evaluation');
if (aiEvaluation) {
    aiEvaluation.style.display = 'block';
} else {
    console.error("Elemento 'ai-evaluation' no encontrado en el DOM.");
}
const emojiPicker = document.querySelector('emoji-picker');
const selectedEmojis = document.getElementById('selected-emojis');



// Función para simular el avance de ronda y sumar puntos
async function simulateRound() {
    if (!currentUser) {
        showPopup('Debes iniciar sesión para usar esta función', false);
        return;
    }

    // Incrementar puntos del jugador y avanzar de ronda
    playerScore += 2; // Sumar 2 puntos por ronda
    currentRound++;

    // Actualizar la interfaz
    updateScores();

    // Guardar puntuación en la base de datos
    try {
        const response = await fetch('/save_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                player_score: playerScore,
                ai_score: aiScore,
                category: currentCategory || 'general'
            })
        });

        if (!response.ok) {
            throw new Error('Error al guardar puntuación');
        }

        showPopup(`Ronda ${currentRound - 1} completada. +2 puntos`, true);
    } catch (error) {
        console.error('Error al simular ronda:', error);
        showPopup('Error al simular ronda', false);
    }
}