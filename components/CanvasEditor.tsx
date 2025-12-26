
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { CanvasState, Shape, CanvasPlugin, PluginContext, CanvasEvent } from '../types';
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
      const ctx = canvasRef.current.getContext('2d');
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
    if (canvasRef.current) canvasRef.current.style.cursor = cursor;
  }, []);

  const pluginCtx: PluginContext = useMemo(() => ({
    state, setState, updateShape, getCanvasCoords,
    scene, canvas: canvasRef.current, renderer: rendererRef.current,
    undo, redo, setCursor
  }), [state, setState, updateShape, getCanvasCoords, scene, undo, redo, setCursor]);

  const createEvent = (e: React.MouseEvent | MouseEvent | React.WheelEvent | WheelEvent, type: string): CanvasEvent => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    let isStopped = false;
    return {
      nativeEvent: e,
      x: coords.x,
      y: coords.y,
      clientX: e.clientX,
      clientY: e.clientY,
      type,
      stopPropagation: () => { isStopped = true; },
      get isPropagationStopped() { return isStopped; }
    };
  };

  const dispatch = (type: string, nativeEvent: any, callbackName: keyof CanvasPlugin) => {
    const ev = createEvent(nativeEvent, type);
    // 修复 Bug: 使用不区分大小写的检查，并包含 Click 和 Context 事件
    const lowerType = type.toLowerCase();
    const shouldHitTest = lowerType.includes('mouse') || lowerType.includes('click') || lowerType.includes('context');
    const hit = shouldHitTest ? scene.hitTest(ev.x, ev.y) : null;
    
    for (const plugin of plugins) {
      const fn = plugin[callbackName] as any;
      if (fn) {
        if (type === 'onMouseDown' || type === 'onDoubleClick' || type === 'onContextMenu') {
          fn(ev, hit, pluginCtx);
        } else {
          fn(ev, pluginCtx);
        }
        if (ev.isPropagationStopped) break;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => dispatch('onMouseDown', e, 'onMouseDown');
  const handleMouseMove = (e: React.MouseEvent) => {
    setCursor('default');
    dispatch('onMouseMove', e, 'onMouseMove');
  };
  const handleMouseUp = (e: React.MouseEvent) => dispatch('onMouseUp', e, 'onMouseUp');
  const handleDoubleClick = (e: React.MouseEvent) => dispatch('onDoubleClick', e, 'onDoubleClick');
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch('onContextMenu', e, 'onContextMenu');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const p of plugins) {
        if (p.onKeyDown?.(e, pluginCtx)) break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [plugins, pluginCtx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      const ev = createEvent(e, 'onWheel');
      for (const p of plugins) {
        const res = p.onWheel?.(ev, pluginCtx);
        if (ev.isPropagationStopped || res === true) {
          e.preventDefault();
          break;
        }
      }
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [plugins, pluginCtx]);

  const draw = useCallback(() => {
    if (!rendererRef.current) return;
    rendererRef.current.render(state, scene, plugins, pluginCtx);
  }, [state, scene, plugins, pluginCtx]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        draw();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  useEffect(() => {
    const request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, [draw]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#09090b]">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className="w-full h-full outline-none"
      />
      {plugins.map((p, i) => <React.Fragment key={p.name + i}>{p.onRenderOverlay?.(pluginCtx)}</React.Fragment>)}
    </div>
  );
};

export default CanvasEditor;
