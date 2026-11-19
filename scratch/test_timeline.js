const { geminiApiKey } = require("../backend/config");

async function testTimelineTable(idea, duration, isMinutes = false) {
  const unit = isMinutes ? "min" : "s";
  const numScenes = 10;
  const step = duration / numScenes;

  const systemInstruction = `You are an elite Hollywood & YouTube Shorts director and screenwriter.
Given a user's story idea and total duration (${duration} ${unit}), break down the entire narrative into a precise chronological Scene Timeline Table with exactly ${numScenes} sequential story beats.
Each scene must advance the story logically:
- Scene 1: Introduction / Setting the world
- Scene 2-3: Characters in motion & setup
- Scene 4-5: Discovery / Inciting moment
- Scene 6-7: Rising interaction / Escalation
- Scene 8-9: Emotional peak / Devotion / Climax
- Scene 10: Divine resolution & cinematic closing

For each scene provide:
1. sceneNumber (1 to ${numScenes})
2. timeRange (e.g. "0–2 ${unit}", "2–4 ${unit}", etc.)
3. storyBeat (concise summary of what happens in this scene, e.g. "Beautiful forest introduction", "Rama and Lakshmana walking")
4. spokenLine (concise voiceover spoken in this scene)
5. visualPrompt (photorealistic cinematic film photography prompt for this scene)

Return clean JSON with:
{
  "title": "Title",
  "totalDuration": "${duration} ${unit}",
  "narration": "Full combined narration script",
  "timeline": [
    {
      "scene": 1,
      "timeRange": "0–${step} ${unit}",
      "storyBeat": "Beautiful forest introduction",
      "spokenLine": "Voiceover line",
      "visualPrompt": "Cinematic visual description"
    }
  ]
}`;

  const userPrompt = `Story Idea: "${idea}"
Total Duration: ${duration} ${unit}
Create the 10-scene chronological timeline table now.`;

  const key = process.env.GEMINI_API_KEY || geminiApiKey;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" + key;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
    })
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}

testTimelineTable(
  "Rama and Lakshmana in forest, and Hanuman appears and watches with devotion",
  20,
  true // testing with minutes or seconds
).then(res => {
  console.log("=== GENERATED SCENE TIMELINE TABLE ===");
  console.log("TITLE:", res.title);
  console.log("TOTAL DURATION:", res.totalDuration);
  console.log("\nScene\tDuration\tStory Beat");
  console.log("-------------------------------------------------------------------");
  res.timeline.forEach(t => {
    console.log(`${t.scene}\t${t.timeRange}\t\t${t.storyBeat}`);
  });
  console.log("\nFULL NARRATION:");
  console.log(res.narration);
}).catch(console.error);
