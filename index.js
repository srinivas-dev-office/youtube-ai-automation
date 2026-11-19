
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ffmpeg = String.raw`C:\Users\alath\Downloads\ffmpeg-9.0.2-essentials_build\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe`;

const outputDir = path.join(__dirname, "output");
const outputFile = path.join(outputDir, "cartoon-football.mp4");

if (!fs.existsSync(ffmpeg)) {
  console.error("FFmpeg was not found. Check its path.");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const videoFilter = [
  "drawbox=x=0:y=1400:w=1080:h=520:color=green:t=fill",
  "drawbox=x=0:y=1390:w=1080:h=10:color=white:t=fill",
  "drawtext=text='CARTOON FOOTBALL':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=220",
  "drawtext=text='GOAL!':fontcolor=yellow:fontsize=90:x=(w-text_w)/2:y=420",
  "drawtext=text='O':fontcolor=white:fontsize=100:x=100+mod(t*180\\,800):y=1050"
].join(",");

console.log("Creating football animation...");

try {
  execFileSync(ffmpeg, [
    "-f", "lavfi",
    "-i", "color=c=deepskyblue:s=1080x1920:r=30:d=5",
    "-vf", videoFilter,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-y", outputFile
  ], { stdio: "inherit" });

  console.log("Football animation created successfully!");
  console.log("Saved to:", outputFile);
} catch (error) {
  console.error("Video creation failed.");
  process.exit(1);
}
