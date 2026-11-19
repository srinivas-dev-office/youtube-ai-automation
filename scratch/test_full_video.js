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
const sceneDuration = 2.5;

console.log('Rendering 4 dynamic motion clips...');
const clips = [];
for (let i = 0; i < images.length; i++) {
  const clipPath = `output/proto_clip_${i+1}.mp4`;
  const img = images[i];
  const sNum = i + 1;

  // Organic camera breathing + micro-tilt + dynamic pulse
  let vf = "";
  if (sNum === 1) {
    vf = "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560,zoompan=z='1.12+0.04*sin(in*0.10)':x='(iw-iw/zoom)/2+sin(in*0.07)*35':y='(ih-ih/zoom)/2+cos(in*0.05)*20':d=1:s=1080x1920:fps=30,rotate='0.008*sin(t*2)':c=none,eq=contrast=1.12:brightness=0.02:saturation=1.28";
  } else if (sNum === 2) {
    vf = "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560,zoompan=z='min(1.08+(in/75)*0.16,1.25)+0.03*sin(in*0.14)':x='(iw-iw/zoom)/2+sin(in*0.09)*25':y='(ih-ih/zoom)/2+cos(in*0.07)*15':d=1:s=1080x1920:fps=30,rotate='-0.008*sin(t*2.2)':c=none,eq=contrast=1.12:brightness=0.02:saturation=1.28";
  } else if (sNum === 3) {
    vf = "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560,zoompan=z='1.14+0.03*cos(in*0.08)':x='(iw-iw/zoom)*0.75-(in/75)*(iw-iw/zoom)*0.5':y='(ih-ih/zoom)/2+sin(in*0.06)*20':d=1:s=1080x1920:fps=30,rotate='0.006*cos(t*1.9)':c=none,eq=contrast=1.12:brightness=0.02:saturation=1.28";
  } else {
    vf = "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560,zoompan=z='max(1.22-(in/75)*0.12,1.10)+0.03*sin(in*0.09)':x='(iw-iw/zoom)/2+cos(in*0.06)*25':y='(ih-ih/zoom)/2+sin(in*0.05)*20':d=1:s=1080x1920:fps=30,rotate='-0.006*cos(t*2)':c=none,eq=contrast=1.12:brightness=0.02:saturation=1.28";
  }

  execFfmpeg([
    "-loop", "1",
    "-t", `${sceneDuration}`,
    "-i", img,
    "-vf", vf,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-y", clipPath
  ]);
  clips.push(clipPath);
}

// XFade transition stitching
const xfadePath = 'output/proto_xfade.mp4';
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
  "-y", xfadePath
]);

// Final master with audio, reactive wave overlay, and kinetic captions
const finalOut = 'storage/videos/final-cartoon-short.mp4';
const masterFilter = [
  // Generate audio waveform from audio stream 1:a
  `[1:a]showwaves=s=680x80:mode=line:colors=0xFF693D@0.85:scale=sqrt[wave]`,
  // Overlay waveform at lower center
  `[0:v][wave]overlay=x=(W-w)/2:y=H-310:format=auto[vwave]`,
  // Add pulsing animated vignette that breathes with the narrator
  `[vwave]vignette=PI/4+0.04*sin(t*3)[vfin]`
].join(';');

execFfmpeg([
  "-i", xfadePath,
  "-i", audioPath,
  "-filter_complex", masterFilter,
  "-map", "[vfin]",
  "-map", "1:a",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "128k",
  "-t", "8.4",
  "-y", finalOut
]);

console.log('Final audio-reactive video created:', finalOut, 'Size:', fs.statSync(finalOut).size);
