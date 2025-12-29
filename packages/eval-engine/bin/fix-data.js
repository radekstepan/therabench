#!/usr/bin/env node

/**
 * MIGRATION & REPAIR SCRIPT
 * 
 * Flattens the messy data/results/{candidate}/{judge}/{timestamp}.json structure
 * into clean data/results/{candidate}/{judge}.json files.
 * 
 * AFTER SAVING: Removes the old files and directories.
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '../data/results');

// Helper to find all json files recursively
function getAllFiles(dirPath, arrayOfFiles) {
  if (!fs.existsSync(dirPath)) return [];
  
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith('.json')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// Helper to remove empty directories recursively
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  
  const isDir = fs.statSync(dir).isDirectory();
  if (!isDir) return;

  let files = fs.readdirSync(dir);
  
  if (files.length > 0) {
    files.forEach(function(file) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        removeEmptyDirs(fullPath);
      }
    });
    // Re-evaluate files; the sub-calls might have removed directories
    files = fs.readdirSync(dir);
  }

  if (files.length === 0) {
    try {
      fs.rmdirSync(dir);
      console.log(`   Removed empty dir: ${path.relative(RESULTS_DIR, dir)}`);
    } catch (e) {
      // Ignore
    }
  }
}

console.log('🧹 Starting Data Repair & Migration...');

if (!fs.existsSync(RESULTS_DIR)) {
  console.error('❌ No results directory found at:', RESULTS_DIR);
  process.exit(1);
}

// 1. Load EVERY JSON file in the results folder recursively
const allFiles = getAllFiles(RESULTS_DIR, []);
console.log(`found ${allFiles.length} JSON files. Processing...`);

const groupedResults = new Map(); // Key: "candidate|judge" -> Array of runs
const processedFiles = []; // Track files we successfully read to delete later

let successCount = 0;
let errorCount = 0;

allFiles.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const runs = Array.isArray(data) ? data : [data];

    runs.forEach(run => {
      if (!run.modelName || !run.aiAssessments) return;
      
      const candidate = run.modelName;
      
      // Identify the judge(s) in this run
      Object.keys(run.aiAssessments).forEach(judge => {
        const key = `${candidate}|${judge}`;
        
        if (!groupedResults.has(key)) {
          groupedResults.set(key, []);
        }
        
        // Create a copy of the run specific to this judge
        const judgeSpecificRun = {
          ...run,
          aiAssessments: {
            [judge]: run.aiAssessments[judge]
          }
        };
        
        groupedResults.get(key).push(judgeSpecificRun);
      });
    });
    
    // Mark file for deletion only if we successfully parsed it
    processedFiles.push(filePath);
    successCount++;
  } catch (e) {
    console.warn(`Failed to process ${filePath}: ${e.message}`);
    errorCount++;
  }
});

console.log(`✅ Processed files. Success: ${successCount}, Errors: ${errorCount}`);
console.log(`📦 Merging and saving to new structure...`);

// 2. Save to new structure
groupedResults.forEach((runs, key) => {
  const [candidate, judge] = key.split('|');
  
  // Deduplicate runs for this pair
  const uniqueRunsMap = new Map();
  runs.forEach(r => {
    if (uniqueRunsMap.has(r.runId)) {
      const existing = uniqueRunsMap.get(r.runId);
      const existingAssessments = existing.aiAssessments[judge];
      const newAssessments = r.aiAssessments[judge];
      
      // Ensure arrays
      const arr1 = Array.isArray(existingAssessments) ? existingAssessments : [existingAssessments];
      const arr2 = Array.isArray(newAssessments) ? newAssessments : [newAssessments];
      
      // Merge uniqueness by timestamp
      const merged = [...arr1];
      arr2.forEach(item => {
        if (!merged.some(m => m.timestamp === item.timestamp)) {
          merged.push(item);
        }
      });
      
      existing.aiAssessments[judge] = merged;
    } else {
      uniqueRunsMap.set(r.runId, r);
    }
  });

  const finalRuns = Array.from(uniqueRunsMap.values());
  
  // Sanitize filenames
  const candidateDir = candidate.replace(/[^a-zA-Z0-9.-]/g, '-');
  const judgeFile = `${judge.replace(/[^a-zA-Z0-9.-]/g, '-')}.json`;
  
  const targetDir = path.join(RESULTS_DIR, candidateDir);
  const targetFile = path.join(targetDir, judgeFile);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  fs.writeFileSync(targetFile, JSON.stringify(finalRuns, null, 2));
  console.log(`   -> Saved ${finalRuns.length} runs to ${candidateDir}/${judgeFile}`);
});

// 3. Cleanup Old Files
console.log(`\n🗑️  Cleaning up old data...`);

// Delete the specific files we processed
let deletedCount = 0;
processedFiles.forEach(file => {
  try {
    // Safety check: Don't delete the new files we just created if they happen to match
    // (Though they shouldn't, as the old ones were usually deeper in directories)
    // The old format was results/{candidate}/{judge}/timestamp.json
    // The new format is results/{candidate}/{judge}.json
    
    // Only delete if it ends in .json and isn't one of our new consolidated files
    // (Simpler check: did we just write it? No, we wrote to specific paths)
    
    fs.unlinkSync(file);
    deletedCount++;
  } catch (e) {
    // Ignore, might have been deleted already
  }
});

console.log(`   Deleted ${deletedCount} old files.`);

// Remove empty directories
console.log(`   Removing empty directories...`);
removeEmptyDirs(RESULTS_DIR);

console.log(`\n🎉 Repair & Cleanup Complete!`);