const { geminiApiKey } = require("./config");
const { CHARACTER_STYLES } = require("./image-service");

function getRawFallbackStoryboard(ideaPrompt) {
  const p = (ideaPrompt || "").toLowerCase();

  // Story 1: The Little Star's Dream (Primary)
  if (p.includes("star") || p.includes("rabbit") || p.includes("bunny") || p.includes("dream") || p.includes("magical")) {
    return {
      title: "The Little Star's Dream ⭐🐰",
      topic: "Kindness & Dreams",
      scenes: [
        {
          sceneNumber: 1,
          title: "The Falling Star",
          timeRange: "0s – 2s",
          duration: 2.0,
          pixarPrompt: "3D Pixar animation style, a cute glowing golden baby star with expressive crying eyes tumbling down through a magical starry night sky into a deep lush enchanted forest, glowing celestial stardust trail, depth of field, 8k render, masterpiece",
          narration: "Once upon a magical night, a tiny star fell from the sky into a quiet forest.",
          effect: "star_fall"
        },
        {
          sceneNumber: 2,
          title: "The Rabbit's Discovery",
          timeRange: "2s – 4s",
          duration: 2.0,
          pixarPrompt: "3D Pixar animation style, an adorable fluffy white bunny with big curious eyes finding a small glowing golden star crying soft glowing tears on mossy forest ground, warm moonbeams, macro close-up, soft cinematic lighting, 8k render",
          narration: "A cute little rabbit discovered the crying star and said, Don't worry, I'll help you!",
          effect: "rabbit_discover"
        },
        {
          sceneNumber: 3,
          title: "The Magical Flight",
          timeRange: "4s – 7s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, the white bunny jumping high into the air with glowing paws, launching the smiling glowing star back up toward the cosmos, dynamic upward camera angle, swirling golden magic rings, flying flower petals, 8k render",
          narration: "With a magical jump, the little star flew soaring back into the sky!",
          effect: "star_launch"
        },
        {
          sceneNumber: 4,
          title: "You Are My Hero",
          timeRange: "7s – 10s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, radiant golden star twinkling brightly high in the night sky smiling and waving goodbye down to the joyful rabbit on the grassy hill, glowing heart particles, beautiful crescent moon, cinematic 8k render",
          narration: "Before saying goodbye, the star whispered, You are my little hero! Small kindness brings big happiness!",
          effect: "star_shine"
        }
      ],
      narration: "A glowing star fell into the forest! A cute rabbit came to help! With a magical jump, the star flew home! You are my hero!",
      subtitles: [
        "A GLOWING STAR FELL FROM THE SKY",
        "A CUTE RABBIT CAME TO HELP",
        "WITH A MAGIC JUMP IT FLIES HOME",
        "YOU ARE MY HERO KINDNESS WINS"
      ],
      youtube: {
        title: "The Little Star's Dream ⭐🐰 | 3D Pixar Bedtime Story Short",
        description: "Once upon a magical night, a tiny star fell from the sky... A cute rabbit came to the rescue! Even the smallest act of kindness can create the biggest happiness. ❤️ #Shorts #Animation #3D #Pixar #BedtimeStory #Cute #Rabbit",
        tags: ["shorts", "animation", "3d", "pixar", "littlestardream", "rabbit", "bedtimestory", "cute", "heartwarming"]
      }
    };
  }

  // Story 2: The Brave Little Lion (4 Scenes - 10s)
  if (p.includes("lion") || p.includes("roar") || p.includes("cub") || p.includes("brave")) {
    return {
      title: "The Brave Little Lion 🦁👑",
      topic: "Courage & Jungle Adventure",
      scenes: [
        {
          sceneNumber: 1,
          title: "The Tiny Cub's Dream",
          timeRange: "0s – 2s",
          duration: 2.0,
          pixarPrompt: "3D Pixar animation style, adorable golden lion cub with big shiny amber eyes practicing an epic roar on a mossy jungle rock, lush African savannah canopy in background, warm golden sunlight, 8k render",
          narration: "A tiny lion cub dreamed of having the mightiest roar in the jungle!",
          effect: "zoom_in"
        },
        {
          sceneNumber: 2,
          title: "The Squeaky Roar",
          timeRange: "2s – 4s",
          duration: 2.0,
          pixarPrompt: "3D Pixar animation style, little lion cub opening mouth wide to roar but only a tiny squeak comes out, colorful funny jungle birds giggling on tree branch, comical expression, 8k render",
          narration: "He took a deep breath, puffed his chest, and let out a funny squeak!",
          effect: "pan"
        },
        {
          sceneNumber: 3,
          title: "The True Courage Moment",
          timeRange: "4s – 7s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, little lion cub bravely leaping to rescue a stranded baby monkey from a rushing jungle stream, heroic dynamic action angle, splashing water, dramatic cinematic lighting, 8k render",
          narration: "When a baby monkey needed help, true courage woke up inside his heart!",
          effect: "crane_up"
        },
        {
          sceneNumber: 4,
          title: "The King's Mighty Roar",
          timeRange: "7s – 10s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, heroic lion cub standing atop Pride Rock surrounded by cheering jungle animals, sunset horizon, magnificent golden mane glowing in twilight, 8k masterpiece render",
          narration: "With a mighty roar that shook the trees, a true little king was born!",
          effect: "celestial"
        }
      ],
      narration: "A tiny lion cub dreamed of having the mightiest roar in the jungle! When a friend needed help, true courage woke up inside his heart. With a mighty roar, a true little king was born!",
      subtitles: [
        "A TINY LION DREAMS BIG",
        "A SQUEAKY LITTLE ROAR",
        "TRUE COURAGE COMES FROM WITHIN",
        "A MIGHTY LITTLE KING IS BORN"
      ],
      youtube: {
        title: "The Brave Little Lion 🦁 | 3D Pixar Bedtime Story Short",
        description: "A tiny lion cub learns that true courage comes from helping others! #Shorts #Animation #3D #Pixar #Lion #KidsStory",
        tags: ["shorts", "animation", "3d", "pixar", "lion", "courage", "jungle"]
      }
    };
  }

  // Story 3: Panda Master's Kung Fu Quest (4 Scenes - 10s)
  if (p.includes("panda") || p.includes("kung fu") || p.includes("bamboo") || p.includes("martial")) {
    return {
      title: "Panda Master: Kung Fu Quest 🐼🥋",
      topic: "Action & Comedy",
      scenes: [
        {
          sceneNumber: 1,
          title: "The Bamboo Training",
          timeRange: "0s – 2s",
          duration: 2.0,
          pixarPrompt: "3D Pixar animation style, cute chubby giant panda wearing red martial arts silk pants balancing on a single bamboo stalk in misty ancient Chinese mountain forest, sunbeams, 8k render",
          narration: "High in the misty bamboo forest, a chubby panda practiced the secret dragon balance!",
          effect: "zoom_in"
        },
        {
          sceneNumber: 2,
          title: "The Clumsy Tumble",
          timeRange: "2s – 4s",
          duration: 2.0,
          pixarPrompt: "3D Pixar style, chubby panda losing balance and rolling down a green grassy hill like a giant bowling ball, comical shocked expression, flying bamboo leaves, 8k render",
          narration: "Whoops! The bamboo snapped, and the master rolled down the hill like a giant dumpling!",
          effect: "pan"
        },
        {
          sceneNumber: 3,
          title: "The Dumpling Strike",
          timeRange: "4s – 7s",
          duration: 3.0,
          pixarPrompt: "3D Pixar style, rolling panda turning into an acrobatic cannonball kick, catching a flying golden bamboo bowl in midair, dynamic slow-motion martial arts angle, 8k render",
          narration: "Bouncing off a rock with lightning speed, he turned the tumble into a master strike!",
          effect: "crane_up"
        },
        {
          sceneNumber: 4,
          title: "The Master's Feast",
          timeRange: "7s – 10s",
          duration: 3.0,
          pixarPrompt: "3D Pixar style, panda sitting proudly at temple steps eating steamy delicious dumplings, smiling with victory pose, glowing lanterns, golden sunset, 8k masterpiece render",
          narration: "Flawless victory! Every great master starts with a delicious snack!",
          effect: "celestial"
        }
      ],
      narration: "In the misty bamboo forest, a chubby panda practiced secret dragon balance! Whoops, rolling down the hill like a dumpling! But with a master bounce, he caught the prize! Every great master starts with a snack!",
      subtitles: [
        "SECRET BAMBOO BALANCE TRAINING",
        "WHOOPS A GIANT DUMPLING ROLL",
        "THE UNEXPECTED CANNONBALL BOUNCE",
        "FLAWLESS VICTORY AND DUMPLINGS"
      ],
      youtube: {
        title: "Panda Master's Kung Fu Quest 🐼🥋 | 3D Cartoon Short",
        description: "When a clumsy panda turns a giant hill roll into the ultimate kung fu move! #Shorts #Animation #3D #Pixar #Panda #KungFu #Comedy",
        tags: ["shorts", "animation", "3d", "pixar", "panda", "kungfu", "funny"]
      }
    };
  }

  // Story 4: Cosmic Puppy's Moon Journey (4 Scenes - 10s)
  if (p.includes("space") || p.includes("puppy") || p.includes("dog") || p.includes("moon") || p.includes("rocket") || p.includes("cosmic")) {
    return {
      title: "Cosmic Puppy's Moon Journey 🚀🐶",
      topic: "Space Wonder & Adventure",
      scenes: [
        {
          sceneNumber: 1,
          title: "The Rocket Backyard Launch",
          timeRange: "0s – 2s",
          duration: 2.0,
          pixarPrompt: "3D Pixar animation style, adorable golden retriever puppy wearing a transparent glass astronaut helmet sitting inside a colorful red rocket toy blasting into starry night sky, rainbow rocket smoke trail, 8k render",
          narration: "With a spark of imagination, a brave little puppy blasted off into the starry cosmos!",
          effect: "star_fall"
        },
        {
          sceneNumber: 2,
          title: "Zero Gravity Float",
          timeRange: "2s – 4s",
          duration: 2.0,
          pixarPrompt: "3D Pixar style, cute puppy floating playfully in zero gravity chasing glowing floating cosmic dog treats, earth visible below in deep space, cosmic stardust, 8k render",
          narration: "Floating freely through space, he chased sparkling floating stardust bones!",
          effect: "pan"
        },
        {
          sceneNumber: 3,
          title: "The Moon Landing",
          timeRange: "4s – 7s",
          duration: 3.0,
          pixarPrompt: "3D Pixar style, puppy landing on the glowing surface of the moon, making cute paw prints in silvery moon dust, looking at towering crater with wonder, glowing earth in distance, 8k render",
          narration: "One giant leap for puppy-kind, landing gently on the silver glowing moon!",
          effect: "crane_up"
        },
        {
          sceneNumber: 4,
          title: "The Starlight Howl",
          timeRange: "7s – 10s",
          duration: 3.0,
          pixarPrompt: "3D Pixar style, golden puppy sitting on moon hill howling happily at a shooting star, twinkling constellations smiling back, heartwarming cinematic lighting, 8k masterpiece render",
          narration: "Howling at the shooting stars, the cosmic puppy found home among the galaxies!",
          effect: "celestial"
        }
      ],
      narration: "A brave little puppy blasted off into the starry cosmos! Floating in zero gravity, chasing stardust bones! One giant leap landing on the silver moon! The universe is full of wonder for a brave heart!",
      subtitles: [
        "BLAST OFF INTO THE COSMOS",
        "ZERO GRAVITY FLOATING PUPPY",
        "ONE GIANT LEAP ON THE MOON",
        "THE UNIVERSE IS FULL OF WONDER"
      ],
      youtube: {
        title: "Cosmic Puppy's Moon Journey 🚀🐶 | 3D Pixar Short",
        description: "A brave golden retriever puppy takes a magical rocket ride to the moon! #Shorts #Animation #3D #Pixar #Puppy #Space #Cute",
        tags: ["shorts", "animation", "3d", "pixar", "space", "puppy", "dog", "cute"]
      }
    };
  }

  // Story 5: Apple vs Carrot Food Fight (Reference Video)
  if (p.includes("apple") || p.includes("carrot") || p.includes("kitchen") || p.includes("fruit") || p.includes("blender")) {
    return {
      title: "Apple vs Carrot: The Kitchen Battle 🥊🍎🥕",
      topic: "Food Fight",
      scenes: [
        {
          sceneNumber: 1,
          title: "The Standoff",
          timeRange: "0s – 3s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, an angry red apple with boxing gloves squaring up against a cute angry orange carrot with fists, macro photography, shallow depth of field, warm kitchen wooden countertop, cinematic soft lighting, 8k, highly detailed render",
          narration: "On a quiet kitchen table, the fiercest food rivalry was about to explode!",
          effect: "cinematic"
        },
        {
          sceneNumber: 2,
          title: "The Sudden Twist",
          timeRange: "3s – 6s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, human chef in floral apron holding a giant sharp steel knife chopping an apple on a cutting board, dramatic motion blur, high action cinematic shot, warm lighting, 8k",
          narration: "Suddenly, the chef steps in with a giant shiny knife! Slice!",
          effect: "shake"
        },
        {
          sceneNumber: 3,
          title: "The Blender Smoothie Ending",
          timeRange: "6s – 9s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, sliced apple and carrot chunks swirling comically inside a transparent kitchen blender, comical shocked expressions, bright colorful smoothie splashing, 8k render",
          narration: "No winner today! Both fighters get tossed into the blender for a delicious morning smoothie!",
          effect: "zoom_out"
        }
      ],
      narration: "On a quiet kitchen table, the fiercest food rivalry was about to explode! Suddenly, the chef steps in with a giant shiny knife! Slice! No winner today, both fighters get tossed into the blender for a delicious morning smoothie!",
      subtitles: [
        "THE FIERCEST FOOD RIVALRY",
        "THE FIGHT IS ABOUT TO START",
        "SUDDENLY A GIANT KNIFE SLICES IN",
        "NO WINNER TODAY SMOOTHIE TIME"
      ],
      youtube: {
        title: "Apple vs Carrot: Kitchen Battle 😂 | 3D Cartoon Short",
        description: "When an apple and a carrot try boxing on the kitchen counter, but the chef has other plans! 🍎🥕🍹 #Shorts #Cartoon #Animation #3D #Pixar #Comedy",
        tags: ["shorts", "cartoon", "animation", "3d", "pixar", "foodfight", "funny"]
      }
    };
  }

  // Story 3: Man vs Lion Jungle Showdown
  if (p.includes("lion") || p.includes("forest") || p.includes("tiger") || p.includes("jungle") || p.includes("man")) {
    return {
      title: "Man vs Lion: Deep Forest Showdown 🦁🥋",
      topic: "Jungle Battle",
      scenes: [
        {
          sceneNumber: 1,
          title: "The Jungle Encounter",
          timeRange: "0s – 3s",
          duration: 3.0,
          pixarPrompt: "3D Pixar animation style, a courageous martial arts warrior facing off against a majestic powerful roaring lion surrounded by towering lush jungle trees, cinematic lighting with sun rays through canopy, depth of field, 8k render",
          narration: "Deep inside the uncharted jungle, a lone warrior comes face to face with the king of beasts!",
          effect: "cinematic"
        },
        {
          sceneNumber: 2,
          title: "The Pounce & Dodge",
          timeRange: "3s – 6s",
          duration: 3.0,
          pixarPrompt: "3D Pixar style, roaring lion leaping through the air with claws extended, martial arts warrior doing an acrobatic backflip dodge, dynamic action camera angle, flying leaves and dust, 8k render",
          narration: "The lion roars and lunges forward! But the warrior dodges with lightning-fast martial arts reflexes!",
          effect: "shake"
        },
        {
          sceneNumber: 3,
          title: "The Respectful Truce",
          timeRange: "6s – 9s",
          duration: 3.0,
          pixarPrompt: "3D Pixar style, the warrior and the lion sitting side by side resting against a giant tree sharing tropical fruits, comical peaceful expressions, golden sunset glowing through the forest, 8k render",
          narration: "Game recognize game! An epic battle turns into the most unexpected forest friendship!",
          effect: "zoom_out"
        }
      ],
      narration: "Deep inside the uncharted jungle, a lone warrior comes face to face with the king of beasts! The ferocious lion roars and lunges forward! But the warrior dodges with lightning reflexes! Game recognize game, an epic battle turns into an unexpected friendship!",
      subtitles: [
        "DEEP IN THE UNCHARTED JUNGLE!",
        "A WARRIOR MEETS THE KING OF BEASTS!",
        "THE LION LUNGES WITH A MIGHTY ROAR!",
        "RESPECT! AN UNEXPECTED FRIENDSHIP!"
      ],
      youtube: {
        title: "Man vs Lion: Deep Forest Showdown 🦁🥋 | 3D Cartoon Short",
        description: "An epic 3D cartoon battle between a brave warrior and a wild lion in the deep jungle! 🌲🦁 #Shorts #Cartoon #3D #Animation #Lion #Action",
        tags: ["shorts", "cartoon", "animation", "3d", "lion", "forest", "action"]
      }
    };
  }

  // Fallback Generic Story
  const cleanPrompt = (ideaPrompt || "3D Pixar Cartoon").trim();
  return {
    title: `${cleanPrompt} 🎬✨`,
    topic: cleanPrompt,
    scenes: [
      {
        sceneNumber: 1,
        title: "The Opening",
        timeRange: "0s – 3s",
        duration: 3.0,
        pixarPrompt: `3D Pixar animation style, vibrant characters and environment for '${cleanPrompt}', cinematic lighting, depth of field, expressive facial expressions, 8k render`,
        narration: `It was an ordinary day, until an incredible moment began with ${cleanPrompt}!`,
        effect: "cinematic"
      },
      {
        sceneNumber: 2,
        title: "The Action Twist",
        timeRange: "3s – 6s",
        duration: 3.0,
        pixarPrompt: `3D Pixar animation style, dramatic action sequence and sudden surprise twist during '${cleanPrompt}', dynamic camera angle, motion blur, 8k render`,
        narration: "Out of nowhere, an unexpected twist turned everything completely upside down!",
        effect: "shake"
      },
      {
        sceneNumber: 3,
        title: "The Funny Climax",
        timeRange: "6s – 9s",
        duration: 3.0,
        pixarPrompt: `3D Pixar animation style, hilarious celebratory resolution for '${cleanPrompt}', colorful environment, joyful expressions, 8k render`,
        narration: "What an unforgettable finish! You never saw this ending coming!",
        effect: "zoom_out"
      }
    ],
    narration: `It was an ordinary day, until an incredible moment began with ${cleanPrompt}! Out of nowhere, an unexpected twist turned everything upside down! What an unforgettable finish!`,
    subtitles: [
      `GET READY FOR ${cleanPrompt.slice(0, 24).toUpperCase()}!`,
      "THE TENSION IS BUILDING UP!",
      "AN UNEXPECTED ACTION TWIST!",
      "WHAT AN UNBELIEVABLE FINISH!"
    ],
    youtube: {
      title: `${cleanPrompt} 🎬 | 3D Cartoon Short`,
      description: `Watch what happens in this 3D cartoon short about ${cleanPrompt}! #Shorts #Cartoon #3D #Animation`,
      tags: ["shorts", "cartoon", "animation", "3d", "viral", "comedy"]
    }
  };
}

