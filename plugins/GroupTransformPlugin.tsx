
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext } from '../types';

type DragMode = 'move' | 'resize' | 'rotate' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr';

export const useGroupTransformPlugin = (): CanvasPlugin => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentMouse, setCurrentMouse] = useState({ x: 0, y: 0 });
  const [initialShapes, setInitialShapes] = useState<Shape[]>([]);
  const [initialGroupRect, setInitialGroupRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [rotationDelta, setRotationDelta] = useState(0);

  const VISUAL_PADDING = 4;

  const getGroupBounds = (shapes: Shape[], ids: string[], zoom: number) => {
    const selected = shapes.filter(s => ids.includes(s.id));
    if (selected.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const padding = VISUAL_PADDING / zoom;

    selected.forEach(s => {
      const corners = [
        { x: -padding, y: -padding }, 
        { x: s.width + padding, y: -padding },
        { x: -padding, y: s.height + padding }, 
        { x: s.width + padding, y: s.height + padding }
      ];
      const cx = s.x + s.width / 2;
      const cy = s.y + s.height / 2;
      const cos = Math.cos(s.rotation);
      const sin = Math.sin(s.rotation);

      corners.forEach(p => {
        const dx = p.x - s.width / 2;
        const dy = p.y - s.height / 2;
        const wx = dx * cos - dy * sin + cx;
        const wy = dx * sin + dy * cos + cy;
        minX = Math.min(minX, wx);
        minY = Math.min(minY, wy);
        maxX = Math.max(maxX, wx);
        maxY = Math.max(maxY, wy);
      });
    });

    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
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
    name: 'group-transform',
    onMouseDown: (e, hit, ctx) => {
      if (ctx.state.selectedIds.length <= 1 || ctx.state.editingId) return false;

      const zoom = ctx.state.zoom;
      const rect = getGroupBounds(ctx.state.shapes, ctx.state.selectedIds, zoom);
      if (!rect) return false;

      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const handleSize = 12 / zoom;

      setInitialGroupRect(rect);
      setDragStart({ x, y });
      setCurrentMouse({ x, y });
      setRotationDelta(0);

      const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
      for (const h of handles) {
        let hx = rect.x, hy = rect.y;
        if (h.includes('r')) hx += rect.w;
        if (h.includes('m') && !h.startsWith('m')) hx += rect.w / 2;
        if (h.includes('b')) hy += rect.h;
        if (h.includes('m') && h.startsWith('m')) hy += rect.h / 2;
        if (h === 'mr') { hx = rect.x + rect.w; hy = rect.y + rect.h / 2; }
        if (h === 'ml') { hx = rect.x; hy = rect.y + rect.h / 2; }

        if (Math.hypot(x - hx, y - hy) < handleSize) {
          setDragMode('resize');
          setActiveHandle(h);
          setInitialShapes(ctx.state.shapes.filter(s => ctx.state.selectedIds.includes(s.id)));
          
          let fx = rect.x + rect.w, fy = rect.y + rect.h;
          if (h.includes('l')) fx = rect.x + rect.w; else if (h.includes('r')) fx = rect.x; else fx = rect.x + rect.w / 2;
          if (h.includes('t')) fy = rect.y + rect.h; else if (h.includes('b')) fy = rect.y; else fy = rect.y + rect.h / 2;
          if (h === 'mr') fx = rect.x;
          if (h === 'ml') fx = rect.x + rect.w;
          
          setFixedPoint({ x: fx, y: fy });
          return true;
        }
      }

      const rx = rect.x + rect.w / 2;
      const ry = rect.y - 30 / zoom;
      if (Math.hypot(x - rx, y - ry) < handleSize) {
        setDragMode('rotate');
        setInitialShapes(ctx.state.shapes.filter(s => ctx.state.selectedIds.includes(s.id)));
        return true;
      }

      const isHitSelected = hit && ctx.state.selectedIds.includes(hit.id);
      const isInsideRect = x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

      if (isHitSelected || isInsideRect) {
        setDragMode('move');
        setInitialShapes(ctx.state.shapes.filter(s => ctx.state.selectedIds.includes(s.id)));
        return true;
      }

      return false;
    },

    onMouseMove: (e, ctx) => {
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const zoom = ctx.state.zoom;
      const handleSize = 12 / zoom;

      // Handle hover cursor
      if (!dragMode && ctx.state.selectedIds.length > 1) {
        const rect = getGroupBounds(ctx.state.shapes, ctx.state.selectedIds, zoom);
        if (rect) {
          // Check rotate handle
          const rx = rect.x + rect.w / 2;
          const ry = rect.y - 30 / zoom;
          if (Math.hypot(x - rx, y - ry) < handleSize) {
            ctx.setCursor('grab');
            return;
          }
          // Check resize handles
          const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
          for (const h of handles) {
            let hx = rect.x, hy = rect.y;
            if (h.includes('r')) hx += rect.w;
            if (h.includes('m') && !h.startsWith('m')) hx += rect.w / 2;
            if (h.includes('b')) hy += rect.h;
            if (h.includes('m') && h.startsWith('m')) hy += rect.h / 2;
            if (h === 'mr') { hx = rect.x + rect.w; hy = rect.y + rect.h / 2; }
            if (h === 'ml') { hx = rect.x; hy = rect.y + rect.h / 2; }

            if (Math.hypot(x - hx, y - hy) < handleSize) {
              ctx.setCursor(getCursorForHandle(h));
              return;
            }
          }
          // Check inside
          if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
            ctx.setCursor('move');
            return;
          }
        }
      }

      if (!dragMode || !initialGroupRect) return;
      setCurrentMouse({ x, y });
      
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      if (dragMode === 'move') {
        ctx.setState(prev => ({
          ...prev,
          shapes: prev.shapes.map(s => {
            const initial = initialShapes.find(is => is.id === s.id);
            return initial ? { ...s, x: initial.x + dx, y: initial.y + dy } : s;
          })
        }), false);
        ctx.setCursor('move');
      } 
      else if (dragMode === 'rotate') {
        const cx = initialGroupRect.x + initialGroupRect.w / 2;
        const cy = initialGroupRect.y + initialGroupRect.h / 2;
        const angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
        const initialAngle = Math.atan2(dragStart.y - cy, dragStart.x - cx) + Math.PI / 2;
        const deltaRotation = angle - initialAngle;
        setRotationDelta(deltaRotation);

        ctx.setState(prev => ({
          ...prev,
          shapes: prev.shapes.map(s => {
            const initial = initialShapes.find(is => is.id === s.id);
            if (!initial) return s;

            const scx = initial.x + initial.width / 2;
            const scy = initial.y + initial.height / 2;
            const rx = scx - cx;
            const ry = scy - cy;
            const cos = Math.cos(deltaRotation);
            const sin = Math.sin(deltaRotation);
            const nx = rx * cos - ry * sin + cx;
            const ny = rx * sin + ry * cos + cy;

            return {
              ...s,
              x: nx - initial.width / 2,
              y: ny - initial.height / 2,
              rotation: initial.rotation + deltaRotation
            };
          })
        }), false);
        ctx.setCursor('grabbing');
      }
      else if (dragMode === 'resize' && activeHandle) {
        let scaleX = 1, scaleY = 1;
        const currentW = Math.abs(x - fixedPoint.x);
        const currentH = Math.abs(y - fixedPoint.y);
        
        if (activeHandle.includes('l') || activeHandle.includes('r')) scaleX = currentW / initialGroupRect.w;
        if (activeHandle.includes('t') || activeHandle.includes('b')) scaleY = currentH / initialGroupRect.h;
        
        if (activeHandle === 'ml' || activeHandle === 'mr') scaleY = 1;
        if (activeHandle === 'tm' || activeHandle === 'bm') scaleX = 1;

        if (e.shiftKey) {
          const s = Math.max(scaleX, scaleY);
          scaleX = s; scaleY = s;
        }

        ctx.setState(prev => ({
          ...prev,
          shapes: prev.shapes.map(s => {
            const initial = initialShapes.find(is => is.id === s.id);
            if (!initial) return s;

            const rx = initial.x - fixedPoint.x;
            const ry = initial.y - fixedPoint.y;
            
            return {
              ...s,
              x: fixedPoint.x + rx * scaleX,
              y: fixedPoint.y + ry * scaleY,
              width: initial.width * scaleX,
              height: initial.height * scaleY
            };
          })
        }), false);
        ctx.setCursor(getCursorForHandle(activeHandle));
      }
    },

    onMouseUp: (e, ctx) => {
      if (dragMode) ctx.setState(prev => ({ ...prev }), true);
      setDragMode(null);
      setInitialShapes([]);
      setInitialGroupRect(null);
      setRotationDelta(0);
    },

    onRenderForeground: (ctx) => {
      if (ctx.state.selectedIds.length <= 1 || ctx.state.editingId) return;
      const zoom = ctx.state.zoom;
      
      let rect = initialGroupRect;
      if (!dragMode || !rect) {
        rect = getGroupBounds(ctx.state.shapes, ctx.state.selectedIds, zoom);
      }
      
      if (!rect) return;

      const { renderer, state } = ctx;
      if (!renderer) return;
      const c = renderer.ctx;
      const offset = state.offset;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      if (dragMode === 'move') {
        const dx = currentMouse.x - dragStart.x;
        const dy = currentMouse.y - dragStart.y;
        c.translate(dx, dy);
      } else if (dragMode === 'rotate') {
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        c.translate(cx, cy);
        c.rotate(rotationDelta);
        c.translate(-cx, -cy);
      } else if (dragMode === 'resize' && activeHandle) {
        const currentRect = getGroupBounds(ctx.state.shapes, ctx.state.selectedIds, zoom);
        if (currentRect) rect = currentRect;
      }

      c.strokeStyle = '#6366f1';
      c.setLineDash([5, 5]);
      c.lineWidth = 1.5 / zoom;
      c.strokeRect(rect.x, rect.y, rect.w, rect.h);
      c.setLineDash([]);

      const handleSize = 8 / zoom;
      const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
      c.fillStyle = '#ffffff';
      c.lineWidth = 1.5 / zoom;
      
      const rx = rect.x + rect.w / 2;
      const ry = rect.y - 30 / zoom;
      c.beginPath();
      c.moveTo(rx, rect.y);
      c.lineTo(rx, ry);
      c.stroke();
      c.beginPath();
      c.arc(rx, ry, 5 / zoom, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      handles.forEach(h => {
        let hx = rect.x, hy = rect.y;
        if (h.includes('r')) hx += rect.w;
        if (h.includes('m') && !h.startsWith('m')) hx += rect.w / 2;
        if (h.includes('b')) hy += rect.h;
        if (h.includes('m') && h.startsWith('m')) hy += rect.h / 2;
        if (h === 'mr') { hx = rect.x + rect.w; hy = rect.y + rect.h / 2; }
        if (h === 'ml') { hx = rect.x; hy = rect.y + rect.h / 2; }

        c.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        c.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      });

      c.restore();
    }
  };
};
