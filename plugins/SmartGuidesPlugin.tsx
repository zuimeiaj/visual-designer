
import { CanvasPlugin, PluginContext, Shape } from '../types';
import { useRef } from 'react';

export const useSmartGuidesPlugin = (): CanvasPlugin => {
  // 使用 ref 记录当前是否正在进行有效的“移动”吸附，避免 state 频繁触发不必要的重绘
  const isSnappingRef = useRef(false);

  const COLOR_GUIDE = '#ff00ff'; 
  const COLOR_TEXT = '#ffffff';
  const SNAP_THRESHOLD = 5; // 吸附阈值（屏幕像素）
  const INNER_MARGIN = 20;  // 内部边距，鼠标落在此范围内才触发对齐（避开缩放手柄）

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

  const drawLabel = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, zoom: number) => {
    ctx.save();
    ctx.font = `bold ${10 / zoom}px Inter`;
    const metrics = ctx.measureText(text);
    const paddingH = 4 / zoom;
    const paddingV = 2 / zoom;
    const w = metrics.width + paddingH * 2;
    const h = 12 / zoom + paddingV * 2;
    ctx.fillStyle = COLOR_GUIDE;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 2 / zoom);
    ctx.fill();
    ctx.fillStyle = COLOR_TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  return {
    name: 'smart-guides',
    onMouseMove: (e, ctx) => {
      const native = e.nativeEvent as MouseEvent;
      // 必须满足：左键按下、选中且仅选中一个物体、非文字编辑状态
      if (native.buttons !== 1 || ctx.state.selectedIds.length !== 1 || ctx.state.editingId) {
        isSnappingRef.current = false;
        return;
      }

      const activeId = ctx.state.selectedIds[0];
      const activeShape = ctx.state.shapes.find(s => s.id === activeId);
      if (!activeShape || activeShape.type === 'group') {
        isSnappingRef.current = false;
        return;
      }

      // 关键判定：识别是否在移动。如果鼠标位置靠近图形边缘，通常是缩放，此时不应吸附。
      const zoom = ctx.state.zoom;
      const m = INNER_MARGIN / zoom;
      const isDraggingCenter = e.x > activeShape.x + m && e.x < activeShape.x + activeShape.width - m &&
                               e.y > activeShape.y + m && e.y < activeShape.y + activeShape.height - m;

      // 如果不在中心区域拖拽（可能在拖拽手柄），则不执行吸附
      if (!isDraggingCenter) {
        isSnappingRef.current = false;
        return;
      }

      isSnappingRef.current = true;

      ctx.setState(prev => {
        const shape = prev.shapes.find(s => s.id === activeId);
        if (!shape) return prev;

        const aAABB = getAABB(shape);
        const aAnchorsX = [aAABB.x, aAABB.x + aAABB.w / 2, aAABB.x + aAABB.w];
        const aAnchorsY = [aAABB.y, aAABB.y + aAABB.h / 2, aAABB.y + aAABB.h];

        let snapDX = 0;
        let snapDY = 0;
        let minDX = SNAP_THRESHOLD / zoom;
        let minDY = SNAP_THRESHOLD / zoom;

        prev.shapes.forEach(s => {
          if (s.id === activeId) return;
          const b = getAABB(s);
          const bAnchorsX = [b.x, b.x + b.w / 2, b.x + b.w];
          const bAnchorsY = [b.y, b.y + b.h / 2, b.y + b.h];

          aAnchorsX.forEach(av => bAnchorsX.forEach(bv => {
            const diff = Math.abs(av - bv);
            if (diff < minDX) { minDX = diff; snapDX = bv - av; }
          }));

          aAnchorsY.forEach(av => bAnchorsY.forEach(bv => {
            const diff = Math.abs(av - bv);
            if (diff < minDY) { minDY = diff; snapDY = bv - av; }
          }));
        });

        if (snapDX !== 0 || snapDY !== 0) {
          return {
            ...prev,
            shapes: prev.shapes.map(s => s.id === activeId ? {
              ...s,
              x: s.x + snapDX,
              y: s.y + snapDY
            } : s)
          };
        }
        return prev;
      }, false);
    },

    onMouseUp: () => {
      isSnappingRef.current = false;
    },

    onRenderForeground: (ctx: PluginContext) => {
      const { state, renderer } = ctx;
      // 只有在满足拖拽条件且 ref 确认为正在吸附时才渲染
      if (!isSnappingRef.current || state.selectedIds.length !== 1 || !renderer) return;

      const activeId = state.selectedIds[0];
      const activeShape = state.shapes.find(s => s.id === activeId);
      if (!activeShape) return;

      const c = renderer.ctx, { zoom, offset, shapes } = state;
      const aAABB = getAABB(activeShape);
      const aX = [aAABB.x, aAABB.x + aAABB.w / 2, aAABB.x + aAABB.w];
      const aY = [aAABB.y, aAABB.y + aAABB.h / 2, aAABB.y + aAABB.h];

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      shapes.forEach(s => {
        if (s.id === activeId) return;
        const b = getAABB(s);
        const bX = [b.x, b.x + b.w / 2, b.x + b.w];
        const bY = [b.y, b.y + b.h / 2, b.y + b.h];

        // 绘制逻辑
        aX.forEach((av) => {
          bX.forEach((bv) => {
            if (Math.abs(av - bv) < 0.1) {
              c.beginPath();
              c.strokeStyle = COLOR_GUIDE;
              c.lineWidth = 1 / zoom;
              c.setLineDash([4 / zoom, 4 / zoom]);
              const minY = Math.min(aAABB.y, b.y);
              const maxY = Math.max(aAABB.y + aAABB.h, b.y + b.h);
              c.moveTo(bv, minY - 10 / zoom);
              c.lineTo(bv, maxY + 10 / zoom);
              c.stroke();
              c.setLineDash([]);
              // 间距标注
              const dy = aAABB.y + aAABB.h < b.y ? b.y - (aAABB.y + aAABB.h) : (b.y + b.h < aAABB.y ? aAABB.y - (b.y + b.h) : 0);
              if (dy > 1) {
                const my = aAABB.y + aAABB.h < b.y ? (aAABB.y + aAABB.h + b.y) / 2 : (b.y + b.h + aAABB.y) / 2;
                drawLabel(c, bv, my, Math.round(dy).toString(), zoom);
              }
            }
          });
        });

        aY.forEach((av) => {
          bY.forEach((bv) => {
            if (Math.abs(av - bv) < 0.1) {
              c.beginPath();
              c.strokeStyle = COLOR_GUIDE;
              c.lineWidth = 1 / zoom;
              c.setLineDash([4 / zoom, 4 / zoom]);
              const minX = Math.min(aAABB.x, b.x);
              const maxX = Math.max(aAABB.x + aAABB.w, b.x + b.w);
              c.moveTo(minX - 10 / zoom, bv);
              c.lineTo(maxX + 10 / zoom, bv);
              c.stroke();
              c.setLineDash([]);
              // 间距标注
              const dx = aAABB.x + aAABB.w < b.x ? b.x - (aAABB.x + aAABB.w) : (b.x + b.w < aAABB.x ? aAABB.x - (b.x + b.w) : 0);
              if (dx > 1) {
                const mx = aAABB.x + aAABB.w < b.x ? (aAABB.x + aAABB.w + b.x) / 2 : (b.x + b.w + aAABB.x) / 2;
                drawLabel(c, mx, bv, Math.round(dx).toString(), zoom);
              }
            }
          });
        });
      });

      c.restore();
    }
  };
};
