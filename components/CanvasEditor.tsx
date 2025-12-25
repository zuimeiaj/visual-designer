
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { CanvasState, Shape, CanvasPlugin, PluginContext } from '../types';
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
  
  // Robust Synchronization: Handles property updates, additions, removals, and REORDERING.
  useEffect(() => {
    // 1. Sync properties and add missing shapes
    state.shapes.forEach(s => {
      const existing = scene.getShapes().find(os => os.id === s.id);
      if (existing) {
        existing.update(s);
      } else {
        scene.add(s);
      }
    });

    // 2. Remove shapes that are no longer in state
    const shapeIdsInState = new Set(state.shapes.map(s => s.id));
    scene.getShapes().forEach(s => {
      if (!shapeIdsInState.has(s.id)) scene.remove(s.id);
    });

    // 3. FIX: Reorder internal scene list to match state.shapes order
    // The rendering order in Scene.ts depends on the array index.
    const internalShapes = scene.getShapes();
    internalShapes.sort((a, b) => {
      const indexA = state.shapes.findIndex(s => s.id === a.id);
      const indexB = state.shapes.findIndex(s => s.id === b.id);
      return indexA - indexB;
    });
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
    if (canvasRef.current) {
      canvasRef.current.style.cursor = cursor;
    }
  }, []);

  const pluginCtx: PluginContext = useMemo(() => ({
    state, setState, updateShape, getCanvasCoords,
    scene, canvas: canvasRef.current, renderer: rendererRef.current,
    undo, redo, setCursor
  }), [state, setState, updateShape, getCanvasCoords, scene, undo, redo, setCursor]);

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const hit = scene.hitTest(x, y);
    for (const p of plugins) {
      if (p.onMouseDown?.(e, hit, pluginCtx)) break;
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    setCursor('default');
    plugins.forEach(p => p.onMouseMove?.(e, pluginCtx));
  };

  const onMouseUp = (e: React.MouseEvent) => {
    plugins.forEach(p => p.onMouseUp?.(e, pluginCtx));
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const hit = scene.hitTest(x, y);
    for (const p of plugins) {
      if (p.onDoubleClick?.(e, hit, pluginCtx)) break;
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const hit = scene.hitTest(x, y);
    for (const p of plugins) {
      if (p.onContextMenu?.(e, hit, pluginCtx)) break;
    }
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
      for (const p of plugins) {
        if (p.onWheel?.(e as any, pluginCtx)) {
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
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        className="w-full h-full outline-none"
      />
      {plugins.map((p, i) => <React.Fragment key={p.name + i}>{p.onRenderOverlay?.(pluginCtx)}</React.Fragment>)}
    </div>
  );
};

export default CanvasEditor;
