// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
const BOX_SIZE = 3;
const TOP_TEN_KEY = 'sudoku-top-ten';
const THEME_KEY = 'sudoku-theme';

let puzzle = [];
let currentSolution = [];
let difficulty = 'medium';
let secondsElapsed = 0;
let timerInterval = null;
let hintsUsed = 0;
let gameFinished = false;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function setMessage(text, type = 'info') {
  const message = document.getElementById('message');
  message.textContent = text;
  message.className = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
}

function startTimer() {
  clearInterval(timerInterval);
  secondsElapsed = 0;
  document.getElementById('timer').textContent = formatTime(secondsElapsed);

  timerInterval = setInterval(() => {
    secondsElapsed += 1;
    document.getElementById('timer').textContent = formatTime(secondsElapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function getThemePreference() {
  return localStorage.getItem(THEME_KEY) === 'dark';
}

function applyTheme() {
  const darkMode = getThemePreference();
  document.body.classList.toggle('dark-mode', darkMode);
  const toggle = document.getElementById('theme-toggle');
  toggle.textContent = darkMode ? 'Light mode' : 'Dark mode';
}

function setTheme(darkMode) {
  localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
  applyTheme();
}

function getSavedScores() {
  try {
    return JSON.parse(localStorage.getItem(TOP_TEN_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function renderLeaderboard() {
  const list = document.getElementById('top-ten-list');
  const scores = getSavedScores().slice(0, 10);

  list.innerHTML = '';

  if (!scores.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-score';
    empty.textContent = 'No scores yet';
    list.appendChild(empty);
    return;
  }

  scores.forEach((entry, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<span>#${index + 1} ${entry.name}</span><span>${entry.difficulty}</span><span>${formatTime(entry.time)}</span>`;
    list.appendChild(item);
  });
}

function saveScore(name) {
  const scores = getSavedScores();
  scores.push({
    name,
    time: secondsElapsed,
    difficulty: difficulty.toUpperCase()
  });

  scores.sort((a, b) => a.time - b.time);
  localStorage.setItem(TOP_TEN_KEY, JSON.stringify(scores.slice(0, 10)));
  renderLeaderboard();
}

function isMoveValid(board, row, col, value) {
  if (!value || value === 0) {
    return true;
  }

  for (let i = 0; i < SIZE; i++) {
    if (i !== col && board[row][i] === value) {
      return false;
    }
  }

  for (let i = 0; i < SIZE; i++) {
    if (i !== row && board[i][col] === value) {
      return false;
    }
  }

  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;

  for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
      if ((r !== row || c !== col) && board[r][c] === value) {
        return false;
      }
    }
  }

  return true;
}

function getBoxClass(row, col) {
  const boxRow = Math.floor(row / BOX_SIZE);
  const boxCol = Math.floor(col / BOX_SIZE);
  return (boxRow + boxCol) % 2 === 0 ? 'box-light' : 'box-dark';
}

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';

  for (let row = 0; row < SIZE; row++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';

    for (let col = 0; col < SIZE; col++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = `sudoku-cell ${getBoxClass(row, col)}`;
      input.dataset.row = row;
      input.dataset.col = col;
      input.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`);

      input.addEventListener('input', (event) => {
        const target = event.target;
        target.value = target.value.replace(/[^1-9]/g, '');

        const board = getBoardFromInputs();
        const value = target.value ? Number(target.value) : 0;

        if (target.value === '') {
          target.classList.remove('invalid', 'incorrect');
          setMessage('');
          return;
        }

        if (!isMoveValid(board, Number(target.dataset.row), Number(target.dataset.col), value)) {
          target.classList.add('invalid');
          setMessage('Invalid move: this value conflicts with the row, column, or 3x3 box.', 'error');
          return;
        }

        target.classList.remove('invalid');
        setMessage('');

        const currentBoard = getBoardFromInputs();
        if (currentBoard.flat().every((cell) => cell !== 0)) {
          checkSolution();
        }
      });

      rowDiv.appendChild(input);
    }

    boardDiv.appendChild(rowDiv);
  }
}

function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();

  const inputs = document.querySelectorAll('.sudoku-cell');

  inputs.forEach((input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const value = puzzle[row][col];

    input.classList.remove('prefilled', 'hinted', 'incorrect', 'invalid');

    if (value !== 0) {
      input.value = value;
      input.disabled = true;
      input.classList.add('prefilled');
    } else {
      input.value = '';
      input.disabled = false;
    }
  });

  setMessage('');
}

function getBoardFromInputs() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  const inputs = document.querySelectorAll('.sudoku-cell');

  inputs.forEach((input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    board[row][col] = input.value ? Number(input.value) : 0;
  });

  return board;
}

function highlightConflicts(board) {
  const inputs = document.querySelectorAll('.sudoku-cell');

  inputs.forEach((input) => {
    if (input.disabled) {
      input.classList.remove('invalid');
      return;
    }

    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const value = input.value ? Number(input.value) : 0;

    if (value === 0) {
      input.classList.remove('invalid');
      return;
    }

    input.classList.toggle('invalid', !isMoveValid(board, row, col, value));
  });
}

async function newGame() {
  difficulty = document.getElementById('difficulty').value;
  const response = await fetch(`/new?difficulty=${encodeURIComponent(difficulty)}`);
  const data = await response.json();

  currentSolution = data.solution;
  puzzle = data.puzzle;
  gameFinished = false;
  hintsUsed = 0;
  renderPuzzle(puzzle);
  startTimer();
  setMessage(`New ${difficulty} puzzle ready.`, 'info');
}

async function checkSolution() {
  if (gameFinished) {
    return;
  }

  const board = getBoardFromInputs();
  highlightConflicts(board);

  const response = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board })
  });

  const data = await response.json();

  if (data.error) {
    setMessage(data.error, 'error');
    return;
  }

  const inputs = document.querySelectorAll('.sudoku-cell');
  const incorrectSet = new Set(data.incorrect.map(([row, col]) => `${row}-${col}`));

  inputs.forEach((input) => {
    if (input.disabled) {
      return;
    }

    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    input.classList.toggle('incorrect', incorrectSet.has(`${row}-${col}`));
  });

  if (data.solved) {
    handleSolved();
    return;
  }

  const hasLocalConflict = Array.from(inputs).some((input) => !input.disabled && input.classList.contains('invalid'));
  if (hasLocalConflict) {
    setMessage('Invalid move: conflicts with the row, column, or 3x3 box.', 'error');
    return;
  }

  setMessage(data.message || 'Some cells are still incorrect.', 'error');
}

function applyHint() {
  if (gameFinished) {
    return;
  }

  const inputs = [...document.querySelectorAll('.sudoku-cell')];
  const target = inputs.find((input) => {
    if (input.disabled && !input.classList.contains('hinted')) {
      return false;
    }

    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const userValue = input.value ? Number(input.value) : 0;
    return !input.disabled && (userValue !== currentSolution[row][col]);
  });

  if (!target) {
    setMessage('No hint available. The board is already complete or locked.', 'info');
    return;
  }

  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  target.value = currentSolution[row][col];
  target.disabled = true;
  target.classList.add('prefilled', 'hinted');
  target.classList.remove('invalid', 'incorrect');
  hintsUsed += 1;
  setMessage(`Hint used! ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} used so far.`, 'info');

  if (getBoardFromInputs().flat().every((cell) => cell !== 0)) {
    checkSolution();
  }
}

function handleSolved() {
  gameFinished = true;
  stopTimer();
  setMessage(`Congratulations! You solved it in ${formatTime(secondsElapsed)}.`, 'success');

  const name = window.prompt('Enter your name for the Top 10 list:', 'Player') || 'Player';
  saveScore(name.trim() || 'Player');
}

function init() {
  applyTheme();
  renderLeaderboard();

  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(!getThemePreference());
  });

  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('hint-cell').addEventListener('click', applyHint);

  document.getElementById('difficulty').addEventListener('change', () => {
    newGame();
  });

  newGame();
}

window.addEventListener('load', init);