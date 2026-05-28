/**
 * tuner.js — Core pitch detection and UI logic for Dutar Tuner
 *
 * Author:  Tumaris Paris (https://github.com/Tumaris-Paris)
 * License: MIT
 *
 * How it works:
 *   1. The browser's Web Audio API captures microphone input.
 *   2. Raw PCM samples are passed to the autocorrelation algorithm,
 *      which finds the fundamental frequency (pitch) of the signal.
 *   3. The detected frequency is compared to the target note of the
 *      selected string, expressed in cents (100ths of a semitone).
 *   4. The UI (needle, badge, readout) updates on every animation frame.
 *
 * Pitch detection:
 *   Uses the autocorrelation method — a standard approach for monophonic
 *   pitch detection. Suitable for instrument tuners. Accuracy is ±1–2 cents
 *   on a quiet input, which is well within the 5-cent "in tune" threshold.
 *
 * Dependencies: none (vanilla JS, Web Audio API).
 */

'use strict';

/* ── Tuning presets ───────────────────────────────────────────────────── */

/**
 * Each preset defines the two strings of a Dutar.
 * freq values are in Hz, corresponding to standard equal-temperament.
 *
 * | Preset | String 1 | String 2 | Common usage                  |
 * |--------|----------|----------|---------------------------------|
 * | GD     | G2  98.0 | D3 146.8 | Standard tuning                 |
 * | AD     | A2 110.0 | D3 146.8 | Atush tuning                    |
 * | custom | user-set | user-set | Method + pitch offset           |
 */
const TUNINGS = {
  GD:     [{ note: 'G', freq:  98.00 }, { note: 'D', freq: 146.83 }],
  AD:     [{ note: 'A', freq: 110.00 }, { note: 'D', freq: 146.83 }],
  custom: [{ note: 'G', freq:  98.00 }, { note: 'D', freq: 146.83 }],
};

/** Chromatic note names (equal temperament). */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/* ── State ────────────────────────────────────────────────────────────── */
let currentTuning   = 'GD';
let selectedString  = 0;
let listening       = false;
let audioCtx        = null;
let analyser        = null;
let micStream       = null;
let animFrame       = null;
let refOscillator   = null;
let refGain         = null;
let refAudioCtx     = null;

/* ── Tuning selection ─────────────────────────────────────────────────── */

/**
 * Switch to a named tuning preset and refresh the UI.
 * @param {string} tuning - Key from TUNINGS ('GD', 'AD', 'custom').
 */
function setTuning(tuning) {
  if (tuning === 'custom') { openCustom(); return; }
  currentTuning = tuning;
  document.querySelectorAll('.tuning-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tuning === tuning);
  });
  updateStringTabs();
  resetMeter();
}

/**
 * Select which string (0 = string 1, 1 = string 2) the tuner targets.
 * @param {number} idx - 0 or 1.
 */
function selectString(idx) {
  selectedString = idx;
  const tab1 = document.getElementById('tab1');
  const tab2 = document.getElementById('tab2');
  tab1.classList.toggle('active', idx === 0);
  tab2.classList.toggle('active', idx === 1);
  tab1.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
  tab2.setAttribute('aria-pressed', idx === 1 ? 'true' : 'false');
  resetMeter();
}

/** Re-render string tab note names from current tuning. */
function updateStringTabs() {
  const strings = TUNINGS[currentTuning];
  document.getElementById('s1note').textContent = strings[0].note;
  document.getElementById('s2note').textContent = strings[1].note;
}

/** Update the reference tone button label. */
function updateRefBtn() {
  const s = TUNINGS[currentTuning][selectedString];
  document.getElementById('refBtnLabel').textContent =
    `Play ${s.note} (${s.freq.toFixed(1)} Hz)`;
}

/* ── Custom tuning modal ──────────────────────────────────────────────── */

/** Show the custom tuning input modal. */
// Natural notes in order and their semitones from C
const NATURAL_NOTES    = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_SEMITONES   = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

