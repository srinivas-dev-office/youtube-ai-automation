const { geminiApiKey } = require("../backend/config");

async function testProScript(idea, style, tone) {
  const duration = 10;
  const wordCount = 28;
  const isRealistic = style === "realistic";

  const systemInstruction = `You are an elite, award-winning YouTube Shorts screenwriter and cinematic director.
You write world-class, high-retention short-form scripts that grip viewers in the first 2 seconds and deliver goosebumps.
NEVER write generic filler or childish bedtime rhymes unless specifically requested.
Structure your script using the proven 4-beat retention formula:
1. The Hook (0-3s): Instant visual or conceptual curiosity that stops scrolling.
2. The Escalation (3-6s): Rapid story development or rising tension.
3. The Climax (6-8s): The peak visual moment or emotional revelation.
4. The Payoff (8-10s): A powerful, memorable punchline or closing line.

CRITICAL RULES:
- Script Word Count: EXACTLY ${wordCount} words (±3 words) to perfectly fit ${duration} seconds.
- Every scene's visual prompt MUST match the exact sentence spoken in that scene.
- Maintain strict visual consistency for all characters across all scenes.
${isRealistic ? "- Characters MUST be real living human beings with authentic skin texture, realistic anatomy, woven fabrics, and 85mm cinematic camera lighting. STRICTLY NO cartoon, 3D, pixar, or render terms." : ""}
Return ONLY clean JSON.`;

  const prompt = `Idea: "${idea}"
Target Duration: ${duration}s (${wordCount} words total)
Tone: ${tone || "Epic and Cinematic"}
Character Style: ${style}

Generate JSON:
{
  "title": "Compelling Viral Title",
  "tone": "${tone}",
  "duration": ${duration},
  "hook": "Hook sentence",
  "narration": "Complete ${wordCount}-word spoken voiceover script that flows seamlessly",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Act 1 Hook",
      "duration": 2.5,
      "spokenLine": "Exact sentence from narration spoken here",
      "pixarPrompt": "Detailed scene visual prompt matching spokenLine in ${style} style"
    },
    {
      "sceneNumber": 2,
      "title": "Act 2 Escalation",
      "duration": 2.5,
      "spokenLine": "Exact sentence from narration spoken here",
      "pixarPrompt": "Detailed scene visual prompt matching spokenLine in ${style} style"
    },
    {
      "sceneNumber": 3,
      "title": "Act 3 Climax",
      "duration": 2.5,
      "spokenLine": "Exact sentence from narration spoken here",
      "pixarPrompt": "Detailed scene visual prompt matching spokenLine in ${style} style"
    },
    {
      "sceneNumber": 4,
      "title": "Act 4 Payoff",
      "duration": 2.5,
      "spokenLine": "Exact sentence from narration spoken here",
      "pixarPrompt": "Detailed scene visual prompt matching spokenLine in ${style} style"
    }
  ],
  "subtitles": [
    "SUBTITLE LINE 1",
    "SUBTITLE LINE 2",
    "SUBTITLE LINE 3",
    "SUBTITLE LINE 4"
  ],
  "youtube": {
    "title": "Viral YouTube Short Title #Shorts",
    "description": "SEO description with tags"
  }
}`;

  const key = process.env.GEMINI_API_KEY || geminiApiKey;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" + key;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
    })
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}

testProScript(
  "Rama and Lakshmana walking in ancient forest, and Hanuman silently watching from trees with deep devotion",
  "realistic",
  "Epic, Mythological, and Reverent"
).then(res => {
  console.log("=== GENERATED SCRIPT RESULT ===");
  console.log("TITLE:", res.title);
  console.log("HOOK:", res.hook);
  console.log("FULL NARRATION (" + res.narration.split(/\s+/).length + " words):");
  console.log(res.narration);
  console.log("\nSCENE BREAKDOWN (1:1 SYNCHRONIZED):");
  res.scenes.forEach(s => {
    console.log(`[Act ${s.sceneNumber}] "${s.spokenLine}"`);
    console.log(`  -> Visual Prompt: ${s.pixarPrompt}`);
  });
  console.log("\nSUBTITLES:");
  console.log(res.subtitles);
}).catch(console.error);
