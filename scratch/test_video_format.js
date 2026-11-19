const fs = require('fs');
const path = require('path');
const { execFfmpeg } = require('../backend/utils/ffmpegHelper');

const images = [
  'storage/images/scene1.png',
  'storage/images/scene2.png',
  'storage/images/scene3.png',
  'storage/images/scene4.png'
];

const audioPath = 'output/dragon-voice-10s.wav';
const duration = 10;
const sceneDuration = 2.5;

console.log('Testing video format rendering...');
// We will test creating 4 motion clips with dynamic camera sway
const clips = [];
for (let i = 0; i < images.length; i++) {
  const clipPath = `output/test_motion_clip_${i+1}.mp4`;
  const img = images[i];
  const sceneNum = i + 1;

  // Dynamic organic camera motion: combination of breathing zoom and floating pan
  // Different motion personality per scene so it feels alive
  let motionFilter = "";
  if (sceneNum === 1) {
    // Scene 1: Floating diagonal drift with breathing pulse
    motionFilter = "scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488,zoompan=z='1.12+0.04*sin(in*0.08)':x='(iw-iw/zoom)/2+sin(in*0.06)*35':y='(ih-ih/zoom)/2+cos(in*0.05)*25':d=1:s=1080x1920:fps=30,eq=contrast=1.12:brightness=0.02:saturation=1.3";
  } else if (sceneNum === 2) {
    // Scene 2: Dramatic punch-in with action sway
    motionFilter = "scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488,zoompan=z='min(1.08+(in/75)*0.16,1.26)+0.02*sin(in*0.15)':x='(iw-iw/zoom)/2+sin(in*0.1)*20':y='(ih-ih/zoom)/2+cos(in*0.08)*15':d=1:s=1080x1920:fps=30,eq=contrast=1.12:brightness=0.02:saturation=1.3";
  } else if (sceneNum === 3) {
    // Scene 3: Wide cinematic sweep with slow rotation drift
    motionFilter = "scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488,zoompan=z='1.14+0.03*cos(in*0.07)':x='(iw-iw/zoom)*0.75-(in/75)*(iw-iw/zoom)*0.5':y='(ih-ih/zoom)/2+sin(in*0.06)*20':d=1:s=1080x1920:fps=30,eq=contrast=1.12:brightness=0.02:saturation=1.3";
  } else {
    // Scene 4: Soft triumphant pull-back with gentle float
    motionFilter = "scale=1400:2488:force_original_aspect_ratio=increase,crop=1400:2488,zoompan=z='max(1.22-(in/75)*0.12,1.10)+0.03*sin(in*0.09)':x='(iw-iw/zoom)/2+cos(in*0.06)*25':y='(ih-ih/zoom)/2+sin(in*0.05)*20':d=1:s=1080x1920:fps=30,eq=contrast=1.12:brightness=0.02:saturation=1.3";
  }

  execFfmpeg([
    "-loop", "1",
    "-t", `${sceneDuration}`,
    "-i", img,
    "-vf", motionFilter,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-y", clipPath
  ]);
  clips.push(clipPath);
  console.log(`Generated clip ${sceneNum}`);
}

// Now test xfade transitions
// 4 clips of 2.5s each = total 10s. With 0.4s transition overlap, total offset = 2.1s, 4.2s, 6.3s
const transitionVideo = 'output/test_xfade_video.mp4';
const filterComplex = [
  `[0:v][1:v]xfade=transition=smoothleft:duration=0.4:offset=2.1[v01]`,
  `[v01][2:v]xfade=transition=circleopen:duration=0.4:offset=4.2[v02]`,
  `[v02][3:v]xfade=transition=fadeblack:duration=0.4:offset=6.3[vout]`
].join(';');

execFfmpeg([
  "-i", clips[0],
  "-i", clips[1],
  "-i", clips[2],
  "-i", clips[3],
  "-filter_complex", filterComplex,
  "-map", "[vout]",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-r", "30",
  "-y", transitionVideo
]);
console.log('Generated xfade video successfully:', transitionVideo);
