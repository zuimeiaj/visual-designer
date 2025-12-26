
import { CanvasPlugin, Shape, PluginContext } from '../types';
import { useState } from 'react';

export const useSelectionPlugin = (): CanvasPlugin => {
  const [marquee, setMarquee] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);

  const getAABB = (s: Shape): { x: number, y: number, w: number, h: number } => {
    if (s.type === 'group' && s.children && s.children.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      s.children.forEach(c => {
        const b = getAABB(c);
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
    const cos = Math.cos(s.rotation), sin = Math.sin(s.rotation);
    const hw = s.width / 2, hh = s.height / 2;
    const corners = [{x:-hw,y:-hh},{x:hw,y:-hh},{x:hw,y:hh},{x:-hw,y:hh}].map(p => ({
      x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos
    }));
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };

  return {
    name: 'selection',
    onMouseDown: (e, hit, ctx) => {
      if ((e.nativeEvent as MouseEvent).button !== 0 || ctx.state.editingId || ctx.state.activeTool !== 'select') return false;
      
      if (hit) return false;

      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      if (!(e.nativeEvent as MouseEvent).shiftKey) {
        ctx.setState(prev => ({ ...prev, selectedIds: [] }), false);
      }
      setMarquee({ start: { x, y }, end: { x, y } });
      return true;
    },
    onMouseMove: (e, ctx) => {
      if (marquee) {
        const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
        setMarquee(prev => prev ? { ...prev, end: { x, y } } : null);
        ctx.setCursor('crosshair');
      }
    },
    onMouseUp: (e, ctx) => {
      if (marquee) {
        const x1 = Math.min(marquee.start.x, marquee.end.x);
        const y1 = Math.min(marquee.start.y, marquee.end.y);
        const x2 = Math.max(marquee.start.x, marquee.end.x);
        const y2 = Math.max(marquee.start.y, marquee.end.y);
        
        const inRect = ctx.state.shapes.filter(s => {
          const b = getAABB(s);
          // Check if the shape's bounding box intersects with the marquee
          return b.x + b.w >= x1 && b.x <= x2 && b.y + b.h >= y1 && b.y <= y2;
        }).map(s => s.id);

        ctx.setState(prev => ({ 
          ...prev, 
          selectedIds: (e.nativeEvent as MouseEvent).shiftKey ? [...new Set([...prev.selectedIds, ...inRect])] : inRect 
        }), true);
        setMarquee(null);
      }
    },
    onRenderForeground: (ctx) => {
      if (!marquee || !ctx.renderer) return;
      const { ctx: c } = ctx.renderer;
      const { zoom, offset } = ctx.state;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);
      
      c.strokeStyle = '#818cf8';
      c.fillStyle = 'rgba(129, 140, 248, 0.15)';
      c.lineWidth = 1 / zoom;
      c.setLineDash([4 / zoom, 2 / zoom]);
      
      const x = marquee.start.x;
      const y = marquee.start.y;
      const w = marquee.end.x - x;
      const h = marquee.end.y - y;
      
      c.fillRect(x, y, w, h);
      c.strokeRect(x, y, w, h);
      
      c.restore();
    }
  };
};