// Base thick string for each method: Standard = G2, Atush = A2
const CUSTOM_BASE = {
  fifth:  { note: 'G', octave: 2 },
  fourth: { note: 'A', octave: 2 },
};

// Interval semitones above thick string
const INTERVAL_SEMITONES = { fifth: 7, fourth: 5 };

function noteOctaveToMidi(note, octave) {
  return (octave + 1) * 12 + NOTE_SEMITONES[note];
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function naturalNoteAtOffset(baseNote, baseOctave, offset) {
  let idx = NATURAL_NOTES.indexOf(baseNote) + offset;
  let oct = baseOctave;
  while (idx < 0)  { idx += 7; oct--; }
  while (idx >= 7) { idx -= 7; oct++; }
  return { note: NATURAL_NOTES[idx], octave: oct };
}

function getCustomStrings(method, offset) {
  const base      = CUSTOM_BASE[method];
  const thick     = naturalNoteAtOffset(base.note, base.octave, offset);
  const thickMidi = noteOctaveToMidi(thick.note, thick.octave);
  const thinMidi  = thickMidi + INTERVAL_SEMITONES[method];
  // Get thin note name from MIDI
  const thinSemitone = thinMidi % 12;
  const allNotes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const thinNote = allNotes[thinSemitone];
  return {
    thick: { note: thick.note, freq: midiToFreq(thickMidi) },
    thin:  { note: thinNote,   freq: midiToFreq(thinMidi)  },
  };
}

function updateCustomPreview() {
  const activeOffset = document.querySelector('.offset-btn.active');
  const activeMethod = document.querySelector('.method-btn.active');
  if (!activeOffset || !activeMethod) return;
  const strings = getCustomStrings(activeMethod.dataset.method, parseInt(activeOffset.dataset.offset));
  document.getElementById('previewS1').textContent = strings.thick.note;
  document.getElementById('previewS2').textContent = strings.thin.note;
}

function selectMethod(btn) {
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateCustomPreview();
}

function selectOffset(btn) {
  document.querySelectorAll('.offset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateCustomPreview();
}

function openCustom() {
  updateCustomPreview();
  document.getElementById('customModal').removeAttribute('hidden');
}

/** Hide the custom tuning input modal without applying changes. */
function closeCustom() {
  document.getElementById('customModal').setAttribute('hidden', '');
}

function applyCustom() {
  const activeOffset = document.querySelector('.offset-btn.active');
  const activeMethod = document.querySelector('.method-btn.active');
  const strings = getCustomStrings(activeMethod.dataset.method, parseInt(activeOffset.dataset.offset));

  TUNINGS.custom[0] = strings.thick;
  TUNINGS.custom[1] = strings.thin;

  currentTuning = 'custom';
  document.querySelectorAll('.tuning-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tuning === 'custom');
  });

  updateStringTabs();
  resetMeter();
  closeCustom();
}

/**
 * Return the nearest chromatic note name for a given frequency.
 * @param {number} freq - Frequency in Hz.
 * @returns {string} Note name, e.g. 'D' or 'F#'.
 */
function freqToClosestNoteName(freq) {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

/* ── Microphone & audio pipeline ──────────────────────────────────────── */

/** Toggle listening on/off. */
async function toggleListening() {
  if (listening) {
    stopListening();
  } else {
    await startListening();
  }
}

/**
 * Request mic access, build the Web Audio graph, and start the
 * detection loop. Shows an alert if the user denies mic permission.
 */
async function startListening() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096; // larger = better low-frequency resolution
    source.connect(analyser);

    listening = true;
    const btn = document.getElementById('startBtn');
    btn.classList.add('listening');
    document.getElementById('startBtnLabel').textContent = 'Stop · توختىتىش';

    detectLoop();
  } catch (err) {
    console.error('Mic error:', err);
    alert(
      'Microphone access was denied or is unavailable.\n' +
      'Please allow microphone access in your browser settings and try again.'
    );
  }
}

