
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext, TransformEvent } from '../types';
import { UIShape } from '../models/UIShape';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'line-start' | 'line-end';

interface ShapeSnapshot extends Shape {}

export const useTransformPlugin = (): CanvasPlugin => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, ShapeSnapshot>>(new Map());
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 }); 
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [initialHandleDist, setInitialHandleDist] = useState({ dx: 0, dy: 0 });

  const VISUAL_PADDING = 0; // 零间距贴合
  const HANDLE_RADIUS = 5;
  const SNAP_THRESHOLD = 5;

  const getSelectionAABB = (shapes: Shape[], ids: string[]) => {
    const selected = shapes.filter(s => ids.includes(s.id));
    if (selected.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(s => {
      const b = UIShape.create(s).getAABB();
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const getAABB = (s: Shape) => UIShape.create(s).getAABB();

  const getLineEndPoints = (s: Shape) => {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const cos = Math.cos(s.rotation);
    const sin = Math.sin(s.rotation);
    const hw = s.width / 2;
    return {
      start: { x: cx - hw * cos, y: cy - hw * sin },
      end: { x: cx + hw * cos, y: cy + hw * sin }
    };
  };

  const collectSnapshots = (shapes: Shape[], targetIds: string[]) => {
    const map = new Map<string, ShapeSnapshot>();
    shapes.forEach(s => {
      if (targetIds.includes(s.id)) {
        // 使用浅拷贝优化，性能更佳，仅在 commit 时生成完整快照
        map.set(s.id, { ...s });
      }
    });
    return map;
  };

  return {
    name: 'transform',
    priority: 200,

    onMouseDown: (e, hit, ctx) => {
      const { selectedIds, shapes, zoom, editingId, activeTool } = ctx.state;
      if (editingId || activeTool !== 'select') return false;

      const { x, y } = e;
      const threshold = 22 / zoom;

      // 直线端点特殊处理
      if (selectedIds.length === 1) {
        const s = shapes.find(sh => sh.id === selectedIds[0]);
        if (s && s.type === 'line') {
          const { start, end } = getLineEndPoints(s);
          if (Math.hypot(x - start.x, y - start.y) < threshold) {
            setActiveHandle('line-start');
            setFixedPoint(end);
            setStartMouse({ x, y });
            setSnapshots(collectSnapshots(shapes, selectedIds));
            ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
            return true;
          }
          if (Math.hypot(x - end.x, y - end.y) < threshold) {
            setActiveHandle('line-end');
            setFixedPoint(start);
            setStartMouse({ x, y });
            setSnapshots(collectSnapshots(shapes, selectedIds));
            ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
            return true;
          }
        }
      }

      // 缩放手柄点击检测
      const currentAABB = getSelectionAABB(shapes, selectedIds);
      if (currentAABB) {
        const padding = VISUAL_PADDING / zoom;
        const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br'];
        for (const h of handles) {
          let hx = 0, hy = 0, fx = 0, fy = 0;
          if (h.includes('l')) { hx = currentAABB.x - padding; fx = currentAABB.x + currentAABB.w; }
          else { hx = currentAABB.x + currentAABB.w + padding; fx = currentAABB.x; }
          if (h.includes('t')) { hy = currentAABB.y - padding; fy = currentAABB.y + currentAABB.h; }
          else { hy = currentAABB.y + currentAABB.h + padding; fy = currentAABB.y; }

          if (Math.hypot(x - hx, y - hy) < threshold) {
            setActiveHandle(h);
            setFixedPoint({ x: fx, y: fy });
            setStartMouse({ x, y });
            setInitialHandleDist({ dx: hx - fx, dy: hy - fy });
            setSnapshots(collectSnapshots(shapes, selectedIds));
            ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
            return true;
          }
        }
      }

      // 点击移动
      if (hit) {
        let nextIds = [...selectedIds];
        if (!selectedIds.includes(hit.id)) {
          nextIds = (e.nativeEvent as MouseEvent).shiftKey ? [...selectedIds, hit.id] : [hit.id];
          ctx.setState(prev => ({ ...prev, selectedIds: nextIds }), false);
        }
        setSnapshots(collectSnapshots(shapes, nextIds));
        setStartMouse({ x, y });
        ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'MOVE' }), false);
        return true;
      }
      return false;
    },

    onTransformUpdate: (e: TransformEvent, ctx: PluginContext) => {
      if (snapshots.size === 0) return;
      const { type, x, y } = e;
      const { selectedIds, zoom, shapes: allShapes } = ctx.state;

      ctx.setState(prev => {
        let snapCorrection = { dx: 0, dy: 0 };
        // 吸附逻辑
        if (type === 'MOVE' && selectedIds.length === 1 && activeHandle === null) {
          const activeId = selectedIds[0];
          const snap = snapshots.get(activeId);
          if (snap) {
            const tempShape = { ...snap, x: snap.x + (x - startMouse.x), y: snap.y + (y - startMouse.y) };
            const a = getAABB(tempShape);
            const aX = [a.x, a.x + a.w / 2, a.x + a.w], aY = [a.y, a.y + a.h / 2, a.y + a.h];
            let minDX = SNAP_THRESHOLD / zoom, minDY = SNAP_THRESHOLD / zoom;
            allShapes.forEach(other => {
              if (other.id === activeId || other.type === 'connection') return;
              const b = getAABB(other);
              const bX = [b.x, b.x + b.w / 2, b.x + b.w], bY = [b.y, b.y + b.h / 2, b.y + b.h];
              aX.forEach(av => bX.forEach(bv => { if (Math.abs(av - bv) < minDX) { minDX = Math.abs(av - bv); snapCorrection.dx = bv - av; } }));
              aY.forEach(av => bY.forEach(bv => { if (Math.abs(av - bv) < minDY) { minDY = Math.abs(av - bv); snapCorrection.dy = bv - av; } }));
            });
          }
        }

        const updateShapeFn = (s: Shape): Shape => {
          const snap = snapshots.get(s.id);
          if (!snap) return s;
          if (type === 'MOVE') return { ...s, x: snap.x + (x - startMouse.x) + snapCorrection.dx, y: snap.y + (y - startMouse.y) + snapCorrection.dy };
          if (type === 'RESIZE') {
            if (s.type === 'line' && (activeHandle === 'line-start' || activeHandle === 'line-end')) {
              const dx = x - fixedPoint.x, dy = y - fixedPoint.y;
              const dist = Math.hypot(dx, dy), newWidth = Math.max(1, dist), newAngle = Math.atan2(dy, dx);
              const newCx = fixedPoint.x + dx / 2, newCy = fixedPoint.y + dy / 2;
              return { ...s, width: newWidth, rotation: newAngle, x: newCx - newWidth / 2, y: newCy - s.height / 2 };
            }
            const isShift = (e.nativeEvent as MouseEvent).shiftKey;
            const curDX = x - fixedPoint.x, curDY = y - fixedPoint.y;
            let sx = Math.abs(initialHandleDist.dx) < 0.1 ? 1 : curDX / initialHandleDist.dx;
            let sy = Math.abs(initialHandleDist.dy) < 0.1 ? 1 : curDY / initialHandleDist.dy;
            if (isShift || s.type === 'circle') { const sVal = Math.max(Math.abs(sx), Math.abs(sy)); sx = sVal * Math.sign(sx); sy = sVal * Math.sign(sy); }
            const newW = Math.max(1, Math.abs(snap.width * sx)), newH = Math.max(1, Math.abs(snap.height * sy));
            const oldCx = snap.x + snap.width / 2, oldCy = snap.y + snap.height / 2;
            const newCx = fixedPoint.x + (oldCx - fixedPoint.x) * sx, newCy = fixedPoint.y + (oldCy - fixedPoint.y) * sy;
            const ui = UIShape.create(snap), extra = ui.transform({ width: newW, height: newH, scaleX: sx, scaleY: sy });
            return { ...s, ...extra, x: newCx - (extra.width || newW) / 2, y: newCy - (extra.height || newH) / 2, width: extra.width || newW, height: extra.height || newH };
          }
          return s;
        };
        return { ...prev, shapes: prev.shapes.map(updateShapeFn) };
      }, false);
    },

    onTransformEnd: (e, ctx) => {
      // 交互结束，提交一次历史记录
      ctx.setState(prev => ({ ...prev }), true);
      setSnapshots(new Map());
      setActiveHandle(null);
    },

    onRenderForeground: (ctx) => {
      const { selectedIds, shapes, zoom, offset, editingId, activeTool } = ctx.state;
      if (selectedIds.length === 0 || editingId || activeTool !== 'select' || !ctx.renderer) return;
      const dpr = window.devicePixelRatio || 1, c = ctx.renderer.ctx, z = zoom;
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(z, z);
      
      // 特殊处理直线渲染
      if (selectedIds.length === 1) {
        const s = shapes.find(sh => sh.id === selectedIds[0]);
        if (s && s.type === 'line') {
          const { start, end } = getLineEndPoints(s);
          c.strokeStyle = '#6366f1'; c.fillStyle = '#ffffff'; c.lineWidth = 1.5 / z;
          [start, end].forEach(p => { c.beginPath(); c.arc(p.x, p.y, HANDLE_RADIUS / z, 0, Math.PI * 2); c.fill(); c.stroke(); });
          c.restore(); return;
        }
      }

      const aabb = getSelectionAABB(shapes, selectedIds);
      if (!aabb) { c.restore(); return; }
      const p = VISUAL_PADDING / z;
      c.strokeStyle = '#6366f1'; c.lineWidth = 1 / z; c.setLineDash([4 / z, 3 / z]);
      c.strokeRect(aabb.x - p, aabb.y - p, aabb.w + 2 * p, aabb.h + 2 * p);
      c.setLineDash([]);
      
      // 渲染四个顶角手柄
      ['tl', 'tr', 'bl', 'br'].forEach(h => {
        let hx = 0, hy = 0;
        if (h.includes('l')) hx = aabb.x - p; else hx = aabb.x + aabb.w + p;
        if (h.includes('t')) hy = aabb.y - p; else hy = aabb.y + aabb.h + p;
        c.fillStyle = '#ffffff'; c.strokeStyle = '#6366f1'; c.lineWidth = 1.5 / z;
        c.beginPath(); c.arc(hx, hy, HANDLE_RADIUS / z, 0, Math.PI * 2); c.fill(); c.stroke();
      });
      c.restore();
    }
  };
};
