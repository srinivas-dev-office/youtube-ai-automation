/**
 * Studio-Grade Cinematic Camera & Character Positioning Engine
 * Powers organic 2.5D animation, multi-axis parallax simulation,
 * and character visual consistency across scenes.
 */

const CAMERA_PROFILES = {
  // 1. Dramatic Zoom In: Logarithmic punch into character's emotional center
  "dramatic_zoom_in": {
    name: "Dramatic Zoom In",
    description: "Punch-in toward character with subtle lateral sway",
    getZoomExpr: (frames) => `min(1.08+(in/${frames})*0.18, 1.28)+0.02*sin(in*0.12)`,
    getXExpr: (anchorX) => `(iw-iw/zoom)*${anchorX}+sin(in*0.08)*20`,
    getYExpr: (anchorY) => `(ih-ih/zoom)*${anchorY}+cos(in*0.06)*12`,
    getRotateExpr: () => `-0.006*sin(t*2.0)`
  },

  // 2. Epic Pull Back: Triumphant wide reveal
  "epic_pull_back": {
    name: "Epic Pull Back",
    description: "Heroic pullback revealing environment and scale",
    getZoomExpr: (frames) => `max(1.24-(in/${frames})*0.14, 1.10)+0.02*sin(in*0.09)`,
    getXExpr: (anchorX) => `(iw-iw/zoom)*${anchorX}+cos(in*0.06)*20`,
    getYExpr: (anchorY) => `(ih-ih/zoom)*${anchorY}+sin(in*0.05)*15`,
    getRotateExpr: () => `0.005*cos(t*1.8)`
  },

  // 3. Pan Right: Cinematic tracking shot moving right
  "pan_right": {
    name: "Cinematic Pan Right",
    description: "Smooth horizontal dolly movement from left to right",
    getZoomExpr: () => `1.15+0.02*sin(in*0.08)`,
    getXExpr: (anchorX, frames) => `(iw-iw/zoom)*(0.25+(in/${frames})*0.50)`,
    getYExpr: (anchorY) => `(ih-ih/zoom)*${anchorY}+sin(in*0.05)*10`,
    getRotateExpr: () => `0.004*sin(t*1.5)`
  },

  // 4. Pan Left: Cinematic tracking shot moving left
  "pan_left": {
    name: "Cinematic Pan Left",
    description: "Smooth horizontal dolly movement from right to left",
    getZoomExpr: () => `1.15+0.02*sin(in*0.08)`,
    getXExpr: (anchorX, frames) => `(iw-iw/zoom)*(0.75-(in/${frames})*0.50)`,
    getYExpr: (anchorY) => `(ih-ih/zoom)*${anchorY}+sin(in*0.05)*10`,
    getRotateExpr: () => `-0.004*sin(t*1.5)`
  },

  // 5. Tilt Up: Vertical pedestal movement revealing grandeur
  "tilt_up": {
    name: "Pedestal Tilt Up",
    description: "Vertical reveal upward from ground to character gaze",
    getZoomExpr: () => `1.14+0.02*cos(in*0.09)`,
    getXExpr: (anchorX) => `(iw-iw/zoom)*${anchorX}+sin(in*0.06)*12`,
    getYExpr: (anchorY, frames) => `(ih-ih/zoom)*(0.70-(in/${frames})*0.45)`,
    getRotateExpr: () => `0.003*sin(t*1.6)`
  },

  // 6. Tilt Down: Downward survey of scene details
  "tilt_down": {
    name: "Pedestal Tilt Down",
    description: "Vertical descent from atmospheric sky to character",
    getZoomExpr: () => `1.14+0.02*cos(in*0.09)`,
    getXExpr: (anchorX) => `(iw-iw/zoom)*${anchorX}+sin(in*0.06)*12`,
    getYExpr: (anchorY, frames) => `(ih-ih/zoom)*(0.25+(in/${frames})*0.45)`,
    getRotateExpr: () => `-0.003*sin(t*1.6)`
  },

  // 7. Dynamic Diagonal Drift: Floating mystical camera movement
  "dynamic_diagonal_drift": {
    name: "Diagonal Parallax Drift",
    description: "Floating compound 3D drift with organic respiratory pulse",
    getZoomExpr: () => `1.12+0.035*sin(in*0.10)`,
    getXExpr: (anchorX) => `(iw-iw/zoom)*${anchorX}+sin(in*0.07)*30`,
    getYExpr: (anchorY) => `(ih-ih/zoom)*${anchorY}+cos(in*0.05)*18`,
    getRotateExpr: () => `0.007*sin(t*2.0)`
  },

  // 8. Vertigo Dolly Zoom: Contra-zoom foreground compression
  "vertigo_dolly_zoom": {
    name: "Vertigo Dolly Zoom",
    description: "Warped focal compression emphasizing intense revelation",
    getZoomExpr: (frames) => `1.08+pow(in/${frames}, 1.6)*0.24`,
    getXExpr: (anchorX) => `(iw-iw/zoom)*${anchorX}`,
    getYExpr: (anchorY) => `(ih-ih/zoom)*${anchorY}`,
    getRotateExpr: () => `0.005*sin(t*2.5)`
  },

  // 9. Breathing Hero: Subtle multi-axis respiratory micro-movement
  "breathing_hero": {
    name: "Organic Hero Breathing",
    description: "Subtle organic posture movement maintaining character focus",
    getZoomExpr: () => `1.08+0.02*sin(in*0.07)`,
    getXExpr: (anchorX) => `(iw-iw/zoom)*${anchorX}+sin(in*0.05)*15`,
    getYExpr: (anchorY) => `(ih-ih/zoom)*${anchorY}+cos(in*0.06)*10`,
    getRotateExpr: () => `0.003*sin(t*1.2)`
  }
};

