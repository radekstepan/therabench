/**
 * Vite plugin to load results from simplified structure
 * data/results/{candidate}/{judge}.json
 * AND pre-calculate token costs to avoid expensive runtime calculation
 */
import type { Plugin } from 'vite';
export default function resultsLoaderPlugin(): Plugin;
