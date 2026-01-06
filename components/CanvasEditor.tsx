
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  CanvasState, Shape, CanvasPlugin, PluginContext, 
  InteractionState, TransformType, BaseEvent, 
  TransformEvent, ViewEvent 
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
  actions: any;
}

const CanvasEditor: React.FC<Props> = ({ state, setState, updateShape, plugins = [], undo, redo, actions }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const shapes = state?.shapes || [];
  
  const scene = useMemo(() => new Scene(shapes), []);
  
  const lastMousePos = useRef({ x: 0, y: 0 });
  const startMousePos = useRef({ x: 0, y: 0 });

  const fpsRef = useRef({ lastTime: performance.now(), frames: 0 });

  useEffect(() => {
    // Ensure we handle potentially undefined shapes gracefully
    const currentShapes = state?.shapes || [];
    
    currentShapes.forEach(s => {
      const existing = scene.getShapes().find(os => os.id === s.id);
      if (existing) existing.update(s);
      else scene.add(s);
    });
    
    const shapeIdsInState = new Set(currentShapes.map(s => s.id));
    const sceneShapes = scene.getShapes();
    for (let i = sceneShapes.length - 1; i >= 0; i--) {
      if (!shapeIdsInState.has(sceneShapes[i].id)) scene.remove(sceneShapes[i].id);
    }
    
    const indexMap = new Map();
    currentShapes.forEach((s, i) => indexMap.set(s.id, i));
    scene.getShapes().sort((a, b) => (indexMap.get(a.id) ?? -1) - (indexMap.get(b.id) ?? -1));
  }, [state?.shapes, scene]);

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
    const zoom = state?.zoom ?? 1;
    const offset = state?.offset ?? { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offset.x) / zoom,
      y: (clientY - rect.top - offset.y) / zoom
    };
  }, [state?.offset, state?.zoom]);

  const setCursor = useCallback((cursor: string) => {
    if (canvasRef.current && canvasRef.current.style.cursor !== cursor) {
      canvasRef.current.style.cursor = cursor;
    }
  }, []);

  const pluginCtx: PluginContext = useMemo(() => ({
    state, setState, updateShape, getCanvasCoords,
    scene, canvas: canvasRef.current, renderer: rendererRef.current,
    undo, redo, setCursor, actions
  }), [state, setState, updateShape, getCanvasCoords, scene, undo, redo, setCursor, actions]);

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
      consume: () => { 
        consumed = true;
        if (e.cancelable) e.preventDefault();
      }
    };
  };

  const dispatchInteraction = (type: string, e: BaseEvent) => {
    for (const p of sortedPlugins) {
      p.onInteraction?.(type, e, pluginCtx);
    }
  };

  const dispatchTransform = (type: 'onTransformStart' | 'onTransformUpdate' | 'onTransformEnd', base: BaseEvent, transformType: TransformType, forcedTargetIds?: string[]) => {
    const selectedIds = state?.selectedIds || [];
    const event: TransformEvent = {
      ...base,
      type: transformType,
      targetIds: forcedTargetIds || selectedIds,
      deltaX: base.x - lastMousePos.current.x,
      deltaY: base.y - lastMousePos.current.y,
      scaleX: 1, scaleY: 1, rotation: 0
    };
    for (const p of sortedPlugins) {
      // @ts-ignore - dynamic access to transform methods
      p[type]?.(event, pluginCtx);
      if (event.consumed) break;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); 
      }
      
      const base = createBaseEvent(e);
      const viewEvent: ViewEvent = { ...base, zoom: state.zoom, offset: state.offset };
      for (const p of sortedPlugins) {
        p.onViewChange?.(viewEvent, pluginCtx);
        if (viewEvent.consumed) break;
      }
    };

    const handleGesture = (e: any) => {
      e.preventDefault();
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    canvas.addEventListener('gesturestart', handleGesture, { passive: false });
    canvas.addEventListener('gesturechange', handleGesture, { passive: false });
    canvas.addEventListener('gestureend', handleGesture, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
      canvas.removeEventListener('gesturestart', handleGesture);
      canvas.removeEventListener('gesturechange', handleGesture);
      canvas.removeEventListener('gestureend', handleGesture);
    };
  }, [sortedPlugins, pluginCtx, state?.zoom, state?.offset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return; 

    const base = createBaseEvent(e);
    lastMousePos.current = { x: base.x, y: base.y };
    startMousePos.current = { x: base.x, y: base.y };

    dispatchInteraction('mousedown', base);
    if (base.consumed) return;

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

    if (state.activeTool !== 'select' && state.activeTool !== 'connect') {
      setState(prev => ({ ...prev, interactionState: 'DRAWING' }), false);
      return;
    }

    if (hit) {
      const isMulti = e.shiftKey;
      let nextIds = [...(state?.selectedIds || [])];
      if (!isMulti && !nextIds.includes(hit.id)) {
        nextIds = [hit.id];
      } else if (isMulti) {
        nextIds = nextIds.includes(hit.id) ? nextIds.filter(id => id !== hit.id) : [...nextIds, hit.id];
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
        setState(prev => ({ ...prev, selectedIds: [], editingId: null, interactionState: 'MARQUEE' }), false);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const base = createBaseEvent(e);
    dispatchInteraction('mousemove', base);
    if (base.consumed) return;

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
    dispatchInteraction('mouseup', base);
    if (base.consumed) return;

    if (state.interactionState === 'TRANSFORMING') {
      dispatchTransform('onTransformEnd', base, state.activeTransformType || 'MOVE');
    }
    for (const p of sortedPlugins) p.onMouseUp?.(base, pluginCtx);
    
    if (state.interactionState !== 'EDITING') {
      setState(prev => ({ ...prev, interactionState: 'IDLE', activeTransformType: null }), true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const base = createBaseEvent(e);
    const hit = scene.hitTest(base.x, base.y);
    for (const p of sortedPlugins) {
      if (p.onContextMenu?.(base, hit, pluginCtx)) {
        break;
      }
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
    if (!rendererRef.current || !state) return;
    
    const now = performance.now();
    fpsRef.current.frames++;
    if (now > fpsRef.current.lastTime + 1000) {
      const fps = Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime));
      const el = document.getElementById('fps-counter');
      if (el) el.innerText = fps.toString();
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
    }

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
        onContextMenu={handleContextMenu} 
        className="block outline-none" 
      />
      {sortedPlugins.map((p, i) => <React.Fragment key={p.name + i}>{p.onRenderOverlay?.(pluginCtx)}</React.Fragment>)}
    </div>
  );
};

export default CanvasEditor;
