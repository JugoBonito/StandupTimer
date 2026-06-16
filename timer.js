/**
 * timer.js – Endless Loop Standup Timer
 *
 * Phase cycle (repeating):
 *   0 – Sitting  : 40 minutes
 *   1 – Standing : 15 minutes
 *   2 – Moving   :  5 minutes
 */

'use strict';

// ─── Phase definitions ─────────────────────────────────────────────────────

const PHASES = [
  {
    key:      'sit',
    label:    'Sitting',
    subtext:  'Time to sit and focus',
    icon:     '🪑',
    minutes:  40,
    accent:   '#4f8ef7',
  },
  {
    key:      'stand',
    label:    'Standing',
    subtext:  'Stand up and stretch',
    icon:     '🧍',
    minutes:  15,
    accent:   '#34d399',
  },
  {
    key:      'move',
    label:    'Moving',
    subtext:  'Move around and energize!',
    icon:     '🚶',
    minutes:  5,
    accent:   '#f97316',
  },
];

const MOVE_EXERCISES_STANDING = [
  'March in place',
  'Heel raises',
  'Shoulder rolls',
  'Standing side bends',
  'Arm circles',
  'Calf stretch at desk',
  'Standing torso twists',
  'Step touch side to side',
];

const MOVE_EXERCISE_GIFS = {
  'March in place': 'assets/exercises/march-in-place.gif',
  'Heel raises': 'assets/exercises/heel-raises.gif',
  'Shoulder rolls': 'assets/exercises/shoulder-rolls.gif',
  'Standing side bends': 'assets/exercises/standing-side-bends.gif',
  'Arm circles': 'assets/exercises/arm-circles.gif',
  'Calf stretch at desk': 'assets/exercises/calf-stretch-at-desk.gif',
  'Standing torso twists': 'assets/exercises/standing-torso-twists.gif',
  'Step touch side to side': 'assets/exercises/step-touch-side-to-side.gif',
};

// ─── State ─────────────────────────────────────────────────────────────────

let phaseIndex   = -1;
let secondsLeft  = 0;
let totalSeconds = 0;
let currentMoveExercise = null;
let running      = false;
let intervalId   = null;
let warningPlayedForPhase = false;

let skipOffsetSeconds = 0;
let lastRealDateString = new Date().toDateString();

const TICK_INTERVAL_MS = 1000;

// ─── Constants ─────────────────────────────────────────────────────────────

const BREAK_SIT_START_M = 11 * 60 + 20;
const BREAK_END_M = 12 * 60 + 30;
const MINUTES_PER_DAY = 24 * 60;
const SECONDS_PER_DAY = 24 * 3600;

// ─── DOM refs ──────────────────────────────────────────────────────────────

const phaseCard     = document.getElementById('phaseCard');
const phaseIcon     = document.getElementById('phaseIcon');
const phaseLabel    = document.getElementById('phaseLabel');
const timerDisplay  = document.getElementById('timerDisplay');
const phaseSubtext  = document.getElementById('phaseSubtext');
const exerciseGifWrap = document.getElementById('exerciseGifWrap');
const exerciseGif   = document.getElementById('exerciseGif');
const progressBar   = document.getElementById('progressBar');
const startStopBtn  = document.getElementById('startStopBtn');
const resetBtn      = document.getElementById('resetBtn');
const skipBtn       = document.getElementById('skipBtn');
const muteCheckbox  = document.getElementById('muteCheckbox');

const stepEls = [
  document.getElementById('step0'),
  document.getElementById('step1'),
  document.getElementById('step2'),
];

// ─── Audio helpers ─────────────────────────────────────────────────────────

/** Lazily-created shared AudioContext (reused across all beep calls). */
let _audioCtx = null;

function getAudioContext() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      return null;
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

/**
 * Generate a short beep using the Web Audio API.
 * @param {number} frequency - Hz
 * @param {number} duration  - seconds
 * @param {string} type      - OscillatorNode type
 */
