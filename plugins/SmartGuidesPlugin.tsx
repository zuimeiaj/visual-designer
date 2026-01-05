
import { CanvasPlugin, PluginContext, Shape, TransformEvent } from '../types';
import { useRef, useState } from 'react';

export const useSmartGuidesPlugin = (): CanvasPlugin => {
  const [activeGuides, setActiveGuides] = useState<any[]>([]);

  const COLOR_GUIDE = '#ff00ff'; 
  const SNAP_THRESHOLD = 5; 

  const getCorners = (s: Shape) => {
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
    const cos = Math.cos(s.rotation), sin = Math.sin(s.rotation);
    const hw = s.width / 2, hh = s.height / 2;
    return [
      { x: -hw, y: -hh }, { x: hw, y: -hh }, 
      { x: hw, y: hh }, { x: -hw, y: hh }
    ].map(p => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos
    }));
  };

  const getAABB = (s: Shape): { x: number, y: number, w: number, h: number } => {
    if (s.type === 'group' && s.children && s.children.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      s.children.forEach(child => {
        const b = getAABB(child);
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    const corners = getCorners(s);
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };

  return {
    name: 'smart-guides',
    priority: 40,

    onTransformUpdate: (e, ctx) => {
      if (e.type !== 'MOVE' || ctx.state.selectedIds.length !== 1) {
        setActiveGuides([]); return;
      }
      const activeId = ctx.state.selectedIds[0];
      const zoom = ctx.state.zoom;
      ctx.setState(prev => {
        const shape = prev.shapes.find(s => s.id === activeId);
        if (!shape) return prev;
        const aAABB = getAABB(shape);
        const aAnchorsX = [aAABB.x, aAABB.x + aAABB.w / 2, aAABB.x + aAABB.w];
        const aAnchorsY = [aAABB.y, aAABB.y + aAABB.h / 2, aAABB.y + aAABB.h];
        let snapDX = 0, snapDY = 0, minDX = SNAP_THRESHOLD / zoom, minDY = SNAP_THRESHOLD / zoom;
        const guides: any[] = [];
        prev.shapes.forEach(s => {
          if (s.id === activeId) return;
          const b = getAABB(s);
          const bAnchorsX = [b.x, b.x + b.w / 2, b.x + b.w];
          const bAnchorsY = [b.y, b.y + b.h / 2, b.y + b.h];
          aAnchorsX.forEach(av => bAnchorsX.forEach(bv => {
            const diff = Math.abs(av - bv);
            if (diff < minDX) { minDX = diff; snapDX = bv - av; guides.push({ type: 'X', val: bv, target: b }); }
          }));
          aAnchorsY.forEach(av => bAnchorsY.forEach(bv => {
            const diff = Math.abs(av - bv);
            if (diff < minDY) { minDY = diff; snapDY = bv - av; guides.push({ type: 'Y', val: bv, target: b }); }
          }));
        });
        setActiveGuides(guides);
        if (snapDX !== 0 || snapDY !== 0) return { ...prev, shapes: prev.shapes.map(s => s.id === activeId ? { ...s, x: s.x + snapDX, y: s.y + snapDY } : s) };
        return prev;
      }, false);
    },

    onTransformEnd: () => { setActiveGuides([]); },

    onRenderForeground: (ctx: PluginContext) => {
      if (activeGuides.length === 0 || !ctx.renderer) return;
      const dpr = window.devicePixelRatio || 1;
      const { zoom, offset, shapes, selectedIds } = ctx.state;
      const activeShape = shapes.find(s => s.id === selectedIds[0]);
      if (!activeShape) return;
      const aAABB = getAABB(activeShape);
      const c = ctx.renderer.ctx;
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); // 关键：适配高 DPI 屏幕
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);
      c.strokeStyle = COLOR_GUIDE; c.lineWidth = 1 / zoom; c.setLineDash([4 / zoom, 4 / zoom]);
      activeGuides.forEach(g => {
        if (g.type === 'X') {
          const minY = Math.min(aAABB.y, g.target.y);
          const maxY = Math.max(aAABB.y + aAABB.h, g.target.y + g.target.h);
          c.beginPath(); c.moveTo(g.val, minY - 10 / zoom); c.lineTo(g.val, maxY + 10 / zoom); c.stroke();
        } else {
          const minX = Math.min(aAABB.x, g.target.x);
          const maxX = Math.max(aAABB.x + aAABB.w, g.target.x + g.target.w);
          c.beginPath(); c.moveTo(minX - 10 / zoom, g.val); c.lineTo(maxX + 10 / zoom, g.val); c.stroke();
        }
      });
      c.restore();
    }
  };
};
