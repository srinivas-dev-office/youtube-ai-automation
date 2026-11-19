const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ffmpegPath, outputDir, ensureOutputDir } = require("./config");

function findAsset(possibleNames) {
  const assetsDir = path.join(__dirname, "assets");
  if (!fs.existsSync(assetsDir)) return null;
  for (const name of possibleNames) {
    const fullPath = path.join(assetsDir, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function generateCartoonVideo(theme, duration = 10, filename = "animated-cartoon.mp4") {
  ensureOutputDir();
  const outputFile = path.join(outputDir, filename);

  const safeHeadline = (theme.headline || "CARTOON SHORT").replace(/['":\\`]/g, "").slice(0, 32).toUpperCase();
  const safePunchline = (theme.punchline || "CHECK THIS OUT!").replace(/['":\\`]/g, "").slice(0, 32).toUpperCase();
  const bgColor = theme.backgroundColor || "forestgreen";
  const groundColor = theme.groundColor || "darkgreen";
  const primaryEmoji = theme.primaryEmoji || "🥋";
  const secondaryEmoji = theme.secondaryEmoji || "🦁";

  // Check for custom user-uploaded images in assets/
  const bgImage = findAsset([
    "forest.png", "forest.jpg", "forest.jpeg",
    "background.png", "background.jpg", "background.jpeg", "bg.png", "bg.jpg"
  ]);
  const manImage = findAsset(["man.png", "man.jpg", "warrior.png", "character.png", "fighter.png"]);
  const lionImage = findAsset(["lion.png", "lion.jpg", "beast.png", "enemy.png"]);

  const ffmpegArgs = [];
  let filterComplex = [];
  let inputCount = 0;

  // ==========================================
  // 1. BACKGROUND & ENVIRONMENT LAYER
  // ==========================================
  if (bgImage) {
    console.log(`🌲 Using custom background image: ${path.basename(bgImage)}`);
    ffmpegArgs.push("-loop", "1", "-t", `${duration}`, "-i", bgImage);
    filterComplex.push(`[${inputCount}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`);
    inputCount++;
  } else {
    ffmpegArgs.push("-f", "lavfi", "-i", `color=c=${bgColor}:s=1080x1920:r=30:d=${duration}`);
    inputCount++;
    
    const envLayers = [
      // Jungle ground with dark rich grass
      `drawbox=x=0:y=1200:w=1080:h=720:color=${groundColor}:t=fill`,
      `drawbox=x=0:y=1190:w=1080:h=10:color=gold:t=fill`, // golden edge
      
      // Pulsing Glowing Sun
      "drawtext=text='☀️':font='Segoe UI Emoji':fontsize=170:x=840:y=70",
      
      // Drifting clouds across the sky
      "drawtext=text='☁️':font='Segoe UI Emoji':fontsize=150:x='mod(t*65,1350)-250':y=130",
      "drawtext=text='☁️':font='Segoe UI Emoji':fontsize=180:x='mod(t*40+450,1400)-250':y=70",
      
      // Dynamic Swaying Forest Trees (Trigonometric Wind Simulation)
      "drawtext=text='🌲':font='Segoe UI Emoji':fontsize=230:x='40+sin(t*2.2)*20':y=960",
      "drawtext=text='🌳':font='Segoe UI Emoji':fontsize=250:x='240-sin(t*2.0)*25':y=930",
      "drawtext=text='🌴':font='Segoe UI Emoji':fontsize=240:x='540+sin(t*1.8)*22':y=940",
      "drawtext=text='🌲':font='Segoe UI Emoji':fontsize=230:x='830-sin(t*2.5)*20':y=960",
      
      // Floating wind-blown leaves
      "drawtext=text='🍃':font='Segoe UI Emoji':fontsize=65:x='1100-mod(t*180,1300)':y='380+sin(t*3)*80'",
      "drawtext=text='🍂':font='Segoe UI Emoji':fontsize=60:x='1100-mod(t*230+400,1350)':y='650+cos(t*2.5)*70'",
      "drawtext=text='🍃':font='Segoe UI Emoji':fontsize=70:x='1100-mod(t*150+800,1300)':y='880+sin(t*3.5)*90'"
    ].join(",");
    
    filterComplex.push(`[0:v]${envLayers}[bg]`);
  }

  let lastStream = "[bg]";

  // ==========================================
  // 2. CHARACTER 1 (WARRIOR / MAN)
  // ==========================================
  if (manImage) {
    console.log(`🥋 Using custom man image: ${path.basename(manImage)}`);
    const manIdx = inputCount++;
    ffmpegArgs.push("-loop", "1", "-t", `${duration}`, "-i", manImage);
    filterComplex.push(`[${manIdx}:v]scale=290:290[man]`);
    filterComplex.push(`${lastStream}[man]overlay=x='130+abs(sin(t*2.5))*80':y='1060-abs(sin(t*3))*120'[v1]`);
    lastStream = "[v1]";
  } else {
    // High-action martial arts warrior dodging & counter-striking
    filterComplex.push(
      `${lastStream}drawtext=text='${primaryEmoji}':font='Segoe UI Emoji':fontsize=140:x='130+abs(sin(t*2.8))*120':y='1060-abs(sin(t*3.2))*180'[v1]`
    );
    lastStream = "[v1]";
  }

  // ==========================================
  // 3. CHARACTER 2 (LION)
  // ==========================================
  if (lionImage) {
    console.log(`🦁 Using custom lion image: ${path.basename(lionImage)}`);
    const lionIdx = inputCount++;
    ffmpegArgs.push("-loop", "1", "-t", `${duration}`, "-i", lionImage);
    filterComplex.push(`[${lionIdx}:v]scale=340:340[lion]`);
    filterComplex.push(`${lastStream}[lion]overlay=x='720-abs(sin(t*3.2))*220':y='1040-abs(sin(t*3.5))*140'[v2]`);
    lastStream = "[v2]";
  } else {
    // Ferocious lunging lion with pouncing arc
    filterComplex.push(
      `${lastStream}drawtext=text='${secondaryEmoji}':font='Segoe UI Emoji':fontsize=145:x='720-abs(sin(t*3.2))*240':y='1050-abs(sin(t*3.5))*190'[v2]`
    );
    lastStream = "[v2]";
  }

  // ==========================================
  // 4. COMBAT FX (IMPACT SPARKS, DUST & EMOTES)
  // ==========================================
  const combatFx = [
    // Clash impact explosion (💥) when characters collide in the center
    "drawtext=text='💥':font='Segoe UI Emoji':fontsize=160:x=450:y=1000:enable='lt(mod(t\\,2.2)\\,0.45)'",
    
    // Martial arts strike effects
    "drawtext=text='⚡':font='Segoe UI Emoji':fontsize=100:x=400:y=920:enable='between(mod(t\\,2.2)\\,0.2\\,0.6)'",
    
    // Motion dust trail behind the pouncing lion
    "drawtext=text='💨':font='Segoe UI Emoji':fontsize=95:x='780-abs(sin(t*3.2))*200':y=1170",
    
    // Anger emote pulsing over the lion
    "drawtext=text='💢':font='Segoe UI Emoji':fontsize=90:x='720-abs(sin(t*3.2))*240':y='940-sin(t*4)*20'",
    
    // Foreground grass blades for 3D depth
    "drawtext=text='🌿🌿🌿🌿🌿🌿🌿🌿':font='Segoe UI Emoji':fontsize=85:x='-30+sin(t*2)*15':y=1760"
  ].join(",");

  filterComplex.push(`${lastStream}${combatFx}[vfx]`);
  lastStream = "[vfx]";

  // ==========================================
  // 5. CINEMATIC VIBRANT BANNER & TITLES
  // ==========================================
  const textBanner = [
    // Glossy translucent dark banner
    "drawbox=x=40:y=200:w=1000:h=200:color=black@0.65:t=fill",
    "drawbox=x=35:y=195:w=1010:h=210:color=gold@0.85:t=5", // Shiny gold frame
    
    // Headline
    `drawtext=text='${safeHeadline}':fontcolor=white:fontsize=48:font='Arial':borderw=4:bordercolor=black:x=(w-text_w)/2:y=235`,
    
    // Glowing Punchline
    `drawtext=text='${safePunchline}':fontcolor=yellow:fontsize=44:font='Arial':borderw=4:bordercolor=black:x=(w-text_w)/2:y=325`
  ].join(",");

  filterComplex.push(`${lastStream}${textBanner}[vfinal]`);

  ffmpegArgs.push(
    "-filter_complex", filterComplex.join(";"),
    "-map", "[vfinal]",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-y", outputFile
  );

  console.log(`Rendering vibrant animated video (${duration}s) with combat FX...`);

  try {
    execFileSync(ffmpegPath, ffmpegArgs, { stdio: "inherit" });
    console.log("Video rendering complete:", outputFile);
    return outputFile;
  } catch (error) {
    console.error("FFmpeg video rendering failed:", error.message);
    throw error;
  }
}

module.exports = { generateCartoonVideo };
