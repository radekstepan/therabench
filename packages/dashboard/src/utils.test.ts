import { describe, it, expect } from 'vitest';
import { countTokens, calculateModelCost, formatModelCost } from './utils';
import type { AugmentedResult } from './types';

describe('Token Counting and Cost Calculation', () => {
  describe('countTokens', () => {
    it('should count tokens in text', () => {
      const text = 'Hello, how are you today?';
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length); // Should be fewer tokens than characters
    });

    it('should handle empty string', () => {
      expect(countTokens('')).toBe(0);
    });

    it('should count more tokens for longer text', () => {
      const short = 'Hello';
      const long = 'Hello, this is a much longer piece of text with many more words';
      expect(countTokens(long)).toBeGreaterThan(countTokens(short));
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

    const createMockRun = (modelName: string, response: string): AugmentedResult => ({
      runId: 'run1',
      questionId: 'q1',
      modelName,
      timestamp: '2025-01-01',
      response,
      question: mockQuestion,
      effectiveScore: 80,
      effectiveSafety: 90,
      effectiveEmpathy: 85,
      effectiveModalityAdherence: 80
    });

    it('should return 0 for model without pricing config', () => {
      const runs = [createMockRun('unknown-model', 'Short response')];
      const cost = calculateModelCost('unknown-model', runs);
      expect(cost).toBe(0);
    });

    it('should calculate cost for gpt-4o', () => {
      const runs = [
        createMockRun('gpt-4o', 'This is a therapeutic response that validates the patient feelings.'),
        createMockRun('gpt-4o', 'Another response to a different scenario.')
      ];
      const cost = calculateModelCost('gpt-4o', runs);
      expect(cost).toBeGreaterThan(0);
    });

    it('should only count runs for the specific model', () => {
      const runs = [
        createMockRun('gpt-4o', 'Response from gpt-4o'),
        createMockRun('gemma-3-12b-it', 'Response from gemma'),
        createMockRun('gpt-4o', 'Another response from gpt-4o')
      ];
      
      const gpt4oCost = calculateModelCost('gpt-4o', runs);
      const gemmaCost = calculateModelCost('gemma-3-12b-it', runs);
      
      expect(gpt4oCost).toBeGreaterThan(0);
      expect(gemmaCost).toBeGreaterThan(0);
      // gpt-4o has 2 runs, gemma has 1, so gpt-4o should cost more (roughly 2x)
      expect(gpt4oCost).toBeGreaterThan(gemmaCost);
    });

    it('CRITICAL: Enhanced version should cost MORE than base version', () => {
      const baseRuns = [
        createMockRun('gpt-5.2-2025-12-11', 'Standard response'),
        createMockRun('gpt-5.2-2025-12-11', 'Another standard response')
      ];
      
      const enhancedRuns = [
        createMockRun('gpt-5.2-2025-12-11 (Enhanced)', 'Enhanced response with more context'),
        createMockRun('gpt-5.2-2025-12-11 (Enhanced)', 'Another enhanced response with more context')
      ];
      
      const baseCost = calculateModelCost('gpt-5.2-2025-12-11', baseRuns);
      const enhancedCost = calculateModelCost('gpt-5.2-2025-12-11 (Enhanced)', enhancedRuns);
      
      // Enhanced should cost MORE or equal, never LESS
      expect(enhancedCost).toBeGreaterThanOrEqual(baseCost);
    });

    it('should cost more for longer responses', () => {
      const shortResponse = [createMockRun('gpt-4o', 'Ok.')];
      const longResponse = [createMockRun('gpt-4o', 'This is a much longer therapeutic response that includes validation, empathy, and detailed cognitive restructuring techniques. It goes into great depth about the patient\'s concerns and provides comprehensive support.')];
      
      const shortCost = calculateModelCost('gpt-4o', shortResponse);
      const longCost = calculateModelCost('gpt-4o', longResponse);
      
      expect(longCost).toBeGreaterThan(shortCost);
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
