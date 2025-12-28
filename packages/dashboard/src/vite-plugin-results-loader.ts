/**
 * Vite plugin to load results from multi-file structure
 * This replaces the single results.json import with a merged dataset
 */

import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

interface ModelRun {
  runId: string;
  questionId: string;
  modelName: string;
  timestamp: string;
  response: string;
  aiAssessments?: Record<string, any[]>;
}

function loadAllResults(resultsDir: string): ModelRun[] {
  if (!fs.existsSync(resultsDir)) {
    console.warn('⚠️  Results directory not found, returning empty array');
    return [];
  }
  
  // Use a Map to merge runs by runId
  const resultsMap = new Map<string, ModelRun>();
  
  try {
    // Traverse the directory structure
    const candidateDirs = fs.readdirSync(resultsDir);
    
    for (const candidateDir of candidateDirs) {
      const candidatePath = path.join(resultsDir, candidateDir);
      
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
              // Merge runs with the same runId
              for (const run of runs) {
                if (resultsMap.has(run.runId)) {
                  // Merge aiAssessments from this file into existing run
                  const existing = resultsMap.get(run.runId)!;
                  if (run.aiAssessments) {
                    existing.aiAssessments = {
                      ...existing.aiAssessments,
                      ...run.aiAssessments
                    };
                  }
                } else {
                  // First time seeing this runId
                  resultsMap.set(run.runId, run);
                }
              }
            }
          } catch (error) {
            console.warn(`Warning: Failed to load results from ${filePath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading results:', error);
  }
  
  return Array.from(resultsMap.values());
}

export default function resultsLoaderPlugin(): Plugin {
  const virtualModuleId = 'virtual:results';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'results-loader',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        // Use path relative to this file's location
        const pluginDir = path.dirname(new URL(import.meta.url).pathname);
        const resultsDir = path.resolve(pluginDir, '../../eval-engine/data/results');
        const oldResultsPath = path.resolve(pluginDir, '../../eval-engine/data/results.json');
        
        let results: ModelRun[] = [];
        
        // Try loading from new structure first
        if (fs.existsSync(resultsDir)) {
          results = loadAllResults(resultsDir);
          console.log(`✅ Loaded ${results.length} results from multi-file structure`);
        } else if (fs.existsSync(oldResultsPath)) {
          // Fallback to old format
          console.warn('⚠️  Loading from old results.json format. Run migration script to upgrade.');
          results = JSON.parse(fs.readFileSync(oldResultsPath, 'utf-8'));
        }
        
        return `export default ${JSON.stringify(results)}`;
      }
    }
  };
}
