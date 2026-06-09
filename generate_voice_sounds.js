const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'public', 'assets', 'sounds');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

function writeWav(filePath, samples, sampleRate = 44100) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function envelope(t, points) {
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    if (t >= t0 && t <= t1) {
      const p = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * p;
    }
  }
  return points[points.length - 1][1];
}

function mix(...signals) {
  return (t) => signals.reduce((sum, fn) => sum + fn(t), 0) / signals.length;
}

function tone(freq, wave = 'sine', detune = 0) {
  return (t) => {
    const f = freq + detune;
    if (wave === 'triangle') {
      return 2 * Math.abs(2 * ((t * f) % 1) - 1) - 1;
    }
    if (wave === 'square') {
      return Math.sign(Math.sin(2 * Math.PI * f * t));
    }
    return Math.sin(2 * Math.PI * f * t);
  };
}

function noise(level) {
  return () => (Math.random() * 2 - 1) * level;
}

function phrase(notes, duration, sampleRate, speechParams) {
  const samples = new Float32Array(Math.floor(duration * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    let value = 0;
    for (const { start, end, freq, wave, vol, pitchBend } of notes) {
      if (t >= start && t < end) {
        const p = (t - start) / (end - start);
        const freqNow = freq + (pitchBend ? pitchBend * p : 0);
        let sample;
        if (wave === 'triangle') {
          sample = 2 * Math.abs(2 * ((t * freqNow) % 1) - 1) - 1;
        } else {
          sample = Math.sin(2 * Math.PI * freqNow * t);
        }
        value += sample * vol * envelope(p, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
      }
    }
    const shout = Math.sin(2 * Math.PI * 200 * t) * 0.1;
    const noiseComp = (Math.random() * 2 - 1) * 0.05;
    samples[i] = Math.max(-1, Math.min(1, value + shout + noiseComp));
  }
  return samples;
}

function makeCelebration(duration, sampleRate, base, top) {
  const samples = new Float32Array(Math.floor(duration * sampleRate));
  const background = tone(220, 'triangle');
  const sparkle = tone(880, 'sine');
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const pulse = Math.sin(2 * Math.PI * 2 * t) * 0.2;
    const layer = background(t) * 0.2 * envelope(t / duration, [[0, 0], [0.2, 1], [0.9, 0.6], [1, 0]])
      + sparkle(t) * 0.08 * Math.sin(2 * Math.PI * 5 * t)
      + (Math.random() * 2 - 1) * 0.02;
    samples[i] = Math.max(-1, Math.min(1, layer));
  }
  return samples;
}

function blend(a, b, alpha) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - alpha) + b[i] * alpha;
  return out;
}

function generateVoiceSound(fileName, text) {
  const sampleRate = 44100;
  const duration = 4;
  const totalSamples = Math.floor(duration * sampleRate);
  const center = (t, freq, wave = 'sine') => tone(freq, wave)(t);

  const wordMap = {
    big: [
      { start: 0.4, end: 0.85, freq: 220, wave: 'triangle', vol: 0.8, pitchBend: 60 },
      { start: 0.85, end: 1.15, freq: 175, wave: 'sine', vol: 0.85 },
    ],
    win: [
      { start: 1.25, end: 1.6, freq: 330, wave: 'sine', vol: 0.9, pitchBend: 80 },
      { start: 1.6, end: 1.9, freq: 440, wave: 'sine', vol: 0.85 },
      { start: 1.9, end: 2.15, freq: 660, wave: 'sine', vol: 0.55 },
    ],
    mega: [
      { start: 0.35, end: 0.75, freq: 200, wave: 'triangle', vol: 0.8, pitchBend: 80 },
      { start: 0.75, end: 1.15, freq: 260, wave: 'sine', vol: 0.85 },
      { start: 1.15, end: 1.4, freq: 210, wave: 'sine', vol: 0.7 },
    ],
    bonus: [
      { start: 0.4, end: 0.8, freq: 240, wave: 'triangle', vol: 0.8, pitchBend: 90 },
      { start: 0.8, end: 1.1, freq: 300, wave: 'sine', vol: 0.85 },
      { start: 1.2, end: 1.5, freq: 360, wave: 'sine', vol: 0.85 },
    ],
  };

  let phraseNotes = [];
  if (text === 'big win') phraseNotes = [...wordMap.big, ...wordMap.win];
  else if (text === 'mega win') phraseNotes = [...wordMap.mega, ...wordMap.win];
  else if (text === 'bonus') phraseNotes = wordMap.bonus;

  const voiceSamples = phraseNotes.reduce((acc, note) => {
    const noteSamples = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      if (t >= note.start && t < note.end) {
        const p = (t - note.start) / (note.end - note.start);
        const freqNow = note.freq + (note.pitchBend ? note.pitchBend * p : 0);
        const waveFn = tone(freqNow, note.wave || 'sine');
        noteSamples[i] = waveFn(t) * note.vol * envelope(p, [[0, 0], [0.1, 1], [0.9, 1], [1, 0]]);
      }
    }
    for (let i = 0; i < totalSamples; i++) acc[i] += noteSamples[i];
    return acc;
  }, new Float32Array(totalSamples));

  const celebration = makeCelebration(duration, sampleRate);
  const mixed = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const env = envelope(i / totalSamples, [[0, 0], [0.08, 1], [0.92, 1], [1, 0]]);
    mixed[i] = Math.max(-1, Math.min(1, voiceSamples[i] * 0.75 + celebration[i] * 0.8 * env));
  }

  writeWav(path.join(outputDir, fileName), mixed, sampleRate);
  console.log('created', fileName);
}

generateVoiceSound('bigwin-voice.wav', 'big win');
generateVoiceSound('megawin-voice.wav', 'mega win');
generateVoiceSound('bonus-voice.wav', 'bonus');
