const fs = require("fs");
const path = require("path");
const { outputDir, ensureOutputDir, tokenPath } = require("./config");
const { generateStoryWithGemini } = require("./gemini-service");
const { generateVoice } = require("./voice-service");
const { generateCartoonVideo } = require("./video-generator");
const { mergeAudioAndSubtitles } = require("./subtitles-merger");
const { uploadToYouTube } = require("./upload-youtube");

async function runPipeline() {
  const args = process.argv.slice(2);
  const shouldUpload = args.includes("--upload");
  const filteredArgs = args.filter((arg) => !arg.startsWith("--"));
  const userIdea = filteredArgs.join(" ").trim() || "The Pizza-Stealing Cat";

  console.log("=================================================");
  console.log("       🎬 YOUTUBE CARTOON AGENT PIPELINE         ");
  console.log("=================================================");
  console.log(`💡 Idea Prompt: "${userIdea}"\n`);

  ensureOutputDir();

  // 1. Generate Story & Metadata with Gemini AI
  console.log("-------------------------------------------------");
  console.log("Step 1: Generating Story & Visual Concept (Gemini AI)...");
  console.log("-------------------------------------------------");
  
  let story;
  try {
    story = await generateStoryWithGemini(userIdea);
  } catch (err) {
    console.error("\n❌ Story generation failed:", err.message);
    if (!process.env.GEMINI_API_KEY) {
      console.log("\n👉 How to fix:");
      console.log("1. Get a free API key at https://aistudio.google.com/");
      console.log("2. Open or create .env in this folder and add:");
      console.log("   GEMINI_API_KEY=your_actual_key_here\n");
    }
    process.exit(1);
  }

  const storyFile = path.join(outputDir, "generated-story.json");
  fs.writeFileSync(storyFile, JSON.stringify(story, null, 2), "utf8");
  console.log(`✅ Story Title: ${story.title}`);
  console.log(`🎭 Narration: "${story.narration}"`);
  console.log(`🎨 Theme Emojis: ${story.theme.primaryEmoji} & ${story.theme.secondaryEmoji}`);
  console.log(`📝 Subtitle Lines: ${story.subtitles.length}`);

  // 2. Generate Voice Narration
  console.log("\n-------------------------------------------------");
  console.log("Step 2: Generating Voiceover Narration...");
  console.log("-------------------------------------------------");
  const { audioPath, duration } = generateVoice(story.narration, "cartoon-narration.wav");

  // 3. Render Dynamic Cartoon Visuals
  console.log("\n-------------------------------------------------");
  console.log("Step 3: Rendering Animated Cartoon Visuals...");
  console.log("-------------------------------------------------");
  // Add a slight 0.5s padding so audio is never abruptly cut off
  const renderDuration = Math.ceil(duration + 0.5);
  const rawVideoPath = generateCartoonVideo(story.theme, renderDuration, "raw-cartoon-visuals.mp4");

  // 4. Merge Audio & Add Synchronized Subtitles (1-pass)
  console.log("\n-------------------------------------------------");
  console.log("Step 4: Synchronizing Subtitles & Final Merge...");
  console.log("-------------------------------------------------");
  const finalVideoPath = mergeAudioAndSubtitles(
    rawVideoPath,
    audioPath,
    story.subtitles,
    duration,
    "final-cartoon-short.mp4"
  );

  console.log("\n🎉 Video generation completed successfully!");
  console.log(`📁 Final Output: ${finalVideoPath}`);

  // 5. YouTube Upload
  console.log("\n-------------------------------------------------");
  console.log("Step 5: YouTube Upload Check...");
  console.log("-------------------------------------------------");

  if (shouldUpload) {
    if (!fs.existsSync(tokenPath)) {
      console.log("⚠️  Cannot upload yet: token.json not found.");
      console.log("👉 First run: node authorize-youtube.js to sign in to YouTube.");
    } else {
      console.log("🚀 Uploading final video to YouTube...");
      await uploadToYouTube(finalVideoPath, story.youtube);
    }
  } else {
    console.log("ℹ️  Upload skipped (run with --upload flag to upload automatically).");
    console.log(`   Command: node pipeline.js "${userIdea}" --upload`);
  }

  console.log("\n=================================================");
  console.log("               ✨ ALL TASKS COMPLETED            ");
  console.log("=================================================");
}

if (require.main === module) {
  runPipeline().catch((err) => {
    console.error("\n❌ Pipeline failed:", err);
    process.exit(1);
  });
}

module.exports = { runPipeline };
