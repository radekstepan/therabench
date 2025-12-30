/**
 * Vite plugin to load results and questions from data/
 * AND pre-calculate token costs to avoid expensive runtime calculation
 */
import type { Plugin } from 'vite';
export default function resultsLoaderPlugin(): Plugin;
