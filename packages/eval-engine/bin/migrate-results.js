#!/usr/bin/env node

/**
 * Migration Script: Convert single results.json to multi-file structure
 * 
 * Old structure: data/results.json (single file with all results)
 * New structure: data/results/{candidateModel}/{judgeModel}/{timestamp}.json
 * 
 * Each ModelRun can have multiple judge assessments. This script will:
 * 1. Group results by candidateModel and judgeModel
 * 2. Create separate files for each combination
 * 3. Preserve all data including timestamps and runIds
 * 4. Back up the original results.json
 */

const fs = require('fs');
const path = require('path');

const RESULTS_PATH = path.join(__dirname, '../data/results.json');
const RESULTS_DIR = path.join(__dirname, '../data/results');
const BACKUP_PATH = path.join(__dirname, '../data/results.json.backup');

function sanitizeFileName(name) {
  // Replace characters that are problematic in file/folder names
  return name.replace(/[^a-zA-Z0-9.-]/g, '-');
}

function getTimestampFileName(timestamp) {
  // Convert ISO timestamp to filesystem-safe format
  // e.g., "2025-12-28T07:18:26.388Z" -> "2025-12-28T07-18-26-388Z"
  return timestamp.replace(/:/g, '-').replace(/\./g, '-');
}

function migrateResults() {
  console.log('🔄 Starting migration of results.json to multi-file structure...\n');

  // Check if results.json exists
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('❌ results.json not found at:', RESULTS_PATH);
    process.exit(1);
  }

  // Create backup
  console.log('📦 Creating backup of results.json...');
  fs.copyFileSync(RESULTS_PATH, BACKUP_PATH);
  console.log(`   Backup saved to: ${BACKUP_PATH}\n`);

  // Load results
  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
  console.log(`📊 Loaded ${results.length} result entries\n`);

  // Create results directory if it doesn't exist
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Group results by candidate model, judge model, and run timestamp
  const grouped = new Map();
  
  for (const run of results) {
    const candidateModel = sanitizeFileName(run.modelName);
    
    // Handle both old and new assessment formats
    const judges = new Set();
    
    // New format: aiAssessments object with judge model keys
    if (run.aiAssessments) {
      Object.keys(run.aiAssessments).forEach(judge => judges.add(judge));
    }
    
    // Old format: single aiAssessment with evaluatorModel
    if (run.aiAssessment && run.aiAssessment.evaluatorModel) {
      judges.add(run.aiAssessment.evaluatorModel);
    }
    
    // If no judges found, use "unknown-judge" as fallback
    if (judges.size === 0) {
      judges.add('unknown-judge');
    }
    
    // Create an entry for each judge
    judges.forEach(judge => {
      const sanitizedJudge = sanitizeFileName(judge);
      const key = `${candidateModel}/${sanitizedJudge}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      
      // Clone the run and only keep relevant judge assessments
      const clonedRun = { ...run };
      
      if (run.aiAssessments) {
        // Keep only this judge's assessments
        clonedRun.aiAssessments = {
          [judge]: run.aiAssessments[judge]
        };
      }
      
      // If this judge was in the old format, preserve it
      if (run.aiAssessment && run.aiAssessment.evaluatorModel === judge) {
        clonedRun.aiAssessment = run.aiAssessment;
      }
      
      grouped.get(key).push(clonedRun);
    });
  }

  console.log(`📁 Creating directory structure for ${grouped.size} combinations...\n`);

  let totalFiles = 0;
  
  // Write grouped results to separate files
  for (const [key, runs] of grouped.entries()) {
    const [candidateModel, judgeModel] = key.split('/');
    const dirPath = path.join(RESULTS_DIR, candidateModel, judgeModel);
    
    // Create directory structure
    fs.mkdirSync(dirPath, { recursive: true });
    
    // Group runs by timestamp to create one file per evaluation run
    const runsByTime = new Map();
    
    for (const run of runs) {
      const timeKey = run.timestamp;
      if (!runsByTime.has(timeKey)) {
        runsByTime.set(timeKey, []);
      }
      runsByTime.get(timeKey).push(run);
    }
    
    // Write one file per timestamp
    for (const [timestamp, runsAtTime] of runsByTime.entries()) {
      const fileName = `${getTimestampFileName(timestamp)}.json`;
      const filePath = path.join(dirPath, fileName);
      
      fs.writeFileSync(filePath, JSON.stringify(runsAtTime, null, 2));
      totalFiles++;
      
      console.log(`   ✅ ${candidateModel}/${judgeModel}/${fileName} (${runsAtTime.length} runs)`);
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   - Created ${totalFiles} files`);
  console.log(`   - Original file backed up to: results.json.backup`);
  console.log(`   - New structure: data/results/{candidateModel}/{judgeModel}/{timestamp}.json`);
  console.log(`\nYou can safely delete results.json after verifying the migration.`);
}

try {
  migrateResults();
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
