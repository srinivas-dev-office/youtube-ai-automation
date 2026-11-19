const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ffmpegPath, outputDir, ensureOutputDir } = require("./config");

const assetsDir = path.join(__dirname, "assets");

function findSceneMedia(sceneNum) {
  if (!fs.existsSync(assetsDir)) return null;
  const files = fs.readdirSync(assetsDir);

  // Prefer video clips first (.mp4, .webm, .mov)
  const videoExts = [".mp4", ".webm", ".mov", ".mkv"];
  for (const f of files) {
    const l = f.toLowerCase();
    const ext = path.extname(l);
    if (l.startsWith(`scene${sceneNum}.`) && videoExts.includes(ext)) {
      return { path: path.join(assetsDir, f), type: "video" };
    }
  }

  // Next check image files (.png, .jpg, .jpeg, .webp)
  const imageExts = [".png", ".jpg", ".jpeg", ".webp"];
  for (const f of files) {
    const l = f.toLowerCase();
    const ext = path.extname(l);
    if (l.startsWith(`scene${sceneNum}.`) && imageExts.includes(ext)) {
      return { path: path.join(assetsDir, f), type: "image" };
    }
  }

  return null;
}

function findCharacterAssets() {
  const chars = {};
  if (!fs.existsSync(assetsDir)) return chars;
  const files = fs.readdirSync(assetsDir);
  for (const f of files) {
    const l = f.toLowerCase();
    if (l.startsWith("rabbit") || l.startsWith("bunny") || l.startsWith("hero") || l.startsWith("man") || l.startsWith("apple")) {
      chars.char1 = path.join(assetsDir, f);
    } else if (l.startsWith("star") || l.startsWith("villain") || l.startsWith("lion") || l.startsWith("carrot")) {
      chars.char2 = path.join(assetsDir, f);
    } else if (l.startsWith("forest") || l.startsWith("night") || l.startsWith("sky") || l.startsWith("bg") || l.startsWith("background")) {
      chars.background = path.join(assetsDir, f);
    }
  }
  return chars;
}

