const fs = require('fs');

async function testGeminiImage() {
  const key = process.env.GEMINI_API_KEY;
  const models = ['gemini-2.5-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-image'];

  for (const m of models) {
    console.log('Testing', m, '...');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Generate an image of a cute baby dragon holding a roasted marshmallow, 3D Pixar style' }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        })
      });
      console.log(m, 'Status:', res.status);
      const data = await res.json();
      console.log(m, 'Response:', JSON.stringify(data).slice(0, 300));
    } catch(e) {
      console.error(m, 'Error:', e.message);
    }
  }
}
testGeminiImage();
