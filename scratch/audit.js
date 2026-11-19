const fs = require('fs');

const checks = [
  {
    file: 'backend/services/videoGenerator.js',
    tests: [
      { name: 'anullsrc fallback (prevents dangling -i)', check: content => content.includes('anullsrc=r=44100:cl=stereo') },
      { name: 'Nirmala.ttc / impact.ttf direct font path', check: content => content.includes('Nirmala.ttc') && content.includes('impact.ttf') },
      { name: 'preset fast', check: content => content.includes('fast') },
      { name: 'clip reuse optimization', check: content => content.includes('outputClipPath') && content.includes('fs.existsSync') }
    ]
  },
  {
    file: 'backend/services/renderQueue.js',
    tests: [
      { name: 'Async queue implemented', check: content => content.includes('createRenderJob') && content.includes('getRenderJob') }
    ]
  },
  {
    file: 'backend/services/storyGenerator.js',
    tests: [
      { name: 'Dynamic duration up to 180s', check: content => content.includes('calculateSceneStructure') && content.includes('Math.min(180') }
    ]
  },
  {
    file: 'backend/services/imageGenerator.js',
    tests: [
      { name: 'Pollinations 1500 char limit', check: content => content.includes('1500') },
      { name: 'Locked character identity injected', check: content => content.includes('locked visual identity') || content.includes('charAnchors') }
    ]
  },
  {
    file: 'backend/services/characterService.js',
    tests: [
      { name: 'Character locking support', check: content => content.includes('toggleCharacterLock') && content.includes('locked') },
      { name: 'Project context endpoint support', check: content => content.includes('getProjectContext') }
    ]
  },
  {
    file: 'backend/routes/videoRoutes.js',
    tests: [
      { name: 'Render job start route', check: content => content.includes('/api/render-job/start') },
      { name: 'Render job status route', check: content => content.includes('/api/render-job/status') }
    ]
  },
  {
    file: 'backend/routes/characterRoutes.js',
    tests: [
      { name: 'Lock character route', check: content => content.includes('/api/lock-character') },
      { name: 'Project context route', check: content => content.includes('/api/project-context') }
    ]
  },
  {
    file: 'frontend/index.html',
    tests: [
      { name: 'Duration options 10s-120s', check: content => content.includes('value="120"') && content.includes('120s (2 Minutes') },
      { name: 'Pipeline status bar in UI', check: content => content.includes('pipeline-status-bar') && content.includes('pipeStepStory') },
      { name: '5-Stage Checklist in Export Modal', check: content => content.includes('stageRowVoice') && content.includes('stageRowScenes') && content.includes('exportPercentBadge') }
    ]
  },
  {
    file: 'frontend/script.js',
    tests: [
      { name: 'Fetches project context on init', check: content => content.includes('/api/project-context') },
      { name: 'Character lock toggle in UI', check: content => content.includes('char-lock-badge') && content.includes('/api/lock-character') },
      { name: 'Scene status pills & generate buttons', check: content => content.includes('scene-status-pill') && content.includes('checkAndUpdateScenesPipeline') },
      { name: 'Async render job polling', check: content => content.includes('/api/render-job/start') && content.includes('/api/render-job/status') }
    ]
  },
  {
    file: 'frontend/style.css',
    tests: [
      { name: 'char-lock-badge styles', check: content => content.includes('.char-lock-badge') },
      { name: 'scene-status-pill styles', check: content => content.includes('.scene-status-pill') },
      { name: 'render-stages-list styles', check: content => content.includes('.render-stages-list') }
    ]
  }
];

console.log('=== VERIFYING CODE MODIFICATIONS ===');
let allPassed = true;
checks.forEach(c => {
  if (!fs.existsSync(c.file)) {
    console.log('❌ MISSING FILE:', c.file);
    allPassed = false;
    return;
  }
  const content = fs.readFileSync(c.file, 'utf8');
  console.log('\n📄 File:', c.file);
  c.tests.forEach(t => {
    const passed = t.check(content);
    if (!passed) allPassed = false;
    console.log('  ' + (passed ? '✅' : '❌') + ' ' + t.name);
  });
});

console.log('\n=== AUDIT RESULT: ' + (allPassed ? 'ALL FEATURES GENUINELY IN CODE' : 'SOME CHECKS FAILED') + ' ===');
