/**
 * AI Video Studio & Advanced Video Editor (CapCut & Premiere Pro Suite)
 * Dual-Mode Engine connecting AI Generation to a Full NLE Video Editing Suite.
 */

(function () {
  "use strict";

  // Master Studio & Editor State
  const state = {
    currentMode: "ai-studio", // "ai-studio" or "advanced-editor"
    theme: localStorage.getItem("studio_theme") || "dark",
    projectTitle: "The Little Star's Dream ⭐",
    aspectRatio: "9:16",
    duration: 20,
    selectedStyle: "realistic",
    selectedCategory: "Animation",
    customCategory: "",
    characterDetails: "",
    selectedLanguage: "telugu",
    selectedVoice: "te-IN-MohanNeural",
    bgmVolume: 0.18,
    voiceVolume: 1.0,
    audioSpeed: 1.0,
    storyboard: null,
    activeSceneIndex: 0,
    currentTime: 0,
    isPlaying: false,
    zoomLevel: 100,

    // Live Video Adjustments (Applied via CSS Filters & Transforms, and sent to FFmpeg)
    adjustments: {
      scale: 100,
      posX: 0,
      posY: 0,
      rotation: 0,
      opacity: 100,
      flipH: false,
      flipV: false,
      brightness: 100,
      contrast: 110,
      saturation: 120,
      exposure: 0,
      temperature: 0,
      tint: 0,
      vignette: 20,
      filter: "normal",
      filterIntensity: 100,
      effect: "none",
      effectIntensity: 50,
      transition: "fade",
      transitionDuration: 0.4,
      animation: "pan-right",
      animEasing: "ease-in-out",
      font: "'Noto Sans Telugu', sans-serif",
      fontSize: 38,
      textColor: "#fef08a",
      outlineColor: "#000000",
      textAlign: "center"
    },

    textLayers: [
      { id: 1, text: "మాయాజాల సాహసం (Magical Adventure)", x: 20, y: 15, size: 28, color: "#fef08a", font: "'Noto Sans Telugu', sans-serif" }
    ],

    stickers: [],

    // Multi-Character Studio State
    characters: [],
    activeCharacterId: "char_rama",
    activeCharacterView: "front",
    activePreviewImageUrl: "/storage/images/character_ref.png",

    undoStack: [],
    redoStack: []
  };

  // DOM Elements Cache
  const el = {
    // Views
    mainAiStudioView: document.getElementById("mainAiStudioView"),
    advancedVideoEditorView: document.getElementById("advancedVideoEditorView"),
    btnOpenAdvancedEditor: document.getElementById("btnOpenAdvancedEditor"),
    btnMainOpenEditorSide: document.getElementById("btnMainOpenEditorSide"),
    btnBackToAiStudio: document.getElementById("btnBackToAiStudio"),

    // View A (Main AI Studio)
    mainProjectTitle: document.getElementById("mainProjectTitle"),
    btnMainThemeToggle: document.getElementById("btnMainThemeToggle"),
    btnMainPublishYt: document.getElementById("btnMainPublishYt"),
    mainStyleCards: document.querySelectorAll(".style-mini-card"),
    mainActiveStyleLabel: document.getElementById("mainActiveStyleLabel"),
    mainIdeaPromptInput: document.getElementById("mainIdeaPromptInput"),
    btnMainAiSuggestIdeas: document.getElementById("btnMainAiSuggestIdeas"),
    mainSelectDuration: document.getElementById("mainSelectDuration"),
    mainSelectLanguage: document.getElementById("mainSelectLanguage"),
    mainSelectVoice: document.getElementById("mainSelectVoice"),
    btnMainGenerateStory: document.getElementById("btnMainGenerateStory"),
    btnMainGenerateAllImages: document.getElementById("btnMainGenerateAllImages"),
    btnMainAnimateAllScenes: document.getElementById("btnMainAnimateAllScenes"),
    batchProgressWrapper: document.getElementById("batchProgressWrapper"),
    batchProgressLabel: document.getElementById("batchProgressLabel"),
    batchProgressPercent: document.getElementById("batchProgressPercent"),
    batchProgressFill: document.getElementById("batchProgressFill"),
    mainScenesList: document.getElementById("mainScenesList"),
    mainVideoContainer: document.getElementById("mainVideoContainer"),
    mainStudioPlayer: document.getElementById("mainStudioPlayer"),
    btnMainRenderVideo: document.getElementById("btnMainRenderVideo"),

    // View B (Advanced Video Editor)
    editorProjectTitleInput: document.getElementById("editorProjectTitleInput"),
    editorAutosaveTag: document.getElementById("editorAutosaveTag"),
    editorBtnUndo: document.getElementById("editorBtnUndo"),
    editorBtnRedo: document.getElementById("editorBtnRedo"),
    editorBtnPreview: document.getElementById("editorBtnPreview"),
    editorBtnSaveProject: document.getElementById("editorBtnSaveProject"),
    editorBtnExportMp4: document.getElementById("editorBtnExportMp4"),
    btnEditorThemeToggle: document.getElementById("btnEditorThemeToggle"),

    // Categories Nav & Inspector
    navCategoryItems: document.querySelectorAll(".nav-category-item"),
    categoryViews: document.querySelectorAll(".category-view"),
    mediaFileInput: document.getElementById("mediaFileInput"),
    mediaDropzone: document.getElementById("mediaDropzone"),
    editorSceneMediaList: document.getElementById("editorSceneMediaList"),
    mediaScaleRange: document.getElementById("mediaScaleRange"),
    valMediaScale: document.getElementById("valMediaScale"),
    mediaPosX: document.getElementById("mediaPosX"),
    mediaPosY: document.getElementById("mediaPosY"),
    mediaRotateRange: document.getElementById("mediaRotateRange"),
    valMediaRotate: document.getElementById("valMediaRotate"),
    mediaOpacityRange: document.getElementById("mediaOpacityRange"),
    valMediaOpacity: document.getElementById("valMediaOpacity"),
    btnFlipH: document.getElementById("btnFlipH"),
    btnFlipV: document.getElementById("btnFlipV"),

    // Text & Captions
    btnAddTextLayer: document.getElementById("btnAddTextLayer"),
    activeTextContent: document.getElementById("activeTextContent"),
    activeTextFont: document.getElementById("activeTextFont"),
    activeTextSize: document.getElementById("activeTextSize"),
    valActiveTextSize: document.getElementById("valActiveTextSize"),
    activeTextColor: document.getElementById("activeTextColor"),
    activeTextOutlineColor: document.getElementById("activeTextOutlineColor"),
    btnTextAlignCenter: document.getElementById("btnTextAlignCenter"),
    btnTextAlignLeft: document.getElementById("btnTextAlignLeft"),
    btnTextAlignRight: document.getElementById("btnTextAlignRight"),
    captionsTimelineList: document.getElementById("captionsTimelineList"),

    // Filters & Effects
    filterOptionCards: document.querySelectorAll(".filter-option-card"),
    filterIntensityRange: document.getElementById("filterIntensityRange"),
    valFilterIntensity: document.getElementById("valFilterIntensity"),
    effectBtns: document.querySelectorAll(".effect-btn"),
    effectIntensityRange: document.getElementById("effectIntensityRange"),
    valEffectIntensity: document.getElementById("valEffectIntensity"),
    transBtns: document.querySelectorAll(".trans-btn"),
    transDurationRange: document.getElementById("transDurationRange"),
    valTransDuration: document.getElementById("valTransDuration"),
    stickerItems: document.querySelectorAll(".sticker-item"),

    // Audio & Color Grading
    audioVoiceVol: document.getElementById("audioVoiceVol"),
    valAudioVoiceVol: document.getElementById("valAudioVoiceVol"),
    audioMusicVol: document.getElementById("audioMusicVol"),
    valAudioMusicVol: document.getElementById("valAudioMusicVol"),
    audioSpeedRange: document.getElementById("audioSpeedRange"),
    valAudioSpeed: document.getElementById("valAudioSpeed"),
    cgBrightness: document.getElementById("cgBrightness"),
    valCgBrightness: document.getElementById("valCgBrightness"),
    cgContrast: document.getElementById("cgContrast"),
    valCgContrast: document.getElementById("valCgContrast"),
    cgSaturation: document.getElementById("cgSaturation"),
    valCgSaturation: document.getElementById("valCgSaturation"),
    cgExposure: document.getElementById("cgExposure"),
    valCgExposure: document.getElementById("valCgExposure"),
    cgTemperature: document.getElementById("cgTemperature"),
    valCgTemperature: document.getElementById("valCgTemperature"),
    cgTint: document.getElementById("cgTint"),
    valCgTint: document.getElementById("valCgTint"),
    cgVignette: document.getElementById("cgVignette"),
    valCgVignette: document.getElementById("valCgVignette"),
    btnResetColorGrading: document.getElementById("btnResetColorGrading"),
    animBtns: document.querySelectorAll(".anim-btn"),
    animEasingSelect: document.getElementById("animEasingSelect"),

    // Center Stage
    editorTimecode: document.getElementById("editorTimecode"),
    btnEditorFullscreen: document.getElementById("btnEditorFullscreen"),
    editorCanvasViewport: document.getElementById("editorCanvasViewport"),
    editorMainVideo: document.getElementById("editorMainVideo"),
    editorOverlaysLayer: document.getElementById("editorOverlaysLayer"),
    editorCaptionTextBox: document.getElementById("editorCaptionTextBox"),
    btnEditorPlayPause: document.getElementById("btnEditorPlayPause"),
    btnEditorStop: document.getElementById("btnEditorStop"),
    btnFrameBack: document.getElementById("btnFrameBack"),
    btnFrameForward: document.getElementById("btnFrameForward"),
    activeClipInfoText: document.getElementById("activeClipInfoText"),

    // Bottom Timeline
    btnTlSplit: document.getElementById("btnTlSplit"),
    btnTlTrim: document.getElementById("btnTlTrim"),
    btnTlDuplicate: document.getElementById("btnTlDuplicate"),
    btnTlDelete: document.getElementById("btnTlDelete"),
    editorPlayheadTime: document.getElementById("editorPlayheadTime"),
    editorPlayhead: document.getElementById("editorPlayhead"),
    editorTimelineRuler: document.getElementById("editorTimelineRuler"),
    tlTrackVideo: document.getElementById("tlTrackVideo"),
    tlTrackText: document.getElementById("tlTrackText"),
    tlTrackSubtitles: document.getElementById("tlTrackSubtitles"),
    editorTrackLanesScroll: document.getElementById("editorTrackLanesScroll"),
    editorTlZoomSlider: document.getElementById("editorTlZoomSlider"),
    btnTlZoomIn: document.getElementById("btnTlZoomIn"),
    btnTlZoomOut: document.getElementById("btnTlZoomOut"),

    // Export Modal & Production Queue
    exportModal: document.getElementById("exportModal"),
    btnCloseExportModal: document.getElementById("btnCloseExportModal"),
    exportJobIdLabel: document.getElementById("exportJobIdLabel"),
    exportPercentBadge: document.getElementById("exportPercentBadge"),
    exportStatusHeading: document.getElementById("exportStatusHeading"),
    exportStatusDetail: document.getElementById("exportStatusDetail"),
    exportProgressFill: document.getElementById("exportProgressFill"),
    exportActionButtons: document.getElementById("exportActionButtons"),
    btnExportPublishYt: document.getElementById("btnExportPublishYt"),
    btnMinimizeExport: document.getElementById("btnMinimizeExport"),
    btnDownloadExport: document.getElementById("btnDownloadExport"),
    stageRowVoice: document.getElementById("stageRowVoice"),
    iconStageVoice: document.getElementById("iconStageVoice"),
    labelStageVoice: document.getElementById("labelStageVoice"),
    stageRowScenes: document.getElementById("stageRowScenes"),
    iconStageScenes: document.getElementById("iconStageScenes"),
    labelStageScenes: document.getElementById("labelStageScenes"),
    stageRowStitch: document.getElementById("stageRowStitch"),
    iconStageStitch: document.getElementById("iconStageStitch"),
    labelStageStitch: document.getElementById("labelStageStitch"),
    stageRowComposite: document.getElementById("stageRowComposite"),
    iconStageComposite: document.getElementById("iconStageComposite"),
    labelStageComposite: document.getElementById("labelStageComposite"),
    stageRowFinalize: document.getElementById("stageRowFinalize"),
    iconStageFinalize: document.getElementById("iconStageFinalize"),
    labelStageFinalize: document.getElementById("labelStageFinalize"),

    // Pipeline Step Badges
    pipeStepStory: document.getElementById("pipeStepStory"),
    pipeStepChar: document.getElementById("pipeStepChar"),
    pipeStepScenes: document.getElementById("pipeStepScenes"),
    pipeStepRender: document.getElementById("pipeStepRender"),

    // Instagram Buttons & Modal
    btnMainPublishInsta: document.getElementById("btnMainPublishInsta"),
    editorBtnExportInsta: document.getElementById("editorBtnExportInsta"),
    instagramModal: document.getElementById("instagramModal"),
    btnCloseInstaModal: document.getElementById("btnCloseInstaModal"),
    instaCaptionText: document.getElementById("instaCaptionText"),
    btnCopyInstaCaption: document.getElementById("btnCopyInstaCaption"),

    // Step 2 Story Category & Idea Elements
    storyCategoryGrid: document.getElementById("storyCategoryGrid"),
    categoryCards: document.querySelectorAll("#storyCategoryGrid .category-card"),
    activeCategoryBadge: document.getElementById("activeCategoryBadge"),
    customCategoryBox: document.getElementById("customCategoryBox"),
    customCategoryInput: document.getElementById("customCategoryInput"),

    // Step 3 Spacious Character Studio Hub
    step3CharacterHub: document.getElementById("step3CharacterHub"),
    charStoryCategoryBadge: document.getElementById("charStoryCategoryBadge"),
    btnCharGenAll: document.getElementById("btnCharGenAll"),
    btnCharAddNew: document.getElementById("btnCharAddNew"),
    charStudioCardsGrid: document.getElementById("charStudioCardsGrid"),

    // Step 3 Character Edit Modal Elements
    charEditModal: document.getElementById("charEditModal"),
    btnCloseCharEditModal: document.getElementById("btnCloseCharEditModal"),
    charModalTitle: document.getElementById("charModalTitle"),
    charModalPrimaryBadge: document.getElementById("charModalPrimaryBadge"),
    charModalShowcaseImg: document.getElementById("charModalShowcaseImg"),
    charModalViewLabel: document.getElementById("charModalViewLabel"),
    charModalPerspTabs: document.querySelectorAll("#charModalPerspTabs .persp-tab"),
    btnModalSetPrimary: document.getElementById("btnModalSetPrimary"),
    btnModalRegenView: document.getElementById("btnModalRegenView"),
    btnModalUploadPhoto: document.getElementById("btnModalUploadPhoto"),
    btnModalDownloadImg: document.getElementById("btnModalDownloadImg"),
    charModalViewsGrid: document.getElementById("charModalViewsGrid"),
    charModalViewCount: document.getElementById("charModalViewCount"),
    charEditHiddenId: document.getElementById("charEditHiddenId"),
    btnSaveCharProfile: document.getElementById("btnSaveCharProfile"),
    btnSaveAndGenerateChar: document.getElementById("btnSaveAndGenerateChar"),

    // Character Form Inputs
    charInputName: document.getElementById("charInputName"),
    charSelectRole: document.getElementById("charSelectRole"),
    charSelectAge: document.getElementById("charSelectAge"),
    charSelectGender: document.getElementById("charSelectGender"),
    charInputSkin: document.getElementById("charInputSkin"),
    charInputBody: document.getElementById("charInputBody"),
    charInputHair: document.getElementById("charInputHair"),
    charInputFace: document.getElementById("charInputFace"),
    charInputCostume: document.getElementById("charInputCostume"),
    charInputAccessories: document.getElementById("charInputAccessories"),
    charInputFeatures: document.getElementById("charInputFeatures"),
    charInputPersonality: document.getElementById("charInputPersonality"),
    charInputDescription: document.getElementById("charInputDescription"),
    charPhotoFileInput: document.getElementById("charPhotoFileInput"),

    // AI Character Replacement (View B Inspector)
    charReplaceSceneSelect: document.getElementById("charReplaceSceneSelect"),
    charReplaceOriginal: document.getElementById("charReplaceOriginal"),
    charReplaceNew: document.getElementById("charReplaceNew"),
    quickArchetypePills: document.querySelectorAll(".archetype-pill"),
    charReplaceExpression: document.getElementById("charReplaceExpression"),
    charReplacePose: document.getElementById("charReplacePose"),
    btnPreviewCharReplace: document.getElementById("btnPreviewCharReplace"),
    replacePreviewContainer: document.getElementById("replacePreviewContainer"),
    compBeforeImg: document.getElementById("compBeforeImg"),
    compAfterImg: document.getElementById("compAfterImg"),
    btnApplyCharReplace: document.getElementById("btnApplyCharReplace"),
    btnApplyCharReplaceAll: document.getElementById("btnApplyCharReplaceAll"),
    particlesOverlay: document.getElementById("particlesOverlay")
  };

  /* ==========================================================================
     1. WORKSPACE SWITCHER: AI STUDIO <-> ADVANCED VIDEO EDITOR
     ========================================================================== */

  function openAdvancedEditor(targetCategory = "media") {
    state.currentMode = "advanced-editor";
    el.mainAiStudioView.classList.add("d-none");
    el.advancedVideoEditorView.classList.remove("d-none");

    // Sync project title
    el.editorProjectTitleInput.value = state.storyboard?.title || state.projectTitle;

    // Load active video & scenes
    el.editorMainVideo.src = `/api/video?_t=${Date.now()}`;

    // Switch to target category if specified
    if (targetCategory) {
      el.navCategoryItems.forEach((btn) => {
        const cat = btn.getAttribute("data-category");
        btn.classList.toggle("active", cat === targetCategory);
      });
      el.categoryViews.forEach((view) => {
        view.classList.toggle("active", view.id === `catView${capitalize(targetCategory)}`);
      });
    }

    // Refresh editor components
    renderEditorMediaList();
    renderCaptionsInspector();
    renderEditorTimelineRuler();
    renderEditorTimelineClips();
    renderOverlays();
    applyEditorVideoAdjustments();
    selectEditorScene(state.activeSceneIndex);
  }

  function closeAdvancedEditor() {
    state.currentMode = "ai-studio";
    el.advancedVideoEditorView.classList.add("d-none");
    el.mainAiStudioView.classList.remove("d-none");

    // Sync title back to studio
    state.projectTitle = el.editorProjectTitleInput.value.trim() || state.projectTitle;
    el.mainProjectTitle.textContent = state.projectTitle;

    // Pause editor video
    if (!el.editorMainVideo.paused) el.editorMainVideo.pause();
  }

  el.btnOpenAdvancedEditor.addEventListener("click", openAdvancedEditor);
  el.btnMainOpenEditorSide.addEventListener("click", openAdvancedEditor);
  el.btnBackToAiStudio.addEventListener("click", closeAdvancedEditor);

  // Theme Toggles
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("studio_theme", t);
  }

  el.btnMainThemeToggle.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
  el.btnEditorThemeToggle.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));

  /* ==========================================================================
     2. VIEW A: MAIN AI STUDIO LOGIC
     ========================================================================== */

  // Character Style Selection
  el.mainStyleCards.forEach((card) => {
    card.addEventListener("click", () => {
      el.mainStyleCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const style = card.getAttribute("data-style") || "realistic";
      state.selectedStyle = style;
      el.mainActiveStyleLabel.textContent = `${capitalize(style)} Style`;
    });
  });

  // Story Category Selection
  el.categoryCards?.forEach((card) => {
    card.addEventListener("click", () => {
      el.categoryCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const cat = card.getAttribute("data-category") || "Animation";
      state.selectedCategory = cat;
      if (el.activeCategoryBadge) el.activeCategoryBadge.textContent = cat;
      if (el.charStoryCategoryBadge) el.charStoryCategoryBadge.textContent = cat;

      if (cat === "Custom") {
        el.customCategoryBox?.classList.remove("d-none");
        el.customCategoryInput?.focus();
      } else {
        el.customCategoryBox?.classList.add("d-none");
      }
    });
  });

  el.customCategoryInput?.addEventListener("input", (e) => {
    state.customCategory = e.target.value.trim();
    const displayCat = state.customCategory || "Custom";
    if (el.activeCategoryBadge) el.activeCategoryBadge.textContent = displayCat;
    if (el.charStoryCategoryBadge) el.charStoryCategoryBadge.textContent = displayCat;
  });

  // Category-Aware AI Idea Suggestion
  el.btnMainAiSuggestIdeas?.addEventListener("click", () => {
    const categorySuggestions = {
      "Horror": [
        "A young girl moves into an old haunted house and discovers a mysterious ghost girl in the attic.",
        "A lost traveler seeks shelter in a shadowy Victorian manor where whispers echo from the portrait gallery.",
        "An antique wooden music box plays by itself at midnight, awakening benevolent guardian spirits."
      ],
      "Animation": [
        "A curious little robot discovers the last blooming sunflower on an abandoned mechanical planet.",
        "A cheerful cloud who cannot stop raining bright colorful confetti over a grayscale city.",
        "A baker's gingerbread man comes alive and helps rescue escaped gingerbread kittens."
      ],
      "Fantasy": [
        "A young apprentice wizard accidentally awakens an ancient miniature dragon inside the library.",
        "An elven herbalist journeys into the luminescent crystal caves to brew the elixir of eternal dawn.",
        "A starlight weaver must stitch the constellation back together before twilight fades."
      ],
      "Adventure": [
        "A brave explorer navigates a hidden jungle temple to recover a lost glowing crystal.",
        "Two seafaring siblings navigate past siren reefs to find the legendary island of whispering emeralds.",
        "A mountain guide and a loyal golden eagle embark on a perilous ascent to the sky fortress."
      ],
      "Comedy": [
        "A mischievous cat attempts to secretly bake a pizza while the family is fast asleep.",
        "An clumsy royal knight gets stuck in an enchanted suit of armor that insists on dancing flamenco.",
        "A flock of pigeons organizes an elaborate heist to steal French fries from a seaside boardwalk café."
      ],
      "Thriller": [
        "A night security guard discovers that the museum statues are changing positions every hour.",
        "A sub-zero research base loses contact with the world as a mysterious heat signal emerges beneath the ice.",
        "An air traffic controller guides an unidentified glowing craft through an electrical thunderstorm."
      ],
      "Mystery": [
        "A clever detective and a talking raven uncover secrets buried beneath the foggy Victorian harbor.",
        "A librarian discovers an unmarked doorway behind the 18th-century atlas shelves leading to an underground archive.",
        "An old pocket watch found in an attic starts ticking backwards, revealing forgotten memories."
      ],
      "Romance": [
        "Two stargazers reunite every fifty years when a luminous golden comet passes overhead.",
        "A bookstore curator and a traveling violinist leave secret letters inside vintage poetry volumes.",
        "Two celestial spirits weave the dawn and dusk together in an eternal cosmic dance."
      ],
      "Mythology": [
        "Rama and Lakshmana journey through Dandaka forest, guided by the devotion of Hanuman.",
        "Lord Krishna plays divine flute melody along the sacred Yamuna river as peacocks dance with joy.",
        "Garuda soars across celestial clouds to deliver the immortal nectar to Mount Meru."
      ],
      "Action": [
        "A futuristic hoverbike courier races across neon rooftop highways to deliver a mysterious energy core.",
        "A master martial artist defends an ancient temple dojo against an army of shadow warriors.",
        "A courageous pilot flies into the vortex of a superstorm to deploy weather stabilization probes."
      ],
      "Educational": [
        "A cheerful water droplet journeys from ocean clouds down through rivers into the majestic sea.",
        "A tiny bee explains the marvelous ecosystem of pollination to woodland animal friends.",
        "A friendly time-traveling sundial explains how seasons change across planet Earth."
      ],
      "Kids Stories": [
        "A little bunny learns that sharing colorful carrots brings friends from all over the meadow.",
        "A timid baby bear who is afraid of the dark discovers the moon is his personal nightlight.",
        "A cheerful little tugboat helps a majestic ship find its way home through a foggy harbor."
      ],
      "Custom": [
        "A breathtaking adventure set in a unique world of wonder, discovering hidden friendships and bravery.",
        "An extraordinary voyage across uncharted horizons where every discovery inspires hope."
      ]
    };

    const cat = state.selectedCategory || "Animation";
    const list = categorySuggestions[cat] || categorySuggestions["Animation"];
    el.mainIdeaPromptInput.value = list[Math.floor(Math.random() * list.length)];
  });

  // Generate Story & Screenplay Main Action
  el.btnMainGenerateStory.addEventListener("click", async () => {
    const prompt = el.mainIdeaPromptInput.value.trim();
    if (!prompt) return alert("Please enter a story idea.");

    const effectiveCategory = state.selectedCategory === "Custom"
      ? (state.customCategory || "Custom")
      : (state.selectedCategory || "Animation");

    el.btnMainGenerateStory.disabled = true;
    el.btnMainGenerateStory.innerHTML = "<span>⏳</span> Generating Screenplay with Gemini AI...";

    try {
      const res = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          category: effectiveCategory,
          duration: parseInt(el.mainSelectDuration.value, 10) || 20,
          characterStyle: state.selectedStyle,
          language: el.mainSelectLanguage.value
        })
      });
      const data = await res.json();
      if (!data.success || !data.storyboard) throw new Error(data.error || "Generation failed");

      state.storyboard = data.storyboard;
      state.projectTitle = data.storyboard.title || "New Cartoon Short";
      el.mainProjectTitle.textContent = state.projectTitle;

      el.pipeStepStory?.classList.add("completed");
      el.pipeStepStory?.classList.remove("active");

      // Synchronize characters extracted for this story
      if (data.characters && Array.isArray(data.characters) && data.characters.length > 0) {
        state.characters = data.characters;
        state.activeCharacterId = data.characters[0].id;
        state.activePreviewImageUrl = data.characters[0].primaryImage;
        renderCharacterStudio();
        el.pipeStepChar?.classList.add("completed");
        el.pipeStepChar?.classList.remove("active");
      }
      el.pipeStepScenes?.classList.remove("completed");
      el.pipeStepScenes?.classList.add("active");
      el.pipeStepRender?.classList.remove("completed");
      el.pipeStepRender?.classList.remove("active");

      renderMainSceneCards();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      el.btnMainGenerateStory.disabled = false;
      el.btnMainGenerateStory.innerHTML = "<span>🪄</span> Generate Complete Story & Screenplay";
    }
  });

  function updatePipelineUI(pipeline) {
    if (!pipeline) return;
    if (pipeline.screenplay === "ready") {
      el.pipeStepStory?.classList.add("completed");
      el.pipeStepStory?.classList.remove("active");
    }
    if (pipeline.characters === "locked" || pipeline.characters === "ready") {
      el.pipeStepChar?.classList.add("completed");
      el.pipeStepChar?.classList.remove("active");
    }
    if (pipeline.scenes === "ready") {
      el.pipeStepScenes?.classList.add("completed");
      el.pipeStepScenes?.classList.remove("active");
    } else if (pipeline.scenes === "partial") {
      el.pipeStepScenes?.classList.add("active");
      el.pipeStepScenes?.classList.remove("completed");
    }
    if (pipeline.video === "ready") {
      el.pipeStepRender?.classList.add("completed");
      el.pipeStepRender?.classList.remove("active");
    }
  }

  function checkAndUpdateScenesPipeline() {
    if (!state.storyboard || !state.storyboard.scenes) return;
    const allReady = state.storyboard.scenes.every(s => s.status === "ready");
    const anyReady = state.storyboard.scenes.some(s => s.status === "ready");
    if (allReady) {
      el.pipeStepScenes?.classList.add("completed");
      el.pipeStepScenes?.classList.remove("active");
    } else if (anyReady) {
      el.pipeStepScenes?.classList.add("active");
      el.pipeStepScenes?.classList.remove("completed");
    }
  }

  function renderMainSceneCards() {
    if (!state.storyboard || !state.storyboard.scenes) return;
    el.mainScenesList.innerHTML = "";

    state.storyboard.scenes.forEach((scene, idx) => {
      const sceneNum = idx + 1;
      const card = document.createElement("div");
      card.className = "main-scene-card";
      card.dataset.sceneNum = sceneNum;

      const isVideoReady = scene.videoStatus === "ready" || !!scene.videoClipPath;
      const isAiVideo = scene.isAiGenerated === true;
      const hasImage = scene.status === "ready";

      let badgeHtml = '<span class="scene-status-pill pending">⏳ Pending</span>';
      if (isVideoReady) {
        if (isAiVideo) {
          badgeHtml = '<span class="badge badge-ai-video" title="Google Veo 3.1 AI Animated Video">🤖 Veo 3.1 Video</span>';
        } else {
          badgeHtml = '<span class="badge badge-ffmpeg-fallback" title="FFmpeg 2.5D Motion Engine">🎞️ FFmpeg Motion</span>';
        }
      } else if (hasImage) {
        badgeHtml = '<span class="badge badge-nano-banana" title="Google Nano Banana 2 Image">🖼️ Image Ready</span>';
      }

      card.innerHTML = `
        <div class="scene-tabs-bar">
          <button class="scene-tab-btn active" data-tab="image">🖼️ Image</button>
          <button class="scene-tab-btn" data-tab="video">🎥 AI Video</button>
        </div>
        <div class="scene-media-viewport">
          <img src="/storage/images/scene${sceneNum}.png?_t=${Date.now()}" class="main-scene-thumb" onerror="this.src='/storage/images/style_${state.selectedStyle}.svg';" onload="const p = this.closest('.main-scene-card').querySelector('.scene-status-pill'); if(p && p.classList.contains('pending')){ p.textContent='✅ Image Ready'; p.className='badge badge-nano-banana'; }">
          <video class="scene-video-player d-none" controls playsinline loop muted>
            <source src="/storage/videos/scene_${sceneNum}_clip.mp4?_t=${Date.now()}" type="video/mp4">
          </video>
          <div style="position: absolute; top: 6px; right: 6px; z-index: 5;" class="scene-badge-container">
            ${badgeHtml}
          </div>
        </div>
        <div class="flex-between mt-1">
          <span class="font-bold text-xs">Scene ${sceneNum}</span>
          <span class="badge purple">${scene.duration || 5}s</span>
        </div>
        <p class="text-xs text-secondary line-clamp-2" title="${escapeHtml(scene.storyBeat || scene.title || '')}">${escapeHtml(scene.storyBeat || scene.title || '')}</p>
        <div class="flex-row gap-1 mt-1">
          <button class="btn btn-outline btn-xs btn-gen-main-scene flex-1" data-scene="${sceneNum}" title="Generate Image with Google Nano Banana 2">🎨 Image</button>
          <button class="btn btn-purple btn-xs btn-animate-scene flex-1 shadow-glow" data-scene="${sceneNum}" title="Animate Image to Video with Google Veo 3.1">🎥 Animate (Veo)</button>
          <button class="btn btn-ghost btn-xs btn-swap-char" data-scene="${sceneNum}" title="Swap Character with AI">🎭</button>
        </div>
      `;

      const tabImageBtn = card.querySelector('[data-tab="image"]');
      const tabVideoBtn = card.querySelector('[data-tab="video"]');
      const imgEl = card.querySelector('.main-scene-thumb');
      const vidEl = card.querySelector('.scene-video-player');

      tabImageBtn.addEventListener("click", () => {
        tabImageBtn.classList.add("active");
        tabVideoBtn.classList.remove("active");
        imgEl.classList.remove("d-none");
        vidEl.classList.add("d-none");
        vidEl.pause();
      });

      tabVideoBtn.addEventListener("click", () => {
        tabVideoBtn.classList.add("active");
        tabImageBtn.classList.remove("active");
        imgEl.classList.add("d-none");
        vidEl.classList.remove("d-none");
        vidEl.play().catch(() => {});
      });

      card.querySelector(".btn-gen-main-scene").addEventListener("click", () => generateSceneImage(sceneNum, scene, card));
      card.querySelector(".btn-animate-scene").addEventListener("click", () => generateSceneVideo(sceneNum, scene, card));
      card.querySelector(".btn-swap-char").addEventListener("click", () => {
        openAdvancedEditor("character");
        el.charReplaceSceneSelect.value = sceneNum;
        triggerSceneReplaceSelection(sceneNum);
      });

      el.mainScenesList.appendChild(card);
    });
  }

  async function generateSceneImage(sceneNum, scene, cardEl) {
    const btn = cardEl.querySelector(".btn-gen-main-scene");
    const badgeContainer = cardEl.querySelector(".scene-badge-container");
    const tabImageBtn = cardEl.querySelector('[data-tab="image"]');
    const tabVideoBtn = cardEl.querySelector('[data-tab="video"]');
    const imgEl = cardEl.querySelector('.main-scene-thumb');
    const vidEl = cardEl.querySelector('.scene-video-player');

    btn.disabled = true;
    btn.innerHTML = "<span>⏳</span> Nano Banana 2...";
    if (badgeContainer) {
      badgeContainer.innerHTML = '<span class="badge purple">⏳ Nano Banana 2</span>';
    }

    try {
      const res = await fetch("/api/generate-scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneNumber: sceneNum,
          sceneIndex: sceneNum,
          prompt: scene.pixarPrompt || scene.cameraDirection || scene.storyBeat || scene.narration,
          characterStyle: state.selectedStyle,
          category: state.selectedCategory
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Image generation failed");

      if (imgEl) {
        imgEl.src = `/storage/images/scene${sceneNum}.png?_t=${Date.now()}`;
        tabImageBtn.classList.add("active");
        tabVideoBtn.classList.remove("active");
        imgEl.classList.remove("d-none");
        vidEl.classList.add("d-none");
      }
      if (badgeContainer) {
        badgeContainer.innerHTML = '<span class="badge badge-nano-banana" title="Google Nano Banana 2 Image">🖼️ Image Ready</span>';
      }
      scene.status = "ready";
      checkAndUpdateScenesPipeline();
    } catch (err) {
      if (badgeContainer) {
        badgeContainer.innerHTML = '<span class="badge red">❌ Image Failed</span>';
      }
      alert(`Scene ${sceneNum} notice: ` + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = "<span>🎨</span> Image";
    }
  }

  async function generateSceneVideo(sceneNum, scene, cardEl) {
    const btnAnimate = cardEl.querySelector(".btn-animate-scene");
    const badgeContainer = cardEl.querySelector(".scene-badge-container");
    const tabVideoBtn = cardEl.querySelector('[data-tab="video"]');
    const tabImageBtn = cardEl.querySelector('[data-tab="image"]');
    const imgEl = cardEl.querySelector('.main-scene-thumb');
    const vidEl = cardEl.querySelector('.scene-video-player');

    btnAnimate.disabled = true;
    btnAnimate.innerHTML = "<span>⏳</span> Veo 3.1...";
    if (badgeContainer) {
      badgeContainer.innerHTML = '<span class="badge purple">⏳ Veo 3.1 Animating</span>';
    }

    try {
      const res = await fetch("/api/generate-scene-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneNumber: sceneNum,
          sceneIndex: sceneNum,
          prompt: scene.pixarPrompt || scene.cameraDirection || scene.storyBeat || scene.narration,
          cameraMotion: scene.cameraMotion || scene.cameraDirection || "cinematic slow push",
          characterAction: scene.characterAction || "natural animation and expression",
          duration: scene.duration || 5,
          preferredProvider: "veo",
          characterStyle: state.selectedStyle,
          category: state.selectedCategory
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Video animation failed");

      scene.videoClipPath = data.videoClipPath;
      scene.videoStatus = "ready";
      scene.isAiGenerated = !!data.isAiGenerated;
      scene.fallbackUsed = !!data.fallbackUsed;

      const videoSrc = `/storage/videos/scene_${sceneNum}_clip.mp4?_t=${Date.now()}`;
      vidEl.querySelector("source").src = videoSrc;
      vidEl.load();

      tabVideoBtn.classList.add("active");
      tabImageBtn.classList.remove("active");
      imgEl.classList.add("d-none");
      vidEl.classList.remove("d-none");
      vidEl.play().catch(() => {});

      if (data.isAiGenerated) {
        badgeContainer.innerHTML = '<span class="badge badge-ai-video" title="Google Veo 3.1 AI Animated Video">🤖 Veo 3.1 Video</span>';
      } else {
        badgeContainer.innerHTML = '<span class="badge badge-ffmpeg-fallback" title="FFmpeg 2.5D Motion Engine">🎞️ FFmpeg Motion</span>';
      }

      checkAndUpdateScenesPipeline();
    } catch (err) {
      if (badgeContainer) {
        badgeContainer.innerHTML = '<span class="badge red">❌ Video Failed</span>';
      }
      alert(`Scene ${sceneNum} Video Error: ` + err.message);
    } finally {
      btnAnimate.disabled = false;
      btnAnimate.innerHTML = "<span>🎥</span> Animate (Veo)";
    }
  }

  // Batch Image Generation (Google Nano Banana 2)
  el.btnMainGenerateAllImages.addEventListener("click", async () => {
    if (!state.storyboard?.scenes || state.storyboard.scenes.length === 0) {
      alert("Please generate a story & screenplay first.");
      return;
    }

    const scenes = state.storyboard.scenes;
    el.btnMainGenerateAllImages.disabled = true;
    el.btnMainGenerateAllImages.innerHTML = "<span>⏳</span> Rendering Images...";

    if (el.batchProgressWrapper) {
      el.batchProgressWrapper.classList.remove("d-none");
      el.batchProgressLabel.textContent = `Google Nano Banana 2: Rendering 0/${scenes.length} scene images...`;
      el.batchProgressPercent.textContent = `0%`;
      el.batchProgressFill.style.width = `0%`;
    }

    for (let i = 0; i < scenes.length; i++) {
      const sceneNum = i + 1;
      const card = el.mainScenesList.children[i];
      if (el.batchProgressLabel) {
        el.batchProgressLabel.textContent = `Google Nano Banana 2: Rendering Scene ${sceneNum}/${scenes.length}...`;
        const pct = Math.round((i / scenes.length) * 100);
        el.batchProgressPercent.textContent = `${pct}%`;
        el.batchProgressFill.style.width = `${pct}%`;
      }
      if (card) {
        await generateSceneImage(sceneNum, scenes[i], card);
      }
    }

    if (el.batchProgressLabel) {
      el.batchProgressLabel.textContent = `✅ All ${scenes.length} scene images generated! Ready for Image-to-Video animation.`;
      el.batchProgressPercent.textContent = `100%`;
      el.batchProgressFill.style.width = `100%`;
    }

    el.btnMainGenerateAllImages.disabled = false;
    el.btnMainGenerateAllImages.innerHTML = "<span>🎨</span> Generate All Images";
  });

  // Batch Video Generation (Google Veo 3.1)
  el.btnMainAnimateAllScenes?.addEventListener("click", async () => {
    if (!state.storyboard?.scenes || state.storyboard.scenes.length === 0) {
      alert("Please generate a story & screenplay first.");
      return;
    }

    const scenes = state.storyboard.scenes;
    el.btnMainAnimateAllScenes.disabled = true;
    el.btnMainAnimateAllScenes.innerHTML = "<span>⏳</span> Animating with Veo 3.1...";

    if (el.batchProgressWrapper) {
      el.batchProgressWrapper.classList.remove("d-none");
      el.batchProgressLabel.textContent = `Google Veo 3.1: Animating 0/${scenes.length} scenes...`;
      el.batchProgressPercent.textContent = `0%`;
      el.batchProgressFill.style.width = `0%`;
    }

    for (let i = 0; i < scenes.length; i++) {
      const sceneNum = i + 1;
      const card = el.mainScenesList.children[i];
      if (el.batchProgressLabel) {
        el.batchProgressLabel.textContent = `Google Veo 3.1: Animating Scene ${sceneNum}/${scenes.length}...`;
        const pct = Math.round((i / scenes.length) * 100);
        el.batchProgressPercent.textContent = `${pct}%`;
        el.batchProgressFill.style.width = `${pct}%`;
      }
      if (card) {
        await generateSceneVideo(sceneNum, scenes[i], card);
      }
    }

    if (el.batchProgressLabel) {
      el.batchProgressLabel.textContent = `🎉 All ${scenes.length} scenes animated! Ready for Master Video assembly.`;
      el.batchProgressPercent.textContent = `100%`;
      el.batchProgressFill.style.width = `100%`;
    }

    el.btnMainAnimateAllScenes.disabled = false;
    el.btnMainAnimateAllScenes.innerHTML = "<span>🎥</span> Animate All (Veo 3.1)";
  });

  // Render Master Video from Studio
  el.btnMainRenderVideo.addEventListener("click", () => {
    openExportModal();
    startMasterRender();
  });

  /* ==========================================================================
     3. VIEW B: ADVANCED VIDEO EDITOR CATEGORIES & INSPECTORS
     ========================================================================== */

  // Left Category Navigation Switcher (10 Categories)
  el.navCategoryItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      el.navCategoryItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.getAttribute("data-category");

      el.categoryViews.forEach((view) => {
        view.classList.toggle("active", view.id === `catView${capitalize(cat)}`);
      });
    });
  });

  // Media Dropzone & Upload Handler
  el.mediaDropzone.addEventListener("click", () => el.mediaFileInput.click());
  el.mediaFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      const targetScene = state.activeSceneIndex + 1;
      try {
        await fetch("/api/upload-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneNumber: targetScene,
            filename: file.name,
            data: base64
          })
        });
        alert(`Scene ${targetScene} image replaced with uploaded media!`);
        renderEditorMediaList();
        renderEditorTimelineClips();
        selectEditorScene(state.activeSceneIndex);
      } catch (err) {
        alert("Upload error: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  function renderEditorMediaList() {
    el.editorSceneMediaList.innerHTML = "";
    const scenes = state.storyboard?.scenes || [1, 2, 3, 4];

    scenes.forEach((_, idx) => {
      const sceneNum = idx + 1;
      const row = document.createElement("div");
      row.className = `scene-media-row ${idx === state.activeSceneIndex ? "active" : ""}`;
      row.innerHTML = `
        <img src="/storage/images/scene${sceneNum}.png" class="scene-media-thumb" onerror="this.src='/storage/images/style_${state.selectedStyle}.svg'">
        <div class="flex-1">
          <span class="font-bold text-xs">Scene ${sceneNum}</span>
          <div class="text-xs text-secondary">${idx === state.activeSceneIndex ? "Selected" : "Clip"}</div>
        </div>
        <button class="btn btn-outline btn-xs btn-replace-media" data-scene="${sceneNum}">Replace</button>
      `;

      row.addEventListener("click", () => selectEditorScene(idx));
      row.querySelector(".btn-replace-media").addEventListener("click", (e) => {
        e.stopPropagation();
        selectEditorScene(idx);
        el.mediaFileInput.click();
      });

      el.editorSceneMediaList.appendChild(row);
    });
  }

  // Media Transforms (Scale, Pos, Rotate, Opacity, Flip)
  el.mediaScaleRange.addEventListener("input", (e) => {
    state.adjustments.scale = parseInt(e.target.value, 10);
    el.valMediaScale.textContent = `${e.target.value}%`;
    applyEditorVideoAdjustments();
  });
  el.mediaPosX.addEventListener("input", (e) => {
    state.adjustments.posX = parseInt(e.target.value, 10) || 0;
    applyEditorVideoAdjustments();
  });
  el.mediaPosY.addEventListener("input", (e) => {
    state.adjustments.posY = parseInt(e.target.value, 10) || 0;
    applyEditorVideoAdjustments();
  });
  el.mediaRotateRange.addEventListener("input", (e) => {
    state.adjustments.rotation = parseInt(e.target.value, 10);
    el.valMediaRotate.textContent = `${e.target.value}°`;
    applyEditorVideoAdjustments();
  });
  el.mediaOpacityRange.addEventListener("input", (e) => {
    state.adjustments.opacity = parseInt(e.target.value, 10);
    el.valMediaOpacity.textContent = `${e.target.value}%`;
    applyEditorVideoAdjustments();
  });
  el.btnFlipH.addEventListener("click", () => {
    state.adjustments.flipH = !state.adjustments.flipH;
    applyEditorVideoAdjustments();
  });
  el.btnFlipV.addEventListener("click", () => {
    state.adjustments.flipV = !state.adjustments.flipV;
    applyEditorVideoAdjustments();
  });

  // Text Category Controls
  el.btnAddTextLayer.addEventListener("click", () => {
    const newText = prompt("Enter text layer content (English or Telugu):", "దివ్య దర్శనం (Divine Sight)");
    if (!newText) return;
    state.textLayers.push({
      id: Date.now(),
      text: newText,
      x: 30,
      y: 40,
      size: 32,
      color: state.adjustments.textColor,
      font: state.adjustments.font
    });
    renderOverlays();
  });

  el.activeTextContent.addEventListener("input", (e) => {
    if (state.textLayers.length > 0) {
      state.textLayers[0].text = e.target.value;
      renderOverlays();
    }
  });
  el.activeTextFont.addEventListener("change", (e) => {
    state.adjustments.font = e.target.value;
    if (state.textLayers.length > 0) state.textLayers[0].font = e.target.value;
    renderOverlays();
  });
  el.activeTextSize.addEventListener("input", (e) => {
    state.adjustments.fontSize = parseInt(e.target.value, 10);
    el.valActiveTextSize.textContent = `${e.target.value}px`;
    if (state.textLayers.length > 0) state.textLayers[0].size = state.adjustments.fontSize;
    renderOverlays();
  });
  el.activeTextColor.addEventListener("input", (e) => {
    state.adjustments.textColor = e.target.value;
    if (state.textLayers.length > 0) state.textLayers[0].color = e.target.value;
    renderOverlays();
  });

  // Subtitle / Captions List in Inspector
  function renderCaptionsInspector() {
    el.captionsTimelineList.innerHTML = "";
    const scenes = state.storyboard?.scenes || [];

    scenes.forEach((scene, idx) => {
      const row = document.createElement("div");
      row.className = "inspector-subbox mb-2";
      row.innerHTML = `
        <div class="flex-between mb-1">
          <span class="font-bold text-xs text-purple">Scene ${idx + 1} Caption</span>
          <span class="text-xs text-secondary">${scene.duration || 2}s</span>
        </div>
        <input type="text" class="studio-input text-xs caption-edit-input" value="${escapeHtml(scene.voiceover || scene.narration || '')}">
      `;
      row.querySelector(".caption-edit-input").addEventListener("input", (e) => {
        scene.voiceover = e.target.value;
        if (idx === state.activeSceneIndex) {
          el.editorCaptionTextBox.textContent = e.target.value;
        }
      });
      el.captionsTimelineList.appendChild(row);
    });
  }

  // Filter Option Cards (11 Presets)
  el.filterOptionCards.forEach((card) => {
    card.addEventListener("click", () => {
      recordUndo();
      el.filterOptionCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      state.adjustments.filter = card.getAttribute("data-filter");
      applyEditorVideoAdjustments();
    });
  });

  el.filterIntensityRange.addEventListener("input", (e) => {
    state.adjustments.filterIntensity = parseInt(e.target.value, 10);
    el.valFilterIntensity.textContent = `${e.target.value}%`;
    applyEditorVideoAdjustments();
  });

  // Effects & Transitions
  el.effectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      recordUndo();
      el.effectBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const effectName = btn.getAttribute("data-effect");
      state.adjustments.effect = effectName;

      // Real-time environmental particles overlay
      if (el.particlesOverlay) {
        el.particlesOverlay.className = "particles-overlay-layer";
        if (effectName === "rain") el.particlesOverlay.classList.add("rain");
        else if (effectName === "snow") el.particlesOverlay.classList.add("snow");
        else if (effectName === "particles" || effectName === "sparkles") el.particlesOverlay.classList.add("embers");
        else if (effectName === "magic" || effectName === "glow") el.particlesOverlay.classList.add("magic");
      }

      applyEditorVideoAdjustments();
    });
  });

  el.transBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      recordUndo();
      el.transBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.adjustments.transition = btn.getAttribute("data-trans");
    });
  });

  el.transDurationRange.addEventListener("input", (e) => {
    state.adjustments.transitionDuration = parseFloat((e.target.value / 10).toFixed(1));
    el.valTransDuration.textContent = `${state.adjustments.transitionDuration}s`;
  });

  // Stickers Placement
  el.stickerItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const icon = btn.getAttribute("data-sticker");
      state.stickers.push({
        id: Date.now(),
        icon,
        x: 45,
        y: 35
      });
      renderOverlays();
    });
  });

  // Audio Sliders
  el.audioVoiceVol.addEventListener("input", (e) => {
    state.voiceVolume = e.target.value / 100;
    el.valAudioVoiceVol.textContent = `${e.target.value}%`;
  });
  el.audioMusicVol.addEventListener("input", (e) => {
    state.bgmVolume = e.target.value / 100;
    el.valAudioMusicVol.textContent = `${e.target.value}%`;
  });
  el.audioSpeedRange.addEventListener("input", (e) => {
    state.audioSpeed = e.target.value / 100;
    el.valAudioSpeed.textContent = `${state.audioSpeed.toFixed(1)}x`;
  });

  // Colour Grading (13 Sliders)
  const cgMap = [
    { el: el.cgBrightness, key: "brightness", label: el.valCgBrightness, offset: -100 },
    { el: el.cgContrast, key: "contrast", label: el.valCgContrast, offset: -100, prefix: true },
    { el: el.cgSaturation, key: "saturation", label: el.valCgSaturation, offset: -100, prefix: true },
    { el: el.cgExposure, key: "exposure", label: el.valCgExposure },
    { el: el.cgTemperature, key: "temperature", label: el.valCgTemperature },
    { el: el.cgTint, key: "tint", label: el.valCgTint },
    { el: el.cgVignette, key: "vignette", label: el.valCgVignette, suffix: "%" }
  ];

  cgMap.forEach((m) => {
    m.el.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.adjustments[m.key] = val;
      const displayVal = m.offset ? val + m.offset : val;
      m.label.textContent = `${m.prefix && displayVal > 0 ? '+' : ''}${displayVal}${m.suffix || ''}`;
      applyEditorVideoAdjustments();
    });
  });

  el.btnResetColorGrading.addEventListener("click", () => {
    recordUndo();
    state.adjustments.brightness = 100;
    state.adjustments.contrast = 110;
    state.adjustments.saturation = 120;
    state.adjustments.exposure = 0;
    state.adjustments.temperature = 0;
    state.adjustments.tint = 0;
    state.adjustments.vignette = 20;

    el.cgBrightness.value = 100; el.valCgBrightness.textContent = "0";
    el.cgContrast.value = 110; el.valCgContrast.textContent = "+10";
    el.cgSaturation.value = 120; el.valCgSaturation.textContent = "+20";
    el.cgExposure.value = 0; el.valCgExposure.textContent = "0";
    el.cgTemperature.value = 0; el.valCgTemperature.textContent = "0";
    el.cgTint.value = 0; el.valCgTint.textContent = "0";
    el.cgVignette.value = 20; el.valCgVignette.textContent = "20%";

    applyEditorVideoAdjustments();
  });

  /* ==========================================================================
     4. REAL EDITING ENGINE (CSS FILTERS & TRANSFORMS)
     ========================================================================== */

  function applyEditorVideoAdjustments() {
    const a = state.adjustments;

    // Transform string (scale, translate, rotate, flip)
    const scaleX = (a.scale / 100) * (a.flipH ? -1 : 1);
    const scaleY = (a.scale / 100) * (a.flipV ? -1 : 1);
    el.editorMainVideo.style.transform = `scale(${scaleX}, ${scaleY}) translate(${a.posX}px, ${a.posY}px) rotate(${a.rotation}deg)`;
    el.editorMainVideo.style.opacity = `${a.opacity / 100}`;

    // Filter computation
    let filterStr = `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)`;
    if (a.exposure !== 0) filterStr += ` brightness(${100 + a.exposure}%)`;
    if (a.temperature !== 0) filterStr += ` sepia(${Math.abs(a.temperature)}%)`;
    if (a.tint !== 0) filterStr += ` hue-rotate(${a.tint * 2}deg)`;

    // Filter presets
    if (a.filter === "cinematic") filterStr += " contrast(125%) saturate(130%)";
    else if (a.filter === "vintage" || a.filter === "sepia") filterStr += " sepia(60%) contrast(90%)";
    else if (a.filter === "warm") filterStr += " sepia(30%) saturate(135%)";
    else if (a.filter === "cool") filterStr += " hue-rotate(20deg) saturate(110%)";
    else if (a.filter === "dramatic") filterStr += " contrast(140%) saturate(145%)";
    else if (a.filter === "bw") filterStr += " grayscale(100%) contrast(130%)";
    else if (a.filter === "vivid") filterStr += " saturate(170%) contrast(115%)";
    else if (a.filter === "dreamy") filterStr += " contrast(90%) brightness(115%) saturate(140%)";
    else if (a.filter === "cartoon") filterStr += " saturate(180%) contrast(135%)";

    // Visual Effects
    if (a.effect === "blur") filterStr += ` blur(${a.effectIntensity / 25}px)`;
    else if (a.effect === "glow") filterStr += ` drop-shadow(0 0 ${a.effectIntensity / 5}px #9333EA)`;
    else if (a.effect === "shake") {
      el.editorCanvasViewport.style.animation = "shake 0.2s infinite";
    } else {
      el.editorCanvasViewport.style.animation = "none";
    }

    el.editorMainVideo.style.filter = filterStr;
  }

  function renderOverlays() {
    // Clear custom stickers & texts (keep subtitle overlay)
    const existing = el.editorOverlaysLayer.querySelectorAll(".dynamic-overlay-item");
    existing.forEach((e) => e.remove());

    // Render Text Layers
    state.textLayers.forEach((tl) => {
      const span = document.createElement("span");
      span.className = "dynamic-overlay-item";
      span.style.position = "absolute";
      span.style.left = `${tl.x}%`;
      span.style.top = `${tl.y}%`;
      span.style.fontSize = `${tl.size}px`;
      span.style.color = tl.color;
      span.style.fontFamily = tl.font;
      span.style.fontWeight = "700";
      span.style.textShadow = "2px 2px 4px #000000";
      span.style.cursor = "move";
      span.style.pointerEvents = "auto";
      span.textContent = tl.text;
      makeDraggable(span, tl);
      el.editorOverlaysLayer.appendChild(span);
    });

    // Render Stickers
    state.stickers.forEach((st) => {
      const span = document.createElement("span");
      span.className = "dynamic-overlay-item placed-sticker";
      span.style.left = `${st.x}%`;
      span.style.top = `${st.y}%`;
      span.textContent = st.icon;
      makeDraggable(span, st);
      el.editorOverlaysLayer.appendChild(span);
    });
  }

  function makeDraggable(domEl, item) {
    let isDragging = false;
    let startX = 0, startY = 0;

    domEl.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      e.stopPropagation();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = ((e.clientX - startX) / el.editorCanvasViewport.offsetWidth) * 100;
      const dy = ((e.clientY - startY) / el.editorCanvasViewport.offsetHeight) * 100;
      item.x = Math.max(0, Math.min(90, item.x + dx));
      item.y = Math.max(0, Math.min(90, item.y + dy));
      domEl.style.left = `${item.x}%`;
      domEl.style.top = `${item.y}%`;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  /* ==========================================================================
     5. CENTER VIEWPORT PLAYBACK & SCENE SELECTOR
     ========================================================================== */

  function selectEditorScene(idx) {
    state.activeSceneIndex = idx;
    const sceneNum = idx + 1;
    const scene = state.storyboard?.scenes ? state.storyboard.scenes[idx] : null;

    // Update active row in media list
    document.querySelectorAll(".scene-media-row").forEach((r, i) => r.classList.toggle("active", i === idx));

    // Update active timeline clip
    document.querySelectorAll(".clip-block").forEach((c, i) => c.classList.toggle("active", i === idx));

    // Update info text
    el.activeClipInfoText.textContent = `Scene ${sceneNum} Selected (${scene?.duration || 2.5}s)`;

    // Update poster & caption
    el.editorMainVideo.poster = `/storage/images/scene${sceneNum}.png`;
    if (scene) {
      el.editorCaptionTextBox.textContent = scene.voiceover || scene.narration || "";
    }
  }

  // Playback Controls
  el.btnEditorPlayPause.addEventListener("click", toggleEditorPlayPause);
  el.editorBtnPreview.addEventListener("click", toggleEditorPlayPause);

  function toggleEditorPlayPause() {
    if (el.editorMainVideo.paused) {
      el.editorMainVideo.play().then(() => {
        state.isPlaying = true;
        el.btnEditorPlayPause.textContent = "⏸";
      }).catch(() => { });
    } else {
      el.editorMainVideo.pause();
      state.isPlaying = false;
      el.btnEditorPlayPause.textContent = "▶";
    }
  }

  el.btnEditorStop.addEventListener("click", () => {
    el.editorMainVideo.pause();
    el.editorMainVideo.currentTime = 0;
    state.isPlaying = false;
    el.btnEditorPlayPause.textContent = "▶";
    updateEditorPlayhead(0);
  });

  el.btnFrameBack.addEventListener("click", () => {
    el.editorMainVideo.currentTime = Math.max(0, el.editorMainVideo.currentTime - 0.033);
  });
  el.btnFrameForward.addEventListener("click", () => {
    if (el.editorMainVideo.duration) {
      el.editorMainVideo.currentTime = Math.min(el.editorMainVideo.duration, el.editorMainVideo.currentTime + 0.033);
    }
  });

  el.editorMainVideo.addEventListener("timeupdate", () => {
    const cur = el.editorMainVideo.currentTime || 0;
    const dur = el.editorMainVideo.duration || state.duration;
    state.currentTime = cur;
    el.editorTimecode.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    el.editorPlayheadTime.textContent = formatTime(cur);

    if (dur > 0) {
      updateEditorPlayhead(cur / dur);
    }
  });

  function updateEditorPlayhead(pct) {
    const rulerW = el.editorTimelineRuler.offsetWidth || 1200;
    el.editorPlayhead.style.transform = `translateX(${pct * rulerW}px)`;
  }

  el.btnEditorFullscreen.addEventListener("click", () => {
    if (el.editorMainVideo.requestFullscreen) el.editorMainVideo.requestFullscreen();
  });

  /* ==========================================================================
     6. BOTTOM ADVANCED MULTI-TRACK TIMELINE (8 TRACKS)
     ========================================================================== */

  function renderEditorTimelineRuler() {
    el.editorTimelineRuler.innerHTML = "";
    const totalSecs = Math.max(20, state.duration);
    const rulerWidth = (el.editorTimelineRuler.offsetWidth || 1200) * (state.zoomLevel / 100);
    el.editorTimelineRuler.style.minWidth = `${rulerWidth}px`;
    el.tlTrackVideo.style.minWidth = `${rulerWidth}px`;
    el.tlTrackText.style.minWidth = `${rulerWidth}px`;
    el.tlTrackSubtitles.style.minWidth = `${rulerWidth}px`;

    for (let s = 0; s <= totalSecs; s += 2) {
      const pct = s / totalSecs;
      const tick = document.createElement("div");
      tick.className = "ruler-tick";
      tick.style.left = `${pct * 100}%`;
      tick.textContent = formatTime(s);
      el.editorTimelineRuler.appendChild(tick);
    }
  }

  function renderEditorTimelineClips() {
    el.tlTrackVideo.innerHTML = "";
    el.tlTrackText.innerHTML = "";
    el.tlTrackSubtitles.innerHTML = "";

    const scenes = state.storyboard?.scenes || [
      { title: "Scene 1", duration: 2.5, voiceover: "In the ancient forest..." },
      { title: "Scene 2", duration: 2.5, voiceover: "Walking with purpose..." },
      { title: "Scene 3", duration: 2.5, voiceover: "Hanuman appears..." },
      { title: "Scene 4", duration: 2.5, voiceover: "Divine devotion..." }
    ];

    const totalDur = state.storyboard?.duration || state.duration;
    let accumulated = 0;

    scenes.forEach((scene, idx) => {
      const dur = parseFloat(scene.duration) || 2.5;
      const leftPct = (accumulated / totalDur) * 100;
      const widthPct = (dur / totalDur) * 100;
      accumulated += dur;

      // 1. Video Clip Block
      const clip = document.createElement("div");
      clip.className = `clip-block ${idx === state.activeSceneIndex ? "active" : ""}`;
      clip.style.left = `${leftPct}%`;
      clip.style.width = `calc(${widthPct}% - 2px)`;
      clip.innerHTML = `
        <img src="/storage/images/scene${idx + 1}.png" class="clip-thumb" onerror="this.src='/storage/images/style_${state.selectedStyle}.svg'">
        <span class="clip-title">Scene ${idx + 1} (${dur}s)</span>
      `;
      clip.addEventListener("click", () => selectEditorScene(idx));
      el.tlTrackVideo.appendChild(clip);

      // 3. Subtitles Clip Block
      const subClip = document.createElement("div");
      subClip.className = "clip-block";
      subClip.style.left = `${leftPct}%`;
      subClip.style.width = `calc(${widthPct}% - 2px)`;
      subClip.style.borderColor = "var(--primary-blue)";
      subClip.innerHTML = `<span class="clip-title" style="color:var(--primary-blue)">💬 ${escapeHtml(scene.voiceover || scene.title || '')}</span>`;
      el.tlTrackSubtitles.appendChild(subClip);
    });

    // 2. Text Layer Clip Block
    if (state.textLayers.length > 0) {
      const textClip = document.createElement("div");
      textClip.className = "clip-block";
      textClip.style.left = "0%";
      textClip.style.width = "75%";
      textClip.style.borderColor = "#9333EA";
      textClip.innerHTML = `<span class="clip-title" style="color:#A855F7">🔤 ${escapeHtml(state.textLayers[0].text)}</span>`;
      el.tlTrackText.appendChild(textClip);
    }
  }

  // Timeline Scrubbing on Ruler Click
  el.editorTrackLanesScroll.addEventListener("click", (e) => {
    const rect = el.editorTimelineRuler.getBoundingClientRect();
    const clickX = e.clientX - rect.left + el.editorTrackLanesScroll.scrollLeft;
    const totalW = el.editorTimelineRuler.offsetWidth || 1200;
    const pct = Math.max(0, Math.min(1, clickX / totalW));
    const targetTime = pct * (el.editorMainVideo.duration || state.duration);
    el.editorMainVideo.currentTime = targetTime;
    updateEditorPlayhead(pct);
  });

  // Timeline Tools (Split, Trim, Delete, Duplicate)
  el.btnTlSplit.addEventListener("click", () => {
    if (!state.storyboard?.scenes) return;
    const idx = state.activeSceneIndex;
    const scene = state.storyboard.scenes[idx];
    if (!scene) return;

    recordUndo();
    const halfDur = parseFloat((scene.duration / 2).toFixed(1));
    scene.duration = halfDur;
    state.storyboard.scenes.splice(idx + 1, 0, {
      ...scene,
      title: `${scene.title} (Part 2)`
    });
    renderEditorTimelineClips();
    renderEditorMediaList();
    alert(`Scene ${idx + 1} split into two clips!`);
  });

  el.btnTlDuplicate.addEventListener("click", () => {
    if (!state.storyboard?.scenes) return;
    const idx = state.activeSceneIndex;
    const scene = state.storyboard.scenes[idx];
    if (!scene) return;

    recordUndo();
    state.storyboard.scenes.splice(idx + 1, 0, JSON.parse(JSON.stringify(scene)));
    renderEditorTimelineClips();
    renderEditorMediaList();
  });

  el.btnTlDelete.addEventListener("click", () => {
    if (!state.storyboard?.scenes) return;
    if (state.storyboard.scenes.length <= 1) return alert("Must keep at least 1 scene.");
    recordUndo();
    state.storyboard.scenes.splice(state.activeSceneIndex, 1);
    state.activeSceneIndex = Math.max(0, state.activeSceneIndex - 1);
    renderEditorTimelineClips();
    renderEditorMediaList();
    selectEditorScene(state.activeSceneIndex);
  });

  // Timeline Zoom Slider
  el.editorTlZoomSlider.addEventListener("input", (e) => {
    state.zoomLevel = parseInt(e.target.value, 10);
    renderEditorTimelineRuler();
  });
  el.btnTlZoomIn.addEventListener("click", () => {
    state.zoomLevel = Math.min(200, state.zoomLevel + 20);
    el.editorTlZoomSlider.value = state.zoomLevel;
    renderEditorTimelineRuler();
  });
  el.btnTlZoomOut.addEventListener("click", () => {
    state.zoomLevel = Math.max(50, state.zoomLevel - 20);
    el.editorTlZoomSlider.value = state.zoomLevel;
    renderEditorTimelineRuler();
  });

  /* ==========================================================================
     7. AUTOSAVE, EXPORTING & YOUTUBE INTEGRATION
     ========================================================================== */

  // Save Project
  el.editorBtnSaveProject.addEventListener("click", saveProject);

  async function saveProject() {
    el.editorAutosaveTag.textContent = "● Saving...";
    try {
      await fetch("/api/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: el.editorProjectTitleInput.value.trim() || state.projectTitle,
          style: state.selectedStyle,
          duration: state.storyboard?.duration || state.duration,
          scenesCount: state.storyboard?.scenes?.length || 0,
          aspectRatio: state.aspectRatio,
          storyboard: state.storyboard,
          adjustments: state.adjustments,
          textLayers: state.textLayers
        })
      });
      el.editorAutosaveTag.textContent = "● Autosaved";
    } catch (_) {
      el.editorAutosaveTag.textContent = "● Offline";
    }
  }

  // Periodic Autosave every 15 seconds
  setInterval(() => {
    if (state.currentMode === "advanced-editor") saveProject();
  }, 15000);

  // Undo / Redo
  function recordUndo() {
    state.undoStack.push(JSON.parse(JSON.stringify(state.adjustments)));
    if (state.undoStack.length > 25) state.undoStack.shift();
  }
  el.editorBtnUndo.addEventListener("click", () => {
    if (state.undoStack.length > 0) {
      state.redoStack.push(JSON.parse(JSON.stringify(state.adjustments)));
      state.adjustments = state.undoStack.pop();
      applyEditorVideoAdjustments();
    }
  });
  el.editorBtnRedo.addEventListener("click", () => {
    if (state.redoStack.length > 0) {
      state.undoStack.push(JSON.parse(JSON.stringify(state.adjustments)));
      state.adjustments = state.redoStack.pop();
      applyEditorVideoAdjustments();
    }
  });

  // Export MP4 Master Movie
  el.editorBtnExportMp4.addEventListener("click", () => {
    openExportModal();
    startMasterRender();
  });

  el.btnMainRenderVideo?.addEventListener("click", () => {
    openExportModal();
    startMasterRender();
  });

  document.getElementById("btnMainOpenEditorSide")?.addEventListener("click", () => {
    openAdvancedEditor();
  });

  // ==========================================================================
  // TELUGU CHARACTER LIP-SYNC VISEME PLAYBACK ENGINE
  // ==========================================================================
  let lipSyncVisemes = null;
  let isLipSyncActive = false;

  async function loadLipSyncVisemes() {
    try {
      const narrationText = state.storyboard?.narration || state.projectTitle || "నమస్కారం";
      const res = await fetch("/api/lipsync-visemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: narrationText,
          projectId: state.projectId || "proj_default",
          wavFilename: "narration.wav"
        })
      });
      const data = await res.json();
      if (data.success && data.visemes) {
        lipSyncVisemes = data.visemes;
        console.log(`[LipSync] Loaded ${lipSyncVisemes.cues?.length || 0} phonetic viseme cues.`);
        return lipSyncVisemes;
      }
    } catch (err) {
      console.warn("[LipSync] Notice:", err.message);
    }
    return null;
  }

  function setMouthViseme(visemeId, phoneme = "", note = "") {
    const shapes = [
      document.getElementById("viseme0"),
      document.getElementById("viseme1"),
      document.getElementById("viseme2"),
      document.getElementById("viseme3")
    ];
    shapes.forEach((s, idx) => {
      if (s) s.classList.toggle("d-none", idx !== visemeId);
    });

    const badge = document.getElementById("visemeBadge");
    const detail = document.getElementById("phonemeDetail");
    const names = [
      "Viseme 0: Closed (Rest/P/B/M)",
      "Viseme 1: Half-Open (Consonants)",
      "Viseme 2: Round (Vowels O/U)",
      "Viseme 3: Wide Open (Vowels A/AA)"
    ];
    if (badge) badge.textContent = names[visemeId] || "Viseme: Rest";
    if (detail) {
      detail.textContent = phoneme ? `Phoneme: ${phoneme} | Telugu Audio Sync` : (note || "Telugu Lip-Sync Ready");
    }
  }

  function updateLipSyncOnTime(currentTime) {
    if (!lipSyncVisemes || !Array.isArray(lipSyncVisemes.cues) || lipSyncVisemes.cues.length === 0) {
      return;
    }
    const cues = lipSyncVisemes.cues;
    let activeCue = cues[0];
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].timeSeconds <= currentTime) {
        activeCue = cues[i];
      } else {
        break;
      }
    }
    if (activeCue) {
      setMouthViseme(activeCue.viseme, activeCue.phoneme);
    }
  }

  const mouthOverlay = document.getElementById("characterMouthOverlay");
  const btnToggleLipSync = document.getElementById("btnToggleLipSyncOverlay");

  btnToggleLipSync?.addEventListener("click", async () => {
    isLipSyncActive = !isLipSyncActive;
    if (mouthOverlay) mouthOverlay.classList.toggle("d-none", !isLipSyncActive);
    btnToggleLipSync.classList.toggle("btn-purple", isLipSyncActive);
    btnToggleLipSync.classList.toggle("btn-outline", !isLipSyncActive);

    if (isLipSyncActive && !lipSyncVisemes) {
      await loadLipSyncVisemes();
    }
  });

  el.mainStudioPlayer?.addEventListener("timeupdate", (e) => {
    if (isLipSyncActive) {
      updateLipSyncOnTime(e.target.currentTime);
    }
  });

  el.mainStudioPlayer?.addEventListener("play", async () => {
    if (isLipSyncActive && !lipSyncVisemes) {
      await loadLipSyncVisemes();
    }
  });

  el.mainStudioPlayer?.addEventListener("pause", () => {
    if (isLipSyncActive) setMouthViseme(0, "", "Paused");
  });

  el.mainStudioPlayer?.addEventListener("ended", () => {
    if (isLipSyncActive) setMouthViseme(0, "", "Audio Completed");
  });

  let currentRenderJobId = null;
  let renderPollInterval = null;

  function setStageRow(rowEl, iconEl, labelEl, status, labelText) {
    if (!rowEl || !iconEl || !labelEl) return;
    iconEl.className = "stage-status-icon " + status;
    if (status === "done") {
      iconEl.textContent = "✓";
      labelEl.textContent = labelText || "Completed";
      labelEl.className = "text-xs text-green";
    } else if (status === "active") {
      iconEl.textContent = "⚙";
      labelEl.textContent = labelText || "In Progress";
      labelEl.className = "text-xs text-purple";
    } else {
      iconEl.textContent = "○";
      labelEl.textContent = labelText || "Waiting";
      labelEl.className = "text-xs text-secondary";
    }
  }

  function openExportModal() {
    el.exportModal.classList.add("active");
    el.exportActionButtons.classList.add("d-none");
    if (el.exportPercentBadge) el.exportPercentBadge.textContent = "0%";
    if (el.exportProgressFill) {
      el.exportProgressFill.style.width = "0%";
      el.exportProgressFill.style.background = "linear-gradient(90deg, #8b5cf6, #ec4899)";
    }
    if (el.exportStatusHeading) el.exportStatusHeading.textContent = "Initiating Production Render...";
    if (el.exportStatusDetail) el.exportStatusDetail.textContent = "Submitting job to background FFmpeg render queue...";

    setStageRow(el.stageRowVoice, el.iconStageVoice, el.labelStageVoice, "wait", "Waiting");
    setStageRow(el.stageRowScenes, el.iconStageScenes, el.labelStageScenes, "wait", "Waiting");
    setStageRow(el.stageRowStitch, el.iconStageStitch, el.labelStageStitch, "wait", "Waiting");
    setStageRow(el.stageRowComposite, el.iconStageComposite, el.labelStageComposite, "wait", "Waiting");
    setStageRow(el.stageRowFinalize, el.iconStageFinalize, el.labelStageFinalize, "wait", "Waiting");
  }

  el.btnCloseExportModal?.addEventListener("click", () => el.exportModal.classList.remove("active"));
  el.btnMinimizeExport?.addEventListener("click", () => el.exportModal.classList.remove("active"));

  async function startMasterRender() {
    try {
      if (!state.storyboard) {
        try {
          const sbRes = await fetch("/api/storyboard");
          const sbData = await sbRes.json();
          if (sbData && sbData.scenes && sbData.scenes.length > 0) {
            state.storyboard = sbData;
          }
        } catch (_) { }
      }
      if (!state.storyboard || !state.storyboard.scenes || state.storyboard.scenes.length === 0) {
        throw new Error("Please generate a story screenplay first in Step 2 before rendering the master video.");
      }

      if (renderPollInterval) {
        clearInterval(renderPollInterval);
        renderPollInterval = null;
      }

      setStageRow(el.stageRowVoice, el.iconStageVoice, el.labelStageVoice, "active", "Initializing");
      if (el.exportPercentBadge) el.exportPercentBadge.textContent = "5%";
      if (el.exportProgressFill) el.exportProgressFill.style.width = "5%";
      if (el.exportStatusHeading) el.exportStatusHeading.textContent = "Queueing Render Job...";
      if (el.exportStatusDetail) el.exportStatusDetail.textContent = "Validating locked characters, visual style and scene narration...";

      const res = await fetch("/api/render-job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboard: state.storyboard,
          aspectRatio: state.aspectRatio,
          duration: state.storyboard?.duration || state.duration,
          bgmVolume: state.bgmVolume,
          adjustments: state.adjustments,
          language: state.selectedLanguage
        })
      });
      const data = await res.json();
      if (!data.success || !data.jobId) throw new Error(data.error || "Failed to start render job");

      currentRenderJobId = data.jobId;
      if (el.exportJobIdLabel) el.exportJobIdLabel.textContent = `JOB: ${currentRenderJobId.slice(0, 16)}`;

      renderPollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/render-job/status?jobId=${currentRenderJobId}`);
          const pollData = await pollRes.json();
          if (!pollData.success || !pollData.job) return;

          const job = pollData.job;
          const pct = Math.max(5, Math.min(100, Math.round(job.progress || 0)));

          if (el.exportPercentBadge) el.exportPercentBadge.textContent = `${pct}%`;
          if (el.exportProgressFill) el.exportProgressFill.style.width = `${pct}%`;
          if (el.exportStatusHeading) el.exportStatusHeading.textContent = job.stage || "Rendering Master Video...";
          if (el.exportStatusDetail) el.exportStatusDetail.textContent = job.message || "Encoding audio-reactive scene clips...";

          // Stage 1: Voice
          if (pct >= 25) {
            setStageRow(el.stageRowVoice, el.iconStageVoice, el.labelStageVoice, "done", "Voice Ready");
          } else {
            setStageRow(el.stageRowVoice, el.iconStageVoice, el.labelStageVoice, "active", "Synthesizing");
          }

          // Stage 2: Scene Clips
          if (pct >= 60) {
            setStageRow(el.stageRowScenes, el.iconStageScenes, el.labelStageScenes, "done", "Clips Cached");
          } else if (pct >= 25) {
            setStageRow(el.stageRowScenes, el.iconStageScenes, el.labelStageScenes, "active", "Camera Zoom/Pan");
          }

          // Stage 3: Seamless Transitions
          if (pct >= 80) {
            setStageRow(el.stageRowStitch, el.iconStageStitch, el.labelStageStitch, "done", "Transitions Done");
          } else if (pct >= 60) {
            setStageRow(el.stageRowStitch, el.iconStageStitch, el.labelStageStitch, "active", "XFade Blending");
          }

          // Stage 4: Waveform & Subtitles
          if (pct >= 95) {
            setStageRow(el.stageRowComposite, el.iconStageComposite, el.labelStageComposite, "done", "Captions Added");
          } else if (pct >= 80) {
            setStageRow(el.stageRowComposite, el.iconStageComposite, el.labelStageComposite, "active", "Wave & Vignette");
          }

          // Stage 5: Master Video
          if (job.status === "completed") {
            clearInterval(renderPollInterval);
            renderPollInterval = null;

            setStageRow(el.stageRowFinalize, el.iconStageFinalize, el.labelStageFinalize, "done", "Master MP4 Ready");
            if (el.exportPercentBadge) el.exportPercentBadge.textContent = "100%";
            if (el.exportProgressFill) el.exportProgressFill.style.width = "100%";
            if (el.exportStatusHeading) el.exportStatusHeading.textContent = "🎉 Master Movie Ready!";
            if (el.exportStatusDetail) el.exportStatusDetail.textContent = `Completed in ${job.durationSec || 6}s with full character consistency.`;
            if (el.exportActionButtons) el.exportActionButtons.classList.remove("d-none");

            const vUrl = `/api/video?_t=${Date.now()}`;
            if (el.mainStudioPlayer) el.mainStudioPlayer.src = vUrl;
            if (el.editorMainVideo) el.editorMainVideo.src = vUrl;

            el.pipeStepRender?.classList.add("completed");
            el.pipeStepRender?.classList.remove("active");
          } else if (job.status === "failed") {
            clearInterval(renderPollInterval);
            renderPollInterval = null;
            if (el.exportStatusHeading) el.exportStatusHeading.textContent = "Export Failed";
            if (el.exportStatusDetail) el.exportStatusDetail.textContent = "Error: " + (job.error || "FFmpeg render error");
            if (el.exportPercentBadge) el.exportPercentBadge.textContent = "Failed";
            if (el.exportProgressFill) el.exportProgressFill.style.background = "#ef4444";
          }
        } catch (pollErr) {
          console.warn("Poll status notice:", pollErr.message);
        }
      }, 800);

    } catch (err) {
      if (el.exportStatusHeading) el.exportStatusHeading.textContent = "Export Failed";
      if (el.exportStatusDetail) el.exportStatusDetail.textContent = "Error: " + err.message;
      if (el.exportPercentBadge) el.exportPercentBadge.textContent = "Error";
    }
  }

  // YouTube 1-Click Publishing
  el.btnMainPublishYt.addEventListener("click", publishYouTubeDirect);
  el.btnExportPublishYt.addEventListener("click", publishYouTubeDirect);

  async function publishYouTubeDirect() {
    const title = el.editorProjectTitleInput.value.trim() || state.projectTitle;
    const confirmPub = confirm(`Publish "${title}" directly to your YouTube Channel (My Story Star)?`);
    if (!confirmPub) return;

    try {
      const res = await fetch("/api/upload-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: `${state.storyboard?.description || ''}\n\n#Shorts #Cartoon #Animation #${state.selectedStyle}`,
          privacyStatus: "public",
          tags: ["cartoon", "shorts", "animation", state.selectedStyle]
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload failed");
      alert(`🎉 Published successfully to YouTube!\nVideo ID: ${data.videoId}\nWatch: https://youtu.be/${data.videoId}`);
    } catch (err) {
      alert("YouTube Error: " + err.message);
    }
  }

  /* ==========================================================================
     5. STEP 3: SPACIOUS CHARACTER REFERENCE & CONSISTENCY HUB
     ========================================================================== */

  async function loadCharactersFromBackend() {
    try {
      const res = await fetch("/api/characters");
      const data = await res.json();
      if (data.success && Array.isArray(data.characters) && data.characters.length > 0) {
        state.characters = data.characters;
        if (!state.activeCharacterId || !state.characters.find(c => c.id === state.activeCharacterId)) {
          state.activeCharacterId = state.characters[0].id;
        }
      }
    } catch (err) {
      console.warn("Could not load characters from backend:", err.message);
    }
    renderCharacterStudio();
  }

  function getActiveCharacter() {
    if (!state.characters || state.characters.length === 0) return null;
    return state.characters.find(c => c.id === state.activeCharacterId) || state.characters[0];
  }

  function formatViewName(view) {
    if (view === "full") return "Full Body";
    if (view === "profile") return "Side Profile";
    if (view === "closeup") return "Facial Close-up";
    if (view === "action") return "Action Pose";
    return "Front Portrait";
  }

  function renderCharacterStudio() {
    if (!el.charStudioCardsGrid) return;
    el.charStudioCardsGrid.innerHTML = "";

    if (!state.characters || state.characters.length === 0) {
      el.charStudioCardsGrid.innerHTML = `
        <div class="empty-characters-box">
          <span style="font-size:36px;">🎭</span>
          <p class="font-bold text-sm mt-1">No characters created yet</p>
          <p class="text-xs text-secondary mb-2">Generate a story in Step 2 to auto-extract characters, or click "+ Add Character" to design your own.</p>
          <button class="btn btn-purple btn-xs shadow-glow" id="btnEmptyAddChar">➕ Add First Character</button>
        </div>
      `;
      document.getElementById("btnEmptyAddChar")?.addEventListener("click", () => el.btnCharAddNew?.click());
      return;
    }

    state.characters.forEach((char, idx) => {
      const card = document.createElement("div");
      card.className = "char-card";
      const isLead = idx === 0;
      const imageUrl = char.primaryImage || "/storage/images/style_realistic.svg";
      const shortDesc = char.description || char.personality || "Consistent visual anchor for story scenes.";

      card.innerHTML = `
        <div class="char-card-media">
          <img src="${imageUrl}" class="char-card-img" alt="${escapeHtml(char.name)}" onerror="this.src='/storage/images/style_realistic.svg'">
          <div class="char-card-badges">
            <span class="badge ${isLead ? 'gold' : 'blue'}">${isLead ? '⭐ Lead Role' : (escapeHtml(char.role || 'Character'))}</span>
            <span class="badge purple">${escapeHtml(char.gender || 'Character')}</span>
            <span class="char-lock-badge ${char.locked ? 'locked' : 'unlocked'}" data-id="${char.id}" title="Click to ${char.locked ? 'Unlock Consistency' : 'Lock Consistency'}">${char.locked ? '🔒 Locked' : '🔓 Unlocked'}</span>
          </div>
        </div>
        <div class="char-card-body">
          <div class="flex-between align-center mb-1">
            <h4 class="char-card-name">${escapeHtml(char.name)}</h4>
            <span class="text-xs text-secondary">${escapeHtml(char.age || 'Ageless')}</span>
          </div>
          <p class="char-card-desc">${escapeHtml(shortDesc)}</p>
          <div class="char-card-traits">
            ${char.costume ? `<span class="trait-tag">👔 ${escapeHtml(char.costume.split(',')[0])}</span>` : ''}
            ${char.skinTone ? `<span class="trait-tag">🎨 ${escapeHtml(char.skinTone.split(',')[0])}</span>` : ''}
          </div>
          <div class="char-card-actions">
            <button class="btn btn-purple btn-xs flex-1 btn-card-edit" data-id="${char.id}">
              <span>✏️</span> Edit Profile
            </button>
            <button class="btn btn-outline btn-xs flex-1 btn-card-regen" data-id="${char.id}">
              <span>🔄</span> Regenerate
            </button>
            <button class="btn btn-ghost btn-xs btn-card-del text-red" data-id="${char.id}" title="Delete character">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      `;

      // Event listeners for card buttons
      card.querySelector(".char-lock-badge")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch("/api/lock-character", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterId: char.id, locked: !char.locked })
          });
          const d = await res.json();
          if (d.success) {
            char.locked = d.locked;
            renderCharacterStudio();
          }
        } catch (err) {
          alert("Could not toggle character lock: " + err.message);
        }
      });
      card.querySelector(".btn-card-edit").addEventListener("click", () => openCharEditModal(char.id));
      card.querySelector(".btn-card-regen").addEventListener("click", () => regenerateCharacterCard(char.id, card));
      card.querySelector(".btn-card-del").addEventListener("click", () => deleteCharacterById(char.id));

      el.charStudioCardsGrid.appendChild(card);
    });
  }

  async function regenerateCharacterCard(charId, cardEl) {
    const char = state.characters.find(c => c.id === charId);
    if (!char) return;
    const btn = cardEl.querySelector(".btn-card-regen");
    btn.disabled = true;
    btn.innerHTML = "<span>⏳</span> Rendering...";

    try {
      const res = await fetch("/api/generate-character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: char.id,
          viewType: "front",
          characterStyle: state.selectedStyle,
          category: state.selectedCategory
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Generation failed");

      if (data.character) {
        const idx = state.characters.findIndex(c => c.id === char.id);
        if (idx >= 0) state.characters[idx] = data.character;
      }
      const img = cardEl.querySelector(".char-card-img");
      if (img) img.src = `${data.url}&_t=${Date.now()}`;
    } catch (err) {
      alert("Regeneration failed: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = "<span>🔄</span> Regenerate";
    }
  }

  async function deleteCharacterById(charId) {
    const char = state.characters.find(c => c.id === charId);
    if (!char) return;
    if (state.characters.length <= 1) {
      return alert("At least one character must remain in the project.");
    }
    const confirmDel = confirm(`Are you sure you want to delete character "${char.name}"?`);
    if (!confirmDel) return;

    try {
      await fetch("/api/delete-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: char.id })
      });
      state.characters = state.characters.filter(c => c.id !== char.id);
      renderCharacterStudio();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  }

  // Open Character Edit Modal
  function openCharEditModal(charId) {
    const char = state.characters.find(c => c.id === charId) || state.characters[0];
    if (!char) return;
    state.activeCharacterId = char.id;
    state.activeCharacterView = "front";

    if (el.charEditHiddenId) el.charEditHiddenId.value = char.id;
    if (el.charModalTitle) el.charModalTitle.textContent = `Edit Character Profile: ${char.name}`;

    // Populate form fields
    if (el.charInputName) el.charInputName.value = char.name || "";
    if (el.charSelectRole) el.charSelectRole.value = char.role || char.type || "Lead Protagonist";
    if (el.charSelectAge) el.charSelectAge.value = char.age || "";
    if (el.charSelectGender) el.charSelectGender.value = char.gender || "Female";
    if (el.charInputSkin) el.charInputSkin.value = char.skinTone || "";
    if (el.charInputBody) el.charInputBody.value = char.bodyType || "";
    if (el.charInputHair) el.charInputHair.value = char.hairStyle || "";
    if (el.charInputFace) el.charInputFace.value = char.faceStructure || "";
    if (el.charInputCostume) el.charInputCostume.value = char.costume || "";
    if (el.charInputAccessories) el.charInputAccessories.value = char.accessories || "";
    if (el.charInputFeatures) el.charInputFeatures.value = char.identifyingFeatures || "";
    if (el.charInputPersonality) el.charInputPersonality.value = char.personality || "";
    if (el.charInputDescription) el.charInputDescription.value = char.description || "";

    // Showcase image
    const previewUrl = char.primaryImage || "/storage/images/style_realistic.svg";
    state.activePreviewImageUrl = previewUrl;
    if (el.charModalShowcaseImg) el.charModalShowcaseImg.src = previewUrl;
    if (el.charModalViewLabel) el.charModalViewLabel.textContent = "Front Portrait";
    if (el.btnModalDownloadImg) {
      el.btnModalDownloadImg.href = previewUrl;
      el.btnModalDownloadImg.download = `${char.name.replace(/\s+/g, "_")}_reference.png`;
    }

    // Reset perspective tabs
    el.charModalPerspTabs?.forEach(tab => {
      tab.classList.toggle("active", tab.getAttribute("data-view") === "front");
    });

    renderModalViewsGrid(char);
    el.charEditModal?.classList.add("active");
  }

  function renderModalViewsGrid(char) {
    if (!el.charModalViewsGrid) return;
    el.charModalViewsGrid.innerHTML = "";
    const views = Array.isArray(char.views) && char.views.length > 0 ? char.views : [
      { id: "v_front", type: "Front Portrait", url: char.primaryImage || "/storage/images/style_realistic.svg" }
    ];

    if (el.charModalViewCount) {
      el.charModalViewCount.textContent = `${views.length} View${views.length === 1 ? '' : 's'}`;
    }

    views.forEach(v => {
      const thumb = document.createElement("div");
      thumb.className = `char-view-thumb ${state.activePreviewImageUrl === v.url ? 'active' : ''}`;
      thumb.innerHTML = `
        <img src="${v.url}" alt="${escapeHtml(v.type)}" onerror="this.src='/storage/images/style_realistic.svg'">
        <span class="thumb-label">${escapeHtml(v.type)}</span>
      `;
      thumb.addEventListener("click", () => {
        state.activePreviewImageUrl = v.url;
        if (el.charModalShowcaseImg) el.charModalShowcaseImg.src = v.url;
        if (el.charModalViewLabel) el.charModalViewLabel.textContent = v.type;
        if (el.btnModalDownloadImg) el.btnModalDownloadImg.href = v.url;
        renderModalViewsGrid(char);
      });
      el.charModalViewsGrid.appendChild(thumb);
    });
  }

  function closeCharEditModal() {
    el.charEditModal?.classList.remove("active");
  }

  el.btnCloseCharEditModal?.addEventListener("click", closeCharEditModal);

  // Perspective Switcher in Modal
  el.charModalPerspTabs?.forEach(tab => {
    tab.addEventListener("click", () => {
      el.charModalPerspTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const view = tab.getAttribute("data-view") || "front";
      state.activeCharacterView = view;
      if (el.charModalViewLabel) el.charModalViewLabel.textContent = formatViewName(view);

      const char = getActiveCharacter();
      if (char && Array.isArray(char.views)) {
        const matching = char.views.find(v => v.type.toLowerCase().includes(view.toLowerCase()));
        if (matching) {
          state.activePreviewImageUrl = matching.url;
          if (el.charModalShowcaseImg) el.charModalShowcaseImg.src = matching.url;
        }
      }
    });
  });

  // Modal: Set as Primary Reference
  el.btnModalSetPrimary?.addEventListener("click", async () => {
    const char = getActiveCharacter();
    if (!char || !state.activePreviewImageUrl) return;

    try {
      const res = await fetch("/api/set-primary-character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: char.id,
          imageUrl: state.activePreviewImageUrl
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to set primary reference");

      char.primaryImage = state.activePreviewImageUrl;
      alert(`⭐ Approved! This image is now the locked primary visual reference for ${char.name}.`);
      renderCharacterStudio();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

  // Modal: Regenerate View
  el.btnModalRegenView?.addEventListener("click", async () => {
    const char = getActiveCharacter();
    if (!char) return;

    el.btnModalRegenView.disabled = true;
    el.btnModalRegenView.innerHTML = `<span>⏳</span> Rendering ${formatViewName(state.activeCharacterView)}...`;

    try {
      const res = await fetch("/api/generate-character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: char.id,
          viewType: state.activeCharacterView,
          characterStyle: state.selectedStyle,
          category: state.selectedCategory
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Generation failed");

      state.activePreviewImageUrl = data.url;
      if (el.charModalShowcaseImg) el.charModalShowcaseImg.src = `${data.url}&_t=${Date.now()}`;
      if (data.character) {
        const idx = state.characters.findIndex(c => c.id === char.id);
        if (idx >= 0) state.characters[idx] = data.character;
        renderModalViewsGrid(data.character);
      }
      renderCharacterStudio();
    } catch (err) {
      alert("Generation failed: " + err.message);
    } finally {
      el.btnModalRegenView.disabled = false;
      el.btnModalRegenView.innerHTML = "<span>🔄</span> Regenerate View";
    }
  });

  // Modal: Save Profile
  async function saveCharProfileFromForm() {
    const char = getActiveCharacter();
    if (!char) return null;

    const updated = {
      ...char,
      name: el.charInputName ? el.charInputName.value.trim() || char.name : char.name,
      role: el.charSelectRole ? el.charSelectRole.value : char.role,
      type: el.charSelectRole ? el.charSelectRole.value : char.role,
      age: el.charSelectAge ? el.charSelectAge.value : char.age,
      gender: el.charSelectGender ? el.charSelectGender.value : char.gender,
      skinTone: el.charInputSkin ? el.charInputSkin.value.trim() : char.skinTone,
      bodyType: el.charInputBody ? el.charInputBody.value.trim() : char.bodyType,
      hairStyle: el.charInputHair ? el.charInputHair.value.trim() : char.hairStyle,
      faceStructure: el.charInputFace ? el.charInputFace.value.trim() : char.faceStructure,
      costume: el.charInputCostume ? el.charInputCostume.value.trim() : char.costume,
      accessories: el.charInputAccessories ? el.charInputAccessories.value.trim() : char.accessories,
      identifyingFeatures: el.charInputFeatures ? el.charInputFeatures.value.trim() : char.identifyingFeatures,
      personality: el.charInputPersonality ? el.charInputPersonality.value.trim() : char.personality,
      description: el.charInputDescription ? el.charInputDescription.value.trim() : char.description
    };

    const res = await fetch("/api/save-character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to save");

    const idx = state.characters.findIndex(c => c.id === char.id);
    if (idx >= 0) state.characters[idx] = data.character;
    renderCharacterStudio();
    return data.character;
  }

  el.btnSaveCharProfile?.addEventListener("click", async () => {
    try {
      const saved = await saveCharProfileFromForm();
      if (saved) {
        alert(`💾 Profile for "${saved.name}" saved successfully!`);
        closeCharEditModal();
      }
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  });

  el.btnSaveAndGenerateChar?.addEventListener("click", async () => {
    try {
      await saveCharProfileFromForm();
      el.btnModalRegenView?.click();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

  // Modal: Upload Reference Photo
  el.btnModalUploadPhoto?.addEventListener("click", () => el.charPhotoFileInput?.click());
  el.charPhotoFileInput?.addEventListener("change", (e) => {
    const char = getActiveCharacter();
    if (!char) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/upload-character-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: char.id,
            filename: file.name,
            data: reader.result
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Upload failed");

        if (data.character) {
          const idx = state.characters.findIndex(c => c.id === char.id);
          if (idx >= 0) state.characters[idx] = data.character;
        }
        state.activePreviewImageUrl = data.url;
        if (el.charModalShowcaseImg) el.charModalShowcaseImg.src = data.url;
        renderCharacterStudio();
        alert(`✨ Reference photo uploaded for ${char.name}!`);
      } catch (err) {
        alert("Upload error: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  // Hub Button: Generate All Character References
  el.btnCharGenAll?.addEventListener("click", async () => {
    if (!state.characters || state.characters.length === 0) return alert("No characters to generate.");

    el.btnCharGenAll.disabled = true;
    for (let i = 0; i < state.characters.length; i++) {
      const char = state.characters[i];
      el.btnCharGenAll.innerHTML = `<span>⏳</span> (${i + 1}/${state.characters.length}) Rendering ${escapeHtml(char.name)}...`;
      try {
        const res = await fetch("/api/generate-character-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: char.id,
            viewType: "front",
            characterStyle: state.selectedStyle,
            category: state.selectedCategory
          })
        });
        const data = await res.json();
        if (data.success && data.character) {
          state.characters[i] = data.character;
          renderCharacterStudio();
        }
      } catch (e) {
        console.warn(`Error generating for ${char.name}:`, e.message);
      }
    }
    el.btnCharGenAll.disabled = false;
    el.btnCharGenAll.innerHTML = "<span>⚡</span> Generate All References";
    alert("✨ All character reference portraits generated successfully!");
  });

  // Hub Button: Add New Character
  el.btnCharAddNew?.addEventListener("click", async () => {
    const name = prompt("Enter character name (e.g. Maya, Dr. John, Ghost Girl, Baby Dragon):", "New Character");
    if (!name || !name.trim()) return;

    const newChar = {
      id: `char_${Date.now()}`,
      name: name.trim(),
      role: "Lead Character",
      type: "Character",
      age: "Young Adult",
      gender: "Female",
      skinTone: "Natural smooth complexion",
      bodyType: "Graceful and expressive",
      hairStyle: "Neat styled hair",
      faceStructure: "Expressive friendly eyes and warm demeanor",
      costume: "Casual contemporary outfit matching story atmosphere",
      accessories: "Character motif accessory",
      identifyingFeatures: "Distinguishing facial warmth and unique styling",
      personality: "Curious, thoughtful and courageous",
      description: `${name.trim()}, character in ${state.selectedCategory} genre with distinct costume and expressive facial features.`,
      primaryImage: "/storage/images/style_realistic.svg",
      views: []
    };

    try {
      const res = await fetch("/api/save-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChar)
      });
      const data = await res.json();
      if (data.success && data.character) {
        state.characters.push(data.character);
        renderCharacterStudio();
        openCharEditModal(data.character.id);
      }
    } catch (err) {
      alert("Error adding character: " + err.message);
    }
  });

  // Upload Custom Reference Photo
  el.btnUploadCharPhoto?.addEventListener("click", () => el.charPhotoFileInput?.click());
  el.charPhotoFileInput?.addEventListener("change", (e) => {
    const char = getActiveCharacter();
    if (!char) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/upload-character-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: char.id,
            filename: file.name,
            data: reader.result
          })
        });
        const data = await res.json();
        if (data.success && data.character) {
          const idx = state.characters.findIndex(c => c.id === char.id);
          if (idx >= 0) state.characters[idx] = data.character;
          state.activePreviewImageUrl = data.url;
          renderCharacterStudio();
          alert(`✨ Custom reference photo uploaded and set for ${char.name}!`);
        }
      } catch (err) {
        alert("Upload error: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  // View B: In-Scene Character Replacement Suite
  function triggerSceneReplaceSelection(sceneNum) {
    if (!el.charReplaceSceneSelect) return;
    el.charReplaceSceneSelect.value = sceneNum;
    if (el.compBeforeImg) {
      el.compBeforeImg.src = `/storage/images/scene${sceneNum}.png?_t=${Date.now()}`;
    }
  }

  el.charReplaceSceneSelect?.addEventListener("change", (e) => {
    triggerSceneReplaceSelection(e.target.value);
  });

  el.quickArchetypePills?.forEach((pill) => {
    pill.addEventListener("click", () => {
      el.quickArchetypePills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      if (el.charReplaceNew) el.charReplaceNew.value = pill.getAttribute("data-archetype");
    });
  });

  el.btnPreviewCharReplace?.addEventListener("click", async () => {
    const sceneNum = parseInt(el.charReplaceSceneSelect.value, 10) || 1;
    const originalChar = el.charReplaceOriginal ? el.charReplaceOriginal.value.trim() : "";
    const newChar = el.charReplaceNew ? el.charReplaceNew.value.trim() : "";
    const expression = el.charReplaceExpression ? el.charReplaceExpression.value : "";
    const action = el.charReplacePose ? el.charReplacePose.value : "";

    if (!newChar) return alert("Please specify the new character description.");

    el.btnPreviewCharReplace.disabled = true;
    el.btnPreviewCharReplace.innerHTML = "<span>⏳</span> Generating AI Character Replacement...";

    try {
      const res = await fetch("/api/character-replace-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneNumber: sceneNum,
          originalCharacter: originalChar,
          newCharacter: newChar,
          expression,
          action,
          characterStyle: state.selectedStyle
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Preview generation failed");

      state.activeReplacePreview = data.previewFilename;
      if (el.compBeforeImg) el.compBeforeImg.src = `/storage/images/scene${sceneNum}.png?_t=${Date.now()}`;
      if (el.compAfterImg) el.compAfterImg.src = `${data.previewUrl}&_t=${Date.now()}`;
      if (el.replacePreviewContainer) el.replacePreviewContainer.classList.remove("d-none");
    } catch (err) {
      alert("Replacement preview error: " + err.message);
    } finally {
      el.btnPreviewCharReplace.disabled = false;
      el.btnPreviewCharReplace.innerHTML = "<span>✨</span> Generate Preview";
    }
  });

  el.btnApplyCharReplace?.addEventListener("click", async () => {
    const sceneNum = parseInt(el.charReplaceSceneSelect.value, 10) || 1;
    if (!state.activeReplacePreview) return alert("Please generate a replacement preview first.");

    el.btnApplyCharReplace.disabled = true;
    el.btnApplyCharReplace.innerHTML = "<span>⏳</span> Applying...";

    try {
      const res = await fetch("/api/character-replace-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneNumber: sceneNum,
          previewFilename: state.activeReplacePreview,
          adjustments: state.adjustments
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Application failed");

      alert(`🎉 Character replacement applied to Scene ${sceneNum}!\nVideo clip updated.`);

      // Refresh thumbnails and editor
      renderEditorMediaList();
      renderMainSceneCards();
      renderEditorTimelineClips();
      el.editorMainVideo.src = `/api/video?_t=${Date.now()}`;
    } catch (err) {
      alert("Application error: " + err.message);
    } finally {
      el.btnApplyCharReplace.disabled = false;
      el.btnApplyCharReplace.innerHTML = "<span>✅</span> Apply to Scene";
    }
  });

  el.btnApplyCharReplaceAll?.addEventListener("click", async () => {
    const newChar = el.charReplaceNew ? el.charReplaceNew.value.trim() : "";
    if (!newChar) return alert("Please specify the new character description.");
    const confirmAll = confirm(`Apply consistent replacement of "${newChar}" across ALL scenes in the project?`);
    if (!confirmAll) return;

    el.btnApplyCharReplaceAll.disabled = true;
    el.btnApplyCharReplaceAll.innerHTML = "<span>⏳</span> Propagating to All Scenes...";

    try {
      const res = await fetch("/api/character-replace-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: state.storyboard?.scenes || [],
          newCharacter: newChar,
          characterStyle: state.selectedStyle
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Propagation failed");

      alert("🎉 Character consistency successfully updated across all scenes!");
      renderEditorMediaList();
      renderMainSceneCards();
      renderEditorTimelineClips();
      el.editorMainVideo.src = `/api/video?_t=${Date.now()}`;
    } catch (err) {
      alert("Propagation error: " + err.message);
    } finally {
      el.btnApplyCharReplaceAll.disabled = false;
      el.btnApplyCharReplaceAll.innerHTML = "<span>🌐</span> Apply All Scenes";
    }
  });

  // Instagram Reels Modal
  function openInstagramModal() {
    const title = el.editorProjectTitleInput ? el.editorProjectTitleInput.value.trim() : state.projectTitle;
    const tags = `#AnimioAI #AIAnimation #Mythology #Shorts #AnimioStudio #${state.selectedStyle} #CreativeVideoStudio`;
    if (el.instaCaptionText) {
      el.instaCaptionText.value = `${title} ✨\n\nExperience this cinematic journey created with Animio AI – AI Creative Video Studio.\n\n${tags}`;
    }
    if (el.instagramModal) el.instagramModal.classList.add("active");
  }

  el.btnMainPublishInsta?.addEventListener("click", openInstagramModal);
  el.editorBtnExportInsta?.addEventListener("click", openInstagramModal);
  el.btnCloseInstaModal?.addEventListener("click", () => el.instagramModal?.classList.remove("active"));
  el.btnCopyInstaCaption?.addEventListener("click", () => {
    if (el.instaCaptionText) {
      navigator.clipboard.writeText(el.instaCaptionText.value);
      el.btnCopyInstaCaption.innerHTML = "<span>✅</span> Copied to Clipboard!";
      setTimeout(() => {
        el.btnCopyInstaCaption.innerHTML = "<span>📋</span> Copy Caption & Tags";
      }, 2000);
    }
  });

  /* ==========================================================================
     UTILITIES & INITIALIZATION
     ========================================================================== */

  function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function initStudioApp() {
    try {
      const res = await fetch("/api/project-context");
      const ctx = await res.json();
      if (ctx.success) {
        if (ctx.storyboard) {
          state.storyboard = ctx.storyboard;
          state.projectTitle = ctx.storyboard.title || state.projectTitle;
          if (el.mainProjectTitle) el.mainProjectTitle.textContent = state.projectTitle;
          if (el.editorProjectTitleInput) el.editorProjectTitleInput.value = state.projectTitle;
          if (ctx.storyboard.duration && el.mainSelectDuration) {
            el.mainSelectDuration.value = String(ctx.storyboard.duration);
          }
        }
        if (ctx.characters && Array.isArray(ctx.characters) && ctx.characters.length > 0) {
          state.characters = ctx.characters;
          state.activeCharacterId = ctx.characters[0].id;
        }
        updatePipelineUI(ctx.pipeline);
      }
    } catch (_) {
      try {
        const res = await fetch("/api/storyboard");
        const data = await res.json();
        if (data && data.scenes && data.scenes.length > 0) {
          state.storyboard = data;
          state.projectTitle = data.title || state.projectTitle;
          if (el.mainProjectTitle) el.mainProjectTitle.textContent = state.projectTitle;
          if (el.editorProjectTitleInput) el.editorProjectTitleInput.value = state.projectTitle;
        }
      } catch (__) { }
      await loadCharactersFromBackend();
    }
    renderMainSceneCards();
    renderCharacterStudio();
    renderCaptionsInspector();
    renderEditorTimelineRuler();
    renderEditorTimelineClips();
  }

  // Global Studio Export
  window.StudioSuite = {
    state,
    openAdvancedEditor,
    closeAdvancedEditor
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStudioApp);
  } else {
    initStudioApp();
  }

})();