function getFallbackStoryboard(ideaPrompt, targetDuration = 10, characterStyle = "stylized") {
  const raw = getRawFallbackStoryboard(ideaPrompt);
  return scaleStoryboardToDuration(raw, targetDuration, characterStyle);
}

async function generateStoryboardWithGemini(ideaPrompt, targetDuration = 10, characterStyle = "stylized") {
  const apiKey = process.env.GEMINI_API_KEY || geminiApiKey;
  // Strictly enforce MAXIMUM 20 seconds
  const dur = Math.min(20, Math.max(5, parseInt(targetDuration, 10) || 10));

  let sceneCount = 4;
  let timePerScene = 2.5;

  if (dur <= 6) {
    sceneCount = 2;
    timePerScene = 2.5;
  } else if (dur <= 11) {
    sceneCount = 4;
    timePerScene = 2.5;
  } else if (dur <= 16) {
    sceneCount = 4;
    timePerScene = 3.75;
  } else {
    // 17s - 20s (MAX 20s)
    sceneCount = 5;
    timePerScene = Math.round((dur / 5) * 10) / 10;
  }

  const styleModifier = CHARACTER_STYLES[characterStyle] || CHARACTER_STYLES["stylized"];

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.log(`ℹ️ Using intelligent Storyboard generator (${dur}s max duration, ${sceneCount} scenes, style: ${characterStyle})...`);
    return getFallbackStoryboard(ideaPrompt, dur, characterStyle);
  }

  const systemInstruction = `
You are a senior animation director creating viral YouTube Shorts (9:16 vertical, exact ${dur} seconds total, maximum 20 seconds).
Visual Character Style Required: "${characterStyle}".
Style details: ${styleModifier}.
Every scene's "pixarPrompt" MUST explicitly start with: "${styleModifier}, ...".

Given the user's idea or story, generate a complete multi-scene Storyboard with exactly ${sceneCount} sequential scenes in strictly valid JSON.
Each scene must have duration approx ${timePerScene}s totaling exactly ${dur} seconds.
Format must be exactly:
{
  "title": "Short catchy title with emoji",
  "topic": "2-3 word topic",
  "duration": ${dur},
  "characterStyle": "${characterStyle}",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene 1 Title",
      "timeRange": "0s - ${timePerScene}s",
      "duration": ${timePerScene},
      "pixarPrompt": "${styleModifier}, detailed scene visual prompt describing characters, lighting, actions, 8k render",
      "narration": "Energetic 1-sentence narration for Scene 1",
      "effect": "star_fall or rabbit_discover or star_launch or star_shine or zoom_in or zoom_out or shake or pan"
    }
  ],
  "narration": "Smooth continuous voiceover narration covering all scenes naturally (under ${dur} seconds)",
  "subtitles": [
    "PUNCHY ALL-CAPS SHORT SUBTITLE 1",
    "PUNCHY ALL-CAPS SHORT SUBTITLE 2"
  ],
  "youtube": {
    "title": "Clickable viral YouTube Shorts title with emoji",
    "description": "Engaging description with emojis and trending hashtags (#Shorts #Animation #Viral)",
    "tags": ["shorts", "cartoon", "animation", "viral"]
  }
}
Output ONLY valid JSON.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${ideaPrompt} (Duration: ${dur} seconds, Style: ${characterStyle})` }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      console.warn(`Gemini API returned status ${response.status}. Using intelligent fallback storyboard.`);
      return getFallbackStoryboard(ideaPrompt, dur, characterStyle);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini API");

    const parsed = JSON.parse(rawText);
    parsed.duration = dur;
    parsed.characterStyle = characterStyle;
    return parsed;
  } catch (err) {
    console.warn("Notice: Gemini storyboard request failed (" + err.message + "). Using intelligent fallback.");
    return getFallbackStoryboard(ideaPrompt, dur, characterStyle);
  }
}

