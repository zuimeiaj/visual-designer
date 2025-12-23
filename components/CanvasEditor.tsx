
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { CanvasState, Shape, CanvasPlugin, PluginContext } from '../types';
import { CanvasRenderer } from '../services/canvasRenderer';
import { Scene } from '../models/Scene';
import { useCanvasInteractions } from '../hooks/useCanvasInteractions';

interface Props {
  state: CanvasState;
  setState: React.Dispatch<React.SetStateAction<CanvasState>>;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  plugins?: CanvasPlugin[];
}

const CanvasEditor: React.FC<Props> = ({ state, setState, updateShape, plugins = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  const scene = useMemo(() => new Scene(state.shapes), []);
  
  useEffect(() => {
    state.shapes.forEach(s => {
      const existing = scene.getShapes().find(os => os.id === s.id);
      if (existing) {
        existing.update(s);
      } else {
        scene.add(s);
      }
    });
    scene.getShapes().forEach(s => {
      if (!state.shapes.find(os => os.id === s.id)) {
        scene.remove(s.id);
      }
    });
  }, [state.shapes, scene]);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        rendererRef.current = new CanvasRenderer(ctx);
      }
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;
    rendererRef.current.render(state, scene, canvas.width, canvas.height);
  }, [state, scene]);

  const { onMouseDown: baseOnMouseDown, onMouseMove, onMouseUp, dragMode, getCanvasCoords } = useCanvasInteractions({
    state,
    setState,
    updateShape,
    scene,
    canvasRef
  });

  const pluginCtx: PluginContext = useMemo(() => ({
    state,
    setState,
    updateShape,
    getCanvasCoords
  }), [state, setState, updateShape, getCanvasCoords]);

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const hit = scene.hitTest(x, y);
    
    // Core interaction
    baseOnMouseDown(e);
    
    // Plugin hooks
    plugins.forEach(p => p.onMouseDown?.(e, hit, pluginCtx));
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const hit = scene.hitTest(x, y);
    
    plugins.forEach(p => p.onDoubleClick?.(e, hit, pluginCtx));
  };

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 0;
        canvas.height = canvas.parentElement?.clientHeight || 0;
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

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      const delta = -e.deltaY * 0.001;
      setState(prev => ({ ...prev, zoom: Math.min(5, Math.max(0.1, prev.zoom + delta)) }));
    } else {
      setState(prev => ({
        ...prev,
        offset: { x: prev.offset.x - e.deltaX, y: prev.offset.y - e.deltaY }
      }));
    }
  };

  const getCursor = () => {
    if (dragMode === 'pan') return 'grabbing';
    if (dragMode === 'move') return 'move';
    if (dragMode === 'resize') return 'nwse-resize';
    if (dragMode === 'rotate') return 'crosshair';
    return 'default';
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        style={{ cursor: getCursor() }}
        className="w-full h-full outline-none"
      />
      {plugins.map(p => p.renderOverlay?.(pluginCtx))}
    </div>
  );
};

export default CanvasEditor;
