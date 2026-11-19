
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ffmpeg =
  "C:\\Users\\alath\\Downloads\\ffmpeg-9.0.2-essentials_build\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe";

const outputDir = path.join(__dirname, "output");
const inputFile = path.join(outputDir, "football-cartoon-with-voice.mp4");
const outputFile = path.join(outputDir, "football-cartoon-subtitled.mp4");

if (!fs.existsSync(inputFile)) {
  console.error("Input video not found:", inputFile);
  process.exit(1);
}

const captions = [
  "HERE COMES THE BIGGEST SHOT!",
  "THE STRIKER KICKS THE BALL!",
  "WHAT A CRAZY SAVE!",
  "WHAT A HILARIOUS FINISH!"
];

const filter = [
  "drawtext=text='HERE COMES THE BIGGEST SHOT!':fontcolor=yellow:fontsize=48:borderw=3:bordercolor=black:x=(w-text_w)/2:y=1400:enable='between(t,0,2.5)'",
  "drawtext=text='THE STRIKER KICKS THE BALL!':fontcolor=yellow:fontsize=48:borderw=3:bordercolor=black:x=(w-text_w)/2:y=1400:enable='between(t,2.5,5)'",
  "drawtext=text='WHAT A CRAZY SAVE!':fontcolor=yellow:fontsize=48:borderw=3:bordercolor=black:x=(w-text_w)/2:y=1400:enable='between(t,5,7.5)'",
  "drawtext=text='WHAT A HILARIOUS FINISH!':fontcolor=yellow:fontsize=48:borderw=3:bordercolor=black:x=(w-text_w)/2:y=1400:enable='between(t,7.5,10)'"
].join(",");

console.log("Adding captions...");

execFileSync(ffmpeg, [
  "-i", inputFile,
  "-vf", filter,
  "-c:v", "libx264",
  "-c:a", "copy",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  "-y", outputFile
], { stdio: "inherit" });

console.log("Subtitled video saved to:", outputFile);
