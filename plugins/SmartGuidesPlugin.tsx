
import { CanvasPlugin, Shape } from '../types';
import { useState } from 'react';
import { UIShape } from '../models/UIShape';

interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GuideLine {
  type: 'X' | 'Y';
  val: number;
  originId: string;
  targetAABB: AABB;
}

interface SpacingGuide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dist: number;
  type: 'H' | 'V';
  aabb1: AABB;
  aabb2: AABB;
}

export const useSmartGuidesPlugin = (): CanvasPlugin => {
  const [activeLines, setActiveLines] = useState<GuideLine[]>([]);
  const [spacingGuides, setSpacingGuides] = useState<SpacingGuide[]>([]);

  const COLOR_GUIDE = '#ff00ff'; 
  const COLOR_GUIDE_WEAK = 'rgba(255, 0, 255, 0.4)'; // 进一步弱化虚线
  const SNAP_THRESHOLD = 5; 

  const getAABB = (s: Shape): AABB => {
    if (s.type === 'group' && s.children && s.children.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      s.children.forEach(child => {
        const b = getAABB(child);
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    const ui = UIShape.create(s);
    return ui.getAABB();
  };

  return {
    name: 'smart-guides',
    priority: 40,

    onTransformUpdate: (e, ctx) => {
      if (e.type !== 'MOVE' || ctx.state.selectedIds.length !== 1) {
        setActiveLines([]);
        setSpacingGuides([]);
        return;
      }

      const activeId = ctx.state.selectedIds[0];
      const zoom = ctx.state.zoom;
      
      ctx.setState(prev => {
        const shape = prev.shapes.find(s => s.id === activeId);
        if (!shape) return prev;
        
        const a = getAABB(shape);
        const aX = [a.x, a.x + a.w / 2, a.x + a.w];
        const aY = [a.y, a.y + a.h / 2, a.y + a.h];
        
        let snapDX = 0, snapDY = 0;
        let minDX = SNAP_THRESHOLD / zoom, minDY = SNAP_THRESHOLD / zoom;
        const newLines: GuideLine[] = [];
        const newSpacings: SpacingGuide[] = [];

        prev.shapes.forEach(s => {
          if (s.id === activeId || s.type === 'connection') return;
          const b = getAABB(s);
          const bX = [b.x, b.x + b.w / 2, b.x + b.w];
          const bY = [b.y, b.y + b.h / 2, b.y + b.h];
          
          // 对齐吸附逻辑
          aX.forEach((av) => bX.forEach((bv) => {
            if (Math.abs(av - bv) < minDX) { 
              minDX = Math.abs(av - bv); 
              snapDX = bv - av; 
              newLines.push({ type: 'X', val: bv, originId: s.id, targetAABB: b });
            }
          }));

          aY.forEach((av) => bY.forEach((bv) => {
            if (Math.abs(av - bv) < minDY) { 
              minDY = Math.abs(av - bv); 
              snapDY = bv - av; 
              newLines.push({ type: 'Y', val: bv, originId: s.id, targetAABB: b });
            }
          }));

          // 间距计算逻辑
          if (a.x > b.x + b.w) {
            newSpacings.push({ 
              x1: b.x + b.w, y1: a.y + a.h/2, x2: a.x, y2: a.y + a.h/2, 
              dist: a.x - (b.x + b.w), type: 'H', aabb1: b, aabb2: a 
            });
          } else if (b.x > a.x + a.w) {
            newSpacings.push({ 
              x1: a.x + a.w, y1: a.y + a.h/2, x2: b.x, y2: a.y + a.h/2, 
              dist: b.x - (a.x + a.w), type: 'H', aabb1: a, aabb2: b 
            });
          }

          if (a.y > b.y + b.h) {
            newSpacings.push({ 
              x1: a.x + a.w/2, y1: b.y + b.h, x2: a.x + a.w/2, y2: a.y, 
              dist: a.y - (b.y + b.h), type: 'V', aabb1: b, aabb2: a 
            });
          } else if (b.y > a.y + a.h) {
            newSpacings.push({ 
              x1: a.x + a.w/2, y1: a.y + a.h, x2: a.x + a.w/2, y2: b.y, 
              dist: b.y - (a.y + a.h), type: 'V', aabb1: a, aabb2: b 
            });
          }
        });

        const filteredLines = newLines.filter(l => {
          const currentA = getAABB(shape);
          const currentAX = [currentA.x, currentA.x + currentA.w / 2, currentA.x + currentA.w];
          const currentAY = [currentA.y, currentA.y + currentA.h / 2, currentA.y + currentA.h];
          return l.type === 'X' 
            ? currentAX.some(v => Math.abs(v + snapDX - l.val) < 0.01)
            : currentAY.some(v => Math.abs(v + snapDY - l.val) < 0.01);
        });

        setActiveLines(filteredLines);
        setSpacingGuides(newSpacings.sort((a,b) => a.dist - b.dist).slice(0, 2));

        if (snapDX !== 0 || snapDY !== 0) {
          return { ...prev, shapes: prev.shapes.map(s => s.id === activeId ? { ...s, x: s.x + snapDX, y: s.y + snapDY } : s) };
        }
        return prev;
      }, false);
    },

    onTransformEnd: () => {
      setActiveLines([]);
      setSpacingGuides([]);
    },

    onRenderForeground: (ctx) => {
      if ((activeLines.length === 0 && spacingGuides.length === 0) || !ctx.renderer) return;
      const { zoom, offset, selectedIds, shapes } = ctx.state;
      const movingShape = shapes.find(s => s.id === selectedIds[0]);
      if (!movingShape) return;
      const movingAABB = getAABB(movingShape);

      const c = ctx.renderer.ctx, dpr = window.devicePixelRatio || 1;
      
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);
      
      // 1. 绘制对齐吸附实线 (极细)
      c.strokeStyle = COLOR_GUIDE;
      c.lineWidth = 1 / zoom;
      activeLines.forEach(g => {
        c.beginPath();
        c.setLineDash([]);
        if (g.type === 'X') {
          const y1 = Math.min(movingAABB.y, g.targetAABB.y);
          const y2 = Math.max(movingAABB.y + movingAABB.h, g.targetAABB.y + g.targetAABB.h);
          c.moveTo(g.val, y1);
          c.lineTo(g.val, y2);
        } else {
          const x1 = Math.min(movingAABB.x, g.targetAABB.x);
          const x2 = Math.max(movingAABB.x + movingAABB.w, g.targetAABB.x + g.targetAABB.w);
          c.moveTo(x1, g.val);
          c.lineTo(x2, g.val);
        }
        c.stroke();
      });

      // 2. 绘制测距引导 (优化为更纤细轻量)
      spacingGuides.forEach(g => {
        // a. 绘制测距主线段 (极细实线)
        c.beginPath();
        c.strokeStyle = COLOR_GUIDE;
        c.lineWidth = 1 / zoom;
        c.setLineDash([]);
        c.moveTo(g.x1, g.y1);
        c.lineTo(g.x2, g.y2);
        c.stroke();

        // b. 绘制“正交延长线” (虚线更淡)
        c.beginPath();
        c.strokeStyle = COLOR_GUIDE_WEAK;
        c.setLineDash([2 / zoom, 2 / zoom]);
        if (g.type === 'H') {
          const yMin1 = Math.min(g.y1, g.aabb1.y);
          const yMax1 = Math.max(g.y1, g.aabb1.y + g.aabb1.h);
          c.moveTo(g.x1, yMin1);
          c.lineTo(g.x1, yMax1);
          const yMin2 = Math.min(g.y2, g.aabb2.y);
          const yMax2 = Math.max(g.y2, g.aabb2.y + g.aabb2.h);
          c.moveTo(g.x2, yMin2);
          c.lineTo(g.x2, yMax2);
        } else {
          const xMin1 = Math.min(g.x1, g.aabb1.x);
          const xMax1 = Math.max(g.x1, g.aabb1.x + g.aabb1.w);
          c.moveTo(xMin1, g.y1);
          c.lineTo(xMax1, g.y1);
          const xMin2 = Math.min(g.x2, g.aabb2.x);
          const xMax2 = Math.max(g.x2, g.aabb2.x + g.aabb2.w);
          c.moveTo(xMin2, g.y2);
          c.lineTo(xMax2, g.y2);
        }
        c.stroke();

        // c. 绘制数值标签 (轻量化设计)
        c.setLineDash([]);
        const distText = Math.round(g.dist).toString();
        const fontSize = 9 / zoom; // 稍微调小
        c.font = `bold ${fontSize}px Inter`;
        const tw = c.measureText(distText).width;
        const th = 12 / zoom; // 稍微调低高度
        const tx = (g.x1 + g.x2) / 2;
        const ty = (g.y1 + g.y2) / 2;
        
        const padX = 3 / zoom; // 减小 Padding
        const padY = 2 / zoom;
        const rx = tx - tw/2 - padX, ry = ty - th/2 - padY, rw = tw + padX*2, rh = th + padY*2;
        
        const offsetY = g.type === 'H' ? -10 / zoom : 0;
        const offsetX = g.type === 'V' ? 10 / zoom : 0;

        c.fillStyle = COLOR_GUIDE;
        c.beginPath();
        if (c.roundRect) {
          // @ts-ignore
          c.roundRect(rx + offsetX, ry + offsetY, rw, rh, 1.5/zoom);
        } else {
          c.rect(rx + offsetX, ry + offsetY, rw, rh);
        }
        c.fill();
        
        c.fillStyle = '#ffffff';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(distText, tx + offsetX, ty + offsetY + 0.5/zoom);
      });

      c.restore();
    }
  };
};