/** Stop listening, release mic track, and reset the UI. */
function stopListening() {
  listening = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (audioCtx)  audioCtx.close();
  audioCtx = null;
  analyser = null;
  micStream = null;

  const btn = document.getElementById('startBtn');
  btn.classList.remove('listening');
  document.getElementById('startBtnLabel').textContent =
    'Start Tuning · تەڭشەشنى باشلاش';

  resetMeter();
}

/* ── Detection loop ───────────────────────────────────────────────────── */

/**
 * Called on every animation frame while listening.
 * Grabs time-domain samples, runs pitch detection, and updates the UI.
 */
function detectLoop() {
  if (!listening) return;

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);

  const freq = autoCorrelate(buffer, audioCtx.sampleRate);

  if (freq > 50 && freq < 2000) {
    updateDisplay(freq);
  }

  animFrame = requestAnimationFrame(detectLoop);
}

/* ── Pitch detection: autocorrelation ────────────────────────────────── */

/**
 * Detect the fundamental frequency of a PCM buffer using autocorrelation.
 *
 * Steps:
 *   1. Check RMS energy — skip silent frames.
 *   2. Trim leading/trailing low-amplitude samples (helps with reverb tails).
 *   3. Compute the autocorrelation function (ACF) for the trimmed buffer.
 *   4. Find the lag T0 with maximum ACF (skipping the trivial zero-lag peak).
 *   5. Refine T0 with parabolic interpolation for sub-sample accuracy.
 *   6. Return sampleRate / T0 as the fundamental frequency.
 *
 * @param {Float32Array} buffer     - PCM time-domain samples.
 * @param {number}       sampleRate - Audio context sample rate (e.g. 44100).
 * @returns {number} Detected frequency in Hz, or -1 if signal is too quiet.
 */
function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;

  // 1. RMS energy gate — silence check
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  // 2. Trim silence from edges
  let r1 = 0;
  let r2 = size - 1;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) >= 0.2) { r1 = i; break; }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) >= 0.2) { r2 = size - i; break; }
  }
  const trimmed = buffer.slice(r1, r2);
  const tLen = trimmed.length;

  // 3. Compute autocorrelation function
  const acf = new Float32Array(tLen);
  for (let lag = 0; lag < tLen; lag++) {
    for (let j = 0; j < tLen - lag; j++) {
      acf[lag] += trimmed[j] * trimmed[j + lag];
    }
  }

  // 4. Skip the initial decay, then find the maximum peak
  let d = 0;
  while (d < tLen - 1 && acf[d] > acf[d + 1]) d++;

  let maxVal = -Infinity;
  let maxPos = d;
  for (let i = d; i < tLen; i++) {
    if (acf[i] > maxVal) { maxVal = acf[i]; maxPos = i; }
  }

  // 5. Parabolic interpolation for sub-sample accuracy
  let T0 = maxPos;
  if (T0 > 0 && T0 < tLen - 1) {
    const x1 = acf[T0 - 1];
    const x2 = acf[T0];
    const x3 = acf[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) T0 = T0 - b / (2 * a);
  }

  return sampleRate / T0;
}

/* ── Display update ───────────────────────────────────────────────────── */

/**
 * Given a detected frequency, compare it to the target note and
 * update all UI elements: note display, frequency label, cents readout,
 * needle rotation, and status badge.
 *
 * @param {number} freq - Detected frequency in Hz.
 */
