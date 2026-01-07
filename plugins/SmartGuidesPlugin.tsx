
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
  const COLOR_GUIDE_WEAK = 'rgba(255, 0, 255, 0.4)'; 
  const EPSILON = 0.05; // 判定对齐的极小误差

  const getAABB = (s: Shape): AABB => {
    const ui = UIShape.create(s);
    return ui.getAABB();
  };

  const getSelectionAABB = (shapes: Shape[], ids: string[]): AABB | null => {
    if (ids.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;
    shapes.forEach(s => {
      if (ids.includes(s.id)) {
        const b = getAABB(s);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
        found = true;
      }
    });
    if (!found) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const clearGuides = () => {
    setActiveLines([]);
    setSpacingGuides([]);
  };

  return {
    name: 'smart-guides',
    priority: 40,

    onTransformUpdate: (e, ctx) => {
      // 仅在移动操作（MOVE）时显示辅助线
      if (e.type !== 'MOVE' || ctx.state.selectedIds.length === 0) {
        clearGuides();
        return;
      }

      const { selectedIds, shapes } = ctx.state;
      // 获取当前选中的整体包围盒（支持单选或多选）
      const a = getSelectionAABB(shapes, selectedIds);
      if (!a) {
        clearGuides();
        return;
      }

      const aX = [a.x, a.x + a.w / 2, a.x + a.w];
      const aY = [a.y, a.y + a.h / 2, a.y + a.h];
      
      const newLines: GuideLine[] = [];
      const newSpacings: SpacingGuide[] = [];

      shapes.forEach(s => {
        // 排除掉当前选中的所有形状以及连接线
        if (selectedIds.includes(s.id) || s.type === 'connection') return;
        
        const b = getAABB(s);
        const bX = [b.x, b.x + b.w / 2, b.x + b.w];
        const bY = [b.y, b.y + b.h / 2, b.y + b.h];
        
        // 检测横向或纵向边缘/中心是否对齐
        aX.forEach((av) => bX.forEach((bv) => {
          if (Math.abs(av - bv) < EPSILON) { 
            newLines.push({ type: 'X', val: bv, originId: s.id, targetAABB: b });
          }
        }));

        aY.forEach((av) => bY.forEach((bv) => {
          if (Math.abs(av - bv) < EPSILON) { 
            newLines.push({ type: 'Y', val: bv, originId: s.id, targetAABB: b });
          }
        }));

        // 计算并添加间距指引
        if (a.x > b.x + b.w) {
          newSpacings.push({ x1: b.x + b.w, y1: a.y + a.h/2, x2: a.x, y2: a.y + a.h/2, dist: a.x - (b.x + b.w), type: 'H', aabb1: b, aabb2: a });
        } else if (b.x > a.x + a.w) {
          newSpacings.push({ x1: a.x + a.w, y1: a.y + a.h/2, x2: b.x, y2: a.y + a.h/2, dist: b.x - (a.x + a.w), type: 'H', aabb1: a, aabb2: b });
        }

        if (a.y > b.y + b.h) {
          newSpacings.push({ x1: a.x + a.w/2, y1: b.y + b.h, x2: a.x + a.w/2, y2: a.y, dist: a.y - (b.y + b.h), type: 'V', aabb1: b, aabb2: a });
        } else if (b.y > a.y + a.h) {
          newSpacings.push({ x1: a.x + a.w/2, y1: a.y + a.h, x2: a.x + a.w/2, y2: b.y, dist: b.y - (a.y + a.h), type: 'V', aabb1: a, aabb2: b });
        }
      });

      setActiveLines(newLines);
      setSpacingGuides(newSpacings.sort((a,b) => a.dist - b.dist).slice(0, 3));
    },

    onTransformEnd: () => clearGuides(),
    onMouseUp: () => clearGuides(),

    onRenderForeground: (ctx) => {
      if ((activeLines.length === 0 && spacingGuides.length === 0) || !ctx.renderer) return;
      
      const { zoom, offset, selectedIds, shapes } = ctx.state;
      const movingAABB = getSelectionAABB(shapes, selectedIds);
      if (!movingAABB) return;

      const c = ctx.renderer.ctx, dpr = window.devicePixelRatio || 1;
      
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);
      
      c.strokeStyle = COLOR_GUIDE;
      c.lineWidth = 1 / zoom;
      
      // 绘制对齐线
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

      // 绘制间距标注
      spacingGuides.forEach(g => {
        c.beginPath();
        c.strokeStyle = COLOR_GUIDE;
        c.lineWidth = 1 / zoom;
        c.setLineDash([]);
        c.moveTo(g.x1, g.y1);
        c.lineTo(g.x2, g.y2);
        c.stroke();

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

        c.setLineDash([]);
        const distText = Math.round(g.dist).toString();
        const fontSize = 9 / zoom; 
        c.font = `bold ${fontSize}px Inter`;
        const tw = c.measureText(distText).width;
        const th = 12 / zoom; 
        const tx = (g.x1 + g.x2) / 2;
        const ty = (g.y1 + g.y2) / 2;
        const padX = 3 / zoom; 
        const padY = 2 / zoom;
        const rx = tx - tw/2 - padX, ry = ty - th/2 - padY, rw = tw + padX*2, rh = th + padY*2;
        
        // 避让文字遮挡
        const offsetY = g.type === 'H' ? -10 / zoom : 0;
        const offsetX = g.type === 'V' ? 10 / zoom : 0;
        
        c.fillStyle = COLOR_GUIDE;
        c.beginPath();
        if ((c as any).roundRect) {
          (c as any).roundRect(rx + offsetX, ry + offsetY, rw, rh, 1.5/zoom);
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
