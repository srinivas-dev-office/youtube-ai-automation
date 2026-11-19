
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ffmpeg =
  "C:\\Users\\alath\\Downloads\\ffmpeg-9.0.2-essentials_build\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe";

const outputDir = path.join(__dirname, "output");
const videoFile = path.join(outputDir, "animated-football-cartoon.mp4");
const audioFile = path.join(outputDir, "football-narration.wav");
const finalFile = path.join(outputDir, "football-cartoon-with-voice.mp4");

if (!fs.existsSync(videoFile)) {
  console.error("Video file not found:", videoFile);
  process.exit(1);
}

if (!fs.existsSync(audioFile)) {
  console.error("Narration file not found:", audioFile);
  process.exit(1);
}

console.log("Combining cartoon video and narration...");

execFileSync(ffmpeg, [
  "-i", videoFile,
  "-i", audioFile,
  "-map", "0:v:0",
  "-map", "1:a:0",
  "-c:v", "copy",
  "-c:a", "aac",
  "-b:a", "128k",
  "-shortest",
  "-movflags", "+faststart",
  "-y", finalFile
], { stdio: "inherit" });

console.log("Final video saved to:", finalFile);