function scaleStoryboardToDuration(sb, targetDuration = 10, characterStyle = "stylized") {
  // Strictly enforce MAXIMUM 20 seconds
  const dur = Math.min(20, Math.max(5, parseInt(targetDuration, 10) || 10));
  let targetSceneCount = 4;
  let defaultDuration = 2.5;

  if (dur <= 6) {
    targetSceneCount = 2;
    defaultDuration = 2.5;
  } else if (dur <= 11) {
    targetSceneCount = 4;
    defaultDuration = 2.5;
  } else if (dur <= 16) {
    targetSceneCount = 4;
    defaultDuration = 3.75;
  } else {
    targetSceneCount = 5;
    defaultDuration = Math.round((dur / 5) * 10) / 10;
  }

  const styleModifier = CHARACTER_STYLES[characterStyle] || CHARACTER_STYLES["stylized"];
  const motionEffects = ["star_fall", "rabbit_discover", "star_launch", "star_shine", "zoom_in", "zoom_out", "shake", "pan"];
  const currentScenes = sb.scenes || [];
  const scenes = [];

  for (let i = 0; i < targetSceneCount; i++) {
    const sceneNum = i + 1;
    let base = currentScenes[i];
    if (!base && currentScenes.length > 0) {
      base = {
        title: `Scene ${sceneNum}: The Big Climax`,
        pixarPrompt: `${styleModifier}, dramatic continuation and heartwarming triumph for '${sb.topic || sb.title}', 8k render`,
        narration: "And together, an unforgettable magical celebration lighted up the entire world!",
        effect: motionEffects[i % motionEffects.length]
      };
    } else if (!base) {
      base = {
        title: `Scene ${sceneNum}`,
        pixarPrompt: `${styleModifier}, vibrant colorful scene ${sceneNum}, 8k masterpiece render`,
        narration: `A magical moment unfolds in Scene ${sceneNum}!`,
        effect: motionEffects[i % motionEffects.length]
      };
    }

    let p = base.pixarPrompt || base.title;
    if (!p.toLowerCase().includes(characterStyle.toLowerCase())) {
      p = `${styleModifier}, ${p}`;
    }

    scenes.push({
      sceneNumber: sceneNum,
      title: base.title || `Scene ${sceneNum}`,
      timeRange: "",
      duration: defaultDuration,
      pixarPrompt: p,
      narration: base.narration || "",
      effect: base.effect || motionEffects[i % motionEffects.length]
    });
  }

  // Calculate clean time ranges
  let accumulatedTime = 0;
  scenes.forEach(sc => {
    const start = accumulatedTime;
    accumulatedTime += sc.duration;
    sc.timeRange = `${start.toFixed(1).replace(/\.0$/, "")}s – ${accumulatedTime.toFixed(1).replace(/\.0$/, "")}s`;
  });

  sb.duration = dur;
  sb.characterStyle = characterStyle;
  sb.scenes = scenes;
  return sb;
}

