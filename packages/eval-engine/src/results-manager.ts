/**
 * Helper utilities for managing the results structure
 * 
 * New Structure: data/results/{candidateModel}/{judgeModel}.json
 * This avoids file fragmentation while keeping file sizes manageable.
 */

import fs from 'fs';
import path from 'path';
import { ModelRun, JudgeAssessment } from './types';

const RESULTS_DIR = path.join(__dirname, '../data/results');

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '-');
}

/**
 * Save evaluation results to the simplified file structure.
 * Merges new runs with existing data in the file.
 */
export function saveResults(runs: ModelRun[], candidateModel: string, judgeModel: string): void {
  const candidateDir = sanitizeFileName(candidateModel);
  const judgeFile = `${sanitizeFileName(judgeModel)}.json`;
  const dirPath = path.join(RESULTS_DIR, candidateDir);
  const filePath = path.join(dirPath, judgeFile);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 1. Load existing results for this candidate/judge pair
  let existingRuns: ModelRun[] = [];
  if (fs.existsSync(filePath)) {
    try {
      existingRuns = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.warn(`⚠️ Corrupt file found at ${filePath}, starting fresh for this batch.`);
    }
  }

  // 2. Create a map for merging
  const resultsMap = new Map<string, ModelRun>();
  existingRuns.forEach(r => resultsMap.set(r.runId, r));

  // 3. Merge new runs
  runs.forEach(newRun => {
    // Filter assessments to only this judge to prevent cross-contamination in this file
    const filteredAssessments: Record<string, JudgeAssessment[]> = {};
    if (newRun.aiAssessments && newRun.aiAssessments[judgeModel]) {
      filteredAssessments[judgeModel] = newRun.aiAssessments[judgeModel];
    }

    const runToSave = {
      ...newRun,
      aiAssessments: filteredAssessments
    };

    if (resultsMap.has(newRun.runId)) {
      const existing = resultsMap.get(newRun.runId)!;
      
      // Merge assessments for this judge
      const mergedAssessments = { ...existing.aiAssessments };
      const existingJudgments = mergedAssessments[judgeModel] || [];
      const newJudgments = filteredAssessments[judgeModel] || [];

      // Combine and deduplicate by timestamp/score
      const combined = [...existingJudgments];
      for (const newJ of newJudgments) {
        const isDuplicate = combined.some(e => e.timestamp === newJ.timestamp && e.score === newJ.score);
        if (!isDuplicate) {
          combined.push(newJ);
        }
      }
      
      mergedAssessments[judgeModel] = combined;

      resultsMap.set(newRun.runId, {
        ...existing,
        ...runToSave, // Update metadata
        aiAssessments: mergedAssessments
      });
    } else {
      resultsMap.set(newRun.runId, runToSave);
    }
  });
  
  // 4. Write back
  fs.writeFileSync(filePath, JSON.stringify(Array.from(resultsMap.values()), null, 2));
}

/**
 * Load all results from the directory structure
 */
export function loadAllResults(): ModelRun[] {
  if (!fs.existsSync(RESULTS_DIR)) {
    return [];
  }
  
  const allResultsMap = new Map<string, ModelRun>();
  
  // Traverse: data/results/{candidate}/{judge}.json
  try {
    const candidateDirs = fs.readdirSync(RESULTS_DIR);
    
    for (const candidateDir of candidateDirs) {
      const candidatePath = path.join(RESULTS_DIR, candidateDir);
      if (!fs.statSync(candidatePath).isDirectory()) continue;
      
      const files = fs.readdirSync(candidatePath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const filePath = path.join(candidatePath, file);
        try {
          const runs: ModelRun[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          
          // Merge into global map
          for (const run of runs) {
            if (allResultsMap.has(run.runId)) {
              const existing = allResultsMap.get(run.runId)!;
              // Merge assessments
              const mergedAssessments = { ...existing.aiAssessments, ...run.aiAssessments };
              allResultsMap.set(run.runId, { ...existing, aiAssessments: mergedAssessments });
            } else {
              allResultsMap.set(run.runId, run);
            }
          }
        } catch (error) {
          console.warn(`Warning: Failed to load ${filePath}`);
        }
      }
    }
  } catch (e) {
    console.error('Error loading results:', e);
  }
  
  return Array.from(allResultsMap.values());
}

export function checkForOldFormat(): boolean {
  return false; // Deprecated check
}
