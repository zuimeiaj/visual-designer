
import { CanvasPlugin, Shape, PluginContext } from '../types';
import { useState, useRef, useEffect } from 'react';

export const useSelectionPlugin = (): CanvasPlugin => {
  const [marquee, setMarquee] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
  const lastScreenPos = useRef<{ x: number, y: number } | null>(null);
  const ctxRef = useRef<PluginContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const EDGE_THRESHOLD = 50; // 距离边缘多少像素开始滚动
  const MAX_SCROLL_SPEED = 12; // 最大滚动速度

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

  // 自动滚动循环
  useEffect(() => {
    const autoScroll = () => {
      const ctx = ctxRef.current;
      const screenPos = lastScreenPos.current;
      const canvas = ctx?.canvas;

      if (!ctx || !screenPos || !canvas || ctx.state.interactionState !== 'MARQUEE') {
        rafRef.current = requestAnimationFrame(autoScroll);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const mouseX = screenPos.x - rect.left;
      const mouseY = screenPos.y - rect.top;

      let dx = 0;
      let dy = 0;

      // 检测四个边缘
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
          
          // 当画布滚动时，必须重新计算鼠标在世界坐标系中的位置
          // 否则框选框的终点会留在原地
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    name: 'selection',
    priority: 10,
    
    onInteraction: (type, e, ctx) => {
      ctxRef.current = ctx; // 保持对上下文的引用供滚动循环使用

      if (type === 'mousemove') {
        const me = e.nativeEvent as MouseEvent;
        lastScreenPos.current = { x: me.clientX, y: me.clientY };

        if (ctx.state.interactionState === 'MARQUEE') {
          setMarquee(prev => {
            if (!prev) return { start: { x: e.x, y: e.y }, end: { x: e.x, y: e.y } };
            return { ...prev, end: { x: e.x, y: e.y } };
          });
          ctx.setCursor('crosshair');
          e.consume();
        }
      }
    },

    onDeselectAfter: (e, ctx) => {
      if (ctx.state.activeTool === 'select') {
        const me = e.nativeEvent as MouseEvent;
        lastScreenPos.current = { x: me.clientX, y: me.clientY };
        setMarquee({ start: { x: e.x, y: e.y }, end: { x: e.x, y: e.y } });
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
            if (s.locked) return false;
            const b = getAABB(s);
            return b.x + b.w >= x1 && b.x <= x2 && b.y + b.h >= y1 && b.y <= y2;
          }).map(s => s.id);

          const isMulti = (e.nativeEvent as MouseEvent).shiftKey;
          ctx.setState(prev => ({ 
            ...prev, 
            selectedIds: isMulti ? [...new Set([...prev.selectedIds, ...inRect])] : inRect 
          }), true);
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
      
      c.strokeStyle = '#818cf8';
      c.fillStyle = 'rgba(129, 140, 248, 0.15)';
      c.lineWidth = 1.5 / zoom;
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
