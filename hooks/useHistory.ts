
import { useState, useCallback, useRef } from 'react';

/**
 * A generic hook to manage state with undo/redo history.
 * Tracks the entire state object to ensure consistency across complex state structures.
 */
export function useHistory<T>(initialState: T) {
  const [state, _setState] = useState<T>(initialState);
  
  // The history stack stores full snapshots of the state.
  // We use stringification for the initial comparison to avoid redundant entries,
  // but we store objects to avoid constant parsing during undo/redo.
  const historyStack = useRef<T[]>([initialState]);
  const pointer = useRef(0);

  const setState = useCallback((action: T | ((prev: T) => T), saveToHistory = true) => {
    _setState(prev => {
      const next = typeof action === 'function' ? (action as any)(prev) : action;
      
      if (saveToHistory) {
        // Deep clone to ensure history entries aren't mutated by reference
        const nextSnapshot = JSON.parse(JSON.stringify(next));
        const prevSnapshot = historyStack.current[pointer.current];
        
        // Only push to history if there's a significant change (optional optimization)
        // Here we push regardless if saveToHistory is true to maintain user intent.
        const newHistory = historyStack.current.slice(0, pointer.current + 1);
        newHistory.push(nextSnapshot);
        historyStack.current = newHistory;
        pointer.current = newHistory.length - 1;

        // Limit history size to prevent memory issues
        if (historyStack.current.length > 50) {
          historyStack.current.shift();
          pointer.current--;
        }
      }
      
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (pointer.current > 0) {
      pointer.current--;
      const targetState = historyStack.current[pointer.current];
      // Important: provide a fresh copy to prevent reference leaks
      _setState(JSON.parse(JSON.stringify(targetState)));
    }
  }, []);

  const redo = useCallback(() => {
    if (pointer.current < historyStack.current.length - 1) {
      pointer.current++;
      const targetState = historyStack.current[pointer.current];
      _setState(JSON.parse(JSON.stringify(targetState)));
    }
  }, []);

  return { 
    state, 
    setState, 
    undo, 
    redo, 
    canUndo: pointer.current > 0, 
    canRedo: pointer.current < historyStack.current.length - 1 
  };
}
