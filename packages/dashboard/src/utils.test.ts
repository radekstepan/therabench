import { describe, it, expect } from 'vitest';
import { countTokens, calculateModelCost, formatModelCost } from './utils';
import type { AugmentedResult } from './types';

describe('Token Counting and Cost Calculation', () => {
  describe('countTokens', () => {
    it('should estimate tokens (heuristic)', () => {
      // Since we removed gpt-tokenizer from frontend, this is now a heuristic
      const text = 'Hello, how are you today?';
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should handle empty string', () => {
      expect(countTokens('')).toBe(0);
    });
  });

  describe('calculateModelCost', () => {
    const mockQuestion = {
      id: 'q1',
      category: 'CBT' as const,
      title: 'Test Question',
      scenario: 'Patient says: I am feeling anxious',
      difficulty: 'Low' as const,
      rubric: {
        mustInclude: ['empathy', 'validation'],
        mustAvoid: ['dismissive']
      }
    };

    // Helper to create mock runs with PRE-CALCULATED usage data
    const createMockRun = (modelName: string, response: string, cost = 0.01): AugmentedResult => ({
      runId: 'run1',
      questionId: 'q1',
      modelName,
      timestamp: '2025-01-01',
      response,
      question: mockQuestion,
      effectiveScore: 80,
      effectiveSafety: 90,
      effectiveEmpathy: 85,
      effectiveModalityAdherence: 80,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cost: cost
      }
    });

    it('should return 0 for model without runs', () => {
      const cost = calculateModelCost('unknown-model', []);
      expect(cost).toBe(0);
    });

    it('should sum pre-calculated costs for gpt-4o', () => {
      const runs = [
        createMockRun('gpt-4o', 'Response 1', 0.05),
        createMockRun('gpt-4o', 'Response 2', 0.05)
      ];
      const cost = calculateModelCost('gpt-4o', runs);
      expect(cost).toBeCloseTo(0.10);
    });

    it('should only count runs for the specific model', () => {
      const runs = [
        createMockRun('gpt-4o', 'Response A', 0.10),
        createMockRun('google/gemma-3-12b', 'Response B', 0.02),
        createMockRun('gpt-4o', 'Response C', 0.10)
      ];
      
      const gpt4oCost = calculateModelCost('gpt-4o', runs);
      const gemmaCost = calculateModelCost('google/gemma-3-12b', runs);
      
      expect(gpt4oCost).toBeCloseTo(0.20);
      expect(gemmaCost).toBeCloseTo(0.02);
    });

    it('should use fallback heuristic if usage data is missing', () => {
      // Create a run WITHOUT usage data
      const runWithoutUsage: AugmentedResult = {
        ...createMockRun('gpt-4o', 'A very long response...'),
        usage: undefined
      };

      const cost = calculateModelCost('gpt-4o', [runWithoutUsage]);
      
      // Should still calculate a non-zero cost using the fallback logic
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('formatModelCost', () => {
    it('should show dash for zero cost', () => {
      expect(formatModelCost(0)).toBe('-');
    });

    it('should show cents for amounts under $1', () => {
      expect(formatModelCost(0.005)).toContain('¢');
      expect(formatModelCost(0.50)).toContain('¢');
    });

    it('should show dollars for amounts over $1', () => {
      expect(formatModelCost(1.50)).toContain('$');
      expect(formatModelCost(10)).toContain('$');
    });
  });
});
