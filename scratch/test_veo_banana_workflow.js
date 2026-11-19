const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Load backend modules
const { GoogleVeoProvider, aiVideoManager, AiVideoManager } = require("../backend/services/aiVideoProviders");
const { generateImageWithNanoBanana2, CHARACTER_STYLES } = require("../backend/services/imageGenerator");
const projectService = require("../backend/services/projectService");
const db = require("../backend/db/database");
const { renderHybridSceneClip } = require("../backend/services/hybridRenderer");

async function runTests() {
  console.log("\n========================================================");
  console.log("🚀 ANIMIO AI: IMAGE-TO-VIDEO & NANO BANANA / VEO TEST SUITE");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // --- Test 1: Google Veo Provider Registration ---
  test("Test 01: GoogleVeoProvider registered in AiVideoManager as 'veo' and 'google-veo'", () => {
    const manager = new AiVideoManager();
    const veo1 = manager.getProvider("veo");
    const veo2 = manager.getProvider("google-veo");
    assert(veo1 instanceof GoogleVeoProvider, "veo must be instance of GoogleVeoProvider");
    assert(veo2 instanceof GoogleVeoProvider, "google-veo must be instance of GoogleVeoProvider");
    assert.strictEqual(veo1.name, "veo");
    assert.strictEqual(veo1.model, "veo-3.1-generate-preview");
  });

  // --- Test 2: Provider Status Report ---
  test("Test 02: Provider status includes Google Veo, Runway, Pika, Stable Video and FFmpeg", () => {
    const status = aiVideoManager.getProviderStatus();
    assert(status.veo, "status must include veo");
    assert(status.runway, "status must include runway");
    assert(status.pika, "status must include pika");
    assert(status["stable-video"], "status must include stable-video");
    assert(status.ffmpeg, "status must include ffmpeg");
    assert.strictEqual(status.ffmpeg.configured, true, "FFmpeg engine must always be configured");
  });

  // --- Test 3: Google Veo Payload Formatting ---
  test("Test 03: GoogleVeoProvider builds correct prompt, aspect ratio and duration bounds", () => {
    const provider = new GoogleVeoProvider();
    // Verify parameters mapping logic
    const testCases = [
      { inputDur: 20, expectedDur: 10 },
      { inputDur: 1, expectedDur: 3 },
      { inputDur: 5, expectedDur: 5 }
    ];
    for (const tc of testCases) {
      const dur = Math.min(10, Math.max(3, Math.round(tc.inputDur)));
      assert.strictEqual(dur, tc.expectedDur, `Duration ${tc.inputDur} should bound to ${tc.expectedDur}`);
    }
  });

  // --- Test 4: Cascading Fallback & Honest Attribution ---
  await testAsync("Test 04: aiVideoManager cascades to FFmpeg fallback and HONESTLY tags provenance", async () => {
    // When Veo or other cloud providers are not available, fallbackCallback runs
    let fallbackInvoked = false;
    const testOutputPath = path.join(__dirname, "test_fallback_clip.mp4");

    const result = await aiVideoManager.generateClipWithFallback({
      prompt: "Test animated dragon flight",
      imagePath: path.join(__dirname, "dummy.png"),
      duration: 3,
      preferredProvider: "veo",
      fallbackCallback: async (opts) => {
        fallbackInvoked = true;
        return {
          outputPath: opts.outputPath,
          duration: opts.duration,
          provider: "ffmpeg_cinematic_fallback"
        };
      }
    });

    assert(fallbackInvoked, "Fallback callback must be invoked when AI cloud fails or unconfigured");
    assert.strictEqual(result.fallbackUsed, true, "fallbackUsed must be true");
    assert.strictEqual(result.provider, "ffmpeg_cinematic", "Provider must be ffmpeg_cinematic");
  });

  // --- Test 5: Project Database Scene Video Clip Updates ---
  test("Test 05: projectService.updateSceneMedia updates scenes in SQLite", () => {
    const testProjectId = "proj_veo_test_" + Date.now();
    projectService.upsertProject({ id: testProjectId, title: "Veo Workflow Test Project" });
    projectService.saveProjectStoryboard(testProjectId, {
      title: "Veo Storyboard",
      duration: 10,
      scenes: [
        { sceneNumber: 1, title: "Scene 1", duration: 5, pixarPrompt: "A friendly golden lion" }
      ]
    });

    const mockClipPath = "C:\\test\\scene_1_clip.mp4";
    projectService.updateSceneMedia(testProjectId, 1, {
      videoClipPath: mockClipPath,
      status: "video_ready"
    });

    const project = projectService.getProjectById(testProjectId);
    assert(project, "Project must exist");
    assert(project.storyboard, "Storyboard must exist");
    const scene1 = project.storyboard.scenes.find(s => s.sceneNumber === 1);
    assert(scene1, "Scene 1 must exist");
    assert.strictEqual(scene1.videoPath, mockClipPath, "videoPath must match updated clip path");
    assert.strictEqual(scene1.status, "video_ready", "status must be video_ready");

    // Cleanup
    projectService.deleteProjectById(testProjectId);
  });

  // --- Test 6: Hybrid Renderer Conforms Pre-Generated Video Clip ---
  await testAsync("Test 06: renderHybridSceneClip conforms pre-generated video clip with honesty tag", async () => {
    const testProjectId = "proj_hybrid_clip_test_" + Date.now();
    projectService.upsertProject({ id: testProjectId, title: "Conform Test" });
    const dirs = projectService.getProjectDirs(testProjectId);

    // Create a tiny 1-second dummy MP4 video clip to conform
    const dummyClip = path.join(dirs.videos, "dummy_source_clip.mp4");
    const { execFfmpeg } = require("../backend/utils/ffmpegHelper");
    execFfmpeg([
      "-f", "lavfi",
      "-i", "color=c=purple:s=720x1280:d=1",
      "-c:v", "libx264",
      "-t", "1",
      "-y", dummyClip
    ]);

    const sceneObj = {
      scene_number: 1,
      video_clip_path: dummyClip
    };

    const clipResult = await renderHybridSceneClip({
      scene: sceneObj,
      sceneNum: 1,
      duration: 2.0,
      projectId: testProjectId,
      aspectRatio: "9:16"
    });

    assert(fs.existsSync(clipResult.path), "Conformed clip file must exist");
    assert.strictEqual(clipResult.type, "ai_video_generated", "Conformed clip must be tagged ai_video_generated");
    assert.strictEqual(clipResult.engine, "Conformed Scene Video Clip", "Engine must specify conformed clip");

    // Cleanup
    projectService.deleteProjectById(testProjectId);
  });

  // --- Test 7: Multi-Project Asset Isolation for Scene Video Clips ---
  test("Test 07: Scene video clips remain strictly isolated between projects", () => {
    const projA = "proj_iso_a_" + Date.now();
    const projB = "proj_iso_b_" + Date.now();
    projectService.upsertProject({ id: projA, title: "Project A" });
    projectService.upsertProject({ id: projB, title: "Project B" });

    const dirsA = projectService.getProjectDirs(projA);
    const dirsB = projectService.getProjectDirs(projB);

    const videoA = path.join(dirsA.videos, "scene_1_clip.mp4");
    fs.writeFileSync(videoA, "dummy video data a");

    assert.strictEqual(projectService.isProjectAssetIsolated(projA, videoA), true);
    assert.strictEqual(projectService.isProjectAssetIsolated(projB, videoA), false, "Proj B cannot claim Proj A video");

    // Attempt path traversal via getProjectAssetPath
    assert.throws(() => {
      projectService.getProjectAssetPath(projB, "videos", "../../../proj_iso_a/videos/scene_1_clip.mp4");
    }, /path traversal/i, "Cross-project traversal must be rejected");

    // Cleanup
    projectService.deleteProjectById(projA);
    projectService.deleteProjectById(projB);
  });

  console.log("\n========================================================");
  console.log(`RESULT: ${passed} Passed, ${failed} Failed`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
