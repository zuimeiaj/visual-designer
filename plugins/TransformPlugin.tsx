
import { useState } from 'react';
import { CanvasPlugin, Shape } from '../types';
import { TextShape } from '../models/UIShape';

type DragMode = 'move' | 'resize' | 'rotate' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr';

export const useTransformPlugin = (): CanvasPlugin => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [initialShape, setInitialShape] = useState<Shape | null>(null);

  const VISUAL_PADDING = 4;

  const getHandleCoords = (shape: Shape, handle: ResizeHandle, zoom: number) => {
    const p = VISUAL_PADDING / zoom;
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    
    let lx = 0, ly = 0;
    switch (handle) {
      case 'tl': lx = shape.x - p; ly = shape.y - p; break;
      case 'tr': lx = shape.x + shape.width + p; ly = shape.y - p; break;
      case 'bl': lx = shape.x - p; ly = shape.y + shape.height + p; break;
      case 'br': lx = shape.x + shape.width + p; ly = shape.y + shape.height + p; break;
      case 'tm': lx = shape.x + shape.width / 2; ly = shape.y - p; break;
      case 'bm': lx = shape.x + shape.width / 2; ly = shape.y + shape.height + p; break;
      case 'ml': lx = shape.x - p; ly = shape.y + shape.height / 2; break;
      case 'mr': lx = shape.x + shape.width + p; ly = shape.y + shape.height / 2; break;
    }

    const dx = lx - cx;
    const dy = ly - cy;
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    
    return {
      x: dx * cos - dy * sin + cx,
      y: dx * sin + dy * cos + cy
    };
  };

  const getRotationHandleCoords = (shape: Shape, zoom: number) => {
    const p = VISUAL_PADDING / zoom;
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const handleDistance = 30 / zoom;
    const lx = shape.x + shape.width / 2;
    const ly = shape.y - p - handleDistance;

    const dx = lx - cx;
    const dy = ly - cy;
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    
    return {
      x: dx * cos - dy * sin + cx,
      y: dx * sin + dy * cos + cy
    };
  };

  const getCursorForHandle = (handle: ResizeHandle): string => {
    switch (handle) {
      case 'tl': case 'br': return 'nwse-resize';
      case 'tr': case 'bl': return 'nesw-resize';
      case 'tm': case 'bm': return 'ns-resize';
      case 'ml': case 'mr': return 'ew-resize';
      default: return 'pointer';
    }
  };

  return {
    name: 'transform',
    onMouseDown: (e, hit, ctx) => {
      if (ctx.state.editingId) return false;

      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const zoom = ctx.state.zoom;
      const handleSize = 12 / zoom;

      if (ctx.state.selectedIds.length === 1) {
        const primaryId = ctx.state.selectedIds[0];
        const selectedShape = ctx.state.shapes.find(s => s.id === primaryId);
        
        if (selectedShape) {
          const rotCoords = getRotationHandleCoords(selectedShape, zoom);
          if (Math.hypot(x - rotCoords.x, y - rotCoords.y) < handleSize) {
            setDragMode('rotate');
            setInitialShape({ ...selectedShape });
            setDragStart({ x, y });
            return true;
          }

          const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
          for (const h of handles) {
            const coords = getHandleCoords(selectedShape, h, zoom);
            if (Math.hypot(x - coords.x, y - coords.y) < handleSize) {
              setDragMode('resize');
              setActiveHandle(h);
              setInitialShape({ ...selectedShape });
              
              const cx = selectedShape.x + selectedShape.width / 2;
              const cy = selectedShape.y + selectedShape.height / 2;
              
              let ox = 0, oy = 0;
              switch (h) {
                case 'tl': ox = selectedShape.x + selectedShape.width; oy = selectedShape.y + selectedShape.height; break;
                case 'tr': ox = selectedShape.x; oy = selectedShape.y + selectedShape.height; break;
                case 'bl': ox = selectedShape.x + selectedShape.width; oy = selectedShape.y; break;
                case 'br': ox = selectedShape.x; oy = selectedShape.y; break;
                case 'tm': ox = cx; oy = selectedShape.y + selectedShape.height; break;
                case 'bm': ox = cx; oy = selectedShape.y; break;
                case 'ml': ox = selectedShape.x + selectedShape.width; oy = cy; break;
                case 'mr': ox = selectedShape.x; oy = cy; break;
              }

              const rdx = ox - cx;
              const rdy = oy - cy;
              const rcos = Math.cos(selectedShape.rotation);
              const rsin = Math.sin(selectedShape.rotation);
              setFixedPoint({
                x: rdx * rcos - rdy * rsin + cx,
                y: rdx * rsin + rdy * rcos + cy
              });
              
              setDragStart({ x, y });
              return true;
            }
          }
        }
      }

      if (hit) {
        if (e.detail >= 2 && hit.type === 'text') return false;

        const isAlreadySelected = ctx.state.selectedIds.includes(hit.id);
        
        if (isAlreadySelected && ctx.state.selectedIds.length > 1) return false;

        if (!isAlreadySelected) {
          if (e.shiftKey) {
            ctx.setState(prev => ({ ...prev, selectedIds: [...prev.selectedIds, hit.id] }), false);
          } else {
            ctx.setState(prev => ({ ...prev, selectedIds: [hit.id] }), false);
          }
        }

        setDragMode('move');
        setDragStart({ x, y });
        setInitialShape(ctx.state.shapes.find(s => s.id === hit.id) || null);
        return true;
      }
      
      return false;
    },

    onMouseMove: (e, ctx) => {
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const zoom = ctx.state.zoom;
      const handleSize = 12 / zoom;

      // Handle cursor updates when not dragging
      if (!dragMode) {
        if (ctx.state.selectedIds.length === 1) {
          const shape = ctx.state.shapes.find(s => s.id === ctx.state.selectedIds[0]);
          if (shape) {
            const rotCoords = getRotationHandleCoords(shape, zoom);
            if (Math.hypot(x - rotCoords.x, y - rotCoords.y) < handleSize) {
              ctx.setCursor('grab');
              return;
            }
            const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
            for (const h of handles) {
              const coords = getHandleCoords(shape, h, zoom);
              if (Math.hypot(x - coords.x, y - coords.y) < handleSize) {
                ctx.setCursor(getCursorForHandle(h));
                return;
              }
            }
          }
        }
        
        const hit = ctx.scene.hitTest(x, y);
        if (hit) {
          ctx.setCursor('move');
          return;
        }
      }

      if (!dragMode) return;

      if (dragMode === 'move') {
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        ctx.setState(prev => ({
          ...prev,
          shapes: prev.shapes.map(s => 
            prev.selectedIds.includes(s.id) 
              ? { ...s, x: s.x + dx, y: s.y + dy } 
              : s
          )
        }), false);
        setDragStart({ x, y });
        ctx.setCursor('move');
      } 
      else if (dragMode === 'rotate' && initialShape) {
        const cx = initialShape.x + initialShape.width / 2;
        const cy = initialShape.y + initialShape.height / 2;
        const angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
        const shapeId = ctx.state.selectedIds[0];
        ctx.updateShape(shapeId, { rotation: angle });
        ctx.setCursor('grabbing');
      }
      else if (dragMode === 'resize' && activeHandle && initialShape) {
        const dx = x - fixedPoint.x;
        const dy = y - fixedPoint.y;
        
        const cos = Math.cos(-initialShape.rotation);
        const sin = Math.sin(-initialShape.rotation);
        const localDX = dx * cos - dy * sin;
        const localDY = dx * sin + dy * cos;

        let newWidth = initialShape.width;
        let newHeight = initialShape.height;

        switch (activeHandle) {
          case 'br': newWidth = localDX; newHeight = localDY; break;
          case 'tl': newWidth = -localDX; newHeight = -localDY; break;
          case 'tr': newWidth = localDX; newHeight = -localDY; break;
          case 'bl': newWidth = -localDX; newHeight = localDY; break;
          case 'mr': newWidth = localDX; break;
          case 'ml': newWidth = -localDX; break;
          case 'bm': newHeight = localDY; break;
          case 'tm': newHeight = -localDY; break;
        }

        newWidth = Math.max(10, newWidth);
        newHeight = Math.max(10, newHeight);

        const shapeId = ctx.state.selectedIds[0];
        const shape = ctx.state.shapes.find(s => s.id === shapeId);
        if (!shape) return;

        if (shape.type === 'circle') {
          let scale = 1;
          if (['ml', 'mr', 'tl', 'tr', 'bl', 'br'].includes(activeHandle)) {
            scale = newWidth / initialShape.width;
          } else {
            scale = newHeight / initialShape.height;
          }
          newWidth = initialShape.width * scale;
          newHeight = initialShape.height * scale;
        }

        if (shape.type === 'text') {
           newHeight = TextShape.measureHeight(shape.text || '', newWidth, shape.fontSize || 16);
        }

        let localCenterX = 0;
        let localCenterY = 0;

        switch (activeHandle) {
          case 'br': localCenterX = newWidth / 2; localCenterY = newHeight / 2; break;
          case 'tl': localCenterX = -newWidth / 2; localCenterY = -newHeight / 2; break;
          case 'tr': localCenterX = newWidth / 2; localCenterY = -newHeight / 2; break;
          case 'bl': localCenterX = -newWidth / 2; localCenterY = newHeight / 2; break;
          case 'mr': localCenterX = newWidth / 2; break;
          case 'ml': localCenterX = -newWidth / 2; break;
          case 'bm': localCenterY = newHeight / 2; break;
          case 'tm': localCenterY = -newHeight / 2; break;
        }

        const rcos = Math.cos(initialShape.rotation);
        const rsin = Math.sin(initialShape.rotation);
        const worldCenterX = localCenterX * rcos - localCenterY * rsin + fixedPoint.x;
        const worldCenterY = localCenterX * rsin + localCenterY * rcos + fixedPoint.y;

        ctx.updateShape(shapeId, {
          width: newWidth,
          height: newHeight,
          x: worldCenterX - newWidth / 2,
          y: worldCenterY - newHeight / 2
        });
        ctx.setCursor(getCursorForHandle(activeHandle));
      }
    },

    onMouseUp: (e, ctx) => {
      if (dragMode) ctx.setState(prev => ({ ...prev }), true);
      setDragMode(null);
      setActiveHandle(null);
      setInitialShape(null);
    },

    onRenderForeground: (ctx) => {
      const { renderer, state } = ctx;
      if (!renderer || state.selectedIds.length !== 1 || state.editingId) return;

      const c = renderer.ctx;
      const zoom = state.zoom;
      const offset = state.offset;
      const p = VISUAL_PADDING / zoom;

      const id = state.selectedIds[0];
      const shape = state.shapes.find(s => s.id === id);
      if (!shape) return;

      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);
      
      c.translate(cx, cy);
      c.rotate(shape.rotation);
      c.translate(-cx, -cy);

      const handleSize = 8 / zoom;
      const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
      
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#6366f1';
      c.lineWidth = 1.5 / zoom;

      const rotCoordsLocal = { x: shape.x + shape.width / 2, y: shape.y - p - 30 / zoom };
      c.beginPath();
      c.moveTo(shape.x + shape.width / 2, shape.y - p);
      c.lineTo(rotCoordsLocal.x, rotCoordsLocal.y);
      c.stroke();
      c.beginPath();
      c.arc(rotCoordsLocal.x, rotCoordsLocal.y, 5 / zoom, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      handles.forEach(h => {
        let hx = 0, hy = 0;
        switch (h) {
          case 'tl': hx = shape.x - p; hy = shape.y - p; break;
          case 'tr': hx = shape.x + shape.width + p; hy = shape.y - p; break;
          case 'bl': hx = shape.x - p; hy = shape.y + shape.height + p; break;
          case 'br': hx = shape.x + shape.width + p; hy = shape.y + shape.height + p; break;
          case 'tm': hx = shape.x + shape.width / 2; hy = shape.y - p; break;
          case 'bm': hx = shape.x + shape.width / 2; hy = shape.y + shape.height + p; break;
          case 'ml': hx = shape.x - p; hy = shape.y + shape.height / 2; break;
          case 'mr': hx = shape.x + shape.width + p; hy = shape.y + shape.height / 2; break;
        }
        // Drawing handle so that its center is exactly at (hx, hy)
        c.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        c.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      });

      c.restore();
    }
  };
};
