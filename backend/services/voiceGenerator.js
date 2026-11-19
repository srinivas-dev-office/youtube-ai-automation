const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { audioDir, outputDir, rootDir, ffmpegPath } = require("../config");

function getWavDuration(wavPath) {
  try {
    const buffer = fs.readFileSync(wavPath);
    if (buffer.length > 44) {
      const byteRate = buffer.readUInt32LE(28);
      if (byteRate > 0) {
        const dataLength = buffer.length - 44;
        return Math.max(2, Math.round((dataLength / byteRate) * 10) / 10);
      }
    }
  } catch (_) { }
  return 10.0;
}

const VOICE_CATALOG = {
  telugu: [
    { id: "te-IN-MohanNeural", name: "Mohan (మోహన్)", gender: "Male", category: "Storytelling", tone: "Deep & Narrative", description: "Authentic, deep male voice ideal for epic storytelling and mythological tales." },
    { id: "te-IN-ShrutiNeural", name: "Shruti (శృతి)", gender: "Female", category: "Emotional", tone: "Warm & Expressive", description: "Rich, emotive female voice that conveys deep emotions and dramatic moments." },
    { id: "te-IN-AnandNeural", name: "Anand (ఆనంద్)", gender: "Male", category: "Young", tone: "Energetic & Crisp", description: "Youthful, spirited male voice for adventure, modern dialogue, and fun stories." },
    { id: "te-IN-KavyaNeural", name: "Kavya (కావ్య)", gender: "Female", category: "Young", tone: "Cheerful & Melodic", description: "Bright, engaging female voice perfect for children stories and friendly animation." },
    { id: "te-IN-RamaiahNeural", name: "Ramaiah (రామయ్య)", gender: "Male", category: "Mature", tone: "Wise & Traditional", description: "Venerable, grandfatherly tone with dignified traditional Telugu cadence." },
    { id: "te-IN-SunithaNeural", name: "Sunitha (సునీత)", gender: "Female", category: "Mature", tone: "Gentle & Motherly", description: "Calm, reassuring mature female voice ideal for moral fables and bedtime tales." },
    { id: "te-Google-Standard", name: "Telugu Cloud Voice", gender: "Neutral", category: "Storytelling", tone: "Clear & Natural", description: "High-clarity neural Telugu voice with standard modern pronunciation." }
  ],
  english: [
    { id: "en-US-David", name: "David", gender: "Male", category: "Mature", tone: "Deep & Authoritative", description: "Classic American narrator voice with clean resonance and cinematic clarity." },
    { id: "en-US-Zira", name: "Zira", gender: "Female", category: "Emotional", tone: "Expressive & Friendly", description: "Warm, articulate female voice with clear enunciation for storytelling." },
    { id: "en-US-GuyNeural", name: "Guy", gender: "Male", category: "Young", tone: "Modern & Dynamic", description: "Vibrant conversational male voice ideal for fast-paced shorts and cartoons." },
    { id: "en-US-JennyNeural", name: "Jenny", gender: "Female", category: "Storytelling", tone: "Warm & Melodic", description: "Engaging narrative voice with natural pauses and emotional expression." }
  ],
  hindi: [
    { id: "hi-IN-MadhurNeural", name: "Madhur (मधुर)", gender: "Male", category: "Storytelling", tone: "Resonant & Dramatic", description: "Classic Hindi storyteller voice with rich inflection for dramatic storytelling." },
    { id: "hi-IN-SwaraNeural", name: "Swara (स्वरा)", gender: "Female", category: "Emotional", tone: "Melodic & Expressive", description: "Warm, heartfelt female Hindi voice with delicate emotional nuances." },
    { id: "hi-Google-Standard", name: "Hindi Cloud Voice", gender: "Neutral", category: "Storytelling", tone: "Clear & Crisp", description: "Clean neural Hindi narration voice for general cartoon commentary." }
  ],
  tamil: [
    { id: "ta-IN-ValluvarNeural", name: "Valluvar (வள்ளுவர்)", gender: "Male", category: "Storytelling", tone: "Traditional & Dignified", description: "Authentic Tamil male narrative voice with classical clarity." },
    { id: "ta-IN-PallaviNeural", name: "Pallavi (பல்லவி)", gender: "Female", category: "Emotional", tone: "Expressive & Melodic", description: "Warm Tamil female voice with clear diction for cartoons and folklore." }
  ],
  kannada: [
    { id: "kn-IN-GaganNeural", name: "Gagan (ಗಗನ್)", gender: "Male", category: "Storytelling", tone: "Rich & Narrative", description: "Expressive Kannada male storyteller voice for dramatic folklore." },
    { id: "kn-IN-SapnaNeural", name: "Sapna (ಸಪ್ನಾ)", gender: "Female", category: "Emotional", tone: "Warm & Clear", description: "Gentle Kannada female voice with emotional depth and clarity." }
  ],
  malayalam: [
    { id: "ml-IN-MidhunNeural", name: "Midhun (മിഥുൻ)", gender: "Male", category: "Storytelling", tone: "Classic & Resonant", description: "Resonant Malayalam male voice for engaging story narration." },
    { id: "ml-IN-SobhanaNeural", name: "Sobhana (ശോഭന)", gender: "Female", category: "Emotional", tone: "Melodic & Articulate", description: "Expressive Malayalam female voice for folk tales and moral stories." }
  ]
};

