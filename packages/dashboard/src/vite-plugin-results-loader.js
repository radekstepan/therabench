/**
 * Vite plugin to load results and questions from data/
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
            // Input: context (if any) + scenario + rubric + prompt
            var inputText = (question.context || '') +
                question.scenario +
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
                    // Input: context + scenario + rubric + response + prompt
                    var judgeInputText = (question.context || '') +
                        question.scenario +
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
/**
 * Scan data directory for questions.json and transcripts.json
 * Merge them into a single array and hydrate context from files if needed.
 */
function loadAllQuestions(dataDir) {
    var allQuestions = [];
    // 1. Load questions.json
    var questionsPath = path.join(dataDir, 'questions.json');
    if (fs.existsSync(questionsPath)) {
        try {
            var data = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
            var qArray = Array.isArray(data) ? data : data.questions || [];
            allQuestions.push.apply(allQuestions, qArray);
        }
        catch (e) {
            console.error('Error loading questions.json:', e);
        }
    }
    // 2. Load transcripts.json
    var transcriptsPath = path.join(dataDir, 'transcripts.json');
    if (fs.existsSync(transcriptsPath)) {
        try {
            var data = JSON.parse(fs.readFileSync(transcriptsPath, 'utf-8'));
            var tArray = Array.isArray(data) ? data : data.questions || [];
            allQuestions.push.apply(allQuestions, tArray);
        }
        catch (e) {
            console.error('Error loading transcripts.json:', e);
        }
    }
    // 3. Hydrate context from files
    return allQuestions.map(function (q) {
        if (q.contextFile && !q.context) {
            var filePath = path.resolve(dataDir, q.contextFile);
            if (fs.existsSync(filePath)) {
                try {
                    return __assign(__assign({}, q), { context: fs.readFileSync(filePath, 'utf-8') });
                }
                catch (e) {
                    console.warn("Failed to read context file: ".concat(filePath));
                }
            }
            else {
                console.warn("Context file not found: ".concat(filePath));
            }
        }
        return q;
    });
}
export default function resultsLoaderPlugin() {
    var virtualResultsId = 'virtual:results';
    var resolvedVirtualResultsId = '\0' + virtualResultsId;
    var virtualQuestionsId = 'virtual:questions';
    var resolvedVirtualQuestionsId = '\0' + virtualQuestionsId;
    return {
        name: 'results-loader',
        resolveId: function (id) {
            if (id === virtualResultsId)
                return resolvedVirtualResultsId;
            if (id === virtualQuestionsId)
                return resolvedVirtualQuestionsId;
        },
        load: function (id) {
            var pluginDir = path.dirname(new URL(import.meta.url).pathname);
            var dataDir = path.resolve(pluginDir, '../../eval-engine/data');
            var resultsDir = path.join(dataDir, 'results');
            var configPath = path.join(dataDir, 'model-config.json');
            if (id === resolvedVirtualResultsId) {
                var results = [];
                if (fs.existsSync(resultsDir)) {
                    console.log('📦 Loading and calculating token costs...');
                    results = loadAllResults(resultsDir);
                    try {
                        // Load all questions to map for cost calculation
                        var questions = loadAllQuestions(dataDir);
                        if (fs.existsSync(configPath)) {
                            var configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                            results = calculateRunCosts(results, questions, configs);
                            console.log("\u2705 Processed costs for ".concat(results.length, " runs"));
                        }
                    }
                    catch (e) {
                        console.error('❌ Error calculating costs:', e);
                    }
                }
                return "export default ".concat(JSON.stringify(results));
            }
            if (id === resolvedVirtualQuestionsId) {
                console.log('📦 Loading questions and transcripts...');
                var questions = loadAllQuestions(dataDir);
                console.log("\u2705 Loaded ".concat(questions.length, " total scenarios"));
                return "export default ".concat(JSON.stringify(questions));
            }
        }
    };
}
