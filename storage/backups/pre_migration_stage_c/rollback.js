/**
 * ToonCraft Studio - Emergency Rollback Utility for Stage C
 * Restores flat JSON files from pre_migration_stage_c backup in case of migration abort.
 */
const fs = require("fs");
const path = require("path");

const backupDir = path.join(__dirname);
const storageDir = path.join(__dirname, "..");
const outputDir = path.join(__dirname, "../../output");

console.log("==================================================");
console.log("   🔄 EMERGENCY ROLLBACK UTILITY (STAGE C)        ");
console.log("==================================================");

try {
  // 1. Restore characters.json
  const charBackup = path.join(backupDir, "characters.json");
  const charDest = path.join(storageDir, "characters.json");
  if (fs.existsSync(charBackup)) {
    fs.copyFileSync(charBackup, charDest);
    console.log("✅ Restored storage/characters.json successfully.");
  }

  // 2. Restore projects.json
  const projBackup = path.join(backupDir, "projects.json");
  const projDest = path.join(storageDir, "projects.json");
  if (fs.existsSync(projBackup)) {
    fs.copyFileSync(projBackup, projDest);
    console.log("✅ Restored storage/projects.json successfully.");
  }

  // 3. Optional: Remove database file if corrupted
  const dbFile = path.join(storageDir, "tooncraft.db");
  const dbWal = path.join(storageDir, "tooncraft.db-wal");
  const dbShm = path.join(storageDir, "tooncraft.db-shm");
  [dbFile, dbWal, dbShm].forEach(f => {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        console.log(`🗑️ Removed ${path.basename(f)}`);
      } catch (e) {
        console.warn(`Could not remove ${f}:`, e.message);
      }
    }
  });

  console.log("==================================================");
  console.log("✅ Rollback completed successfully!");
  console.log("==================================================");
} catch (err) {
  console.error("❌ Rollback failed:", err);
  process.exit(1);
}
