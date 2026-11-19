const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { credentialsPath, tokenPath } = require("./config");

async function checkChannel() {
  if (!fs.existsSync(credentialsPath) || !fs.existsSync(tokenPath)) {
    console.log("Credentials or token file not found.");
    return;
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const config = credentials.installed || credentials.web;

  const auth = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    "http://localhost:3000/oauth2callback"
  );

  const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  auth.setCredentials(tokens);

  const youtube = google.youtube({ version: "v3", auth });

  try {
    const response = await youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true
    });

    const channels = response.data.items;
    if (channels && channels.length > 0) {
      const ch = channels[0];
      console.log("==========================================");
      console.log("CHANNEL FOUND:");
      console.log("Title:", ch.snippet.title);
      console.log("Custom URL:", ch.snippet.customUrl || "None");
      console.log("Channel ID:", ch.id);
      console.log("URL: https://www.youtube.com/channel/" + ch.id);
      console.log("Subscribers:", ch.statistics.subscriberCount);
      console.log("Videos:", ch.statistics.videoCount);
      console.log("==========================================");
    } else {
      console.log("No channel found for this Google account.");
    }
  } catch (err) {
    console.error("Could not fetch channel info:", err.message);
  }
}

checkChannel();
