const canvas = document.getElementById('tetris-board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const finalScoreElement = document.getElementById('final-score');
const gameOverOverlay = document.getElementById('game-over-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const soundBtn = document.getElementById('sound-btn');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Tetromino definitions
const SHAPES = [
    [], // Empty placeholder
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[2, 0, 0], [2, 2, 2], [0, 0, 0]], // J
    [[0, 0, 3], [3, 3, 3], [0, 0, 0]], // L
    [[4, 4], [4, 4]], // O
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]], // S
    [[0, 6, 0], [6, 6, 6], [0, 0, 0]], // T
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]]  // Z
];

const COLORS = [
    null,
    '#00f0f0', // I - Cyan
    '#0000f0', // J - Blue
    '#f0a000', // L - Orange
    '#f0f000', // O - Yellow
    '#00f000', // S - Green
    '#a000f0', // T - Purple
    '#f00000'  // Z - Red
];

let board = [];
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isSoundOn = true;

let particles = [];

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0
};

let nextPieceMatrix = null;

// Sound System using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const sounds = {
    move: () => playTone(200, 'square', 0.05),
    rotate: () => playTone(300, 'triangle', 0.05),
    drop: () => playTone(100, 'sawtooth', 0.1),
    clear: () => playMelody([440, 554, 659], 'sine', 0.1), // A major chord
    gameOver: () => playMelody([300, 250, 200, 150], 'sawtooth', 0.3)
};

function playTone(freq, type, duration) {
    if (!isSoundOn) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playMelody(freqs, type, noteDuration) {
    if (!isSoundOn) return;
    freqs.forEach((f, i) => {
        setTimeout(() => playTone(f, type, noteDuration), i * noteDuration * 1000);
    });
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // Gravity
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

function createParticles(x, y, color) {
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
        const pX = (x * BLOCK_SIZE) + (BLOCK_SIZE / 2);
        const pY = (y * BLOCK_SIZE) + (BLOCK_SIZE / 2);
        particles.push(new Particle(pX, pY, color));
    }
}

function init() {
    board = createMatrix(COLS, ROWS);
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    isPaused = false;
    dropInterval = 1000;
    particles = [];
    updateScore();

    playerReset();
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    update();
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function draw() {
    // Clear board
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMatrix(board, { x: 0, y: 0 });

    // Draw Ghost Piece
    const ghostPos = { ...player.pos };
    while (!collide(board, { pos: ghostPos, matrix: player.matrix })) {
        ghostPos.y++;
    }
    ghostPos.y--; // Move back up one step

    drawMatrix(player.matrix, ghostPos, true); // true for ghost
    drawMatrix(player.matrix, player.pos);

    // Draw particles
    particles.forEach(p => p.draw(ctx));
}

function drawMatrix(matrix, offset, isGhost = false) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                if (isGhost) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    ctx.strokeRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                } else {
                    // Main block
                    ctx.fillStyle = COLORS[value];
                    ctx.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

                    // Inner bevel/highlight effect for 3D look
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.strokeRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

                    // Inner glow
                    ctx.shadowColor = COLORS[value];
                    ctx.shadowBlur = 10;
                }
                ctx.shadowBlur = 0; // Reset shadow
            }
        });
    });
}

function drawNextPiece() {
    nextCtx.fillStyle = '#000'; // Or transparent
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!nextPieceMatrix) return;

    // Center the piece in the preview window
    const offsetX = (nextCanvas.width / BLOCK_SIZE - nextPieceMatrix[0].length) / 2;
    const offsetY = (nextCanvas.height / BLOCK_SIZE - nextPieceMatrix.length) / 2;

    const PREVIEW_BLOCK_SIZE = 20;

    nextPieceMatrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                nextCtx.fillStyle = COLORS[value];
                nextCtx.fillRect((x + 1) * PREVIEW_BLOCK_SIZE, (y + 1) * PREVIEW_BLOCK_SIZE, PREVIEW_BLOCK_SIZE, PREVIEW_BLOCK_SIZE);

                nextCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                nextCtx.strokeRect((x + 1) * PREVIEW_BLOCK_SIZE, (y + 1) * PREVIEW_BLOCK_SIZE, PREVIEW_BLOCK_SIZE, PREVIEW_BLOCK_SIZE);
            }
        });
    });
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        sounds.drop();
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(board, player)) {
        player.pos.x -= dir;
    } else {
        sounds.move();
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
    sounds.rotate();
}

function playerReset() {
    if (nextPieceMatrix === null) {
        const typeId = (Math.random() * (SHAPES.length - 1) | 0) + 1;
        nextPieceMatrix = createPiece(typeId);
    }

    player.matrix = nextPieceMatrix;

    const typeId = (Math.random() * (SHAPES.length - 1) | 0) + 1;
    nextPieceMatrix = createPiece(typeId);
    drawNextPiece();

    player.pos.y = 0;
    player.pos.x = (board[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(board, player)) {
        gameOver = true;
        sounds.gameOver();
        finalScoreElement.innerText = score;
        gameOverOverlay.classList.remove('hidden');
    }
}

function createPiece(type) {
    if (typeof type === 'number') {
        return SHAPES[type].map(row => [...row]);
    }
    return SHAPES[1].map(row => [...row]);
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }

        // Line cleared! Spawn particles
        for (let x = 0; x < board[y].length; ++x) {
            createParticles(x, y, COLORS[board[y][x]]);
        }

        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        rowCount++;
    }

    if (rowCount > 0) {
        sounds.clear();
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[rowCount] * level;
        lines += rowCount;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    }
}

function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;

    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
    } else {
        pauseOverlay.classList.add('hidden');
        lastTime = performance.now(); // Reset time to avoid jump
        requestAnimationFrame(update);
    }
}

function toggleSound() {
    isSoundOn = !isSoundOn;
    soundBtn.innerText = isSoundOn ? "Sound: ON" : "Sound: OFF";
    if (isSoundOn && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function update(time = 0) {
    if (gameOver || isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    draw();
    requestAnimationFrame(update);
}

function updateScore() {
    scoreElement.innerText = score;
    levelElement.innerText = level;
}

document.addEventListener('keydown', event => {
    if (gameOver) return;

    // Pause toggle
    if (event.keyCode === 80 || event.keyCode === 27) { // P or Escape
        togglePause();
        return;
    }

    if (isPaused) return; // Block other controls if paused

    if (event.keyCode === 37) { // Left
        playerMove(-1);
    } else if (event.keyCode === 39) { // Right
        playerMove(1);
    } else if (event.keyCode === 40) { // Down
        playerDrop();
    } else if (event.keyCode === 38) { // Up (Rotate)
        playerRotate(1);
    } else if (event.keyCode === 32) { // Space (Hard Drop)
        while (!collide(board, player)) {
            player.pos.y++;
        }
        player.pos.y--;
        merge(board, player);
        sounds.drop();
        playerReset();
        arenaSweep();
        updateScore();
        dropCounter = 0;
    }
});

restartBtn.addEventListener('click', () => {
    init();
});

if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
        togglePause();
        pauseBtn.blur();
    });
}

if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
        togglePause();
    });
}

if (soundBtn) {
    soundBtn.addEventListener('click', () => {
        toggleSound();
        soundBtn.blur();
    });
}

// Start game
init();
