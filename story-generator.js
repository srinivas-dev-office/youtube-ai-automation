
const fs = require("fs");
const path = require("path");

const stories = [
  {
    title: "Funny Football Challenge",
    story: "A football player shoots, but the goalkeeper makes a hilarious save."
  },
  {
    title: "The Pizza-Stealing Cat",
    story: "A sneaky cat tries to steal a pizza and gets caught."
  },
  {
    title: "Robot Dance Competition",
    story: "A robot tries dancing and surprises everyone."
  },
  {
    title: "The Superfast Rabbit",
    story: "A rabbit challenges a turtle to a race but gets distracted."
  },
  {
    title: "The Magic Mango",
    story: "A magical mango bounces around a kitchen."
  }
];

const outputDir = path.join(__dirname, "output");
const outputFile = path.join(outputDir, "story-ideas.json");

fs.mkdirSync(outputDir, { recursive: true });

console.log("================================");
console.log("YOUTUBE CARTOON STORY GENERATOR");
console.log("================================");

stories.forEach((story, index) => {
  console.log(`${index + 1}. ${story.title}`);
  console.log(`   ${story.story}`);
});

fs.writeFileSync(
  outputFile,
  JSON.stringify(stories, null, 2),
  "utf8"
);

console.log("\nTotal ideas:", stories.length);
console.log("Saved to:", outputFile);

