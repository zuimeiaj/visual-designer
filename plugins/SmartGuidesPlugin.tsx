
import { CanvasPlugin, PluginContext, Shape } from '../types';
import { useState } from 'react';

export const useSmartGuidesPlugin = (): CanvasPlugin => {
  const [isDragging, setIsDragging] = useState(false);
  
  const COLOR_GUIDE = '#ff00ff'; // Figma Style Magenta
  const COLOR_CONNECTOR = 'rgba(255, 0, 255, 0.7)';
  const COLOR_TARGET_FILL = 'rgba(255, 0, 255, 0.05)';
  const SNAP_THRESHOLD_DISPLAY = 0.5; // 画布空间下的显示阈值

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

  const getEdges = (s: Shape) => {
    const corners = getCorners(s);
    return [
      [corners[0], corners[1]],
      [corners[1], corners[2]],
      [corners[2], corners[3]],
      [corners[3], corners[0]]
    ];
  };

  const intersectLineSegment = (p1: {x:number, y:number}, p2: {x:number, y:number}, axis: 'x'|'y', val: number) => {
    if (axis === 'x') {
      if ((p1.x <= val && p2.x >= val) || (p1.x >= val && p2.x <= val)) {
        if (Math.abs(p1.x - p2.x) < 0.0001) return p1.y;
        const t = (val - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
      }
    } else {
      if ((p1.y <= val && p2.y >= val) || (p1.y >= val && p2.y <= val)) {
        if (Math.abs(p1.y - p2.y) < 0.0001) return p1.x;
        const t = (val - p1.y) / (p2.y - p1.y);
        return p1.x + t * (p2.x - p1.x);
      }
    }
    return null;
  };

  return {
    name: 'smart-guides',
    onMouseDown: (e) => {
      if (e.button === 0) setIsDragging(true);
      return false;
    },
    onMouseUp: () => setIsDragging(false),
    onRenderForeground: (ctx: PluginContext) => {
      const { state, renderer } = ctx;
      if (!isDragging || state.selectedIds.length !== 1 || !renderer || state.editingId) return;

      const activeShape = state.shapes.find(s => s.id === state.selectedIds[0]);
      if (!activeShape) return;

      const c = renderer.ctx, { zoom, offset, shapes } = state;
      const aAABB = getAABB(activeShape);
      const aAnchorsX = [aAABB.x, aAABB.x + aAABB.w / 2, aAABB.x + aAABB.w];
      const aAnchorsY = [aAABB.y, aAABB.y + aAABB.h / 2, aAABB.y + aAABB.h];

      const xGuides: Map<number, string[]> = new Map();
      const yGuides: Map<number, string[]> = new Map();

      shapes.forEach(s => {
        if (s.id === activeShape.id || state.selectedIds.includes(s.id)) return;
        const b = getAABB(s);
        const bAnchorsX = [b.x, b.x + b.w / 2, b.x + b.w];
        const bAnchorsY = [b.y, b.y + b.h / 2, b.y + b.h];

        aAnchorsX.forEach(av => {
          bAnchorsX.forEach(bv => {
            if (Math.abs(av - bv) < SNAP_THRESHOLD_DISPLAY) {
              const list = xGuides.get(bv) || [];
              list.push(s.id);
              xGuides.set(bv, list);
            }
          });
        });

        aAnchorsY.forEach(av => {
          bAnchorsY.forEach(bv => {
            if (Math.abs(av - bv) < SNAP_THRESHOLD_DISPLAY) {
              const list = yGuides.get(bv) || [];
              list.push(s.id);
              yGuides.set(bv, list);
            }
          });
        });
      });

      if (xGuides.size === 0 && yGuides.size === 0) return;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);
      
      const drawGuideSystem = (pos: number, targets: string[], axis: 'x' | 'y') => {
        const allInvolved = [activeShape.id, ...targets].map(id => shapes.find(s => s.id === id)!);
        const aabbs = allInvolved.map(getAABB);
        const minCoord = Math.min(...aabbs.map(b => axis === 'x' ? b.y : b.x));
        const maxCoord = Math.max(...aabbs.map(b => axis === 'x' ? b.y + b.h : b.x + b.w));

        // 绘制主对齐线
        c.beginPath();
        c.strokeStyle = COLOR_GUIDE;
        c.lineWidth = 1 / zoom;
        if (axis === 'x') {
          c.moveTo(pos, minCoord - 20 / zoom);
          c.lineTo(pos, maxCoord + 20 / zoom);
        } else {
          c.moveTo(minCoord - 20 / zoom, pos);
          c.lineTo(maxCoord + 20 / zoom, pos);
        }
        c.stroke();

        const intervals: { min: number, max: number }[] = [];

        allInvolved.forEach(s => {
          const edges = getEdges(s);
          const intersections: number[] = [];
          edges.forEach(([p1, p2]) => {
            const inter = intersectLineSegment(p1, p2, axis, pos);
            if (inter !== null) intersections.push(inter);
          });

          if (intersections.length > 0) {
            const minI = Math.min(...intersections);
            const maxI = Math.max(...intersections);
            intervals.push({ min: minI, max: maxI });
            
            // 绘制物体内的连接线 (实线)
            c.beginPath();
            c.strokeStyle = COLOR_CONNECTOR;
            c.lineWidth = 1.5 / zoom;
            if (axis === 'x') {
              c.moveTo(pos, minI); c.lineTo(pos, maxI);
            } else {
              c.moveTo(minI, pos); c.lineTo(maxI, pos);
            }
            c.stroke();
          }
          
          if (s.id !== activeShape.id) {
            c.save();
            const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
            c.translate(cx, cy); c.rotate(s.rotation); c.translate(-cx, -cy);
            c.fillStyle = COLOR_TARGET_FILL;
            c.fillRect(s.x, s.y, s.width, s.height);
            c.restore();
          }
        });

        // 绘制间隔和距离标签
        intervals.sort((a, b) => a.min - b.min);
        for (let i = 0; i < intervals.length - 1; i++) {
          const start = intervals[i].max;
          const end = intervals[i+1].min;
          const distance = end - start;
          
          if (distance > 2 / zoom) {
            const mid = (start + end) / 2;
            const distText = Math.abs(Math.round(distance)).toString();
            
            // 绘制虚线间隔
            c.beginPath();
            c.setLineDash([2, 2]);
            c.strokeStyle = COLOR_GUIDE;
            c.lineWidth = 1 / zoom;
            if (axis === 'x') {
              c.moveTo(pos, start); c.lineTo(pos, end);
            } else {
              c.moveTo(start, pos); c.lineTo(end, pos);
            }
            c.stroke();
            c.setLineDash([]);

            // 绘制背景气泡
            c.font = `bold ${10/zoom}px Inter`;
            const textWidth = c.measureText(distText).width;
            const padding = 4 / zoom;
            const labelW = textWidth + padding * 2;
            const labelH = 14 / zoom;

            c.fillStyle = COLOR_GUIDE;
            if (axis === 'x') {
              const lx = pos + 6 / zoom;
              const ly = mid - labelH / 2;
              c.beginPath();
              c.roundRect(lx, ly, labelW, labelH, 3 / zoom);
              c.fill();
              c.fillStyle = '#fff';
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.fillText(distText, lx + labelW / 2, mid);
            } else {
              const lx = mid - labelW / 2;
              const ly = pos + 6 / zoom;
              c.beginPath();
              c.roundRect(lx, ly, labelW, labelH, 3 / zoom);
              c.fill();
              c.fillStyle = '#fff';
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.fillText(distText, mid, ly + labelH / 2);
            }
          }
        }
      };

      if (xGuides.size > 0) {
        const sortedX = Array.from(xGuides.entries()).sort((a, b) => Math.abs(a[0] - (aAABB.x + aAABB.w/2)) - Math.abs(b[0] - (aAABB.x + aAABB.w/2)));
        const [pos, targets] = sortedX[0];
        drawGuideSystem(pos, targets, 'x');
      }

      if (yGuides.size > 0) {
        const sortedY = Array.from(yGuides.entries()).sort((a, b) => Math.abs(a[0] - (aAABB.y + aAABB.h/2)) - Math.abs(b[0] - (aAABB.y + aAABB.h/2)));
        const [pos, targets] = sortedY[0];
        drawGuideSystem(pos, targets, 'y');
      }

      c.restore();
    }
  };
};