function getFallbackStoryboardFromNarration(narrationText, targetDuration = 10, characterStyle = "stylized") {
  // Strictly enforce MAXIMUM 20 seconds
  const dur = Math.min(20, Math.max(5, parseInt(targetDuration, 10) || 10));
  let targetSceneCount = 4;
  let defaultDuration = 2.5;

  if (dur <= 6) {
    targetSceneCount = 2;
    defaultDuration = 2.5;
  } else if (dur <= 11) {
    targetSceneCount = 4;
    defaultDuration = 2.5;
  } else if (dur <= 16) {
    targetSceneCount = 4;
    defaultDuration = 3.75;
  } else {
    targetSceneCount = 5;
    defaultDuration = Math.round((dur / 5) * 10) / 10;
  }

  const styleModifier = CHARACTER_STYLES[characterStyle] || CHARACTER_STYLES["stylized"];
  const text = (narrationText || "").trim();
  const rawParts = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let beats = [];
  if (rawParts.length >= targetSceneCount) {
    beats = rawParts.slice(0, targetSceneCount);
  } else {
    const clauses = text.split(/(?:,\s*|\s+(?:and|then|with|as|so)\s+|[!?.])/i).filter(s => s.trim().length > 0);
    for (let c of clauses) {
      if (beats.length < targetSceneCount) beats.push(c);
    }
    while (beats.length < targetSceneCount) {
      beats.push(`Exciting Act ${beats.length + 1} of the adventure`);
    }
  }

  const motionEffects = ["star_fall", "rabbit_discover", "star_launch", "star_shine", "zoom_in", "zoom_out", "shake", "pan"];

  let accumulatedTime = 0;
  const scenes = beats.map((beat, index) => {
    const sceneNum = index + 1;
    const start = accumulatedTime;
    accumulatedTime += defaultDuration;
    const timeRange = `${start.toFixed(1).replace(/\.0$/, "")}s – ${accumulatedTime.toFixed(1).replace(/\.0$/, "")}s`;

    const words = beat.replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 2);
    let title = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    if (!title || title.length < 3) title = `Scene ${sceneNum}: The Adventure`;

    let effect = motionEffects[index % motionEffects.length];
    const bLower = beat.toLowerCase();
    if (bLower.includes("fall") || bLower.includes("drop") || bLower.includes("slide") || bLower.includes("sky")) effect = "star_fall";
    else if (bLower.includes("look") || bLower.includes("find") || bLower.includes("discover") || bLower.includes("forest") || bLower.includes("walk")) effect = "rabbit_discover";
    else if (bLower.includes("jump") || bLower.includes("fly") || bLower.includes("soar") || bLower.includes("launch") || bLower.includes("rocket") || bLower.includes("leap")) effect = "star_launch";
    else if (bLower.includes("shine") || bLower.includes("wave") || bLower.includes("goodbye") || bLower.includes("smile") || bLower.includes("hero") || bLower.includes("moon")) effect = "star_shine";

    const pixarPrompt = `${styleModifier}, scene representing: '${beat}', expressive character emotions, beautiful cinematic lighting, depth of field, vibrant colors, 8k render masterpiece`;

    return {
      sceneNumber: sceneNum,
      title: title,
      timeRange: timeRange,
      duration: defaultDuration,
      pixarPrompt: pixarPrompt,
      narration: beat,
      effect: effect
    };
  });

  const subtitles = beats.map(b => {
    return b.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}]/gu, "")
      .replace(/[^\w\s]/g, "")
      .trim()
      .toUpperCase()
      .slice(0, 36);
  });

  const firstBeatWords = beats[0].replace(/[^\w\s]/g, "").split(/\s+/).slice(0, 4).join(" ");
  const title = `${firstBeatWords || "Animated Story"} 🎬✨`;

  return {
    title: title,
    topic: "Cartoon Short",
    duration: dur,
    characterStyle: characterStyle,
    scenes: scenes,
    narration: text,
    subtitles: subtitles,
    youtube: {
      title: `${title} | Cartoon Short`,
      description: `${text}\n\n#Shorts #Animation #Viral`,
      tags: ["shorts", "animation", "viral"]
    }
  };
}

