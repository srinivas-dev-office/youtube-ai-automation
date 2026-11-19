const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { ffmpegPath, outputDir, ensureOutputDir } = require("./config");

function mergeAudioAndSubtitles(videoPath, audioPath, subtitles, duration, filename = "final-cartoon-short.mp4", options = {}) {
  ensureOutputDir();
  const outputFile = path.join(outputDir, filename);

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const showCaptions = options.showCaptions !== false && options.useCaptions !== false;
  let posY = "1420";
  if (options.position === "top") posY = "320";
  else if (options.position === "center") posY = "(h-text_h)/2";

  // Clean lines: strip emojis & unwanted characters
  const lines = (Array.isArray(subtitles) && subtitles.length > 0 ? subtitles : [
    "A MAGICAL CARTOON ADVENTURE",
    "CHECK THIS OUT",
    "AMAZING HAPPY ENDING"
  ]).map(l => l.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}]/gu, "").replace(/['":\\`]/g, "").trim().toUpperCase())
    .filter(l => l.length > 0);

  // Custom Caption & Font Styling Options
  const font = options.font || "Arial";
  const color = options.color || "yellow";
  const fontSize = options.fontSize || 54;
  const useBox = options.useBox !== false;
  const boxParam = useBox ? ":box=1:boxcolor=black@0.75:boxborderw=18" : "";
  const borderw = options.borderw || 4;

  const timePerLine = duration / Math.max(1, lines.length);
  const subtitleFilters = lines.map((safeText, idx) => {
    const start = (idx * timePerLine).toFixed(2);
    const end = Math.min(duration, (idx + 1) * timePerLine).toFixed(2);
    return `drawtext=text='${safeText}':font='${font}':fontcolor=${color}:fontsize=${fontSize}:borderw=${borderw}:bordercolor=black${boxParam}:x=(w-text_w)/2:y=${posY}:enable='between(t\\,${start}\\,${end})'`;
  }).join(",");

  const bgmPath = options.bgmPath;
  const bgmVolume = options.bgmVolume || 0.18;
  const hasBgm = bgmPath && fs.existsSync(bgmPath);

  const ffmpegArgs = [
    "-i", videoPath,
    "-i", audioPath
  ];

  if (hasBgm) {
    console.log(`🎵 Mixing background music: ${path.basename(bgmPath)} (Volume: ${Math.round(bgmVolume * 100)}%)`);
    // Loop background music if shorter than video
    ffmpegArgs.push("-stream_loop", "-1", "-i", bgmPath);
  }

  // Video filter for subtitles (only if captions are turned ON)
  if (showCaptions && subtitleFilters.length > 0) {
    ffmpegArgs.push("-vf", subtitleFilters);
  }

  if (hasBgm) {
    // Mix voiceover (100%) and BGM (ducked at 18%), keeping video length
    ffmpegArgs.push(
      "-filter_complex",
      `[1:a]apad[padded_voice];[padded_voice]volume=1.0[voice];[2:a]volume=${bgmVolume}[bgm];[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
      "-map", "0:v:0",
      "-map", "[aout]"
    );
  } else {
    ffmpegArgs.push(
      "-filter_complex",
      `[1:a]apad[aout]`,
      "-map", "0:v:0",
      "-map", "[aout]"
    );
  }

  ffmpegArgs.push(
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-t", `${duration}`,
    "-movflags", "+faststart",
    "-y", outputFile
  );

  console.log(`Merging video, audio (font: ${font}, color: ${color}) in 1 pass...`);

  try {
    execFileSync(ffmpegPath, ffmpegArgs, { stdio: "inherit" });
    console.log("Final subtitled video created:", outputFile);
    return outputFile;
  } catch (error) {
    console.error("FFmpeg merging failed:", error.message);
    throw error;
  }
}

module.exports = { mergeAudioAndSubtitles };
