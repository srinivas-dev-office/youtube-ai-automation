
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const outputDir = path.join(__dirname, "output");
const storiesFile = path.join(outputDir, "story-ideas.json");

const ffmpeg = "C:\\Users\\alath\\Downloads\\ffmpeg-9.0.2-essentials_build\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe";

if (!fs.existsSync(storiesFile)) {
  console.error("Story ideas file not found. Run story-generator.js first.");
  process.exit(1);
}

const stories = JSON.parse(fs.readFileSync(storiesFile, "utf8"));
const story = stories[0];

if (!story) {
  console.error("No stories found.");
  process.exit(1);
}

const outputFile = path.join(outputDir, "funny-football-cartoon.mp4");

console.log("Creating cartoon:", story.title);

const safeTitle = story.title.replace(/[^a-zA-Z0-9 ]/g, "");

execFileSync(ffmpeg, [
  "-f", "lavfi",
  "-i", "color=c=blue:s=1080x1920:d=10",
  "-vf",
  `drawtext=text='${safeTitle}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=500,drawtext=text='GOAL!':fontcolor=yellow:fontsize=90:x=(w-text_w)/2:y=900`,
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-y", outputFile
], { stdio: "inherit" });

console.log("Video created:", outputFile);
