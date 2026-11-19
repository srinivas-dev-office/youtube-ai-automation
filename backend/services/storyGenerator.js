const fs = require("fs");
const path = require("path");
const { geminiApiKey } = require("../config");

const GEMINI_API_HOST = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Call Gemini REST API directly with ultra-fast modern models
 */
async function callGeminiApi(prompt, systemInstruction = "") {
  const key = process.env.GEMINI_API_KEY || geminiApiKey;
  if (!key || key.length < 5) {
    throw new Error("Gemini API key is not configured.");
  }

  // Active high-speed Gemini models in order of velocity and capability
  const models = ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  let lastError = null;

  for (const model of models) {
    const url = `${GEMINI_API_HOST}/models/${model}:generateContent?key=${key}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Gemini API] Model ${model} returned ${response.status}: ${errorText.slice(0, 100)}`);
        lastError = new Error(`Gemini API (${model}) failed: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find(p => p.text)?.text || parts[0]?.text;
      if (textPart) return textPart;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[Gemini API] Model ${model} request error: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

function parseJsonFromText(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/, "");
  else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "");
  cleaned = cleaned.replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

/**
 * Dynamically calculate optimal scene count and scene duration based on target total seconds
 */
function calculateSceneStructure(duration, durationUnit = "s") {
  const isMinutes = durationUnit === "min" || String(duration).toLowerCase().includes("min");
  const rawNum = parseFloat(duration) || 20;
  // Support 5s up to 180s (3 minutes)
  const totalSeconds = isMinutes ? Math.min(180, Math.max(10, Math.round(rawNum * 60))) : Math.min(180, Math.max(5, Math.round(rawNum)));

  let sceneCount = 4;
  if (totalSeconds <= 12) {
    sceneCount = 3;       // 10s -> 3 scenes (~3.3s each)
  } else if (totalSeconds <= 22) {
    sceneCount = 4;       // 20s -> 4 scenes (5.0s each)
  } else if (totalSeconds <= 35) {
    sceneCount = 6;       // 30s -> 6 scenes (5.0s each)
  } else if (totalSeconds <= 70) {
    sceneCount = 10;      // 60s -> 10 scenes (6.0s each)
  } else {
    sceneCount = Math.max(8, Math.min(20, Math.round(totalSeconds / 7.0))); // 120s -> ~16 scenes
  }

  const perScene = +(totalSeconds / sceneCount).toFixed(1);
  const targetWords = Math.round(totalSeconds * 2.3);

  return { totalSeconds, sceneCount, perScene, targetWords, unit: "s" };
}

/**
 * Generate full storyboard & scene timeline breakdown from user idea prompt
 */
async function generateStoryboardWithGemini(prompt, duration = 20, characterStyle = "stylized", storyTone = "Epic and Cinematic", durationUnit = "s", category = "Animation") {
  const { totalSeconds, sceneCount, perScene, targetWords, unit } = calculateSceneStructure(duration, durationUnit);
  const validDuration = totalSeconds;
  const selectedCategory = category || "Animation";
  const isRealistic = characterStyle === "realistic";

  const systemInstruction = `You are an elite cinematic screenwriter, visual director, and character concept designer.
Your mission: Given any story idea, category/genre ("${selectedCategory}"), and total duration (${validDuration} seconds), create a tightly synchronized master screenplay divided into EXACTLY ${sceneCount} sequential acts (${perScene}s each), AND extract the 1 to 3 actual characters.

CRITICAL DURATION & PACING MANDATES:
- Total Duration: EXACTLY ${validDuration} seconds.
- Scene Count: EXACTLY ${sceneCount} sequential scenes (Scenes 1 to ${sceneCount}).
- Scene Duration: ${perScene} seconds per scene.
- Narration Word Budget: The entire combined spoken narration script MUST be approximately ${targetWords} words so voiceover speaking pace synchronizes with the ${validDuration}s video.

CRITICAL STORY CONTINUITY & CHARACTER CONSISTENCY MANDATE:
- Identify the 1 to 3 ACTUAL characters in THIS specific story idea.
- Maintain seamless story progression from Scene 1 to Scene ${sceneCount} (introduction -> development -> climax -> resolution).
- NEVER invent unrelated characters from other projects.
- Every character MUST have concrete visual attributes (name, role, age, gender, skinTone, hairStyle, faceStructure, bodyType, costume, accessories, identifyingFeatures, personality, description).
- For EVERY scene (1 to ${sceneCount}), you MUST generate:
1. "sceneNumber": integer 1 to ${sceneCount}
2. "timeRange": exact time window (e.g. "0–${perScene}s", "${perScene}–${perScene * 2}s")
3. "storyBeat": concise narrative action beat in ${selectedCategory} genre
4. "title": descriptive act title
5. "spokenLine": exact voiceover line spoken during this time window (~${Math.round(targetWords / sceneCount)} words)
6. "pixarPrompt": vivid scene visual prompt detailing exact character actions, camera framing (wide, medium, close-up), and atmospheric lighting

${isRealistic ? '- Photorealism Mandate: Characters MUST be real living human beings with authentic skin pores, natural anatomy, woven fabrics, and 85mm portrait lenses with cinematic film lighting. STRICTLY AVOID cartoon, 3D, pixar, animation, render, or CGI terms.' : `- Visual Style: Depict all scenes consistently in "${characterStyle}" visual style.`}
- Genre / Category Influence: Strictly adapt visual atmosphere, lighting, camera framing, and tone to the "${selectedCategory}" genre.
Return ONLY clean JSON without markdown code fences.`;

  const promptExample = isRealistic
    ? `Photorealistic cinematic 8k film photograph of real human beings in ${selectedCategory} setting, authentic skin pores, natural anatomy, 85mm portrait lens, cinematic dramatic lighting`
    : `Detailed scene prompt for image generator in ${characterStyle} visual style, ${selectedCategory} aesthetic, 8k render`;

  const userPrompt = `Story Idea: "${prompt}"
Story Category / Genre: "${selectedCategory}"
Tone: "${storyTone}"
Visual Character Style: "${characterStyle}"
Total Duration: ${validDuration} seconds (${sceneCount} scenes, ${perScene}s each, ~${targetWords} words total)

Generate the complete master screenplay, characters list, and ${sceneCount}-scene timeline table in JSON format:
{
  "title": "Compelling Story Title",
  "category": "${selectedCategory}",
  "tone": "${storyTone}",
  "duration": ${validDuration},
  "durationUnit": "s",
  "totalDurationFormatted": "${validDuration}s",
  "narration": "Full combined spoken narration script",
  "characters": [
    {
      "name": "Character Name",
      "role": "Lead Protagonist",
      "age": "e.g. Young Girl (10-12 years)",
      "gender": "Female / Male / Other",
      "skinTone": "Detailed skin tone and complexion",
      "hairStyle": "Hair color, length and style",
      "faceStructure": "Facial features, eye color, expressions",
      "bodyType": "Physique and body proportions",
      "costume": "Detailed clothing, fabrics, colors matching ${selectedCategory}",
      "accessories": "Props, weapons, or items carried",
      "identifyingFeatures": "Distinctive marks, aura, or visual cues",
      "personality": "Core emotional tone and personality traits",
      "description": "Comprehensive visual prompt description for AI image generator"
    }
  ],
  "timeline": [
    {
      "scene": 1,
      "duration": "0–${perScene}s",
      "story": "Atmospheric introduction",
      "spokenLine": "First sentence of voiceover",
      "prompt": "${promptExample}"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "timeRange": "0–${perScene}s",
      "storyBeat": "Atmospheric introduction",
      "title": "Act 1: Introduction",
      "duration": ${perScene},
      "spokenLine": "First sentence of voiceover",
      "effect": "zoom_in",
      "pixarPrompt": "${promptExample}"
    }
  ],
  "subtitles": [
    "CLEAN UPPERCASE SUBTITLE LINE 1",
    "CLEAN UPPERCASE SUBTITLE LINE 2"
  ],
  "youtube": {
    "title": "Viral YouTube Title #Shorts",
    "description": "Engaging description with tags #Shorts #${selectedCategory.replace(/\\s+/g, '')} #Story"
  }
}`;

  try {
    const raw = await callGeminiApi(userPrompt, systemInstruction);
    const parsed = parseJsonFromText(raw);
    parsed.duration = validDuration;
    parsed.durationUnit = unit;
    parsed.characterStyle = characterStyle;
    parsed.category = selectedCategory;
    parsed.tone = storyTone;

    // Ensure timeline is populated if only scenes were returned
    if (!parsed.timeline && parsed.scenes) {
      parsed.timeline = parsed.scenes.map(s => ({
        scene: s.sceneNumber,
        duration: s.timeRange || `${s.duration}s`,
        story: s.storyBeat || s.title,
        spokenLine: s.spokenLine || "",
        prompt: s.pixarPrompt || ""
      }));
    }

    // Ensure characters are populated with fallback if missing
    if (!parsed.characters || !Array.isArray(parsed.characters) || parsed.characters.length === 0) {
      parsed.characters = extractFallbackCharacters(prompt, selectedCategory, characterStyle);
    }

    return parsed;
  } catch (err) {
    console.warn("Gemini storyboard generation failed, using intelligent category-aware offline template:", err.message);
    return getOfflineFallbackStoryboard(prompt, validDuration, characterStyle, storyTone, unit, selectedCategory);
  }
}

/**
 * Intelligent character extraction from prompt and category
 */
function extractFallbackCharacters(prompt = "", category = "Animation", characterStyle = "stylized") {
  const pLower = prompt.toLowerCase();
  const catLower = (category || "Animation").toLowerCase();
  const isRealistic = characterStyle === "realistic";

  // Check for specific character mentions in prompt
  const hasGirl = pLower.includes("girl") || pLower.includes("woman") || pLower.includes("daughter");
  const hasGhost = pLower.includes("ghost") || pLower.includes("spirit") || pLower.includes("phantom") || pLower.includes("haunt");
  const hasBoy = pLower.includes("boy") || pLower.includes("man") || pLower.includes("son");
  const hasDragon = pLower.includes("dragon");
  const hasRama = pLower.includes("rama") || pLower.includes("hanuman") || pLower.includes("lakshman");
  const hasCat = pLower.includes("cat") || pLower.includes("kitten");
  const hasDog = pLower.includes("dog") || pLower.includes("puppy");

  if (hasRama || catLower === "mythology") {
    return [
      {
        name: "Lord Rama",
        role: "Lead Hero / Divine Prince",
        age: "Young Adult (Divine / Ageless)",
        gender: "Male",
        skinTone: "Radiant Blue (Neelamegha-shyama, sapphire glow)",
        hairStyle: "Long dark lustrous hair tied gracefully in royal ascetic topknot",
        faceStructure: "Chiseled serene jawline, compassionate lotus eyes, calm dignified expression",
        bodyType: "Tall athletic warrior physique with broad shoulders",
        costume: "Silk saffron dhoti with golden zari border, royal shoulder sash",
        accessories: "Divine Kodanda longbow, golden quiver with celestial arrows",
        identifyingFeatures: "Luminous blue aura, sacred sandalwood tilak",
        personality: "Righteous, dignified, supremely calm and courageous",
        description: "Lord Rama, athletic warrior prince with blue-toned radiant complexion, golden crown, silk saffron dhoti, bow and arrow quiver."
      },
      {
        name: "Hanuman",
        role: "Embodiment of Devotion & Strength",
        age: "Ageless & Mighty",
        gender: "Male",
        skinTone: "Warm radiant golden-copper glowing skin",
        hairStyle: "Lustrous golden-brown hair, expressive tail",
        faceStructure: "Illuminated divine expression, eyes filled with tearful devotion",
        bodyType: "Colossal muscular heroic physique",
        costume: "Simple saffron cloth loincloth with golden waist cord",
        accessories: "Sacred pearl garland, celestial golden mace (Gada)",
        identifyingFeatures: "Golden radiance, gentle folded hands in reverence",
        personality: "Boundless devotion, humility, unmatched courage",
        description: "Hanuman, divine heroic vanara with golden radiant face, muscular build, watching Lord Rama with profound devotion."
      }
    ];
  }

  if (catLower === "horror" || hasGhost || pLower.includes("haunted")) {
    return [
      {
        name: hasGirl ? "Lily" : "Alex",
        role: "Lead Protagonist",
        age: hasGirl ? "Young Girl (11 years)" : "Young Explorer (12 years)",
        gender: hasGirl ? "Female" : "Male",
        skinTone: "Fair complexion with rosy cheeks and light freckles",
        hairStyle: hasGirl ? "Shoulder-length wavy chestnut brown hair with side clip" : "Messy dark brown hair",
        faceStructure: "Round expressive youthful face, wide curious hazel eyes",
        bodyType: "Petite, agile youthful build",
        costume: "Yellow hooded warm raincoat over cozy knitted sweater and dark denim dungarees, durable boots",
        accessories: "Vintage brass lantern emitting warm golden amber glow, worn leather satchel",
        identifyingFeatures: "Bright yellow raincoat, brass lantern illuminating shadows, brave inquisitive expression",
        personality: "Courageous, deeply curious, compassionate, perceptive",
        description: `${hasGirl ? "A brave 11-year-old young girl" : "A brave young explorer"} with expressive eyes, wearing a yellow hooded raincoat and holding an antique glowing brass lantern in a spooky haunted manor, cinematic 8k.`
      },
      {
        name: "Aria the Ghost Girl",
        role: "Mysterious Ghost / Supernatural Companion",
        age: "Ethereal Spirit (Ageless apparition)",
        gender: "Female",
        skinTone: "Translucent porcelain pale skin with soft bioluminescent blue-white aura",
        hairStyle: "Long ethereal silver-white hair floating weightlessly as if underwater",
        faceStructure: "Delicate porcelain features, luminous glowing cyan eyes, enigmatic gentle smile",
        bodyType: "Slender, floating weightlessly off the ground",
        costume: "Tattered antique Victorian lace dress that fades into misty vapor at the hem",
        accessories: "Faint glowing spectral crystal pendant around neck",
        identifyingFeatures: "Floating softly above floor, translucent silhouette casting no shadow, glowing cyan eyes",
        personality: "Mysterious, lonely, gentle, watchful guardian of the house",
        description: "A mysterious translucent ghost girl with floating silver hair, luminous cyan eyes, wearing a tattered antique lace dress, hovering gently with an ethereal misty aura, cinematic masterpiece."
      }
    ];
  }

  if (catLower === "fantasy" || hasDragon) {
    return [
      {
        name: hasDragon ? "Ignis the Baby Dragon" : "Eldrin the Apprentice",
        role: "Lead Protagonist",
        age: hasDragon ? "Playful Young Drake" : "Youthful Mage (15 years)",
        gender: "Male",
        skinTone: hasDragon ? "Vibrant emerald green scales with golden belly plates" : "Light sun-kissed skin",
        hairStyle: hasDragon ? "Tiny iridescent ruby crest horns" : "Tousled silver-blonde hair",
        faceStructure: hasDragon ? "Big sparkling curious golden reptilian eyes, happy toothy smile" : "Sharp thoughtful features, violet eyes",
        bodyType: hasDragon ? "Chubby adorable dragon pup with small bat-wings" : "Lean athletic build",
        costume: hasDragon ? "Leather miniature collar with enchanted brass bell" : "Midnight blue wizard tunic with star embroidery",
        accessories: hasDragon ? "Toasted marshmallow on a wooden stick" : "Carved wooden staff with glowing sapphire tip",
        identifyingFeatures: hasDragon ? "Small playful puffs of purple smoke from snout" : "Glowing runes on palms",
        personality: "Enthusiastic, playful, curious, fiercely loyal",
        description: hasDragon
          ? "Adorable baby dragon with emerald scales, sparkling golden eyes, chubby paws, holding a roasted marshmallow, vibrant fantasy lighting."
          : "Youthful apprentice sorcerer with midnight blue robes and a glowing crystal staff, magical forest backdrop."
      },
      {
        name: "Lumina the Forest Sprite",
        role: "Magical Companion",
        age: "Ancient Forest Fae",
        gender: "Female",
        skinTone: "Luminescent pearlescent glowing skin",
        hairStyle: "Spun golden hair adorned with glowing fireflies and wild dewberry blossoms",
        faceStructure: "Pointed delicate elven ears, glittering emerald eyes",
        bodyType: "Tiny winged fairy figure",
        costume: "Dress woven from silver spider silk and fresh green birch leaves",
        accessories: "Tiny blossom wand that leaves a sparkling dust trail",
        identifyingFeatures: "Four iridescent dragonfly wings fluttering with rainbow sheen",
        personality: "Whimsical, wise, cheerful, protective of nature",
        description: "A luminous tiny forest fairy with iridescent dragonfly wings, glowing golden hair and leaf gown, sprinkling magical fairy dust."
      }
    ];
  }

  if (catLower === "comedy") {
    return [
      {
        name: "Barnaby the Bumbling Hero",
        role: "Lead Comedic Protagonist",
        age: "Young Adult (22 years)",
        gender: "Male",
        skinTone: "Fair with comical freckles",
        hairStyle: "Wild uncombed red hair pointing in funny directions",
        faceStructure: "Expressive eyebrows, crooked friendly grin, wide surprised eyes",
        bodyType: "Gangly, lanky build prone to comedic acrobatics",
        costume: "Mismatched colorful striped cardigan, polka-dot bow tie, rolled up brown corduroy trousers",
        accessories: "Oversized magnifying glass, pocket watch with popping cuckoo",
        identifyingFeatures: "Round spectacles sliding down the nose, band-aid on cheek",
        personality: "Clumsy, overly optimistic, wildly determined, hilarious",
        description: "Comical animated hero with wild red hair, round spectacles, mismatched striped cardigan, hilarious funny expression."
      },
      {
        name: "Gidget the Sassy Pet",
        role: "Clever Sidekick",
        age: "Adult",
        gender: "Female",
        skinTone: hasCat ? "Calico orange and white fur" : "Golden fluffy fur",
        hairStyle: "Fluffy tufts around ears",
        faceStructure: "Half-lidded sassy skeptical eyes, twitching whiskers",
        bodyType: "Plump, cuddly comedic pet",
        costume: "Tiny red bowtie",
        accessories: "Half-eaten slice of pepperoni pizza",
        identifyingFeatures: "Always looking unimpressed while saving the day",
        personality: "Dry wit, secretly genius, loyal food-lover",
        description: "Funny cartoon chubby pet with hilarious deadpan expression, wearing a tiny red bow tie."
      }
    ];
  }

  if (catLower === "adventure" || catLower === "action") {
    return [
      {
        name: "Leo the Pathfinder",
        role: "Lead Adventurer",
        age: "Young Adult (20 years)",
        gender: "Male",
        skinTone: "Warm tanned weathered skin",
        hairStyle: "Short cropped windswept dark hair",
        faceStructure: "Determined square jawline, keen observant amber eyes",
        bodyType: "Athletic, agile, muscular build",
        costume: "Rugged canvas explorer jacket with brass buckles, cargo pants, climbing boots",
        accessories: "Vintage brass compass, grappling hook coiled at hip",
        identifyingFeatures: "Small heroic scar across left eyebrow, fingerless leather gloves",
        personality: "Brave, resourceful, steadfast, tactical",
        description: "Rugged brave explorer with canvas jacket and brass compass, standing atop a mountain ridge, dramatic golden cinematic lighting."
      },
      {
        name: "Maya the Wilderness Scout",
        role: "Expert Tracker & Navigator",
        age: "Young Adult (19 years)",
        gender: "Female",
        skinTone: "Golden olive radiant complexion",
        hairStyle: "Braided thick raven hair with turquoise beads",
        faceStructure: "Sharp alert features, confident smirk, falcon-like focused gaze",
        bodyType: "Swift, nimble athletic build",
        costume: "Reinforced desert leather tunic with utility belt and hooded scarf",
        accessories: "Ornate spyglass, custom topographical parchment map",
        identifyingFeatures: "Falcon feather woven into braid, keen tactical stance",
        personality: "Fearless, witty, brilliant navigator, loyal friend",
        description: "Confident female adventurer with raven braided hair and leather scout gear, surveying ancient wilderness."
      }
    ];
  }

  // Universal Default / Kids Stories / Animation
  return [
    {
      name: hasGirl ? "Sophie" : "Leo",
      role: "Lead Protagonist",
      age: "Young Hero (10-12 years)",
      gender: hasGirl ? "Female" : "Male",
      skinTone: "Warm radiant fair skin",
      hairStyle: hasGirl ? "Bouncy chestnut ponytail with blue ribbon" : "Spiky dark brown hair",
      faceStructure: "Bright sparkling eyes, friendly open smile, optimistic expression",
      bodyType: "Youthful energetic build",
      costume: "Vibrant sapphire blue hoodie with white stripes, sneakers, denim jeans",
      accessories: "Adventure backpack with favorite sketchbook and pocket flashlight",
      identifyingFeatures: "Bright curious smile, badge on backpack",
      personality: "Kind-hearted, adventurous, inventive, full of wonder",
      description: `A spirited animated ${hasGirl ? "young girl" : "young boy"} with sparkling eyes, wearing a blue hoodie and backpack, filled with joy and adventure.`
    },
    {
      name: "Barnaby the Friendly Companion",
      role: "Supporting Best Friend",
      age: "Youthful Creature",
      gender: "Male",
      skinTone: "Fluffy golden honey fur",
      hairStyle: "Velvety soft floppy ears",
      faceStructure: "Big cartoon puppy-dog eyes, joyful wagging tail, happy tongue",
      bodyType: "Huggable rounded silhouette",
      costume: "Red bandana knotted around collar",
      accessories: "Favorite bouncing rubber ball",
      identifyingFeatures: "Heart-shaped white patch over right eye",
      personality: "Loyal, playful, protective, affectionate",
      description: "An adorable friendly cartoon animal companion with fluffy golden fur, floppy ears, red bandana, radiating warmth and happiness."
    }
  ];
}

/**
 * Generate scenes specifically synchronized to match user's custom narration script
 */
async function generateStoryboardFromNarration(narration, duration = 20, characterStyle = "stylized", storyTone = "Epic and Cinematic", durationUnit = "s", category = "Animation") {
  const { totalSeconds, sceneCount, perScene, targetWords, unit } = calculateSceneStructure(duration, durationUnit);
  const validDuration = totalSeconds;
  const selectedCategory = category || "Animation";
  const isRealistic = characterStyle === "realistic";

  const systemInstruction = `You are an expert cinematic visual director and character concept artist.
Analyze the user's narration script, story category ("${selectedCategory}"), and break it down into exactly ${sceneCount} sequential cinematic scenes (${perScene}s each).
CRITICAL MANDATES:
1. Every scene MUST include "sceneNumber", "timeRange" (e.g. "0–${perScene}s"), "storyBeat", and "spokenLine".
2. The scene's visual prompt ("pixarPrompt") MUST directly and vividly visualize that specific spoken moment in ${characterStyle} style, reflecting the "${selectedCategory}" genre aesthetic.
3. EXTRACT 1 to 3 ACTUAL CHARACTERS who appear in this narration. Never invent unrelated characters. Provide their detailed attributes in a "characters" array.
${isRealistic ? '4. Characters MUST be depicted as REAL LIVING HUMAN BEINGS with authentic skin pores, natural anatomy, woven fabrics, and cinematic film lighting. STRICTLY AVOID cartoon, 3D, pixar, animation, cgi, or render terms.' : `4. Visual Style: "${characterStyle}".`}
Return ONLY clean JSON without markdown code fences.`;

  const promptExample = isRealistic
    ? `Photorealistic cinematic 8k film photograph of real human beings in ${selectedCategory} atmosphere, authentic skin pores, natural anatomy, 85mm lens, cinematic daylight`
    : `Prompt matching this specific moment of the narration in ${characterStyle} style, ${selectedCategory} aesthetic`;

  const userPrompt = `Narration Script:
"${narration}"

Story Category / Genre: "${selectedCategory}"
Tone: "${storyTone}"
Duration: ${validDuration}s (${sceneCount} scenes, ${perScene}s each)
Visual Style: "${characterStyle}"

Output JSON:
{
  "title": "Story Title",
  "category": "${selectedCategory}",
  "tone": "${storyTone}",
  "duration": ${validDuration},
  "durationUnit": "s",
  "totalDurationFormatted": "${validDuration}s",
  "narration": "${narration.replace(/"/g, '\\"')}",
  "characters": [
    {
      "name": "Character Name",
      "role": "Lead Protagonist",
      "age": "Age",
      "gender": "Gender",
      "skinTone": "Skin tone",
      "hairStyle": "Hair style",
      "faceStructure": "Face & eyes",
      "bodyType": "Body type",
      "costume": "Costume",
      "accessories": "Accessories",
      "identifyingFeatures": "Distinct features",
      "personality": "Personality",
      "description": "Visual prompt description"
    }
  ],
  "timeline": [
    {
      "scene": 1,
      "duration": "0–${perScene} ${unit}",
      "story": "Story beat summary",
      "spokenLine": "Portion of user narration for this act",
      "prompt": "${promptExample}"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "timeRange": "0–${perScene} ${unit}",
      "storyBeat": "Story beat summary",
      "title": "Act 1 Title",
      "duration": ${isMinutes ? 2.0 : perScene.toFixed(1)},
      "spokenLine": "Portion of user narration for this act",
      "effect": "zoom_in",
      "pixarPrompt": "${promptExample}"
    }
  ],
  "subtitles": [
    "CLEAN UPPERCASE SUBTITLES MATCHING NARRATION"
  ],
  "youtube": {
    "title": "Short Title #Shorts",
    "description": "Engaging description with tags #Shorts #${selectedCategory.replace(/\\s+/g, '')}"
  }
}`;

  try {
    const raw = await callGeminiApi(userPrompt, systemInstruction);
    const parsed = parseJsonFromText(raw);
    parsed.narration = narration;
    parsed.duration = validDuration;
    parsed.durationUnit = unit;
    parsed.characterStyle = characterStyle;
    parsed.category = selectedCategory;
    parsed.tone = storyTone;

    if (!parsed.timeline && parsed.scenes) {
      parsed.timeline = parsed.scenes.map(s => ({
        scene: s.sceneNumber,
        duration: s.timeRange || `${s.duration}s`,
        story: s.storyBeat || s.title,
        spokenLine: s.spokenLine || "",
        prompt: s.pixarPrompt || ""
      }));
    }

    if (!parsed.characters || !Array.isArray(parsed.characters) || parsed.characters.length === 0) {
      parsed.characters = extractFallbackCharacters(narration, selectedCategory, characterStyle);
    }

    return parsed;
  } catch (err) {
    return getOfflineFallbackStoryboard(narration, validDuration, characterStyle, storyTone, unit, selectedCategory);
  }
}

/**
 * Generate classic single-scene story
 */
async function generateStoryWithGemini(prompt, category = "Animation") {
  const systemInstruction = "You are a creative writer for animated cartoon shorts. Return ONLY valid JSON.";
  const userPrompt = `Create a 10s story based on: "${prompt}" in the "${category}" genre. JSON with headline, narration, character1Action, character2Action, sceneDescription, subtitles (4 lines).`;
  try {
    const raw = await callGeminiApi(userPrompt, systemInstruction);
    return parseJsonFromText(raw);
  } catch (_) {
    return {
      headline: `${category} Adventure`,
      narration: `A thrilling tale of ${prompt.slice(0, 30)} that unfolded with wonder, mystery, and an unforgettable journey.`,
      character1Action: "cautious greeting",
      character2Action: "gentle curiosity",
      sceneDescription: `${category} setting with rich atmospheric lighting`,
      subtitles: [
        "AN UNFORGETTABLE JOURNEY",
        "A BRAVE SOUL STEPPED FORTH",
        "A MYSTERIOUS PRESENCE WATCHED",
        "DESTINY WAS WRITTEN"
      ]
    };
  }
}

function getOfflineFallbackStoryboard(prompt, duration, characterStyle, storyTone = "Epic and Cinematic", unit = "s", category = "Animation") {
  const { totalSeconds, sceneCount, perScene } = calculateSceneStructure(duration, unit);
  const validDuration = totalSeconds;
  const selectedCategory = category || "Animation";
  const catLower = selectedCategory.toLowerCase();
  const cleanTopic = prompt.slice(0, 45).trim();
  const isRealistic = characterStyle === "realistic";

  // Category-specific scene beats
  let categoryBeats = [];
  if (catLower === "horror" || cleanTopic.toLowerCase().includes("haunt") || cleanTopic.toLowerCase().includes("ghost")) {
    categoryBeats = [
      { beat: "Approaching the haunted manor", text: "Through the cold mist, the creaking gates of the forgotten house loomed." },
      { beat: "Stepping into the shadowed hall", text: "Footsteps echoed on ancient floorboards as cold air filled the silent room." },
      { beat: "A lantern cuts through darkness", text: "The flickering lantern light cast dancing shadows against wallpapered walls." },
      { beat: "Whispers from the staircase", text: "A faint child's whisper floated down from the winding dark stairs." },
      { beat: "A glowing silhouette appears", text: "In the mirror's reflection, an ethereal translucent silhouette stood silently." },
      { beat: "The ghost girl steps forward", text: "Silver hair floating weightlessly, the spectral girl looked with gentle eyes." },
      { beat: "A secret unspoken message", text: "The spirit reached out a translucent hand, pointing toward a locked music box." },
      { beat: "Unlocking the old secret", text: "The ancient brass key turned, unveiling memories preserved in dust and light." },
      { beat: "A moment of supernatural peace", text: "A warm golden glow replaced the cold shadows as fear turned to empathy." },
      { beat: "Guiding spirit of the house", text: "The ghost smiled softly, fading into starlight as a peaceful guardian of the home." }
    ];
  } else if (catLower === "fantasy") {
    categoryBeats = [
      { beat: "Awakening in enchanted glade", text: `A magical breeze swept through the glowing valley as ${cleanTopic} began.` },
      { beat: "Summoning ancient arcane light", text: "Sparkling runes danced across stone pillars as the crystal staff awakened." },
      { beat: "A mythical companion arrives", text: "Flapping iridescent wings, a companion descended from the canopy." },
      { beat: "Unlocking the celestial portal", text: "Swirling violet mists opened the path between enchanted realms." },
      { beat: "Crossing the bridge of starlight", text: "Steps glowed beneath their feet as starlight formed a shimmering bridge." },
      { beat: "Whispers of the ancient guardians", text: "Ethereal forest guardians offered ancient blessings for the quest." },
      { beat: "Facing the trial of courage", text: "Courage burned brighter than fear in the face of ancient elemental power." },
      { beat: "Unleashing the harmony spell", text: "Light and nature merged in a blinding cascade of golden celestial fire." },
      { beat: "Restoration of the sacred realm", text: "The blighted grove bloomed with thousands of radiant jewel flowers." },
      { beat: "Eternal guardians of wonder", text: "Together, the guardians stood triumphant under the starry twin moons." }
    ];
  } else if (catLower === "mythology" || cleanTopic.toLowerCase().includes("rama")) {
    categoryBeats = [
      { beat: "Sacred forest introduction", text: `${cleanTopic} began beneath ancient sunlit canopies of Dandakaranya.` },
      { beat: "Protagonists journey in motion", text: "Two noble figures walked with quiet dignity through the dense trees." },
      { beat: "Mysterious watcher appears", text: "In the far background, a divine presence watched between ancient trunks." },
      { beat: "Devotion and silent reverence", text: "Eyes filled with awe and deep devotion observed every holy step." },
      { beat: "Awakening of awareness", text: "The forest grew still as a gentle breeze stirred the emerald leaves." },
      { beat: "A peaceful exchange of words", text: "Spoken truths echoed softly, carrying the warmth of eternal brotherhood." },
      { beat: "Drawing closer with humble heart", text: "Step by step, the distance closed with deep respect and humble devotion." },
      { beat: "Approaching with folded hands", text: "With joined palms, a sacred heart stepped forward into the warm light." },
      { beat: "Moment of profound union", text: "A divine meeting of devotion and grace sealed an unbreakable eternal bond." },
      { beat: "Epic closing and divine destiny", text: "The path of destiny opened, shining forever in golden legend." }
    ];
  } else if (catLower === "comedy") {
    categoryBeats = [
      { beat: "A quiet morning goes wrong", text: `It was supposed to be a normal day, until ${cleanTopic} kicked off!` },
      { beat: "The grand overcomplicated plan", text: "With wild enthusiasm, the master plan was put into motion!" },
      { beat: "The first accidental catastrophe", text: "Whoops! One wrong step sent everything tumbling down the stairs!" },
      { beat: "A hilarious chase ensues", text: "Scrambling on slippery tiles, chaos erupted at top speed!" },
      { beat: "The unexpected acrobatic save", text: "A miraculous leap over the furniture defied all laws of physics!" },
      { beat: "The pet watches in total disbelief", text: "Watching the disaster, the deadpan pet slowly shook its head." },
      { beat: "A sudden comical twist", text: "Just when things seemed under control, the pizza box flew into the air!" },
      { beat: "Caught red-handed", text: "Frozen mid-air with cheeks stuffed, the culprit froze with a guilty grin!" },
      { beat: "Laughter breaks the tension", text: "Nobody could stay mad as uncontrollable laughter filled the whole room." },
      { beat: "Happy hilarious ending", text: "Sharing a laugh and a fresh snack, another crazy day ended in smiles!" }
    ];
  } else {
    // Universal Animation / Kids / Adventure / Drama
    categoryBeats = [
      { beat: "The journey begins", text: `Once upon a time, ${cleanTopic} unfolded under open skies.` },
      { beat: "Friends embarking forward", text: "With determined hearts, the companions set off on their grand journey." },
      { beat: "An unexpected discovery", text: "Suddenly, a mysterious path revealed itself through the trees." },
      { beat: "Observing from a distance", text: "Curious eyes watched from the shadows, eager to understand." },
      { beat: "Sharing a meaningful moment", text: "Words of hope and courage brought light to the quiet path." },
      { beat: "A new presence approaches", text: "Stepping out from the foliage, a new friend approached with care." },
      { beat: "A warm greeting of friendship", text: "With open hands and a friendly smile, trust was established." },
      { beat: "Overcoming the challenge together", text: "Side by side, every obstacle faded before their shared resolve." },
      { beat: "Celebration of courage", text: "Golden light illuminated the horizon as victory was achieved." },
      { beat: "A timeless happy closing", text: "Their legend carried forward on the wind, a beacon of joy forever." }
    ];
  }

  const scenes = [];
  const timeline = [];
  const effects = ["zoom_in", "pan", "star_fall", "zoom_out", "shake", "rabbit_discover", "star_launch", "star_shine"];

  for (let i = 1; i <= sceneCount; i++) {
    const template = categoryBeats[(i - 1) % categoryBeats.length];
    const start = ((i - 1) * perScene).toFixed(1).replace(".0", "");
    const end = (i * perScene).toFixed(1).replace(".0", "");
    const timeRange = `${start}–${end} ${unit}`;

    const promptText = isRealistic
      ? `Cinematic 85mm photograph, ${cleanTopic}, Scene ${i}: ${template.beat}, ${selectedCategory} atmosphere, realistic human anatomy and skin pores, 8k photographic lighting`
      : `${characterStyle} visual style, ${cleanTopic}, Scene ${i}: ${template.beat}, ${selectedCategory} aesthetic, dramatic vibrant cinematic lighting, 8k`;

    scenes.push({
      sceneNumber: i,
      timeRange,
      storyBeat: template.beat,
      title: `Act ${i}: ${template.beat}`,
      duration: isMinutes ? 2.0 : parseFloat(perScene.toFixed(1)),
      spokenLine: template.text,
      effect: effects[(i - 1) % effects.length],
      pixarPrompt: promptText
    });

    timeline.push({
      scene: i,
      duration: timeRange,
      story: template.beat,
      spokenLine: template.text,
      prompt: promptText
    });
  }

  const narration = scenes.map(s => s.spokenLine).join(" ");
  const characters = extractFallbackCharacters(prompt, selectedCategory, characterStyle);

  return {
    title: cleanTopic || `${selectedCategory} Short`,
    category: selectedCategory,
    tone: storyTone,
    duration: validDuration,
    durationUnit: unit,
    totalDurationFormatted: `${validDuration} ${unit}`,
    characterStyle,
    narration,
    characters,
    timeline,
    scenes,
    subtitles: scenes.slice(0, 4).map(s => s.spokenLine.toUpperCase()),
    youtube: {
      title: `${cleanTopic} • #${selectedCategory.replace(/\\s+/g, '')} Short`,
      description: `Watch this ${selectedCategory} story about ${cleanTopic}! #Shorts #Story #${selectedCategory.replace(/\\s+/g, '')}`
    }
  };
}

module.exports = {
  generateStoryWithGemini,
  generateStoryboardWithGemini,
  generateStoryboardFromNarration,
  extractFallbackCharacters
};
