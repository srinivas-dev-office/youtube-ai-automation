const fs = require("fs");
const path = require("path");

/**
 * Phonetic Viseme Categories for Telugu & Multilingual Animation
 * 0 = Mouth Closed (Silence, P, B, M)
 * 1 = Mouth Half Open (Consonants T, D, S, N, L, R)
 * 2 = Mouth Round (Vowels U, OO, O)
 * 3 = Mouth Wide / Open (Vowels A, AA, E, EE, AI)
 */
const TELUGU_VISEME_MAP = {
  // Telugu Vowels
  "అ": 3, "ఆ": 3, "ఇ": 3, "ఈ": 3,
  "ఉ": 2, "ఊ": 2, "ఋ": 1, "ౠ": 1,
  "ఎ": 3, "ఏ": 3, "ఐ": 3, "ఒ": 2, "ఓ": 2, "ఔ": 2,
  "అం": 0, "అః": 3,

  // Telugu Matras (Vowel signs)
  "ా": 3, "ి": 3, "ీ": 3, "ు": 2, "ూ": 2, "ృ": 1,
  "ె": 3, "ే": 3, "ై": 3, "ొ": 2, "ో": 2, "ౌ": 2,
  "ం": 0, "ః": 3, "్": 0, // Virama / Halant

  // Telugu Consonants
  "క": 1, "ఖ": 1, "గ": 1, "ఘ": 1, "ఙ": 1,
  "చ": 1, "ఛ": 1, "జ": 1, "ఝ": 1, "ఞ": 1,
  "ట": 1, "ఠ": 1, "డ": 1, "ఢ": 1, "ణ": 1,
  "త": 1, "థ": 1, "ద": 1, "ధ": 1, "న": 1,
  "ప": 0, "ఫ": 0, "బ": 0, "భ": 0, "మ": 0, // Bilabials = Mouth Closed
  "య": 1, "ర": 1, "ల": 1, "వ": 0, "శ": 1, "ష": 1, "స": 1, "హ": 1, "ళ": 1, "క్ష": 1, "ఱ": 1
};

/**
 * Parses PCM audio samples from an uncompressed 16-bit PCM WAV file
 */
function readWavPcm16(wavPath) {
  if (!fs.existsSync(wavPath)) {
    throw new Error(`WAV file not found: ${wavPath}`);
  }

  const buffer = fs.readFileSync(wavPath);
  if (buffer.length < 44) {
    throw new Error("WAV file header too short");
  }

  // Verify RIFF header
  const riff = buffer.toString("utf8", 0, 4);
  const wave = buffer.toString("utf8", 8, 12);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("Invalid WAV file format");
  }

  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);

  // Locate data chunk
  let offset = 36;
  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString("utf8", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      const dataStart = offset + 8;
      const dataEnd = Math.min(buffer.length, dataStart + chunkSize);
      const samplesCount = Math.floor((dataEnd - dataStart) / (bitsPerSample / 8) / numChannels);
      return {
        sampleRate,
        numChannels,
        bitsPerSample,
        dataBuffer: buffer.subarray(dataStart, dataEnd),
        samplesCount,
        duration: samplesCount / sampleRate
      };
    }
    offset += 8 + chunkSize;
  }

  // Fallback if data chunk not explicitly tagged
  return {
    sampleRate: 44100,
    numChannels: 1,
    bitsPerSample: 16,
    dataBuffer: buffer.subarray(44),
    samplesCount: (buffer.length - 44) / 2,
    duration: (buffer.length - 44) / 2 / 44100
  };
}

/**
 * Extracts RMS Audio Amplitude Envelope across 50ms time windows
 */