function updateDisplay(freq) {
  const target     = TUNINGS[currentTuning][selectedString];
  const detectedMidi = 12 * Math.log2(freq / 440) + 69;
  const targetMidi   = 12 * Math.log2(target.freq / 440) + 69;
  const cents        = (detectedMidi - targetMidi) * 100; // positive = sharp

  // Nearest chromatic note name
  const nearestNote = NOTE_NAMES[((Math.round(detectedMidi) % 12) + 12) % 12];

  document.getElementById('detectedNote').textContent = nearestNote;
  document.getElementById('freqLabel').textContent = '';

  const centsEl = document.getElementById('centsLabel');
  const badge   = document.getElementById('statusBadge');

  if (Math.abs(cents) <= 5) {
    // In tune
    centsEl.textContent = '✓ In tune · تەڭشەلدى';
    centsEl.className   = 'cents-readout intune';
    badge.textContent   = '✓ In tune · تەڭشەلدى';
    badge.className     = 'status-badge intune';
  } else if (cents < 0) {
    // Flat — tune up
    const c = Math.round(Math.abs(cents));
    centsEl.textContent = `-${c}`;
    centsEl.className   = 'cents-readout flat';
    badge.textContent   = '▲ Tune up · ئۆرلىتىڭ';
    badge.className     = 'status-badge flat';
  } else {
    // Sharp — tune down
    const c = Math.round(cents);
    centsEl.textContent = `+${c}`;
    centsEl.className   = 'cents-readout sharp';
    badge.textContent   = '▼ Tune down · چۈشۈرۈڭ';
    badge.className     = 'status-badge sharp';
  }

  rotateNeedle(cents);
}

/**
 * Rotate the SVG tuning needle.
 * 0 cents → vertical (12 o'clock). ±50 cents → ±80° from vertical.
 * @param {number} cents - Offset in cents from target (negative = flat).
 */
function rotateNeedle(cents) {
  const clamped = Math.max(-50, Math.min(50, cents));
  const angle   = (clamped / 50) * 80; // map ±50¢ to ±80°
  document.getElementById('needle').setAttribute(
    'transform', `rotate(${angle}, 160, 115)`
  );
}

/** Reset the meter to its idle state. */
function resetMeter() {
  document.getElementById('detectedNote').textContent = '–';
  document.getElementById('freqLabel').textContent    = 'Play a string to begin · تارىنى چېلىڭ';
  document.getElementById('centsLabel').textContent   = '';
  document.getElementById('centsLabel').className     = 'cents-readout';
  document.getElementById('statusBadge').textContent  = 'Waiting · كۈتۈۋاتىدۇ';
  document.getElementById('statusBadge').className    = 'status-badge waiting';
  rotateNeedle(0);
}

/* ── Reference tone ───────────────────────────────────────────────────── */

/**
 * Play a 3-second sine/triangle tone at the target string's frequency.
 * Fades out smoothly using an exponential ramp.
 * Stops any previously playing reference tone first.
 */
function playRef() {
  // Stop any existing ref tone
  if (refOscillator) {
    try { refOscillator.stop(); } catch (_) {}
    refOscillator = null;
  }
  if (refAudioCtx) {
    try { refAudioCtx.close(); } catch (_) {}
  }

  const targetFreq = TUNINGS[currentTuning][selectedString].freq;
  refAudioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const now = refAudioCtx.currentTime;
  const duration = 3;

  // Dynamics compressor — maximizes perceived loudness
  const compressor = refAudioCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value      = 10;
  compressor.ratio.value     = 12;
  compressor.attack.value    = 0.003;
  compressor.release.value   = 0.25;
  compressor.connect(refAudioCtx.destination);

  // Harmonics: [multiplier, gain] — boosted for audibility on phone speakers
  const harmonics = [
    [1,   1.0],
    [2,   0.7],
    [3,   0.4],
    [4,   0.25],
    [5,   0.15],
  ];

  // Master gain with pluck envelope
  const masterGain = refAudioCtx.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.linearRampToValueAtTime(1.5, now + 0.005);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  masterGain.connect(compressor);

  harmonics.forEach(([mult, vol]) => {
    const osc  = refAudioCtx.createOscillator();
    const gain = refAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = targetFreq * mult;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  });

  refOscillator = { stop: () => { try { refAudioCtx.close(); } catch(_){} } };
  refAudioCtx.resume();
}

/* ── Init ─────────────────────────────────────────────────────────────── */

/** Run once on page load to populate the UI with default values. */
function init() {
  updateStringTabs();
}

init();
