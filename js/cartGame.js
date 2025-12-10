
const music = document.getElementById('bg-music');
const musicToggle = document.getElementById('music-toggle');
let isMusicPlaying = false;

if (music && musicToggle) {
  musicToggle.addEventListener('click', () => {
    if (!isMusicPlaying) {
      music.play();
      isMusicPlaying = true;
      musicToggle.textContent = '♫ Pause';
    } else {
      music.pause();
      isMusicPlaying = false;
      musicToggle.textContent = '♫ Music';
    }
  });
}

const startBtn = document.getElementById('start-game');
const timeLeftSpan = document.getElementById('time-left');
const scoreSpan = document.getElementById('score');
const currentDiscountSpan = document.getElementById('current-discount');
const gameArea = document.getElementById('game-area');
const target = document.getElementById('target');
const gameMessage = document.getElementById('game-message');

let timeLeft = 10;
let score = 0;
let timerId = null;
let moveId = null;
let gameRunning = false;

let playCount = Number(localStorage.getItem('gamePlayCount') || 0);

let bestDiscount = Number(localStorage.getItem('gameDiscount') || 0);
if (bestDiscount > 0) {
  currentDiscountSpan.textContent = bestDiscount;
  gameMessage.textContent =
    `目前最高折扣為 ${bestDiscount} 元（最多可玩 3 次，取最高分計算折扣）。`;
}

function checkPlayLimit() {
  if (playCount >= 3) {
    startBtn.disabled = true;
    startBtn.textContent = '今日遊戲次數已用完';
    if (!gameMessage.textContent.includes('已達 3 次')) {
      gameMessage.textContent += '\n（已達 3 次，無法再遊玩，可以回 Menu 使用最高折扣）';
    }
    return true;
  }
  return false;
}
checkPlayLimit();

startBtn.addEventListener('click', () => {
  if (gameRunning) return;
  if (checkPlayLimit()) return;

  gameRunning = true;
  timeLeft = 10;
  score = 0;
  timeLeftSpan.textContent = timeLeft;
  scoreSpan.textContent = score;
  gameMessage.textContent = '遊戲開始！快用滑鼠或手指點擊食物圖示！';

  target.classList.remove('hidden');
  moveTarget();

  timerId = setInterval(() => {
    timeLeft--;
    timeLeftSpan.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  moveId = setInterval(moveTarget, 1000);
});

target.addEventListener('pointerdown', () => {
  if (!gameRunning) return;
  score++;
  scoreSpan.textContent = score;
  moveTarget();
});

function endGame() {
  clearInterval(timerId);
  clearInterval(moveId);
  gameRunning = false;
  target.classList.add('hidden');

  let thisDiscount = score * 5;
  if (thisDiscount > 100) thisDiscount = 100;

  let prevBest = Number(localStorage.getItem('gameDiscount') || 0);
  bestDiscount = Math.max(prevBest, thisDiscount);

  localStorage.setItem('gameDiscount', bestDiscount);

  playCount++;
  localStorage.setItem('gamePlayCount', playCount);

  currentDiscountSpan.textContent = bestDiscount;

  if (thisDiscount > 0) {
    gameMessage.textContent =
      `遊戲結束！這一局得到 ${score} 分，折扣 ${thisDiscount} 元。\n` +
      `目前三局內最高折扣為 ${bestDiscount} 元（已套用到 Menu 頁，已玩 ${playCount}/3 次）。`;
  } else {
    gameMessage.textContent =
      `遊戲結束！這一局沒有折扣，\n` +
      `目前三局內最高折扣仍為 ${bestDiscount} 元（已玩 ${playCount}/3 次）。`;
  }

  checkPlayLimit();
}

function moveTarget() {
  const areaRect = gameArea.getBoundingClientRect();
  const size = 48;
  const maxX = areaRect.width - size;
  const maxY = areaRect.height - size;

  const x = Math.random() * maxX;
  const y = Math.random() * maxY;

  target.style.left = x + 'px';
  target.style.top = y + 'px';
}
