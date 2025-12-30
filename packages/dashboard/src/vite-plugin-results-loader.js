/**
 * Vite plugin to load results from simplified structure
 * data/results/{candidate}/{judge}.json
 * AND pre-calculate token costs to avoid expensive runtime calculation
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
import { encode } from 'gpt-tokenizer';
function stripEnhancedSuffix(modelName) {
    return modelName.replace(' (Enhanced)', '');
}
function countTokens(text) {
    if (!text)
        return 0;
    try {
        return encode(text).length;
    }
    catch (error) {
        // Fallback estimation (approx 4 chars per token)
        return Math.ceil(text.length / 4);
    }
}
function getPricing(modelName, configs) {
    var baseName = stripEnhancedSuffix(modelName);
    var config = configs.find(function (c) { return c.modelName === baseName; });
    return (config === null || config === void 0 ? void 0 : config.pricing) || null;
}
function calculateRunCosts(runs, questions, configs) {
    var questionMap = new Map(questions.map(function (q) { return [q.id, q]; }));
    return runs.map(function (run) {
        var question = questionMap.get(run.questionId);
        if (!question)
            return run;
        // 1. Calculate Candidate Model Cost
        var candidatePricing = getPricing(run.modelName, configs);
        if (candidatePricing) {
            // Input: scenario + rubric + prompt
            var inputText = question.scenario +
                JSON.stringify(question.rubric) +
                "You are a therapist. Respond to this patient.";
            var inputTokens = countTokens(inputText);
            var outputTokens = countTokens(run.response);
            var cost = ((inputTokens / 1000000) * candidatePricing.input) +
                ((outputTokens / 1000000) * candidatePricing.output);
            run.usage = {
                inputTokens: inputTokens,
                outputTokens: outputTokens,
                cost: cost
            };
        }
        // 2. Calculate Judge Costs
        if (run.aiAssessments) {
            Object.entries(run.aiAssessments).forEach(function (_a) {
                var judgeName = _a[0], assessments = _a[1];
                var judgePricing = getPricing(judgeName, configs);
                if (!judgePricing)
                    return;
                // Ensure array
                var assessmentList = Array.isArray(assessments) ? assessments : [assessments];
                assessmentList.forEach(function (assessment) {
                    // Input: scenario + rubric + response + prompt
                    var judgeInputText = question.scenario +
                        JSON.stringify(question.rubric) +
                        run.response +
                        "Evaluate this therapeutic response.";
                    // Output: reasoning + flags + metrics
                    var judgeOutputText = (assessment.reasoning || '') +
                        JSON.stringify(assessment.flags || []) +
                        JSON.stringify(assessment.metrics || {});
                    var inputTokens = countTokens(judgeInputText);
                    var outputTokens = countTokens(judgeOutputText);
                    var cost = ((inputTokens / 1000000) * judgePricing.input) +
                        ((outputTokens / 1000000) * judgePricing.output);
                    assessment.usage = {
                        inputTokens: inputTokens,
                        outputTokens: outputTokens,
                        cost: cost
                    };
                });
            });
        }
        return run;
    });
}
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
                var questionsPath = path.resolve(pluginDir, '../../eval-engine/data/questions.json');
                var configPath = path.resolve(pluginDir, '../../eval-engine/data/model-config.json');
                var results = [];
                if (fs.existsSync(resultsDir)) {
                    console.log('📦 Loading and calculating token costs...');
                    // Load base results
                    results = loadAllResults(resultsDir);
                    // Load auxiliary data for cost calculation
                    try {
                        if (fs.existsSync(questionsPath) && fs.existsSync(configPath)) {
                            var questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
                            var questions = Array.isArray(questionsData) ? questionsData : questionsData.questions;
                            var configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                            // Inject costs
                            results = calculateRunCosts(results, questions, configs);
                            console.log("\u2705 Processed costs for ".concat(results.length, " runs"));
                        }
                        else {
                            console.warn('⚠️ Missing questions.json or model-config.json, skipping cost calculation');
                        }
                    }
                    catch (e) {
                        console.error('❌ Error calculating costs:', e);
                    }
                }
                else {
                    console.warn('⚠️  Results directory not found at:', resultsDir);
                }
                return "export default ".concat(JSON.stringify(results));
            }
        }
    };
}
