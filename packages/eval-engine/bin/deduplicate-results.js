#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '../data/results');

function deduplicateArray(results) {
  const seen = new Map();
  
  for (const run of results) {
    const key = `${run.runId}|${run.questionId}`;
    // Keep the last occurrence (which likely has the most complete assessments)
    seen.set(key, run);
  }
  
  return Array.from(seen.values());
}

function processDirectory(dirPath, level = 0) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath);
  let totalFixed = 0;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      totalFixed += processDirectory(fullPath, level + 1);
    } else if (stats.isFile() && entry.endsWith('.json')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const results = JSON.parse(content);

        if (Array.isArray(results)) {
          const originalLength = results.length;
          const deduplicated = deduplicateArray(results);

          if (deduplicated.length < originalLength) {
            console.log(`📝 ${fullPath}`);
            console.log(`   Before: ${originalLength} results`);
            console.log(`   After: ${deduplicated.length} results`);
            console.log(`   Removed: ${originalLength - deduplicated.length} duplicates`);

            fs.writeFileSync(fullPath, JSON.stringify(deduplicated, null, 2));
            totalFixed += (originalLength - deduplicated.length);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${fullPath}:`, error.message);
      }
    }
  }

  return totalFixed;
}

console.log('🧹 Deduplicating results files...\n');
const totalDuplicatesRemoved = processDirectory(RESULTS_DIR);

if (totalDuplicatesRemoved > 0) {
  console.log(`\n✅ Cleanup complete! Removed ${totalDuplicatesRemoved} total duplicates.`);
} else {
  console.log('\n✅ No duplicates found. All files are clean!');
}
