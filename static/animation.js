// Función para crear confeti al ganar una ronda
function createConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = ''; // Limpiar confeti previo

    const colors = ['#6C5CE7', '#a29bfe', '#00b894', '#55efc4', '#fdcb6e', '#ffeaa7', '#e84393', '#fd79a8'];

    // Crear 100 piezas de confeti
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        // Posición aleatoria
        const left = Math.random() * 100;

        // Duración y retraso aleatorios
        const duration = Math.random() * 3 + 2; // 2-5 segundos
        const delay = Math.random() * 0.5; // 0-0.5 segundos

        // Color aleatorio
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Aplicar estilos
        confetti.style.setProperty('--color', color);
        confetti.style.setProperty('--duration', `${duration}s`);
        confetti.style.setProperty('--delay', `${delay}s`);
        confetti.style.left = `${left}%`;

        container.appendChild(confetti);
    }

    // Eliminar confeti después de 5 segundos
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Mejorar la función showPopup para incluir animaciones
const originalShowPopup = window.showPopup;
window.showPopup = function(message, isSuccess) {
    originalShowPopup(message, isSuccess);

    // Añadir efectos según resultado
    if (isSuccess) {
        createConfetti();
        document.getElementById('player-score').classList.add('win-animation');
        setTimeout(() => {
            document.getElementById('player-score').classList.remove('win-animation');
        }, 1000);
    } else {
        document.getElementById('ai-score').classList.add('win-animation');
        setTimeout(() => {
            document.getElementById('ai-score').classList.remove('win-animation');
        }, 1000);
    }
};



// Mejorar la función endGame para mostrar un mensaje diferente según el resultado
const originalEndGame = window.endGame;
window.endGame = function() {
    originalEndGame();

    // Mostrar mensaje según el resultado
    const finalPlayerScore = parseInt(document.getElementById('final-player-score').textContent);
    const finalAiScore = parseInt(document.getElementById('final-ai-score').textContent);
    const finalMessage = document.getElementById('final-message');

    if (finalPlayerScore > finalAiScore) {
        finalMessage.innerHTML = '¡Felicidades! <i class="fas fa-crown"></i> Has ganado al desafío de emojis';
        finalMessage.style.color = '#00b894';
        createConfetti();
    } else if (finalPlayerScore < finalAiScore) {
        finalMessage.innerHTML = 'Has perdido esta vez <i class="fas fa-sad-tear"></i> ¡Inténtalo de nuevo!';
        finalMessage.style.color = '#d63031';
    } else {
        finalMessage.innerHTML = '¡Empate! <i class="fas fa-handshake"></i> Tu y la IA tienen el mismo nivel';
        finalMessage.style.color = '#6C5CE7';
    }
};

// Añadir animación a las opciones de película al hacer clic
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('movie-option')) {
        const options = document.querySelectorAll('.movie-option');
        options.forEach(option => {
            if (option !== e.target) {
                option.style.opacity = '0.6';
                option.style.transform = 'scale(0.95)';
            } else {
                option.classList.add('win-animation');
            }
        });
    }
});

// Animación en emoji seleccionado
document.addEventListener('DOMContentLoaded', function() {
    // Efecto de pulso para el contenedor de emojis seleccionados cuando está vacío
    const selectedEmojis = document.getElementById('selected-emojis');
    if (selectedEmojis) {
        setInterval(() => {
            if (selectedEmojis.textContent.trim() === '') {
                selectedEmojis.classList.add('pulse-animation');
            } else {
                selectedEmojis.classList.remove('pulse-animation');
            }
        }, 500);
    }

    // Animación de entrada para los elementos de la página
    const elementsToAnimate = [
        'h1', 'h2', '.form-group', '.category-buttons', '.scores',
        '#category-display', '.emojis', '.movie-options', '#emoji-picker-container',
        '.selected-emojis', '.emoji-remove-btn', '.ai-guess', '.ai-evaluation'
    ];
    elementsToAnimate.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            element.classList.add('fade-in-animation');
        });
    });
});