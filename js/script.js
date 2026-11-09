const board   = document.getElementById('board');
const mario   = document.querySelector('.mario');
const message = document.getElementById('message');
const scoreEl = document.getElementById('score');
const bestEl  = document.getElementById('best');

const MARIO_RUN  = './imagens/mario.gif';
const MARIO_DEAD = './imagens/game-over.png';

/* ---------- obstáculos ----------
   bottom  : altura do chão até a base do obstáculo (px)
   insetX  : folga lateral na colisão (px)
   insetTop: folga no topo na colisão (px)
   speedMul: multiplicador de velocidade                */
const TYPES = {
  pipe:   { el: document.querySelector('.pipe'),   bottom: 0,  width: 80, insetX: 6,  insetTop: 12, speedMul: 1 },
  bullet: { el: document.querySelector('.bullet'), bottom: 70, width: 80, insetX: 10, insetTop: 10, speedMul: 1.2 }
};

// velocidade em "larguras do tabuleiro por segundo"
const START_SPEED = 0.5;
const MAX_SPEED   = 0.95;
const SPEED_STEP  = 0.02;     // aumenta a cada ponto

// pontuação mínima para as balas começarem a aparecer e chance de aparecerem
const BULLET_FROM   = 3;
const BULLET_CHANCE = 0.4;

// hitbox do Mario (px)
const MARIO_LEFT  = 25;
const MARIO_RIGHT = 95;
const STAND_H     = 95;       // altura em pé
const CROUCH_H    = 55;       // altura abaixado

let state   = 'ready';        // 'ready' | 'playing' | 'over'
let score   = 0;
let best    = Number(localStorage.getItem('marioBest')) || 0;
let current = 'pipe';
let obsX    = 0;
let lastTime = 0;
let rafId   = null;

let keyDown   = false;        // seta para baixo / S pressionada
let touchDown = false;        // dedo segurando a parte de baixo da tela

bestEl.textContent = best;

/* ---------- pulo ---------- */
const jump = () => {
  if (state !== 'playing' || mario.classList.contains('jump')) return;
  mario.classList.remove('crouch');
  mario.classList.add('jump');
};

mario.addEventListener('animationend', () => {
  mario.classList.remove('jump');
  updateCrouch();
});

/* ---------- abaixar ---------- */
function updateCrouch() {
  const wantsCrouch = keyDown || touchDown;
  const canCrouch = state === 'playing' && !mario.classList.contains('jump');
  mario.classList.toggle('crouch', wantsCrouch && canCrouch);
}

/* ---------- obstáculos ---------- */
const currentSpeed = () => Math.min(MAX_SPEED, START_SPEED + score * SPEED_STEP);

const spawn = () => {
  const useBullet = score >= BULLET_FROM && Math.random() < BULLET_CHANCE;
  current = useBullet ? 'bullet' : 'pipe';

  for (const [name, t] of Object.entries(TYPES)) {
    t.el.style.display = name === current ? 'block' : 'none';
  }

  obsX = board.clientWidth + Math.random() * 150;
  TYPES[current].el.style.left = `${obsX}px`;
};

const collides = () => {
  const t = TYPES[current];
  const marioBottom = parseFloat(getComputedStyle(mario).bottom);
  const marioTop = marioBottom + (mario.classList.contains('crouch') ? CROUCH_H : STAND_H);

  const oLeft   = obsX + t.insetX;
  const oRight  = obsX + t.width - t.insetX;
  const oBottom = t.bottom;
  const oTop    = t.bottom + t.el.offsetHeight - t.insetTop;

  return oLeft < MARIO_RIGHT && oRight > MARIO_LEFT &&
         marioBottom < oTop && marioTop > oBottom;
};

/* ---------- laço principal ---------- */
const tick = (now) => {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const t = TYPES[current];
  obsX -= currentSpeed() * board.clientWidth * t.speedMul * dt;
  t.el.style.left = `${obsX}px`;

  if (collides()) {
    gameOver();
    return;
  }

  if (obsX < -t.width) {            // passou pelo Mario
    score++;
    scoreEl.textContent = score;
    spawn();
  }

  rafId = requestAnimationFrame(tick);
};

/* ---------- controle do jogo ---------- */
const startGame = () => {
  state = 'playing';
  score = 0;
  scoreEl.textContent = score;

  mario.src = MARIO_RUN;
  mario.removeAttribute('style');
  mario.classList.remove('jump', 'crouch');

  message.classList.add('hidden');

  spawn();
  updateCrouch();

  cancelAnimationFrame(rafId);
  lastTime = performance.now();
  rafId = requestAnimationFrame(tick);
};

const gameOver = () => {
  state = 'over';
  cancelAnimationFrame(rafId);

  // congela o Mario onde ele está
  const marioBottom = parseFloat(getComputedStyle(mario).bottom);
  mario.classList.remove('jump', 'crouch');
  mario.style.animation = 'none';
  mario.style.bottom = `${marioBottom}px`;
  mario.src = MARIO_DEAD;
  mario.style.width = '75px';
  mario.style.marginLeft = '45px';

  if (score > best) {
    best = score;
    localStorage.setItem('marioBest', best);
    bestEl.textContent = best;
  }

  message.innerHTML =
    `<h1>Game Over</h1>
     <p>Você fez <strong>${score}</strong> ponto${score === 1 ? '' : 's'}</p>
     <p>Pressione <kbd>Espaço</kbd> ou toque para jogar de novo</p>`;
  message.classList.remove('hidden');
};

/* ---------- entrada: teclado ---------- */
const JUMP_KEYS   = ['Space', 'ArrowUp', 'KeyW'];
const CROUCH_KEYS = ['ArrowDown', 'KeyS'];

document.addEventListener('keydown', (e) => {
  if (JUMP_KEYS.includes(e.code)) {
    e.preventDefault();
    if (e.repeat) return;
    if (state === 'playing') jump();
    else startGame();
  } else if (CROUCH_KEYS.includes(e.code)) {
    e.preventDefault();
    keyDown = true;
    updateCrouch();
  }
});

document.addEventListener('keyup', (e) => {
  if (CROUCH_KEYS.includes(e.code)) {
    keyDown = false;
    updateCrouch();
  }
});

window.addEventListener('blur', () => {
  keyDown = false;
  touchDown = false;
  updateCrouch();
});

/* ---------- entrada: toque / mouse ---------- */
board.addEventListener('pointerdown', (e) => {
  e.preventDefault();

  if (state !== 'playing') {
    startGame();
    return;
  }

  // no toque, a parte de baixo da tela (40%) abaixa; o resto pula
  const rect = board.getBoundingClientRect();
  const inLowerZone = (e.clientY - rect.top) > rect.height * 0.6;

  if (e.pointerType === 'touch' && inLowerZone) {
    touchDown = true;
    updateCrouch();
  } else {
    jump();
  }
});

const releaseTouch = () => {
  if (!touchDown) return;
  touchDown = false;
  updateCrouch();
};
document.addEventListener('pointerup', releaseTouch);
document.addEventListener('pointercancel', releaseTouch);
