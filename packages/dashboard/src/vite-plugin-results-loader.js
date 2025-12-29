/**
 * Vite plugin to load results from simplified structure
 * data/results/{candidate}/{judge}.json
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
        return [];
    }
    var resultsMap = new Map();
    try {
        var candidateDirs = fs.readdirSync(resultsDir);
        for (var _i = 0, candidateDirs_1 = candidateDirs; _i < candidateDirs_1.length; _i++) {
            var candidateDir = candidateDirs_1[_i];
            var candidatePath = path.join(resultsDir, candidateDir);
            if (!fs.statSync(candidatePath).isDirectory())
                continue;
            var judgeFiles = fs.readdirSync(candidatePath).filter(function (f) { return f.endsWith('.json'); });
            for (var _a = 0, judgeFiles_1 = judgeFiles; _a < judgeFiles_1.length; _a++) {
                var file = judgeFiles_1[_a];
                var filePath = path.join(candidatePath, file);
                try {
                    var runs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    if (Array.isArray(runs)) {
                        for (var _b = 0, runs_1 = runs; _b < runs_1.length; _b++) {
                            var run = runs_1[_b];
                            if (resultsMap.has(run.runId)) {
                                // Merge assessments
                                var existing = resultsMap.get(run.runId);
                                var mergedAssessments = __assign(__assign({}, existing.aiAssessments), run.aiAssessments);
                                resultsMap.set(run.runId, __assign(__assign({}, existing), { aiAssessments: mergedAssessments }));
                            }
                            else {
                                resultsMap.set(run.runId, run);
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn("Warning: Failed to load results from ".concat(filePath));
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
                var results = [];
                if (fs.existsSync(resultsDir)) {
                    results = loadAllResults(resultsDir);
                    console.log("\u2705 Loaded ".concat(results.length, " results from ").concat(resultsDir));
                }
                else {
                    console.warn('⚠️  Results directory not found at:', resultsDir);
                }
                return "export default ".concat(JSON.stringify(results));
            }
        }
    };
}
