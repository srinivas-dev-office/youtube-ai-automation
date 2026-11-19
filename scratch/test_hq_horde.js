const fs = require('fs');

async function testHordeQuality() {
  const prompt = "masterpiece, high quality, 8k 3D render, Pixar Disney animation style, adorable fluffy white kitsune fox in Kyoto bamboo forest, glowing golden maple leaves, floating lanterns, cinematic warm lighting, rich vibrant colors, cute expressive eyes, sharp focus";
  const negativePrompt = "blurry, low quality, distorted, bad anatomy, deformed, watermark, text, artifacts, noisy, duplicate, ugly, low resolution";

  console.log("Submitting high-quality request to AI Horde...");
  const t0 = Date.now();
  const postRes = await fetch("https://aihorde.net/api/v2/generate/async", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": "0000000000" },
    body: JSON.stringify({
      prompt: `${prompt} ### ${negativePrompt}`,
      params: {
        width: 448,
        height: 768,
        steps: 22,
        sampler_name: "k_euler_a",
        cfg_scale: 7.5,
        n: 1
      }
    })
  });

  console.log("Post status:", postRes.status);
  const data = await postRes.json();
  console.log("Post response:", data);
  const id = data.id;
  if (!id) return;

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const chk = await (await fetch("https://aihorde.net/api/v2/generate/check/" + id)).json();
    console.log(`Check ${i + 1}: wait=${chk.wait_time}s, done=${chk.done}`);
    if (chk.done) {
      const st = await (await fetch("https://aihorde.net/api/v2/generate/status/" + id)).json();
      const imgUrl = st.generations?.[0]?.img;
      const model = st.generations?.[0]?.model;
      console.log(`Success in ${(Date.now() - t0)}ms! Model used: ${model}, URL: ${imgUrl}`);
      const imgRes = await fetch(imgUrl);
      const buf = await imgRes.arrayBuffer();
      fs.writeFileSync("storage/images/test_hq.webp", Buffer.from(buf));
      console.log("Saved test_hq.webp, bytes:", buf.byteLength);
      break;
    }
  }
}
testHordeQuality();
