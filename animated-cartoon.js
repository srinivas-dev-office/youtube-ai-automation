
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ffmpeg =
  "C:\\Users\\alath\\Downloads\\ffmpeg-9.0.2-essentials_build\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe";

const outputDir = path.join(__dirname, "output");
fs.mkdirSync(outputDir, { recursive: true });

const outputFile = path.join(outputDir, "animated-football-cartoon.mp4");

const filter = [
  "drawbox=x=0:y=1150:w=1080:h=770:color=green:t=fill",
  "drawbox=x=0:y=1145:w=1080:h=8:color=white:t=fill",
  "drawtext=text='THE FUNNY FOOTBALL CHALLENGE':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=250",
  "drawtext=text='GOALKEEPER, WATCH OUT!':fontcolor=yellow:fontsize=42:x=(w-text_w)/2:y=350",
  "drawtext=text='O':fontcolor=white:fontsize=100:x='100+mod(t*180,800)':y='1050-abs(sin(t*3))*250'"
].join(",");

console.log("Generating animated football cartoon...");

execFileSync(ffmpeg, [
  "-f", "lavfi",
  "-i", "color=c=blue:s=1080x1920:r=30:d=10",
  "-vf", filter,
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-y", outputFile
], { stdio: "inherit" });

console.log("Video saved to:", outputFile);
