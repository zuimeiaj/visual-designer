
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  CanvasState, Shape, CanvasPlugin, PluginContext, 
  InteractionState, TransformType, BaseEvent, SelectionEvent, 
  TransformEvent, EditEvent, ViewEvent 
} from '../types';
import { CanvasRenderer } from '../services/canvasRenderer';
import { Scene } from '../models/Scene';

interface Props {
  state: CanvasState;
  setState: (action: CanvasState | ((prev: CanvasState) => CanvasState), save?: boolean) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  plugins?: CanvasPlugin[];
  undo: () => void;
  redo: () => void;
}

const CanvasEditor: React.FC<Props> = ({ state, setState, updateShape, plugins = [], undo, redo }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const scene = useMemo(() => new Scene(state.shapes), []);
  
  const lastMousePos = useRef({ x: 0, y: 0 });
  const startMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    state.shapes.forEach(s => {
      const existing = scene.getShapes().find(os => os.id === s.id);
      if (existing) existing.update(s);
      else scene.add(s);
    });
    const shapeIdsInState = new Set(state.shapes.map(s => s.id));
    const currentShapes = scene.getShapes();
    for (let i = currentShapes.length - 1; i >= 0; i--) {
      if (!shapeIdsInState.has(currentShapes[i].id)) scene.remove(currentShapes[i].id);
    }
    const indexMap = new Map();
    state.shapes.forEach((s, i) => indexMap.set(s.id, i));
    scene.getShapes().sort((a, b) => (indexMap.get(a.id) ?? -1) - (indexMap.get(b.id) ?? -1));
  }, [state.shapes, scene]);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', { alpha: false });
      if (ctx) rendererRef.current = new CanvasRenderer(ctx);
    }
  }, []);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.offset.x) / state.zoom,
      y: (clientY - rect.top - state.offset.y) / state.zoom
    };
  }, [state.offset, state.zoom]);

  const setCursor = useCallback((cursor: string) => {
    if (canvasRef.current && canvasRef.current.style.cursor !== cursor) {
      canvasRef.current.style.cursor = cursor;
    }
  }, []);

  const pluginCtx: PluginContext = useMemo(() => ({
    state, setState, updateShape, getCanvasCoords,
    scene, canvas: canvasRef.current, renderer: rendererRef.current,
    undo, redo, setCursor
  }), [state, setState, updateShape, getCanvasCoords, scene, undo, redo, setCursor]);

  const sortedPlugins = useMemo(() => {
    return [...plugins].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }, [plugins]);

  const createBaseEvent = (e: React.MouseEvent | MouseEvent | React.WheelEvent | WheelEvent): BaseEvent => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    let consumed = false;
    const hitShape = scene.hitTest(coords.x, coords.y);
    const internalHit = hitShape ? hitShape.getInternalHit(coords.x, coords.y) : null;

    return {
      x: coords.x,
      y: coords.y,
      nativeEvent: e,
      internalHit,
      get consumed() { return consumed; },
      consume: () => { consumed = true; }
    };
  };

  const dispatchTransform = (type: 'onTransformStart' | 'onTransformUpdate' | 'onTransformEnd', base: BaseEvent, transformType: TransformType, forcedTargetIds?: string[]) => {
    const event: TransformEvent = {
      ...base,
      type: transformType,
      targetIds: forcedTargetIds || state.selectedIds,
      deltaX: base.x - lastMousePos.current.x,
      deltaY: base.y - lastMousePos.current.y,
      scaleX: 1, scaleY: 1, rotation: 0
    };
    for (const p of sortedPlugins) {
      p[type]?.(event, pluginCtx);
      if (event.consumed) break;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const base = createBaseEvent(e);
    lastMousePos.current = { x: base.x, y: base.y };
    startMousePos.current = { x: base.x, y: base.y };

    const hit = scene.hitTest(base.x, base.y);

    if (state.editingId) {
      if (hit?.id === state.editingId) {
        let handledInternally = false;
        for (const p of sortedPlugins) {
          if (p.onMouseDown?.(base, hit, pluginCtx) === true || base.consumed) {
            handledInternally = true;
            break;
          }
        }
        if (!handledInternally) {
          setState(prev => ({ ...prev, editingId: null, interactionState: 'IDLE' }), false);
        } else {
          return;
        }
      } else {
        setState(prev => ({ ...prev, editingId: null, interactionState: 'IDLE' }), false);
      }
    }

    for (const p of sortedPlugins) {
      if (p.onMouseDown?.(base, hit, pluginCtx)) return;
      if (base.consumed) return;
    }

    if (e.button === 2) {
      for (const p of sortedPlugins) {
        if (p.onContextMenu?.(base, hit, pluginCtx)) break;
      }
      return;
    }

    if (state.activeTool !== 'select' && state.activeTool !== 'connect') {
      setState(prev => ({ ...prev, interactionState: 'DRAWING' }), false);
      return;
    }

    if (hit) {
      const isMulti = e.shiftKey;
      let nextIds = [...state.selectedIds];
      if (!isMulti && !state.selectedIds.includes(hit.id)) {
        nextIds = [hit.id];
      } else if (isMulti) {
        nextIds = state.selectedIds.includes(hit.id) ? state.selectedIds.filter(id => id !== hit.id) : [...state.selectedIds, hit.id];
      }

      setState(prev => ({ 
        ...prev, 
        selectedIds: nextIds,
        interactionState: 'TRANSFORMING',
        activeTransformType: 'MOVE'
      }), false);
      dispatchTransform('onTransformStart', base, 'MOVE', nextIds);
    } else {
      if (!e.shiftKey) {
        setState(prev => ({ ...prev, selectedIds: [], editingId: null, interactionState: 'MARQUEE' }), true);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const base = createBaseEvent(e);
    if (state.interactionState === 'IDLE' || state.interactionState === 'EDITING') {
      if (state.activeTool === 'select' || state.activeTool === 'connect') {
        setCursor('default');
      } else {
        setCursor('crosshair');
      }
    }

    if (state.interactionState === 'TRANSFORMING') {
      dispatchTransform('onTransformUpdate', base, state.activeTransformType || 'MOVE');
    } else {
      for (const p of sortedPlugins) {
        p.onMouseMove?.(base, pluginCtx);
        if (base.consumed) break; 
      }
    }
    lastMousePos.current = { x: base.x, y: base.y };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const base = createBaseEvent(e);
    if (state.interactionState === 'TRANSFORMING') {
      dispatchTransform('onTransformEnd', base, state.activeTransformType || 'MOVE');
    }
    for (const p of sortedPlugins) p.onMouseUp?.(base, pluginCtx);
    if (state.interactionState !== 'EDITING') {
      setState(prev => ({ ...prev, interactionState: 'IDLE', activeTransformType: null }), true);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const base = createBaseEvent(e);
    const hit = scene.hitTest(base.x, base.y);

    if (hit && !state.editingId) {
      for (const p of sortedPlugins) {
        p.onDoubleClick?.(base, hit, pluginCtx);
        if (base.consumed) break;
      }
      if (!base.consumed) {
        setState(prev => ({ 
          ...prev, 
          editingId: hit.id, 
          interactionState: 'EDITING',
          selectedIds: [hit.id] 
        }), true);
      }
    } else if (state.editingId) {
      for (const p of sortedPlugins) {
        p.onDoubleClick?.(base, hit, pluginCtx);
        if (base.consumed) break;
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const p of sortedPlugins) {
        if (p.onKeyDown?.(e, pluginCtx)) break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedPlugins, pluginCtx]);

  const draw = useCallback(() => {
    if (!rendererRef.current) return;
    rendererRef.current.render(state, scene, sortedPlugins, pluginCtx);
  }, [state, scene, sortedPlugins, pluginCtx]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        
        draw();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      draw();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [draw]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-white flex items-start justify-start">
      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        onDoubleClick={handleDoubleClick} 
        onContextMenu={e => e.preventDefault()} 
        className="block outline-none" 
      />
      {sortedPlugins.map((p, i) => <React.Fragment key={p.name + i}>{p.onRenderOverlay?.(pluginCtx)}</React.Fragment>)}
    </div>
  );
};

export default CanvasEditor;
