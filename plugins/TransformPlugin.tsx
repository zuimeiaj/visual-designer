
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext, TransformEvent } from '../types';
import { UIShape } from '../models/UIShape';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';

interface ShapeSnapshot extends Shape {}

export const useTransformPlugin = (): CanvasPlugin => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, ShapeSnapshot>>(new Map());
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 }); 
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [initialHandleDist, setInitialHandleDist] = useState({ dx: 0, dy: 0 });

  const VISUAL_PADDING = 8;
  const HANDLE_RADIUS = 5;

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

  const getCornerPos = (rect: {x:number, y:number, w:number, h:number}, handle: ResizeHandle, padding: number) => {
    switch(handle) {
      case 'tl': return { x: rect.x - padding, y: rect.y - padding };
      case 'tr': return { x: rect.x + rect.w + padding, y: rect.y - padding };
      case 'bl': return { x: rect.x - padding, y: rect.y + rect.h + padding };
      case 'br': return { x: rect.x + rect.w + padding, y: rect.y + rect.h + padding };
    }
  };

  /**
   * IMPORTANT: Only collect snapshots for the TOP-LEVEL selected IDs.
   * If we collect children, they will be moved twice (once by the parent, once by the snapshot delta).
   */
  const collectSnapshots = (shapes: Shape[], targetIds: string[]) => {
    const map = new Map<string, ShapeSnapshot>();
    shapes.forEach(s => {
      if (targetIds.includes(s.id)) {
        map.set(s.id, JSON.parse(JSON.stringify(s)));
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
      const p = VISUAL_PADDING / zoom;
      const threshold = 22 / zoom;

      const currentAABB = getSelectionAABB(shapes, selectedIds);
      if (currentAABB) {
        const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br'];
        const oppMap: Record<ResizeHandle, ResizeHandle> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };

        for (const h of handles) {
          const hp = getCornerPos(currentAABB, h, p);
          if (Math.hypot(x - hp.x, y - hp.y) < threshold) {
            setActiveHandle(h);
            const fp = getCornerPos(currentAABB, oppMap[h], 0);
            setFixedPoint(fp);
            setStartMouse({ x, y });
            setInitialHandleDist({ dx: hp.x - fp.x, dy: hp.y - fp.y });
            setSnapshots(collectSnapshots(shapes, selectedIds));
            ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
            e.consume();
            return true;
          }
        }
      }

      if (hit) {
        let nextIds = [...selectedIds];
        if (!selectedIds.includes(hit.id)) {
          nextIds = (e.nativeEvent as MouseEvent).shiftKey ? [...selectedIds, hit.id] : [hit.id];
          ctx.setState(prev => ({ ...prev, selectedIds: nextIds }), false);
        }
        setSnapshots(collectSnapshots(shapes, nextIds));
        setStartMouse({ x, y });
        ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'MOVE' }), false);
        e.consume();
        return true;
      }
      return false;
    },

    onTransformUpdate: (e: TransformEvent, ctx: PluginContext) => {
      if (snapshots.size === 0) return;
      const { type, x, y } = e;
      const isShift = (e.nativeEvent as MouseEvent).shiftKey;
      const { selectedIds } = ctx.state;

      ctx.setState(prev => {
        const updateShape = (s: Shape): Shape => {
          const snap = snapshots.get(s.id);
          if (!snap) return s;

          if (type === 'MOVE') {
            return { ...s, x: snap.x + (x - startMouse.x), y: snap.y + (y - startMouse.y) };
          } 

          if (type === 'RESIZE') {
            const curDX = x - fixedPoint.x;
            const curDY = y - fixedPoint.y;

            let sx = Math.abs(initialHandleDist.dx) < 0.1 ? 1 : curDX / initialHandleDist.dx;
            let sy = Math.abs(initialHandleDist.dy) < 0.1 ? 1 : curDY / initialHandleDist.dy;

            if (isShift || s.type === 'circle') {
              const sVal = Math.max(Math.abs(sx), Math.abs(sy));
              sx = sVal * Math.sign(sx); sy = sVal * Math.sign(sy);
            }

            const newW = Math.max(1, Math.abs(snap.width * sx));
            const newH = Math.max(1, Math.abs(snap.height * sy));
            
            const oldCx = snap.x + snap.width / 2;
            const oldCy = snap.y + snap.height / 2;
            const newCx = fixedPoint.x + (oldCx - fixedPoint.x) * sx;
            const newCy = fixedPoint.y + (oldCy - fixedPoint.y) * sy;

            const baseUpdate: Shape = {
              ...s,
              x: newCx - newW / 2,
              y: newCy - newH / 2,
              width: newW,
              height: newH
            };

            // UIShape.create returns the model which handles complex transforms (like Group children scaling)
            const ui = UIShape.create(snap);
            const extra = ui.transform({ width: newW, height: newH, scaleX: sx, scaleY: sy });
            
            return { ...baseUpdate, ...extra };
          }
          return s;
        };

        return { ...prev, shapes: prev.shapes.map(updateShape) };
      }, false);
    },

    onTransformEnd: () => {
      setSnapshots(new Map());
      setActiveHandle(null);
    },

    onRenderForeground: (ctx) => {
      const { selectedIds, shapes, zoom, offset, editingId, activeTool } = ctx.state;
      if (selectedIds.length === 0 || editingId || activeTool !== 'select' || !ctx.renderer) return;

      const aabb = getSelectionAABB(shapes, selectedIds);
      if (!aabb) return;

      const dpr = window.devicePixelRatio || 1;
      const c = ctx.renderer.ctx, z = zoom, p = VISUAL_PADDING / z;

      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(z, z);
      c.strokeStyle = '#6366f1';
      c.lineWidth = 1.5 / z;
      c.setLineDash([4 / z, 3 / z]);
      c.strokeRect(aabb.x - p, aabb.y - p, aabb.w + 2 * p, aabb.h + 2 * p);
      c.setLineDash([]);

      const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br'];
      handles.forEach(h => {
        const hp = getCornerPos(aabb, h, p);
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(hp.x, hp.y, HANDLE_RADIUS / z, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      });
      c.restore();
    }
  };
};
