/**
 * Helper utilities for managing the multi-file results structure
 * 
 * Structure: data/results/{candidateModel}/{judgeModel}/{timestamp}.json
 */

import fs from 'fs';
import path from 'path';
import { ModelRun } from './types';

const RESULTS_DIR = path.join(__dirname, '../data/results');

function sanitizeFileName(name: string): string {
  // Replace characters that are problematic in file/folder names
  return name.replace(/[^a-zA-Z0-9.-]/g, '-');
}

function getTimestampFileName(timestamp: string): string {
  // Convert ISO timestamp to filesystem-safe format
  // e.g., "2025-12-28T07:18:26.388Z" -> "2025-12-28T07-18-26-388Z"
  return timestamp.replace(/:/g, '-').replace(/\./g, '-');
}

/**
 * Save evaluation results to the multi-file structure
 */
export function saveResults(runs: ModelRun[], candidateModel: string, judgeModel: string, timestamp: string): void {
  const candidateDir = sanitizeFileName(candidateModel);
  const judgeDir = sanitizeFileName(judgeModel);
  const dirPath = path.join(RESULTS_DIR, candidateDir, judgeDir);
  
  // Create directory structure
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const fileName = `${getTimestampFileName(timestamp)}.json`;
  const filePath = path.join(dirPath, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(runs, null, 2));
}

/**
 * Load all results from the multi-file structure
 */
export function loadAllResults(): ModelRun[] {
  if (!fs.existsSync(RESULTS_DIR)) {
    return [];
  }
  
  const allResults: ModelRun[] = [];
  
  // Traverse the directory structure
  const candidateDirs = fs.readdirSync(RESULTS_DIR);
  
  for (const candidateDir of candidateDirs) {
    const candidatePath = path.join(RESULTS_DIR, candidateDir);
    
    if (!fs.statSync(candidatePath).isDirectory()) {
      continue;
    }
    
    const judgeDirs = fs.readdirSync(candidatePath);
    
    for (const judgeDir of judgeDirs) {
      const judgePath = path.join(candidatePath, judgeDir);
      
      if (!fs.statSync(judgePath).isDirectory()) {
        continue;
      }
      
      const resultFiles = fs.readdirSync(judgePath).filter(f => f.endsWith('.json'));
      
      for (const file of resultFiles) {
        const filePath = path.join(judgePath, file);
        try {
          const runs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (Array.isArray(runs)) {
            allResults.push(...runs);
          }
        } catch (error) {
          console.warn(`Warning: Failed to load results from ${filePath}:`, error);
        }
      }
    }
  }
  
  return allResults;
}

/**
 * Get the path where results for a specific combination would be saved
 */
export function getResultsPath(candidateModel: string, judgeModel: string, timestamp: string): string {
  const candidateDir = sanitizeFileName(candidateModel);
  const judgeDir = sanitizeFileName(judgeModel);
  const fileName = `${getTimestampFileName(timestamp)}.json`;
  
  return path.join(RESULTS_DIR, candidateDir, judgeDir, fileName);
}

/**
 * Check if the old results.json exists and should be migrated
 */
export function checkForOldFormat(): boolean {
  const oldPath = path.join(__dirname, '../data/results.json');
  return fs.existsSync(oldPath);
}

/**
 * Load results from the old single-file format (for backward compatibility)
 */
export function loadOldFormatResults(): ModelRun[] {
  const oldPath = path.join(__dirname, '../data/results.json');
  if (!fs.existsSync(oldPath)) {
    return [];
  }
  
  try {
    return JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
  } catch (error) {
    console.warn('Warning: Failed to load old format results.json:', error);
    return [];
  }
}
