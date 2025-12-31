
import { useEffect } from 'react';
import { CanvasPlugin, Shape } from '../types';

const CACHE_KEY = 'canvas-ai-designer-shapes';

export const useCachePlugin = (shapes: Shape[]): CanvasPlugin => {
  // Sync shapes to localStorage whenever they change
  useEffect(() => {
    try {
      if (shapes && shapes.length > 0) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(shapes));
      } else if (shapes && shapes.length === 0) {
        // We still save empty state if user deleted everything
        localStorage.setItem(CACHE_KEY, JSON.stringify([]));
      }
    } catch (error) {
      console.error('Failed to save canvas state to cache:', error);
    }
  }, [shapes]);

  return {
    name: 'cache-plugin',
    priority: -10, // Low priority as it only handles side-effects
  };
};
