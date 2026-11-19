const { generateStoryboardFromNarration } = require('../backend/services/storyGenerator');

async function test() {
  const script = `Rama and Lakshmana continue walking in the foreground.
In the far background, Hanuman appears between two large trees.
Camera focuses on Rama and Lakshmana first.
Slowly shift focus to Hanuman.
Hanuman walks quietly, maintaining a respectful distance.
His tail moves naturally with each step.
Sunlight illuminates his face as he watches Rama with devotion.`;

  const sb = await generateStoryboardFromNarration(script, 10, "realistic");
  console.log("Resulting storyboard:\n", JSON.stringify(sb, null, 2));
}
test();
