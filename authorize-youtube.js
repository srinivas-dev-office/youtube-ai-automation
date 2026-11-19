
const fs = require("fs");
const path = require("path");
const http = require("http");
const { exec } = require("child_process");
const { google } = require("googleapis");

const credentialsPath = path.join(__dirname, "client_secret.json");
const tokenPath = path.join(__dirname, "token.json");

if (!fs.existsSync(credentialsPath)) {
  console.error("client_secret.json was not found in the project folder.");
  process.exit(1);
}

const credentials = JSON.parse(
  fs.readFileSync(credentialsPath, "utf8")
);

const config = credentials.installed || credentials.web;

if (!config) {
  console.error("Invalid OAuth credentials JSON.");
  process.exit(1);
}

const port = 3000;
const redirectUri = `http://localhost:${port}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(
  config.client_id,
  config.client_secret,
  redirectUri
);

const scopes = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly"
];

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${port}`);

  if (requestUrl.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const error = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Authorization was not completed. You can close this tab.");
    console.error("Authorization failed:", error || "No code returned");
    server.close();
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    fs.writeFileSync(
      tokenPath,
      JSON.stringify(tokens, null, 2),
      { mode: 0o600 }
    );

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>YouTube authorization successful!</h2><p>You can close this browser tab and return to PowerShell.</p>");

    console.log("Authorization successful!");
    console.log("Token saved locally to token.json.");
  } catch (err) {
    console.error("Could not exchange authorization code:", err.message);
    res.writeHead(500);
    res.end("Authorization failed. Check the PowerShell window.");
  } finally {
    server.close();
  }
});

server.listen(port, "localhost", () => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes
  });

  console.log("==================================================");
  console.log("       YOUTUBE CHANNEL ONE-TIME LOGIN             ");
  console.log("==================================================");
  console.log("Opening your browser automatically...");
  console.log("If your browser did not open, click this link manually:");
  console.log(authUrl);
  console.log("\nWaiting for Google's authorization callback...");

  try {
    exec(`powershell -NoProfile -Command "Start-Process '${authUrl}'"`);
  } catch (e) {
    // Fallback if auto-open fails
  }
});