function extractAudioEnvelope(wavPath, windowMs = 50) {
  try {
    const wav = readWavPcm16(wavPath);
    const samplesPerWindow = Math.floor((wav.sampleRate * windowMs) / 1000);
    const bytesPerSample = wav.bitsPerSample / 8;
    const stride = bytesPerSample * wav.numChannels;
    const totalFrames = Math.floor(wav.samplesCount / samplesPerWindow);

    const envelope = [];
    let peakRms = 0.001;

    for (let f = 0; f < totalFrames; f++) {
      let sumSquares = 0;
      let count = 0;
      const startSample = f * samplesPerWindow;

      for (let s = 0; s < samplesPerWindow; s++) {
        const byteOffset = (startSample + s) * stride;
        if (byteOffset + 1 < wav.dataBuffer.length) {
          const sampleVal = wav.dataBuffer.readInt16LE(byteOffset) / 32768.0;
          sumSquares += sampleVal * sampleVal;
          count++;
        }
      }

      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      if (rms > peakRms) peakRms = rms;
      envelope.push({
        timeMs: f * windowMs,
        rms
      });
    }

    // Normalize envelope [0.0 - 1.0]
    return envelope.map(frame => ({
      timeMs: frame.timeMs,
      amplitude: Math.min(1.0, frame.rms / peakRms)
    }));
  } catch (err) {
    console.warn(`[LipSyncService] Audio envelope fallback: ${err.message}`);
    return [];
  }
}

/**
 * Generates Viseme Cue Points synchronized with audio envelope and Telugu phonetics
 */
function generateLipSyncVisemes(text, wavPath, fps = 30) {
  const envelope = extractAudioEnvelope(wavPath, Math.round(1000 / fps));
  const characters = Array.from(text || "");
  const cues = [];

  // Speech presence threshold
  const SPEECH_THRESHOLD = 0.12;

  let textIdx = 0;
  for (let i = 0; i < envelope.length; i++) {
    const frame = envelope[i];
    const timeSeconds = frame.timeMs / 1000.0;

    let viseme = 0; // Mouth Closed default

    if (frame.amplitude > SPEECH_THRESHOLD) {
      // Find phonetic character hint
      let charViseme = 2; // Default open
      if (textIdx < characters.length) {
        const char = characters[textIdx];
        if (TELUGU_VISEME_MAP[char] !== undefined) {
          charViseme = TELUGU_VISEME_MAP[char];
        }
        textIdx = (textIdx + 1) % characters.length;
      }

      // Combine acoustic energy with phonetic profile
      if (frame.amplitude > 0.65) {
        viseme = 3; // Mouth Wide Open (Loud vowel / shout)
      } else if (frame.amplitude > 0.35) {
        viseme = charViseme > 0 ? charViseme : 1; // Articulated consonant/vowel
      } else {
        viseme = 1; // Mouth Half Open
      }
    } else {
      viseme = 0; // Natural pause / mouth closed
    }

    cues.push({
      timeMs: frame.timeMs,
      timeSeconds: parseFloat(timeSeconds.toFixed(3)),
      viseme,
      visemeName: getVisemeName(viseme),
      amplitude: parseFloat(frame.amplitude.toFixed(3))
    });
  }

  return {
    totalDuration: envelope.length > 0 ? envelope[envelope.length - 1].timeMs / 1000.0 : 0,
    fps,
    cuesCount: cues.length,
    cues
  };
}

function getVisemeName(id) {
  switch (id) {
    case 0: return "mouth_closed";
    case 1: return "mouth_half";
    case 2: return "mouth_round";
    case 3: return "mouth_wide";
    default: return "mouth_closed";
  }
}

/**
 * Temporal Alignment: Adjusts scene visual duration so speech is never cut off
 */
function alignNarrationDuration(audioDuration, visualDuration, minPadding = 0.4) {
  const safeAudio = Math.max(1.0, parseFloat(audioDuration) || 0);
  const safeVisual = Math.max(1.0, parseFloat(visualDuration) || 0);

  // If visual duration is shorter than speech + padding, stretch visual duration
  if (safeVisual < safeAudio + minPadding) {
    const aligned = Math.round((safeAudio + minPadding) * 10) / 10;
    console.log(`[LipSyncService] Auto-aligning scene duration: ${safeVisual}s -> ${aligned}s to fit speech.`);
    return aligned;
  }
  return safeVisual;
}

module.exports = {
  generateLipSyncVisemes,
  extractAudioEnvelope,
  alignNarrationDuration,
  TELUGU_VISEME_MAP
};
