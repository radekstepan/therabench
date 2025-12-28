/**
 * Vite plugin to load results from multi-file structure
 * This replaces the single results.json import with a merged dataset
 */
import fs from 'fs';
import path from 'path';
function loadAllResults(resultsDir) {
    if (!fs.existsSync(resultsDir)) {
        console.warn('⚠️  Results directory not found, returning empty array');
        return [];
    }
    var allResults = [];
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
                            allResults.push.apply(allResults, runs);
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
    return allResults;
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
                var resultsDir = path.join(__dirname, '../eval-engine/data/results');
                var oldResultsPath = path.join(__dirname, '../eval-engine/data/results.json');
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