async function generateStoryboardFromNarration(narrationText, targetDuration = 10, characterStyle = "stylized") {
  // Strictly enforce MAXIMUM 20 seconds
  const dur = Math.min(20, Math.max(5, parseInt(targetDuration, 10) || 10));
  let targetSceneCount = 4;
  let defaultDuration = 2.5;

  if (dur <= 6) {
    targetSceneCount = 2;
    defaultDuration = 2.5;
  } else if (dur <= 11) {
    targetSceneCount = 4;
    defaultDuration = 2.5;
  } else if (dur <= 16) {
    targetSceneCount = 4;
    defaultDuration = 3.75;
  } else {
    targetSceneCount = 5;
    defaultDuration = Math.round((dur / 5) * 10) / 10;
  }

  const apiKey = process.env.GEMINI_API_KEY || geminiApiKey;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.log(`ℹ️ Parsing narration script into ${targetSceneCount} scenes (${dur}s duration, style: ${characterStyle})...`);
    return getFallbackStoryboardFromNarration(narrationText, dur, characterStyle);
  }

  const styleModifier = CHARACTER_STYLES[characterStyle] || CHARACTER_STYLES["stylized"];

  const systemInstruction = `
You are a senior animation director.
Given the user's EXACT voiceover narration script for a ${dur}-second vertical YouTube Short (maximum 20 seconds), break it down chronologically into exactly ${targetSceneCount} sequential scenes:
Each scene duration should be approx ${defaultDuration}s totaling ${dur}s.
Visual Character Style: "${characterStyle}". Description: ${styleModifier}.
Each scene's "pixarPrompt" MUST start with: "${styleModifier}, ...".

For each scene:
- title: 2-4 word catchy title
- duration: number (${defaultDuration})
- pixarPrompt: extremely detailed prompt ready for image generation, describing characters, expressions, lighting, environment, 8k render
- effect: camera motion (choose best fit: "star_fall", "rabbit_discover", "star_launch", "star_shine", "zoom_in", "zoom_out", "shake", "pan")
- narration: the segment of the narration script corresponding to this scene

Also return ${targetSceneCount} punchy all-caps subtitle lines (clean text, NO emojis) and YouTube title & description.
Output strictly valid JSON with keys: "title", "duration", "characterStyle", "scenes", "narration", "subtitles", "youtube".
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Narration script:\n${narrationText}\nTarget total duration: ${dur} seconds\nCharacter style: ${characterStyle}` }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      return getFallbackStoryboardFromNarration(narrationText, dur, characterStyle);
    }
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return getFallbackStoryboardFromNarration(narrationText, dur, characterStyle);
    const parsed = JSON.parse(rawText);
    parsed.narration = narrationText;
    parsed.duration = dur;
    parsed.characterStyle = characterStyle;
    return parsed;
  } catch (err) {
    return getFallbackStoryboardFromNarration(narrationText, dur, characterStyle);
  }
}

// Single-scene story generator (legacy)
async function generateStoryWithGemini(ideaPrompt) {
  const sb = await generateStoryboardWithGemini(ideaPrompt);
  return {
    headline: sb.scenes?.[0]?.title || "CARTOON SHORT",
    punchline: sb.scenes?.[sb.scenes.length - 1]?.title || "WATCH TILL END!",
    narration: sb.narration,
    subtitles: sb.subtitles,
    primaryEmoji: "⭐",
    secondaryEmoji: "🐰",
    backgroundColor: "midnightblue",
    groundColor: "darkgreen",
    youtube: sb.youtube
  };
}

module.exports = {
  generateStoryWithGemini,
  generateStoryboardWithGemini,
  generateStoryboardFromNarration
};
