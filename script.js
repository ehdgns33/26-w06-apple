const BOARD_SIZE = 8;
const ROUND_SECONDS = 60;
const BEST_SCORE_KEY = "ten-link-best-score";

const boardElement = document.querySelector("#game-board");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const timerElement = document.querySelector("#timer");
const timerStateElement = document.querySelector("#timer-state");
const timerProgress = document.querySelector("#timer-progress");
const timerTrack = document.querySelector(".timer-track");
const startButton = document.querySelector("#start-button");
const replayButton = document.querySelector("#replay-button");
const selectionSumElement = document.querySelector("#selection-sum");
const gameMessageElement = document.querySelector("#game-message");
const endOverlay = document.querySelector("#end-overlay");
const finalScoreElement = document.querySelector("#final-score");
const confettiLayer = document.querySelector("#confetti-layer");

let board = [];
let fallDistances = [];
let selection = [];
let score = 0;
let bestScore = readBestScore();
let secondsLeft = ROUND_SECONDS;
let deadline = 0;
let timerId = null;
let activePointerId = null;
let gameState = "ready";
let messageTimeout = null;
let confettiTimeout = null;

bestScoreElement.textContent = bestScore.toLocaleString("ko-KR");
createBoard();

function readBestScore() {
  try {
    return Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function randomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function createBoard() {
  board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, randomNumber),
  );
  fallDistances = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  renderBoard();
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  board.forEach((row, rowIndex) => {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";
    rowElement.setAttribute("role", "row");

    row.forEach((number, columnIndex) => {
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `${rowIndex + 1}행 ${columnIndex + 1}열, ${number}`);
      tile.dataset.row = rowIndex;
      tile.dataset.column = columnIndex;
      const fruit = document.createElement("span");
      fruit.className = "apple-fruit";
      fruit.setAttribute("aria-hidden", "true");
      fruit.textContent = "🍎";
      fruit.style.setProperty("--fall-offset", `${fallDistances[rowIndex][columnIndex] * -100}%`);
      fruit.style.setProperty("--fall-delay", `${fallDistances[rowIndex][columnIndex] * 24}ms`);
      const label = document.createElement("span");
      label.className = "tile-number";
      label.textContent = number;
      tile.append(fruit, label);
      rowElement.append(tile);
    });

    fragment.append(rowElement);
  });

  boardElement.replaceChildren(fragment);
}

function getPosition(tile) {
  return {
    row: Number(tile.dataset.row),
    column: Number(tile.dataset.column),
  };
}

function positionKey(position) {
  return `${position.row},${position.column}`;
}

function isAdjacent(first, second) {
  return Math.max(
    Math.abs(first.row - second.row),
    Math.abs(first.column - second.column),
  ) === 1;
}

function updateSelectionDisplay() {
  const sum = selection.reduce(
    (total, position) => total + board[position.row][position.column],
    0,
  );
  selectionSumElement.textContent = sum.toString();

  for (const tile of boardElement.querySelectorAll(".tile")) {
    const position = getPosition(tile);
    const isSelected = selection.some((selected) => positionKey(selected) === positionKey(position));
    tile.classList.toggle("is-selected", isSelected);
    tile.setAttribute("aria-pressed", String(isSelected));
  }
}

function clearSelection() {
  selection = [];
  updateSelectionDisplay();
}

function showMessage(message, isAlert = false) {
  window.clearTimeout(messageTimeout);
  gameMessageElement.textContent = message;
  gameMessageElement.classList.toggle("is-alert", isAlert);

  if (isAlert) {
    messageTimeout = window.setTimeout(() => {
      gameMessageElement.textContent = "이웃한 숫자를 이어 합을 10의 배수로 만들어 보세요.";
      gameMessageElement.classList.remove("is-alert");
    }, 1400);
  }
}

function startGame() {
  window.clearInterval(timerId);
  window.clearTimeout(messageTimeout);
  score = 0;
  secondsLeft = ROUND_SECONDS;
  gameState = "playing";
  endOverlay.hidden = true;
  scoreElement.textContent = "0";
  timerStateElement.textContent = "LIVE";
  timerStateElement.parentElement.classList.add("is-live");
  startButton.innerHTML = '<span aria-hidden="true">↻</span> 다시 시작';
  clearSelection();
  createBoard();
  showMessage("숫자를 이어 합을 10의 배수로 만들어 보세요.");
  updateTimerDisplay();

  deadline = Date.now() + ROUND_SECONDS * 1000;
  timerId = window.setInterval(tick, 100);
}