/**
 * Character Positioning Anchors for Frame Consistency
 */
const CHARACTER_ANCHORS = {
  "hero_center": { x: 0.50, y: 0.48, label: "Hero Centered (Standard Focus)" },
  "left_third": { x: 0.33, y: 0.46, label: "Left Rule of Thirds (Facing Right)" },
  "right_third": { x: 0.67, y: 0.46, label: "Right Rule of Thirds (Facing Left)" },
  "dialogue_two_shot": { x: 0.50, y: 0.50, label: "Two-Shot Dialogue Balancing" },
  "cinematic_wide": { x: 0.50, y: 0.55, label: "Wide Environmental Perspective" }
};

/**
 * Dimensions by Aspect Ratio (with 1.33x overscan padding to prevent blank edges)
 */
function getCanvasDimensions(aspectRatio = "9:16") {
  const norm = String(aspectRatio).toLowerCase().trim();
  if (norm === "16:9" || norm === "landscape" || norm === "horizontal") {
    return { outW: 1920, outH: 1080, padW: 2560, padH: 1440, fps: 30 };
  } else if (norm === "1:1" || norm === "square") {
    return { outW: 1080, outH: 1080, padW: 1440, padH: 1440, fps: 30 };
  }
  // Standard 9:16 vertical (YouTube Shorts / Instagram Reels / TikTok)
  return { outW: 1080, outH: 1920, padW: 1440, padH: 2560, fps: 30 };
}

/**
 * Color Grading LUT & Equalizer Filter Chains
 */
function getColorGradingFilter(adjustments = {}) {
  let contrast = 1.12;
  let brightness = 0.02;
  let saturation = 1.30;

  if (adjustments.contrast !== undefined) contrast = Math.max(0.6, (adjustments.contrast / 100) * 1.12);
  if (adjustments.brightness !== undefined) brightness = ((adjustments.brightness - 100) / 100) * 0.3;
  if (adjustments.saturation !== undefined) saturation = Math.max(0.0, (adjustments.saturation / 100) * 1.30);

  let eq = `eq=contrast=${contrast.toFixed(2)}:brightness=${brightness.toFixed(2)}:saturation=${saturation.toFixed(2)}`;

  const filter = (adjustments.filter || adjustments.colorTone || "").toLowerCase();
  if (filter === "warm") {
    eq += ",colorchannelmixer=1.12:0:0:0:0:1.02:0:0:0:0:0.88";
  } else if (filter === "cool") {
    eq += ",colorchannelmixer=0.90:0:0:0:0:1.0:0:0:0:0:1.15";
  } else if (filter === "dramatic" || filter === "vibrant") {
    eq += ",eq=contrast=1.35:saturation=1.45";
  } else if (filter === "vintage" || filter === "sepia") {
    eq += ",colorchannelmixer=.9:.1:.1:0:.1:.8:.1:0:.1:.1:.7";
  } else if (filter === "noir" || filter === "bw") {
    eq += ",hue=s=0";
  } else if (filter === "cyberpunk") {
    eq += ",hue=h=90:s=1.5";
  }

  return eq;
}

/**
 * Compiles a studio-grade FFmpeg filter chain for 2.5D animation
 */
function buildCinematicFilterChain({
  cameraMotion = "dramatic_zoom_in",
  characterAnchor = "hero_center",
  duration = 5.0,
  aspectRatio = "9:16",
  adjustments = {}
}) {
  const dim = getCanvasDimensions(aspectRatio);
  const frames = Math.max(30, Math.round(dim.fps * duration));

  const profile = CAMERA_PROFILES[cameraMotion] || CAMERA_PROFILES["dramatic_zoom_in"];
  const anchor = CHARACTER_ANCHORS[characterAnchor] || CHARACTER_ANCHORS["hero_center"];

  const zoomExpr = profile.getZoomExpr(frames);
  const xExpr = profile.getXExpr(anchor.x, frames);
  const yExpr = profile.getYExpr(anchor.y, frames);
  const rotateExpr = profile.getRotateExpr();
  const colorGrading = getColorGradingFilter(adjustments);

  // 1. Scale with overscan to prevent edge clamping
  const scaleFilter = `scale=${dim.padW}:${dim.padH}:force_original_aspect_ratio=increase,crop=${dim.padW}:${dim.padH}`;

  // 2. Continuous sub-pixel zoompan
  const zoompanFilter = `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${dim.outW}x${dim.outH}:fps=${dim.fps}`;

  // 3. Subtle organic rotation tilt
  const rotateFilter = `rotate='${rotateExpr}':c=none:ow=${dim.outW}:oh=${dim.outH}`;

  return [scaleFilter, zoompanFilter, rotateFilter, colorGrading].join(",");
}

module.exports = {
  CAMERA_PROFILES,
  CHARACTER_ANCHORS,
  getCanvasDimensions,
  getColorGradingFilter,
  buildCinematicFilterChain
};
