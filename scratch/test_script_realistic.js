const { callGeminiApi } = require('../backend/services/storyGenerator');

async function testPrompt() {
  const script = `Rama and Lakshmana continue walking in the foreground.
In the far background, Hanuman appears between two large trees.
Camera focuses on Rama and Lakshmana first.
Slowly shift focus to Hanuman.
Hanuman walks quietly, maintaining a respectful distance.
His tail moves naturally with each step.
Sunlight illuminates his face as he watches Rama with devotion.`;

  const sys = `You are an elite cinematic film director and visual prompt engineer for cinema films and YouTube Shorts.
When characterStyle is 'realistic', characters MUST be described as REAL LIVING HUMAN BEINGS with authentic human anatomy, real skin texture with pores, natural fabric clothing, cinematic lighting, and camera lens specifications (85mm, shallow depth of field). NEVER use words like cartoon, pixar, 3d, animation, or cgi render.
Return ONLY valid JSON.`;

  const prompt = `Convert this script into a 4-scene cinematic storyboard (10 seconds total).
Script: "${script}"
Visual Style: "realistic"

Output JSON format:
{
  "title": "Divine Devotion",
  "duration": 10,
  "characterStyle": "realistic",
  "narration": "Rama and Lakshmana walk through the sacred woods, unaware of the devoted guardian watching from the shadows.",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Princes of Ayodhya",
      "duration": 2.5,
      "effect": "diagonal",
      "imagePrompt": "Cinematic 8k photograph, two real ancient Indian warriors Lord Rama and Lakshmana walking through a dense sunlit forest, authentic Indian features, real human skin pores, woven traditional silk dhoti, carrying ornate bows on shoulder, warm golden hour sunlight, 85mm portrait lens, shallow depth of field, National Geographic realism"
    }
  ],
  "subtitles": [
    "RAMA AND LAKSHMANA WALK FORTH",
    "A SHADOW IN THE TREES",
    "DEVOTION FROM A DISTANCE",
    "THE GAZE OF HANUMAN"
  ]
}`;

  const res = await callGeminiApi(prompt, sys);
  console.log("Gemini Response:\n", res);
}
testPrompt();
