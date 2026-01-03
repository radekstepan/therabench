#!/usr/bin/env node

/**
 * Import Script: Apply overrides from a specified file to questions.json
 * 
 * This script reads questions.json and the specified overrides file, then applies the
 * question overrides to update the actual questions with user modifications.
 * 
 * Usage:
 *   node bin/overrides.js <path-to-overrides-file>
 * 
 * Example:
 *   node bin/overrides.js data/overrides.json
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');

// Get overrides file path from command line argument
const OVERRIDES_FILE = process.argv[2];

if (!OVERRIDES_FILE) {
  console.error('❌ Error: Please provide the path to the overrides file');
  console.error(`\nUsage: node ${path.relative(process.cwd(), __filename)} <path-to-overrides-file>`);
  console.error(`Example: node ${path.relative(process.cwd(), __filename)} data/overrides.json`);
  process.exit(1);
}

// Resolve the overrides file path (supports both relative and absolute paths)
const resolvedOverridesPath = path.resolve(OVERRIDES_FILE);

/**
 * Read and parse a JSON file
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Write data to a JSON file with formatting
 */
function writeJsonFile(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Find and update a question by ID
 */
function updateQuestion(questions, overrideQuestion) {
  const index = questions.findIndex(q => q.id === overrideQuestion.id);
  
  if (index === -1) {
    console.log(`⚠️  Question ${overrideQuestion.id} not found in questions.json`);
    return false;
  }
  
  // Create the updated question by merging the override
  const updatedQuestion = {
    ...questions[index],
    ...overrideQuestion,
    // Remove the 'modified' flag from the final question
  };
  
  // Remove the 'modified' flag if present
  delete updatedQuestion.modified;
  
  questions[index] = updatedQuestion;
  
  console.log(`✓ Updated question ${overrideQuestion.id}: "${overrideQuestion.title}"`);
  return true;
}

/**
 * Main execution
 */
function main() {
  console.log('🔄 Importing question overrides...\n');
  console.log(`Source: ${path.relative(process.cwd(), QUESTIONS_FILE)}`);
  console.log(`Overrides: ${resolvedOverridesPath}\n`);
  
  // Check if the overrides file exists
  if (!fileExists(resolvedOverridesPath)) {
    console.error(`❌ Error: Overrides file not found at ${resolvedOverridesPath}`);
    process.exit(1);
  }
  
  // Read the files
  const questionsData = readJsonFile(QUESTIONS_FILE);
  const overridesData = readJsonFile(resolvedOverridesPath);
  
  if (!questionsData) {
    process.exit(1);
  }
  
  if (!overridesData) {
    console.error(`❌ Could not read ${resolvedOverridesPath}`);
    process.exit(1);
  }
  
  // Extract questions arrays
  const questions = questionsData.questions;
  const overrideQuestions = overridesData.questions;
  
  if (!questions || !Array.isArray(questions)) {
    console.error('❌ Invalid questions.json format');
    process.exit(1);
  }
  
  if (!overrideQuestions || !Array.isArray(overrideQuestions)) {
    console.error('❌ Invalid overrides.json format');
    process.exit(1);
  }
  
  console.log(`Found ${questions.length} questions in questions.json`);
  console.log(`Found ${overrideQuestions.length} overrides in overrides.json\n`);
  
  // Apply overrides
  let updateCount = 0;
  const skippedQuestions = [];
  
  overrideQuestions.forEach(override => {
    if (override.id && override.modified) {
      if (updateQuestion(questions, override)) {
        updateCount++;
      }
    } else if (override.id && !override.modified) {
      skippedQuestions.push(override.id);
    }
  });
  
  // Warn about skipped questions
  if (skippedQuestions.length > 0) {
    console.log(`\n⏭️  Skipped ${skippedQuestions.length} questions (not marked as modified):`);
    skippedQuestions.forEach(id => console.log(`   - ${id}`));
  }
  
  console.log(`\n📊 Summary: Updated ${updateCount} questions`);
  
  if (updateCount > 0) {
    // Backup the original file
    const backupPath = QUESTIONS_FILE + '.backup';
    try {
      fs.copyFileSync(QUESTIONS_FILE, backupPath);
      console.log(`💾 Backup created at ${backupPath}`);
    } catch (error) {
      console.warn(`⚠️  Could not create backup: ${error.message}`);
    }
    
    // Write the updated questions
    const success = writeJsonFile(QUESTIONS_FILE, questionsData);
    
    if (success) {
      console.log('\n✅ Import completed successfully!');
    } else {
      console.error('\n❌ Failed to write updated questions.json');
      process.exit(1);
    }
  } else {
    console.log('\nℹ️  No questions to update');
  }
}

// Run the script
main();
