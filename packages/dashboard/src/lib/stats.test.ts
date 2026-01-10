import { describe, it, expect } from 'vitest';
import { 
  calculateMean, 
  calculateStdDev, 
  calculateCorrelation, 
  calculateModelReliability,
  calculateRMSE,
  calculateVariance
} from './stats';

describe('Statistical Functions', () => {
  it('calculates mean correctly', () => {
    expect(calculateMean([10, 20, 30])).toBe(20);
    expect(calculateMean([5])).toBe(5);
    expect(calculateMean([])).toBe(0);
  });

  it('calculates variance correctly', () => {
    // Sample variance of 2, 4, 4, 4, 5, 5, 7, 9
    // Mean = 5
    // Sum Sq Diff = 9 + 1 + 1 + 1 + 0 + 0 + 4 + 16 = 32
    // Variance = 32 / (8-1) = 4.57
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const v = calculateVariance(data);
    expect(v).toBeCloseTo(4.57, 2);
  });

  it('calculates standard deviation correctly', () => {
    // StdDev of [10, 12, 23, 23, 16, 23, 21, 16]
    // Mean = 18
    // Variance approx 27.43 (sample variance)
    // SD approx 5.24
    const data = [10, 12, 23, 23, 16, 23, 21, 16];
    expect(calculateStdDev(data)).toBeCloseTo(5.24, 1);
  });

  it('calculates correlation correctly', () => {
    // Perfect positive correlation
    expect(calculateCorrelation([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    
    // Perfect negative correlation
    expect(calculateCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    
    // No correlation
    expect(calculateCorrelation([1, 2, 3], [1, 1, 1])).toBe(0); // Variance Y is 0
  });
  
  it('calculates RMSE correctly', () => {
    const truth = [100, 90, 80];
    const pred = [90, 90, 70]; 
    // Diffs: 10, 0, 10
    // Sq: 100, 0, 100 => Sum 200
    // Mean Sq: 66.66
    // Sqrt: 8.16
    expect(calculateRMSE(truth, pred)).toBeCloseTo(8.16, 2);
  });

  it('calculates model reliability index', () => {
    // Model A: [80, 80, 80] -> Mean 80, SD 0 -> Index 80
    // Model B: [60, 100, 80] -> Mean 80, SD 20 -> Index 60
    
    const stable = calculateModelReliability('Stable', [80, 80, 80]);
    const volatile = calculateModelReliability('Volatile', [60, 100, 80]);
    
    expect(stable.meanScore).toBe(80);
    expect(volatile.meanScore).toBe(80);
    
    expect(stable.reliabilityIndex).toBeGreaterThan(volatile.reliabilityIndex);
  });
});