function beep(frequency = 440, duration = 0.2, type = 'sine') {
  if (muteCheckbox.checked) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type            = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (_) {
    // Audio not available – silently ignore
  }
}

/** Three ascending tones to signal a new phase. */
function playPhaseChime() {
  if (muteCheckbox.checked) return;
  beep(523, 0.18, 'triangle');
  setTimeout(() => beep(659, 0.18, 'triangle'), 200);
  setTimeout(() => beep(784, 0.30, 'triangle'), 400);
}

/** Two short warning beeps when 30 s remain. */
function playWarningBeep() {
  beep(880, 0.12, 'square');
  setTimeout(() => beep(880, 0.12, 'square'), 220);
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getRandomMoveExercise() {
  const randomIndex = Math.floor(Math.random() * MOVE_EXERCISES_STANDING.length);
  return MOVE_EXERCISES_STANDING[randomIndex];
}

function updateExerciseGif(phaseKey) {
  const isMovePhase = phaseKey === 'move' && currentMoveExercise;
  if (!isMovePhase) {
    exerciseGifWrap.classList.add('hidden');
    exerciseGif.src = '';
    exerciseGif.alt = '';
    return;
  }

  const gifSrc = MOVE_EXERCISE_GIFS[currentMoveExercise];
  if (!gifSrc) {
    exerciseGifWrap.classList.add('hidden');
    exerciseGif.src = '';
    exerciseGif.alt = '';
    return;
  }

  exerciseGif.src = gifSrc;
  exerciseGif.alt = `${currentMoveExercise} demonstration`;
  exerciseGifWrap.classList.remove('hidden');
}

function applyPhaseUI(phase, animate = false) {
  // Card class
  phaseCard.className = `phase-card ${phase.key}`;
  if (animate) {
    phaseCard.classList.add('pulsing');
    setTimeout(() => phaseCard.classList.remove('pulsing'), 700);
  }

  phaseIcon.textContent    = phase.icon;
  phaseLabel.textContent   = phase.label;
  phaseSubtext.textContent = phase.key === 'move'
    ? `${phase.subtext} Try: ${currentMoveExercise}`
    : phase.subtext;
  updateExerciseGif(phase.key);

  // Progress bar colour
  progressBar.style.background = phase.accent;

  // Start button colour
  startStopBtn.style.background = phase.accent;

  // Step indicators
  stepEls.forEach((el, i) => {
    el.classList.toggle('active', i === phaseIndex);
  });

  // Page title
  document.title = `${phase.label} – Standup Timer`;
}

function updateDisplay() {
  timerDisplay.textContent = formatTime(secondsLeft);

  const pct = (secondsLeft / totalSeconds) * 100;
  progressBar.style.width = `${pct}%`;

  // Warning flash in last 30 s
  const isWarning = secondsLeft <= 30 && secondsLeft > 0;
  phaseCard.classList.toggle('warning', isWarning);
}

// ─── Time calculation ──────────────────────────────────────────────────────

function getPhaseForTime(date) {
  if (date.toDateString() !== lastRealDateString) {
    skipOffsetSeconds = 0;
    lastRealDateString = date.toDateString();
  }

  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const realSeconds = h * 3600 + m * 60 + s;
  
  const virtualSeconds = ((realSeconds + skipOffsetSeconds) % SECONDS_PER_DAY + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  
  const vt_m = Math.floor(virtualSeconds / 60);
  
  if (vt_m >= BREAK_SIT_START_M && vt_m < BREAK_END_M) {
    // 11:20 to 12:30 is SIT
    return {
      index: 0,
      totalSeconds: (BREAK_END_M - BREAK_SIT_START_M) * 60,
      secondsLeft: BREAK_END_M * 60 - virtualSeconds
    };
  }
  
  let cycleStartOffsetM = 0;
  if (vt_m >= BREAK_END_M) {
    cycleStartOffsetM = 30;
  }
  
  let shiftedM = vt_m - cycleStartOffsetM;
  let cycleHourM = Math.floor(shiftedM / 60) * 60 + cycleStartOffsetM;
  let mInCycle = vt_m - cycleHourM;
  
  if (mInCycle < 15) {
    return {
      index: 1, // Stand
      totalSeconds: 15 * 60,
      secondsLeft: (cycleHourM + 15) * 60 - virtualSeconds
    };
  } else if (mInCycle < 20) {
    return {
      index: 2, // Move
      totalSeconds: 5 * 60,
      secondsLeft: (cycleHourM + 20) * 60 - virtualSeconds
    };
  } else {
    // Sit
    let endM = cycleHourM + 60;
    if (endM > MINUTES_PER_DAY) {
      endM = MINUTES_PER_DAY;
    }
    
    return {
      index: 0,
      totalSeconds: (endM - (cycleHourM + 20)) * 60,
      secondsLeft: endM * 60 - virtualSeconds
    };
  }
}

// ─── Phase transitions ─────────────────────────────────────────────────────

function shouldPlayWarning(animate) {
  return secondsLeft <= 30 && secondsLeft > 0 && !warningPlayedForPhase && running && animate;
}

function checkAndLoadPhase(animate = false) {
  const now = new Date();
  const phaseInfo = getPhaseForTime(now);
  
  totalSeconds = phaseInfo.totalSeconds;
  secondsLeft = phaseInfo.secondsLeft;

  if (phaseInfo.index !== phaseIndex) {
    phaseIndex = phaseInfo.index;
    warningPlayedForPhase = false;
    const phase = PHASES[phaseIndex];
    if (phase.key === 'move') {
      currentMoveExercise = getRandomMoveExercise();
    } else {
      currentMoveExercise = null;
    }
    
    applyPhaseUI(phase, animate);
    
    // Play sound if running
    if (running && animate) {
      playPhaseChime();
    }
  } else if (shouldPlayWarning(animate)) {
    playWarningBeep();
    warningPlayedForPhase = true;
  }

  updateDisplay();
}

// ─── Tick ──────────────────────────────────────────────────────────────────

function tick() {
  if (running) {
    checkAndLoadPhase(true);
  }
}

// ─── Controls ──────────────────────────────────────────────────────────────

function startTimer() {
  if (running) return;
  
  // Browsers require interaction to play audio. 
  // We can init audio context here.
  getAudioContext();
  
  running = true;
  checkAndLoadPhase(false);
  intervalId = setInterval(tick, TICK_INTERVAL_MS);
  startStopBtn.textContent = '⏸ Pause Tracking';
  startStopBtn.setAttribute('aria-label', 'Pause tracking');
}

function pauseTimer() {
  if (!running) return;
  clearInterval(intervalId);
  intervalId = null;
  running    = false;
  startStopBtn.textContent = '▶ Start Tracking';
  startStopBtn.setAttribute('aria-label', 'Start tracking');
}

// ─── Event listeners ───────────────────────────────────────────────────────

startStopBtn.addEventListener('click', () => {
  if (running) pauseTimer();
  else         startTimer();
});

resetBtn.addEventListener('click', () => {
  skipOffsetSeconds = 0;
  checkAndLoadPhase(true);
});

skipBtn.addEventListener('click', () => {
  const now = new Date();
  const phaseInfo = getPhaseForTime(now);
  skipOffsetSeconds += phaseInfo.secondsLeft;
  checkAndLoadPhase(true);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && running) {
    checkAndLoadPhase(false);
  }
});

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    if (running) pauseTimer();
    else         startTimer();
  }
  if (e.code === 'KeyR' && e.target === document.body) {
    resetBtn.click();
  }
  if (e.code === 'KeyS' && e.target === document.body) {
    skipBtn.click();
  }
});

// ─── Init ──────────────────────────────────────────────────────────────────

checkAndLoadPhase(false);
