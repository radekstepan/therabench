/**
 * Vite plugin to load results from multi-file structure
 * This replaces the single results.json import with a merged dataset
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import fs from 'fs';
import path from 'path';
function loadAllResults(resultsDir) {
    if (!fs.existsSync(resultsDir)) {
        console.warn('⚠️  Results directory not found, returning empty array');
        return [];
    }
    // Use a Map to merge runs by runId
    var resultsMap = new Map();
    try {
        // Traverse the directory structure
        var candidateDirs = fs.readdirSync(resultsDir);
        for (var _i = 0, candidateDirs_1 = candidateDirs; _i < candidateDirs_1.length; _i++) {
            var candidateDir = candidateDirs_1[_i];
            var candidatePath = path.join(resultsDir, candidateDir);
            if (!fs.statSync(candidatePath).isDirectory()) {
                continue;
            }
            var judgeDirs = fs.readdirSync(candidatePath);
            for (var _a = 0, judgeDirs_1 = judgeDirs; _a < judgeDirs_1.length; _a++) {
                var judgeDir = judgeDirs_1[_a];
                var judgePath = path.join(candidatePath, judgeDir);
                if (!fs.statSync(judgePath).isDirectory()) {
                    continue;
                }
                var resultFiles = fs.readdirSync(judgePath).filter(function (f) { return f.endsWith('.json'); });
                for (var _b = 0, resultFiles_1 = resultFiles; _b < resultFiles_1.length; _b++) {
                    var file = resultFiles_1[_b];
                    var filePath = path.join(judgePath, file);
                    try {
                        var runs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                        if (Array.isArray(runs)) {
                            // Merge runs with the same runId
                            for (var _c = 0, runs_1 = runs; _c < runs_1.length; _c++) {
                                var run = runs_1[_c];
                                if (resultsMap.has(run.runId)) {
                                    // Merge aiAssessments from this file into existing run
                                    var existing = resultsMap.get(run.runId);
                                    if (run.aiAssessments) {
                                        existing.aiAssessments = __assign(__assign({}, existing.aiAssessments), run.aiAssessments);
                                    }
                                }
                                else {
                                    // First time seeing this runId
                                    resultsMap.set(run.runId, run);
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.warn("Warning: Failed to load results from ".concat(filePath, ":"), error);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('Error loading results:', error);
    }
    return Array.from(resultsMap.values());
}
export default function resultsLoaderPlugin() {
    var virtualModuleId = 'virtual:results';
    var resolvedVirtualModuleId = '\0' + virtualModuleId;
    return {
        name: 'results-loader',
        resolveId: function (id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        load: function (id) {
            if (id === resolvedVirtualModuleId) {
                // Use path relative to this file's location
                var pluginDir = path.dirname(new URL(import.meta.url).pathname);
                var resultsDir = path.resolve(pluginDir, '../../eval-engine/data/results');
                var oldResultsPath = path.resolve(pluginDir, '../../eval-engine/data/results.json');
                var results = [];
                // Try loading from new structure first
                if (fs.existsSync(resultsDir)) {
                    results = loadAllResults(resultsDir);
                    console.log("\u2705 Loaded ".concat(results.length, " results from multi-file structure"));
                }
                else if (fs.existsSync(oldResultsPath)) {
                    // Fallback to old format
                    console.warn('⚠️  Loading from old results.json format. Run migration script to upgrade.');
                    results = JSON.parse(fs.readFileSync(oldResultsPath, 'utf-8'));
                }
                return "export default ".concat(JSON.stringify(results));
            }
        }
    };
}
