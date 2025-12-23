
import { useState, useCallback } from 'react';
import { CanvasState, Shape } from '../types';
import { Scene } from '../models/Scene';
import { TextShape } from '../models/UIShape';

type DragMode = 'move' | 'resize' | 'rotate' | 'pan' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';

interface UseCanvasInteractionsProps {
  state: CanvasState;
  setState: React.Dispatch<React.SetStateAction<CanvasState>>;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  scene: Scene;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const useCanvasInteractions = ({
  state,
  setState,
  updateShape,
  scene,
  canvasRef
}: UseCanvasInteractionsProps) => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [draggedShapeId, setDraggedShapeId] = useState<string | null>(null);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - state.offset.x) / state.zoom;
    const y = (clientY - rect.top - state.offset.y) / state.zoom;
    return { x, y };
  }, [state.offset, state.zoom, canvasRef]);

  const getGlobalCorner = useCallback((shape: Shape, corner: ResizeHandle) => {
    const zoom = state.zoom;
    const padding = 4 / zoom;
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;

    let lx = 0, ly = 0;
    switch (corner) {
      case 'tl': lx = shape.x - padding; ly = shape.y - padding; break;
      case 'tr': lx = shape.x + shape.width + padding; ly = shape.y - padding; break;
      case 'bl': lx = shape.x - padding; ly = shape.y + shape.height + padding; break;
      case 'br': lx = shape.x + shape.width + padding; ly = shape.y + shape.height + padding; break;
    }

    const dx = lx - cx;
    const dy = ly - cy;
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    
    return {
      x: dx * cos - dy * sin + cx,
      y: dx * sin + dy * cos + cy
    };
  }, [state.zoom]);

  const getRotationHandleCoords = useCallback((shape: Shape) => {
    const zoom = state.zoom;
    const padding = 4 / zoom;
    const rotateLineHeight = 24 / zoom;
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;

    const lx = shape.x + shape.width / 2;
    const ly = shape.y - padding - rotateLineHeight;

    const dx = lx - cx;
    const dy = ly - cy;
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    
    return {
      x: dx * cos - dy * sin + cx,
      y: dx * sin + dy * cos + cy
    };
  }, [state.zoom]);

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (state.selectedId) {
      const shape = state.shapes.find(s => s.id === state.selectedId);
      if (shape) {
        const handleThreshold = 15 / state.zoom;

        const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br'];
        for (const h of handles) {
          const coords = getGlobalCorner(shape, h);
          if (Math.hypot(x - coords.x, y - coords.y) < handleThreshold) {
            setDragMode('resize');
            setActiveHandle(h);
            setDraggedShapeId(shape.id);
            
            let fx = 0, fy = 0;
            switch (h) {
              case 'tl': fx = shape.x + shape.width; fy = shape.y + shape.height; break;
              case 'tr': fx = shape.x; fy = shape.y + shape.height; break;
              case 'bl': fx = shape.x + shape.width; fy = shape.y; break;
              case 'br': fx = shape.x; fy = shape.y; break;
            }

            const scx = shape.x + shape.width / 2;
            const scy = shape.y + shape.height / 2;
            const dx = fx - scx;
            const dy = fy - scy;
            const cos = Math.cos(shape.rotation);
            const sin = Math.sin(shape.rotation);
            setFixedPoint({
              x: dx * cos - dy * sin + scx,
              y: dx * sin + dy * cos + scy
            });
            return;
          }
        }

        const rotateCoords = getRotationHandleCoords(shape);
        if (Math.hypot(x - rotateCoords.x, y - rotateCoords.y) < handleThreshold) {
          setDragMode('rotate');
          setDraggedShapeId(shape.id);
          return;
        }
      }
    }

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setDragMode('pan');
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const hit = scene.hitTest(x, y);
    const selectedId = hit ? hit.id : null;
    setState(prev => ({ ...prev, selectedId }));
    
    if (hit) {
      setDragMode('move');
      setDraggedShapeId(hit.id);
      setDragStart({ x: x - hit.x, y: y - hit.y });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (dragMode === 'pan') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setState(prev => ({
        ...prev,
        offset: { x: prev.offset.x + dx, y: prev.offset.y + dy }
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!draggedShapeId) return;
    const shape = state.shapes.find(s => s.id === draggedShapeId);
    if (!shape) return;

    if (dragMode === 'move') {
      updateShape(draggedShapeId, {
        x: x - dragStart.x,
        y: y - dragStart.y
      });
    } else if (dragMode === 'resize' && activeHandle) {
      const dx = x - fixedPoint.x;
      const dy = y - fixedPoint.y;
      
      const cos = Math.cos(-shape.rotation);
      const sin = Math.sin(-shape.rotation);
      const ldx = dx * cos - dy * sin;
      const ldy = dx * sin + dy * cos;

      let newWidth = ldx;
      let newHeight = ldy;
      
      switch (activeHandle) {
        case 'tl': newWidth = -ldx; newHeight = -ldy; break;
        case 'tr': newWidth = ldx; newHeight = -ldy; break;
        case 'bl': newWidth = -ldx; newHeight = ldy; break;
        case 'br': newWidth = ldx; newHeight = ldy; break;
      }

      newWidth = Math.max(10, newWidth);
      newHeight = Math.max(10, newHeight);

      if (shape.type === 'circle') {
        const size = Math.max(newWidth, newHeight);
        newWidth = size;
        newHeight = size;
      }
      
      // Auto-height for text shapes on width resize
      if (shape.type === 'text') {
        newHeight = TextShape.measureHeight(shape.text || '', newWidth, shape.fontSize || 16);
      }

      let vcx = 0, vcy = 0;
      switch (activeHandle) {
        case 'tl': vcx = -newWidth / 2; vcy = -newHeight / 2; break;
        case 'tr': vcx = newWidth / 2; vcy = -newHeight / 2; break;
        case 'bl': vcx = -newWidth / 2; vcy = newHeight / 2; break;
        case 'br': vcx = newWidth / 2; vcy = newHeight / 2; break;
      }

      const rcos = Math.cos(shape.rotation);
      const rsin = Math.sin(shape.rotation);
      const newCx = vcx * rcos - vcy * rsin + fixedPoint.x;
      const newCy = vcx * rsin + vcy * rcos + fixedPoint.y;

      updateShape(draggedShapeId, {
        width: newWidth,
        height: newHeight,
        x: newCx - newWidth / 2,
        y: newCy - newHeight / 2
      });
    } else if (dragMode === 'rotate') {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
      updateShape(draggedShapeId, { rotation: angle });
    }
  };

  const onMouseUp = () => {
    setDragMode(null);
    setActiveHandle(null);
    setDraggedShapeId(null);
  };

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    dragMode,
    getCanvasCoords
  };
};
