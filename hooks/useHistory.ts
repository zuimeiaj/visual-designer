
import { useState, useCallback, useRef } from 'react';
import { CanvasState } from '../types';

export const useHistory = (initialState: CanvasState) => {
  const [state, _setState] = useState<CanvasState>(initialState);
  const historyStack = useRef<string[]>([JSON.stringify(initialState.shapes)]);
  const pointer = useRef(0);

  const setState = useCallback((action: CanvasState | ((prev: CanvasState) => CanvasState), saveToHistory = true) => {
    _setState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      
      if (saveToHistory) {
        const nextShapesStr = JSON.stringify(next.shapes);
        const prevShapesStr = historyStack.current[pointer.current];
        
        // 只有内容发生实际改变时才压入历史栈
        if (nextShapesStr !== prevShapesStr) {
          const newHistory = historyStack.current.slice(0, pointer.current + 1);
          newHistory.push(nextShapesStr);
          historyStack.current = newHistory;
          pointer.current = newHistory.length - 1;
        }
      }
      
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (pointer.current > 0) {
      pointer.current--;
      const targetShapes = JSON.parse(historyStack.current[pointer.current]);
      _setState(prev => ({ ...prev, shapes: targetShapes, selectedIds: [] }));
    }
  }, []);

  const redo = useCallback(() => {
    if (pointer.current < historyStack.current.length - 1) {
      pointer.current++;
      const targetShapes = JSON.parse(historyStack.current[pointer.current]);
      _setState(prev => ({ ...prev, shapes: targetShapes, selectedIds: [] }));
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
};
