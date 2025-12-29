/**
 * Vite plugin to load results from simplified structure
 * data/results/{candidate}/{judge}.json
 */

import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

interface ModelRun {
  runId: string;
  aiAssessments?: Record<string, any[]>;
  [key: string]: any;
}

function loadAllResults(resultsDir: string): ModelRun[] {
  if (!fs.existsSync(resultsDir)) {
    return [];
  }
  
  const resultsMap = new Map<string, ModelRun>();
  
  try {
    const candidateDirs = fs.readdirSync(resultsDir);
    
    for (const candidateDir of candidateDirs) {
      const candidatePath = path.join(resultsDir, candidateDir);
      
      if (!fs.statSync(candidatePath).isDirectory()) continue;
      
      const judgeFiles = fs.readdirSync(candidatePath).filter(f => f.endsWith('.json'));
      
      for (const file of judgeFiles) {
        const filePath = path.join(candidatePath, file);
        try {
          const runs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (Array.isArray(runs)) {
            for (const run of runs) {
              if (resultsMap.has(run.runId)) {
                // Merge assessments
                const existing = resultsMap.get(run.runId)!;
                const mergedAssessments = { ...existing.aiAssessments, ...run.aiAssessments };
                resultsMap.set(run.runId, { ...existing, aiAssessments: mergedAssessments });
              } else {
                resultsMap.set(run.runId, run);
              }
            }
          }
        } catch (error) {
          console.warn(`Warning: Failed to load results from ${filePath}`);
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
        
        let results: ModelRun[] = [];
        
        if (fs.existsSync(resultsDir)) {
          results = loadAllResults(resultsDir);
          console.log(`✅ Loaded ${results.length} results from ${resultsDir}`);
        } else {
          console.warn('⚠️  Results directory not found at:', resultsDir);
        }
        
        return `export default ${JSON.stringify(results)}`;
      }
    }
  };
}