function renderSceneClip(mediaInfo, sceneNum, duration, effect, outputClipPath) {
  // ========================================================
  // CASE 1: REAL 3D VIDEO CLIP (.mp4, .webm, .mov)
  // ========================================================
  if (mediaInfo && mediaInfo.type === "video") {
    console.log(`🎥 [Scene ${sceneNum}] Using real 3D video clip: ${path.basename(mediaInfo.path)} (${duration}s)...`);

    const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS,fps=30`;
    const args = [
      "-stream_loop", "-1",
      "-i", mediaInfo.path,
      "-t", `${duration}`,
      "-vf", filter,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", outputClipPath
    ];
    execFileSync(ffmpegPath, args, { stdio: "inherit" });
    return;
  }

  // ========================================================
  // CASE 2: MULTI-ELEMENT CUTOUT ANIMATION (If layers exist)
  // ========================================================
  const chars = findCharacterAssets();
  const hasCharLayers = chars.char1 && chars.char2 && chars.background;

  if (hasCharLayers && !mediaInfo) {
    console.log(`🎬 [Scene ${sceneNum}] Rendering multi-element character action animation...`);

    let filterComplex = "";
    if (effect === "star_fall" || sceneNum === 1) {
      filterComplex = [
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`,
        `[2:v]scale=280:280[star]`,
        `[bg][star]overlay=x='900-(t/${duration})*650':y='-100+(t/${duration})*1350'[v1]`,
        `[v1]eq=contrast=1.12:brightness=0.02:saturation=1.35[vfinal]`
      ].join(";");
    } else if (effect === "rabbit_discover" || sceneNum === 2) {
      filterComplex = [
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`,
        `[1:v]scale=320:320[rabbit]`,
        `[2:v]scale=260:260[star]`,
        `[bg][star]overlay=x='620':y='1220+sin(t*3)*15'[v1]`,
        `[v1][rabbit]overlay=x='100+(t/${duration})*350':y='1140-abs(sin(t*9))*130'[v2]`,
        `[v2]eq=contrast=1.12:brightness=0.02:saturation=1.35[vfinal]`
      ].join(";");
    } else if (effect === "star_launch" || sceneNum === 3) {
      filterComplex = [
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`,
        `[1:v]scale=320:320[rabbit]`,
        `[2:v]scale=280:280[star]`,
        `[bg][rabbit]overlay=x='420':y='1200-abs(sin(t*3.5))*260'[v1]`,
        `[v1][star]overlay=x='440+sin(t*5)*40':y='1000-pow(t,2)*110'[v2]`,
        `[v2]eq=contrast=1.12:brightness=0.02:saturation=1.35[vfinal]`
      ].join(";");
    } else {
      filterComplex = [
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`,
        `[1:v]scale=300:300[rabbit]`,
        `[2:v]scale=340:340[star]`,
        `[bg][star]overlay=x='370':y='320+sin(t*4)*20'[v1]`,
        `[v1][rabbit]overlay=x='445':y='1280-abs(sin(t*8))*150'[v2]`,
        `[v2]eq=contrast=1.12:brightness=0.02:saturation=1.35[vfinal]`
      ].join(";");
    }

    const args = [
      "-framerate", "30", "-loop", "1", "-t", `${duration}`, "-i", chars.background,
      "-framerate", "30", "-loop", "1", "-t", `${duration}`, "-i", chars.char1,
      "-framerate", "30", "-loop", "1", "-t", `${duration}`, "-i", chars.char2,
      "-filter_complex", filterComplex,
      "-map", "[vfinal]",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-y", outputClipPath
    ];
    execFileSync(ffmpegPath, args, { stdio: "inherit" });
    return;
  }

  // ========================================================
  // CASE 3: CINEMATIC DYNAMIC MOVIE MOTION (From Scene Image)
  // ========================================================
  let imagePath = mediaInfo ? mediaInfo.path : null;
  if (!imagePath || !fs.existsSync(imagePath)) {
    const colors = ["midnightblue", "darkslateblue", "navy", "darkcyan"];
    const emojis = ["⭐", "🐰", "✨", "❤️"];
    const fallbackImg = path.join(outputDir, `fallback_scene_${sceneNum}.png`);
    execFileSync(ffmpegPath, [
      "-f", "lavfi",
      "-i", `color=c=${colors[(sceneNum - 1) % colors.length]}:s=1080x1920:d=1`,
      "-vf", `drawtext=text='SCENE ${sceneNum}':fontcolor=white:fontsize=80:borderw=4:bordercolor=black:x=(w-text_w)/2:y=800,drawtext=text='${emojis[(sceneNum - 1) % emojis.length]}':font='Segoe UI Emoji':fontsize=180:x=(w-text_w)/2:y=1000`,
      "-vframes", "1",
      "-y", fallbackImg
    ], { stdio: "inherit" });
    imagePath = fallbackImg;
  }

  console.log(`🎬 [Scene ${sceneNum}] Rendering cinematic movie camera & action motion for: ${path.basename(imagePath)}`);

  const colorGrading = "eq=contrast=1.12:brightness=0.02:saturation=1.35";
  let dynamicFilter = "";

  if (effect === "star_fall" || effect === "slide" || effect === "diagonal" || sceneNum === 1) {
    // Act 1: Smooth diagonal camera tracking down along cosmic path
    dynamicFilter = [
      `scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488`,
      `zoompan=z='1.14':x='(iw-iw/zoom)*0.75-(in/(30*${duration}))*(iw-iw/zoom)*0.55':y='(ih-ih/zoom)*0.15+(in/(30*${duration}))*(ih-ih/zoom)*0.60':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  } else if (effect === "rabbit_discover" || effect === "pan_left" || effect === "pan" || sceneNum === 2) {
    // Act 2: Smooth panoramic horizontal forest sweep
    dynamicFilter = [
      `scale=3545:1920:force_original_aspect_ratio=increase,crop=3545:1920`,
      `zoompan=z='1.08':x='(iw-iw/zoom)*0.75-(in/(30*${duration}))*(iw-iw/zoom)*0.65':y='(ih-ih/zoom)/2':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  } else if (effect === "star_launch" || effect === "crane_up" || effect === "tilt_up" || sceneNum === 3) {
    // Act 3: Upward crane shot rising from ground towards moon
    dynamicFilter = [
      `scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488`,
      `zoompan=z='1.12':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.85-(in/(30*${duration}))*(ih-ih/zoom)*0.70':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  } else if (effect === "star_shine" || effect === "slow_pull" || effect === "celestial" || sceneNum === 4) {
    // Act 4: Celestial high framing with gentle pull-back
    dynamicFilter = [
      `scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488`,
      `zoompan=z='max(1.20-(in/(30*${duration}))*0.14,1.06)':x='(iw-iw/zoom)*0.55':y='(ih-ih/zoom)*0.25':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  } else if (effect === "zoom_in" || effect === "push_in") {
    dynamicFilter = [
      `scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488`,
      `zoompan=z='min(1.05+(in/(30*${duration}))*0.18,1.25)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  } else if (effect === "zoom_out" || effect === "pull_out") {
    dynamicFilter = [
      `scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488`,
      `zoompan=z='max(1.24-(in/(30*${duration}))*0.18,1.05)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  } else if (effect === "shake" || effect === "action") {
    dynamicFilter = [
      `scale=1300:2311:force_original_aspect_ratio=increase,crop=1300:2311`,
      `zoompan=z='1.14':x='(iw-iw/zoom)/2+sin(in*0.4)*16':y='(ih-ih/zoom)/2+cos(in*0.5)*12':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  } else {
    // Default: Organic subtle breathing camera
    dynamicFilter = [
      `scale=1350:2400:force_original_aspect_ratio=increase,crop=1350:2400`,
      `zoompan=z='1.10+0.04*sin(in*0.05)':x='(iw-iw/zoom)/2+sin(in*0.06)*25':y='(ih-ih/zoom)/2+cos(in*0.05)*15':d=1:s=1080x1920:fps=30`,
      colorGrading
    ].join(",");
  }

  const args = [
    "-framerate", "30",
    "-loop", "1",
    "-t", `${duration}`,
    "-i", imagePath,
    "-vf", dynamicFilter,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-y", outputClipPath
  ];
  execFileSync(ffmpegPath, args, { stdio: "inherit" });
}

function renderMultiSceneStoryboard(scenes, totalDuration, options = {}) {
  ensureOutputDir();
  // Strictly enforce MAXIMUM 20 seconds
  const safeTotalDuration = Math.min(20.0, Math.max(4.0, parseFloat(totalDuration) || 10.0));
  const sceneClips = [];
  const sceneCount = scenes.length || 3;
  const defaultTimePerScene = Math.max(2.0, Math.round((safeTotalDuration / sceneCount) * 10) / 10);

  console.log(`🎬 Rendering ${sceneCount}-Scene Master Movie (${safeTotalDuration}s total - Max 20s)...`);

  // Step 1: Render individual scene clips
  scenes.forEach((scene, index) => {
    const sceneNum = index + 1;
    const clipPath = path.join(outputDir, `scene_clip_${sceneNum}.mp4`);
    const mediaInfo = findSceneMedia(sceneNum);
    const duration = scene.duration || defaultTimePerScene;

    console.log(`[Scene ${sceneNum}] Rendering ${duration}s with effect: ${scene.effect || 'cinematic'}...`);
    renderSceneClip(mediaInfo, sceneNum, duration, scene.effect || (sceneNum === 2 ? "shake" : "zoom_in"), clipPath);
    sceneClips.push(clipPath);
  });

  // Step 2: Concatenate all scene clips into one seamless video
  const concatListFile = path.join(outputDir, "scenes_concat.txt");
  const concatContent = sceneClips.map(clip => `file '${clip.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(concatListFile, concatContent, "utf8");

  const stitchedVideo = path.join(outputDir, "stitched_storyboard.mp4");
  execFileSync(ffmpegPath, [
    "-f", "concat",
    "-safe", "0",
    "-i", concatListFile,
    "-c", "copy",
    "-y", stitchedVideo
  ], { stdio: "inherit" });

  console.log("✅ All scenes stitched into seamless master movie:", stitchedVideo);
  return stitchedVideo;
}

module.exports = { renderMultiSceneStoryboard, findSceneMedia };
