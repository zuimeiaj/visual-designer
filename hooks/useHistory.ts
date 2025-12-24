
import { useState, useCallback, useRef } from 'react';
import { CanvasState } from '../types';

export const useHistory = (initialState: CanvasState) => {
  const [state, _setState] = useState<CanvasState>(initialState);
  const historyStack = useRef<CanvasState[]>([initialState]);
  const pointer = useRef(0);

  const setState = useCallback((action: CanvasState | ((prev: CanvasState) => CanvasState), saveToHistory = true) => {
    _setState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      
      if (saveToHistory && JSON.stringify(prev.shapes) !== JSON.stringify(next.shapes)) {
        // 只有当形状发生实际变化时才存入历史记录
        const newHistory = historyStack.current.slice(0, pointer.current + 1);
        newHistory.push(next);
        historyStack.current = newHistory;
        pointer.current = newHistory.length - 1;
      }
      
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (pointer.current > 0) {
      pointer.current--;
      _setState(historyStack.current[pointer.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (pointer.current < historyStack.current.length - 1) {
      pointer.current++;
      _setState(historyStack.current[pointer.current]);
    }
  }, []);

  return { state, setState, undo, redo, canUndo: pointer.current > 0, canRedo: pointer.current < historyStack.current.length - 1 };
};
