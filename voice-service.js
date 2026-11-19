const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { outputDir, ensureOutputDir } = require("./config");

function getWavDuration(wavPath) {
  try {
    const buffer = fs.readFileSync(wavPath);
    if (buffer.length > 44) {
      const byteRate = buffer.readUInt32LE(28);
      if (byteRate > 0) {
        const dataLength = buffer.length - 44;
        return Math.max(3, Math.round((dataLength / byteRate) * 10) / 10);
      }
    }
  } catch (e) {
    // fallback
  }
  return 10.0;
}

function generateVoice(text, filename = "narration.wav") {
  ensureOutputDir();
  const psScript = path.join(__dirname, "create-voice.ps1");
  const outputFile = path.join(outputDir, filename);

  console.log("Generating narration audio...");

  const psCommand = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", psScript,
    "-Text", text,
    "-OutputFile", outputFile
  ];

  try {
    const stdout = execFileSync("powershell.exe", psCommand, { encoding: "utf8" });
    const match = stdout.match(/DURATION_SECONDS:([\d.]+)/);
    let duration = match ? parseFloat(match[1]) : getWavDuration(outputFile);

    if (isNaN(duration) || duration <= 0) {
      duration = getWavDuration(outputFile);
    }

    console.log(`Voice generated (${duration}s): ${outputFile}`);
    return { audioPath: outputFile, duration };
  } catch (error) {
    console.error("Failed to generate voice with PowerShell:", error.message);
    throw error;
  }
}

module.exports = { generateVoice, getWavDuration };
