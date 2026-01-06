
import { CanvasPlugin, Shape, PluginContext } from '../types';
import { useState, useRef, useEffect } from 'react';
import { UIShape } from '../models/UIShape';

export const useSelectionPlugin = (): CanvasPlugin => {
  const [marquee, setMarquee] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
  const lastScreenPos = useRef<{ x: number, y: number } | null>(null);
  const ctxRef = useRef<PluginContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const EDGE_THRESHOLD = 50; 
  const MAX_SCROLL_SPEED = 12;

  useEffect(() => {
    const autoScroll = () => {
      const ctx = ctxRef.current;
      const screenPos = lastScreenPos.current;
      const canvas = ctx?.canvas;

      if (!ctx || !screenPos || !canvas || !marquee) {
        rafRef.current = requestAnimationFrame(autoScroll);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const mouseX = screenPos.x - rect.left;
      const mouseY = screenPos.y - rect.top;

      let dx = 0, dy = 0;

      if (mouseX < EDGE_THRESHOLD) {
        dx = Math.max(-MAX_SCROLL_SPEED, -((EDGE_THRESHOLD - mouseX) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      } else if (mouseX > rect.width - EDGE_THRESHOLD) {
        dx = Math.min(MAX_SCROLL_SPEED, ((mouseX - (rect.width - EDGE_THRESHOLD)) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      }

      if (mouseY < EDGE_THRESHOLD) {
        dy = Math.max(-MAX_SCROLL_SPEED, -((EDGE_THRESHOLD - mouseY) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      } else if (mouseY > rect.height - EDGE_THRESHOLD) {
        dy = Math.min(MAX_SCROLL_SPEED, ((mouseY - (rect.height - EDGE_THRESHOLD)) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      }

      if (dx !== 0 || dy !== 0) {
        ctx.setState(prev => {
          const newOffset = { x: prev.offset.x - dx, y: prev.offset.y - dy };
          const newWorldEnd = {
            x: (screenPos.x - rect.left - newOffset.x) / prev.zoom,
            y: (screenPos.y - rect.top - newOffset.y) / prev.zoom
          };
          setMarquee(prevM => prevM ? { ...prevM, end: newWorldEnd } : null);
          return { ...prev, offset: newOffset };
        }, false);
      }
      rafRef.current = requestAnimationFrame(autoScroll);
    };

    rafRef.current = requestAnimationFrame(autoScroll);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [marquee]);

  return {
    name: 'selection',
    priority: 10,

    onMouseDown: (e, hit, ctx) => {
      ctxRef.current = ctx;
      const isSelectTool = ctx.state.activeTool === 'select';
      const isLeftClick = (e.nativeEvent as MouseEvent).button === 0;

      if (!hit && isSelectTool && isLeftClick) {
        setMarquee({ start: { x: e.x, y: e.y }, end: { x: e.x, y: e.y } });
        ctx.setState(prev => ({ 
          ...prev, 
          interactionState: 'MARQUEE',
          selectedIds: (e.nativeEvent as MouseEvent).shiftKey ? prev.selectedIds : [] 
        }), false);
        e.consume();
        return true;
      }
      return false;
    },
    
    onInteraction: (type, e, ctx) => {
      ctxRef.current = ctx;
      if (type === 'mousemove') {
        const me = e.nativeEvent as MouseEvent;
        lastScreenPos.current = { x: me.clientX, y: me.clientY };
        
        if (marquee) {
          setMarquee(prev => prev ? { ...prev, end: { x: e.x, y: e.y } } : null);
          ctx.setCursor('crosshair');
          e.consume();
        }
      }
    },

    onMouseUp: (e, ctx) => {
      lastScreenPos.current = null;
      if (marquee) {
        const x1 = Math.min(marquee.start.x, marquee.end.x);
        const y1 = Math.min(marquee.start.y, marquee.end.y);
        const x2 = Math.max(marquee.start.x, marquee.end.x);
        const y2 = Math.max(marquee.start.y, marquee.end.y);
        
        const isClick = Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2;
        
        if (!isClick) {
          const inRect = ctx.state.shapes.filter(s => {
            if (s.locked || s.type === 'connection') return false;
            // 统一使用 UIShape 获取 AABB 保证精准
            const b = UIShape.create(s).getAABB();
            return b.x < x2 && b.x + b.w > x1 && b.y < y2 && b.y + b.h > y1;
          }).map(s => s.id);

          const isMulti = (e.nativeEvent as MouseEvent).shiftKey;
          ctx.setState(prev => ({ 
            ...prev, 
            selectedIds: isMulti ? [...new Set([...prev.selectedIds, ...inRect])] : inRect,
            interactionState: 'IDLE'
          }), true);
        } else {
          ctx.setState(prev => ({ ...prev, interactionState: 'IDLE' }), false);
        }
        
        setMarquee(null);
        e.consume();
      }
    },

    onRenderForeground: (ctx) => {
      if (!marquee || !ctx.renderer) return;
      const dpr = window.devicePixelRatio || 1;
      const { ctx: c } = ctx.renderer;
      const { zoom, offset } = ctx.state;
      
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); 
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);
      
      const x = Math.min(marquee.start.x, marquee.end.x);
      const y = Math.min(marquee.start.y, marquee.end.y);
      const w = Math.abs(marquee.end.x - marquee.start.x);
      const h = Math.abs(marquee.end.y - marquee.start.y);

      c.strokeStyle = '#6366f1';
      c.fillStyle = 'rgba(99, 102, 241, 0.08)';
      c.lineWidth = 1 / zoom;
      c.setLineDash([4 / zoom, 2 / zoom]);
      
      c.fillRect(x, y, w, h);
      c.strokeRect(x, y, w, h);
      c.restore();
    }
  };
};