function getCatalogForLanguage(lang = "telugu") {
  const key = (lang || "telugu").toLowerCase().trim();
  if (VOICE_CATALOG[key]) return VOICE_CATALOG[key];
  if (key.startsWith("te")) return VOICE_CATALOG.telugu;
  if (key.startsWith("hi")) return VOICE_CATALOG.hindi;
  if (key.startsWith("ta")) return VOICE_CATALOG.tamil;
  if (key.startsWith("kn")) return VOICE_CATALOG.kannada;
  if (key.startsWith("ml")) return VOICE_CATALOG.malayalam;
  return VOICE_CATALOG.english;
}

const LANG_CODE_MAP = {
  telugu: "te",
  te: "te",
  english: "en",
  en: "en",
  hindi: "hi",
  hi: "hi",
  tamil: "ta",
  ta: "ta",
  kannada: "kn",
  kn: "kn",
  malayalam: "ml",
  ml: "ml"
};

function fetchCloudAudioChunk(text, langCode) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(langCode)}&client=tw-ob&q=${encodeURIComponent(text)}`;
    const req = https.get(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, timeout: 12000 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`TTS service returned HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TTS request timed out"));
    });
  });
}

async function synthesizeMultiLangAudio(text, langCode, wavOutputFile) {
  // Split text into chunks < 150 chars along punctuation boundaries
  const sentences = text.match(/[^.!?\n\r]+[.!?\n\r]*/g) || [text];
  const textChunks = [];
  let current = "";

  for (const s of sentences) {
    if ((current + " " + s).trim().length > 140) {
      if (current.trim()) textChunks.push(current.trim());
      current = s;
    } else {
      current = (current + " " + s).trim();
    }
  }
  if (current.trim()) textChunks.push(current.trim());

  const audioBuffers = [];
  for (const chunk of textChunks) {
    if (!chunk.trim()) continue;
    try {
      const buf = await fetchCloudAudioChunk(chunk, langCode);
      audioBuffers.push(buf);
    } catch (e) {
      console.warn(`[VoiceGenerator] Cloud chunk synthesis warning:`, e.message);
    }
  }

  if (audioBuffers.length === 0) {
    throw new Error("No audio generated from cloud TTS");
  }

  const combinedMp3 = Buffer.concat(audioBuffers);
  const tempMp3 = wavOutputFile.replace(/\.wav$/i, ".mp3");
  fs.writeFileSync(tempMp3, combinedMp3);

  // Convert MP3 to 44100Hz 16-bit WAV with FFmpeg safely without shell interpolation
  try {
    const bin = (ffmpegPath && fs.existsSync(ffmpegPath)) ? ffmpegPath : "ffmpeg";
    execFileSync(bin, ["-y", "-i", tempMp3, "-ar", "44100", "-ac", "2", wavOutputFile], { stdio: "ignore" });
  } catch (convErr) {
    // If FFmpeg fails, copy tempMp3 as fallback or preserve
    console.warn("[VoiceGenerator] FFmpeg conversion notice:", convErr.message);
  }

  return wavOutputFile;
}

function synthesizeWithSapi(text, wavOutputFile) {
  const psScript = path.join(rootDir, "create-voice.ps1");
  const psCommand = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", psScript,
    "-Text", text,
    "-OutputFile", wavOutputFile
  ];
  const stdout = execFileSync("powershell.exe", psCommand, { encoding: "utf8" });
  const match = stdout.match(/DURATION_SECONDS:([\d.]+)/);
  let duration = match ? parseFloat(match[1]) : getWavDuration(wavOutputFile);
  return { audioPath: wavOutputFile, duration: duration > 0 ? duration : 10.0 };
}

async function generateVoice(text, filename = "cartoon-narration.wav", options = {}) {
  const storageAudioFile = path.join(audioDir, filename);
  const outputAudioFile = path.join(outputDir, filename);
  const language = (options.language || "telugu").toLowerCase();
  const langCode = LANG_CODE_MAP[language] || "te";

  console.log(`[VoiceGenerator] Generating narration (${language.toUpperCase()} / ${langCode}): "${text.slice(0, 40)}..."`);

  let duration = 8.0;

  // If language is English and SAPI script is available, can use SAPI or cloud
  if (language === "english" && options.useSapi) {
    const sapiRes = synthesizeWithSapi(text, storageAudioFile);
    duration = sapiRes.duration;
  } else {
    // Multi-lingual Cloud synthesis (Telugu, Hindi, Tamil, Kannada, Malayalam, English)
    try {
      await synthesizeMultiLangAudio(text, langCode, storageAudioFile);
      duration = getWavDuration(storageAudioFile);
      if (isNaN(duration) || duration <= 0) {
        // Estimate ~3.2 words per second for spoken Indian languages
        const wordCount = text.trim().split(/\s+/).length;
        duration = Math.max(3.0, Math.round((wordCount / 2.8) * 10) / 10);
      }
    } catch (cloudErr) {
      console.warn(`[VoiceGenerator] Cloud TTS failed (${cloudErr.message}), falling back to Windows SAPI...`);
      const sapiRes = synthesizeWithSapi(text, storageAudioFile);
      duration = sapiRes.duration;
    }
  }

  // Sync to output directory
  try {
    fs.copyFileSync(storageAudioFile, outputAudioFile);
    const mp3Src = storageAudioFile.replace(/\.wav$/i, ".mp3");
    const mp3Dst = outputAudioFile.replace(/\.wav$/i, ".mp3");
    if (fs.existsSync(mp3Src)) fs.copyFileSync(mp3Src, mp3Dst);
  } catch (_) { }

  console.log(`[VoiceGenerator] Narration successfully generated (${duration}s): ${storageAudioFile}`);
  return { audioPath: storageAudioFile, duration, language, langCode };
}

module.exports = {
  generateVoice,
  getWavDuration,
  getCatalogForLanguage,
  VOICE_CATALOG
};
