
import { CanvasPlugin, PluginContext } from '../types';
import React, { useState } from 'react';

export const useSelectionPlugin = (): CanvasPlugin => {
  const [marquee, setMarquee] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);

  return {
    name: 'selection',
    onMouseDown: (e, hit, ctx) => {
      if (e.button !== 0) return;
      
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      
      if (!hit) {
        if (!e.shiftKey) {
          ctx.setState(prev => ({ ...prev, selectedIds: [] }));
        }
        setMarquee({ start: { x, y }, end: { x, y } });
        return true;
      }
      
      return false;
    },
    onMouseMove: (e, ctx) => {
      if (marquee) {
        const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
        setMarquee(prev => prev ? { ...prev, end: { x, y } } : null);
        ctx.setCursor('crosshair');
      } else {
        // Only set default if no other plugin set it (base check)
        const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
        const hit = ctx.scene.hitTest(x, y);
        if (!hit) {
          ctx.setCursor('crosshair');
        }
      }
    },
    onMouseUp: (e, ctx) => {
      if (marquee) {
        const x1 = Math.min(marquee.start.x, marquee.end.x);
        const y1 = Math.min(marquee.start.y, marquee.end.y);
        const x2 = Math.max(marquee.start.x, marquee.end.x);
        const y2 = Math.max(marquee.start.y, marquee.end.y);
        
        const inRect = ctx.scene.getShapes().filter(s => 
          s.x >= x1 && s.x + s.width <= x2 && s.y >= y1 && s.y + s.height <= y2
        ).map(s => s.id);

        if (inRect.length > 0) {
          ctx.setState(prev => ({ ...prev, selectedIds: [...new Set([...prev.selectedIds, ...inRect])] }));
        }
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
      
      c.strokeStyle = '#6366f1';
      c.fillStyle = 'rgba(99, 102, 241, 0.1)';
      c.lineWidth = 1 / zoom;
      const w = marquee.end.x - marquee.start.x;
      const h = marquee.end.y - marquee.start.y;
      c.fillRect(marquee.start.x, marquee.start.y, w, h);
      c.strokeRect(marquee.start.x, marquee.start.y, w, h);
      c.restore();
    }
  };
};