function tick() {
  secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  updateTimerDisplay();

  if (secondsLeft === 0) {
    finishGame();
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  timerElement.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerProgress.style.width = `${(secondsLeft / ROUND_SECONDS) * 100}%`;
  timerTrack.setAttribute("aria-valuenow", String(secondsLeft));
}

function finishGame() {
  window.clearInterval(timerId);
  timerId = null;
  gameState = "finished";
  activePointerId = null;
  clearSelection();
  timerStateElement.textContent = "DONE";
  timerStateElement.parentElement.classList.remove("is-live");
  finalScoreElement.textContent = score.toLocaleString("ko-KR");
  endOverlay.hidden = false;
  showMessage("1분이 끝났어요. 다음 판에서 기록을 갱신해 보세요.");
  startButton.innerHTML = '<span aria-hidden="true">↻</span> 다시 도전';
}

function addScore(points) {
  score += points;
  scoreElement.textContent = score.toLocaleString("ko-KR");

  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = bestScore.toLocaleString("ko-KR");
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    } catch {
      // The current game remains playable when storage is unavailable.
    }
    return true;
  }

  return false;
}

function dropApples(harvestedPositions) {
  const harvested = new Set(harvestedPositions.map(positionKey));
  fallDistances = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));

  for (let column = 0; column < BOARD_SIZE; column += 1) {
    let destinationRow = BOARD_SIZE - 1;

    for (let sourceRow = BOARD_SIZE - 1; sourceRow >= 0; sourceRow -= 1) {
      if (harvested.has(`${sourceRow},${column}`)) continue;

      board[destinationRow][column] = board[sourceRow][column];
      fallDistances[destinationRow][column] = destinationRow - sourceRow;
      destinationRow -= 1;
    }

    while (destinationRow >= 0) {
      board[destinationRow][column] = randomNumber();
      destinationRow -= 1;
    }
  }
}

function showConfetti() {
  const colors = ["#d94c40", "#347b4d", "#f2c94c", "#55a6c9", "#f28c65"];
  const pieces = document.createDocumentFragment();

  for (let index = 0; index < 72; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--left", `${Math.random() * 100}%`);
    piece.style.setProperty("--color", colors[Math.floor(Math.random() * colors.length)]);
    piece.style.setProperty("--drift", `${Math.random() * 220 - 110}px`);
    piece.style.setProperty("--spin", `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty("--duration", `${1.8 + Math.random() * 1.2}s`);
    piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
    piece.style.setProperty("--width", `${5 + Math.random() * 5}px`);
    piece.style.setProperty("--height", `${8 + Math.random() * 8}px`);
    if (Math.random() > 0.55) piece.classList.add("is-round");
    pieces.append(piece);
  }

  confettiLayer.replaceChildren(pieces);
  window.clearTimeout(confettiTimeout);
  confettiTimeout = window.setTimeout(() => confettiLayer.replaceChildren(), 3400);
}

function finishSelection() {
  if (selection.length < 2) {
    clearSelection();
    return;
  }

  const sum = selection.reduce(
    (total, position) => total + board[position.row][position.column],
    0,
  );

  if (sum % 10 !== 0) {
    clearSelection();
    showMessage("합이 10의 배수가 아니에요. 다시 이어 보세요.", true);
    return;
  }

  const harvestedPositions = selection;
  dropApples(harvestedPositions);
  const isNewRecord = addScore(sum);
  clearSelection();
  renderBoard();
  if (isNewRecord) showConfetti();
  showMessage(`${sum}점을 얻었어요! 계속 이어 보세요.`);
}

function extendSelection(tile) {
  const position = getPosition(tile);
  const last = selection[selection.length - 1];
  if (!last || positionKey(position) === positionKey(last)) return;

  if (selection.length > 1 && positionKey(position) === positionKey(selection[selection.length - 2])) {
    selection.pop();
    updateSelectionDisplay();
    return;
  }

  const alreadySelected = selection.some((selected) => positionKey(selected) === positionKey(position));
  if (alreadySelected || !isAdjacent(last, position)) return;

  selection.push(position);
  updateSelectionDisplay();
}

function tileAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element instanceof Element ? element.closest(".tile") : null;
}

boardElement.addEventListener("pointerdown", (event) => {
  if (gameState !== "playing") return;
  const tile = event.target.closest(".tile");
  if (!tile) return;

  event.preventDefault();
  clearSelection();
  activePointerId = event.pointerId;
  boardElement.setPointerCapture(event.pointerId);
  selection.push(getPosition(tile));
  updateSelectionDisplay();
});

boardElement.addEventListener("pointermove", (event) => {
  if (gameState !== "playing" || activePointerId !== event.pointerId) return;
  const tile = tileAtPoint(event.clientX, event.clientY);
  if (tile) extendSelection(tile);
});

function endPointer(event, shouldCommit) {
  if (activePointerId !== event.pointerId) return;
  activePointerId = null;
  if (boardElement.hasPointerCapture(event.pointerId)) {
    boardElement.releasePointerCapture(event.pointerId);
  }
  if (shouldCommit && gameState === "playing") finishSelection();
  else clearSelection();
}

boardElement.addEventListener("pointerup", (event) => endPointer(event, true));
boardElement.addEventListener("pointercancel", (event) => endPointer(event, false));

startButton.addEventListener("click", startGame);
replayButton.addEventListener("click", startGame);
