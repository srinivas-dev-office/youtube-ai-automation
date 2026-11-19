const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

async function testEnhancedGeneration() {
  const prompt = "masterpiece, 8k 3D render, Pixar Disney animation style, adorable chubby baby dragon roasting sweet marshmallow over glowing campfire in misty fantasy forest, volumetric lighting, rich vibrant colors, cute glossy eyes, sharp focus";
  const negativePrompt = "blurry, low quality, distorted, bad anatomy, extra limbs, bad eyes, watermark, text, artifacts, noisy, low resolution, deformed";

  console.log("Testing enhanced generation...");
  const postRes = await fetch("https://aihorde.net/api/v2/generate/async", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": "0000000000" },
    body: JSON.stringify({
      prompt: `${prompt} ### ${negativePrompt}`,
      params: {
        width: 384,
        height: 640,
        steps: 16,
        sampler_name: "k_euler_a",
        cfg_scale: 7.5,
        n: 1
      }
    })
  });

  const data = await postRes.json();
  const id = data.id;
  console.log("Job ID:", id);

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const chk = await (await fetch("https://aihorde.net/api/v2/generate/check/" + id)).json();
    if (chk.done) {
      const st = await (await fetch("https://aihorde.net/api/v2/generate/status/" + id)).json();
      const imgUrl = st.generations?.[0]?.img;
      console.log("Horde done! URL:", imgUrl);
      const res = await fetch(imgUrl);
      const buf = await res.arrayBuffer();
      const rawPath = "storage/images/test_raw.webp";
      const outPath = "storage/images/test_upscaled.png";
      fs.writeFileSync(rawPath, Buffer.from(buf));

      // FFmpeg lanczos upscale + unsharp enhancement
      execSync(`ffmpeg -i ${rawPath} -vf "scale=1080:1920:flags=lanczos,unsharp=5:5:0.8:5:5:0.0" -y ${outPath}`);
      console.log("Upscaled successfully! Size:", fs.statSync(outPath).size);
      break;
    }
  }
}
testEnhancedGeneration();
