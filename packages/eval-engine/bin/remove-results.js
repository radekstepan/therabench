#!/usr/bin/env node
'use strict';

/**
 * Remove responses by question ID from all result files
 * 
 * This script removes all ModelRun entries with a specific question ID
 * from the results directory structure.
 * 
 * Usage:
 *   node bin/remove-results.js <questionId>
 * 
 * Example:
 *   node bin/remove-results.js q10
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const RESULTS_DIR = path.join(DATA_DIR, 'results');

// Get question ID from command line argument
const QUESTION_ID = process.argv[2];

if (!QUESTION_ID) {
  console.error('❌ Error: Please provide a question ID');
  console.error(`\nUsage: node ${path.relative(process.cwd(), __filename)} <questionId>`);
  console.error(`Example: node ${path.relative(process.cwd(), __filename)} q10`);
  process.exit(1);
}

/**
 * Check if a directory exists
 */
function dirExists(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Read and parse a JSON file
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Write data to a JSON file with formatting
 */
function writeJsonFile(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ Error writing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Count runs by question ID in a file
 */
function countRunsByQuestionId(runs, questionId) {
  return runs.filter(run => run.questionId === questionId).length;
}

/**
 * Remove runs with the specified question ID
 */
function removeRunsByQuestionId(runs, questionId) {
  const originalCount = runs.length;
  const filteredRuns = runs.filter(run => run.questionId !== questionId);
  const removedCount = originalCount - filteredRuns.length;
  
  return { filteredRuns, removedCount };
}

/**
 * Main execution
 */
async function main() {
  console.log(`🗑️  Removing responses for question ID: ${QUESTION_ID}\n`);

  // Check if results directory exists
  if (!dirExists(RESULTS_DIR)) {
    console.log('ℹ️  No results directory found. Nothing to remove.');
    process.exit(0);
  }

  let totalFilesProcessed = 0;
  let totalRunsRemoved = 0;
  let totalFilesModified = 0;
  let totalEmptyFilesDeleted = 0;
  const directoriesModified = new Set();

  try {
    // Traverse: data/results/{candidate}/{judge}.json
    const candidateDirs = fs.readdirSync(RESULTS_DIR);

    for (const candidateDir of candidateDirs) {
      const candidatePath = path.join(RESULTS_DIR, candidateDir);
      if (!fs.statSync(candidatePath).isDirectory()) continue;

      console.log(`\n📁 Processing candidate: ${candidateDir}`);

      const files = fs.readdirSync(candidatePath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(candidatePath, file);
        totalFilesProcessed++;

        // Load the results file
        const runs = readJsonFile(filePath);
        if (!runs) continue;

        // Count how many runs will be removed
        const countToRemove = countRunsByQuestionId(runs, QUESTION_ID);
        
        if (countToRemove === 0) {
          console.log(`  ✓ ${file}: No matches for ${QUESTION_ID}`);
          continue;
        }

        // Remove runs with the specified question ID
        const { filteredRuns, removedCount } = removeRunsByQuestionId(runs, QUESTION_ID);
        totalRunsRemoved += removedCount;

        if (removedCount > 0) {
          console.log(`  ✂️  ${file}: Removed ${removedCount} response(s) for ${QUESTION_ID}`);
          
          // Write back the filtered results
          if (filteredRuns.length > 0) {
            const success = writeJsonFile(filePath, filteredRuns);
            if (success) {
              totalFilesModified++;
              directoriesModified.add(candidateDir);
            }
          } else {
            // If file is now empty, delete it
            fs.unlinkSync(filePath);
            console.log(`  🗑️  ${file}: File emptied and deleted (no remaining responses)`);
            totalFilesModified++;
            totalEmptyFilesDeleted++;
            directoriesModified.add(candidateDir);
          }
        }
      }

      // Check if candidate directory is now empty
      if (directoriesModified.has(candidateDir)) {
        const remainingFiles = fs.readdirSync(candidatePath).filter(f => f.endsWith('.json'));
        if (remainingFiles.length === 0) {
          fs.rmdirSync(candidatePath);
          console.log(`  🗑️  Directory ${candidateDir}: Empty and removed`);
          directoriesModified.delete(candidateDir); // Remove to avoid double counting
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total files processed: ${totalFilesProcessed}`);
    console.log(`Total responses removed: ${totalRunsRemoved}`);
    console.log(`Total files modified: ${totalFilesModified}`);
    console.log(`Empty files deleted: ${totalEmptyFilesDeleted}`);
    console.log(`Directories affected: ${directoriesModified.size}`);
    console.log('='.repeat(60));

    if (totalRunsRemoved === 0) {
      console.log('\nℹ️  No responses found with question ID:', QUESTION_ID);
    } else {
      console.log(`\n✅ Successfully removed ${totalRunsRemoved} response(s) for question ID: ${QUESTION_ID}`);
    }

  } catch (error) {
    console.error('\n❌ Error during removal:', error.message);
    process.exit(1);
  }
}

main();
