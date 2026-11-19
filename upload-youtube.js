const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { credentialsPath, tokenPath, outputDir } = require("./config");

async function uploadToYouTube(videoFilePath, metadata = {}) {
  const finalVideoPath = videoFilePath || path.join(outputDir, "final-cartoon-short.mp4");

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`client_secret.json not found at ${credentialsPath}`);
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`token.json not found at ${tokenPath}. Please run: node authorize-youtube.js`);
  }
  if (!fs.existsSync(finalVideoPath)) {
    throw new Error(`Video file not found at ${finalVideoPath}`);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const config = credentials.installed || credentials.web;

  if (!config) {
    throw new Error("Invalid OAuth client configuration in client_secret.json");
  }

  const auth = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    "http://localhost:3000/oauth2callback"
  );

  const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  auth.setCredentials(tokens);

  auth.on("tokens", (newTokens) => {
    try {
      const current = fs.existsSync(tokenPath) ? JSON.parse(fs.readFileSync(tokenPath, "utf8")) : {};
      fs.writeFileSync(tokenPath, JSON.stringify({ ...current, ...newTokens }, null, 2));
      console.log("OAuth tokens automatically refreshed and saved to token.json");
    } catch (err) {
      console.warn("Could not persist refreshed tokens:", err.message);
    }
  });

  const youtube = google.youtube({ version: "v3", auth });

  let storyMeta = {};
  const storyFile = path.join(outputDir, "generated-story.json");
  if (fs.existsSync(storyFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(storyFile, "utf8"));
      if (parsed.youtube) storyMeta = parsed.youtube;
    } catch (e) {}
  }

  const title = metadata.title || storyMeta.title || "Man vs Lion in Deep Forest 🦁🥋 | Wild Battle";
  const description = metadata.description || storyMeta.description || "An epic cartoon showdown in the deep forest! 🌲🦁 #Shorts #Cartoon #Animation";
  const tags = metadata.tags || storyMeta.tags || ["cartoon", "funny", "animation", "shorts", "action"];
  const privacyStatus = metadata.privacyStatus || "public";

  console.log(`\nUploading "${title}" to YouTube (Privacy: ${privacyStatus})...`);

  let response;
  try {
    response = await youtube.videos.insert(
      {
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title,
            description,
            tags,
            categoryId: "23" // Comedy
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: fs.createReadStream(finalVideoPath)
        }
      },
      {
        onUploadProgress: (event) => {
          if (event.total) {
            const percent = Math.round((event.bytesRead / event.total) * 100);
            process.stdout.write(`\rUpload progress: ${percent}%`);
          }
        }
      }
    );
  } catch (err) {
    if (err.message?.includes("invalid_grant") || err.response?.data?.error === "invalid_grant") {
      console.error("\n❌ YouTube OAuth token has expired or was revoked by Google.");
      console.error("👉 Please re-authorize by running: npm run auth");
    }
    throw err;
  }

  console.log("\nUpload successful!");
  console.log("Video ID:", response.data.id);
  console.log(`View in YouTube Studio: https://studio.youtube.com/video/${response.data.id}/edit`);
  return response.data;
}

if (require.main === module) {
  uploadToYouTube().catch((err) => {
    console.error("\nUpload failed:", err.message);
    process.exitCode = 1;
  });
}

module.exports = { uploadToYouTube };
