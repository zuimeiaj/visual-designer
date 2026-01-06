
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext } from '../types';
import { UIShape } from '../models/UIShape';

type DragMode = 'move' | 'resize' | 'rotate' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';

interface ShapeSnapshot {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?: { x: number, y: number }[];
}

export const useGroupTransformPlugin = (): CanvasPlugin => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [pivotPoint, setPivotPoint] = useState({ x: 0, y: 0 });
  const [visualRotation, setVisualRotation] = useState(0);
  const [visualScale, setVisualScale] = useState({ sx: 1, sy: 1 });
  
  const [snapshots, setSnapshots] = useState<ShapeSnapshot[]>([]);
  const [initialRect, setInitialRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const VISUAL_PADDING = 8;
  const HANDLE_RADIUS = 4;

  const getMultiAABB = (shapes: Shape[], ids: string[]) => {
    const selected = shapes.filter(s => ids.includes(s.id));
    if (selected.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(s => {
      const b = UIShape.create(s).getAABB();
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    if (minX === Infinity) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const collectAllSnapshots = (shapes: Shape[], selectedIds: string[]): ShapeSnapshot[] => {
    let result: ShapeSnapshot[] = [];
    selectedIds.forEach(id => {
      const s = shapes.find(item => item.id === id);
      if (s) {
        result.push({ 
          id: s.id, type: s.type, x: s.x, y: s.y, 
          width: s.width, height: s.height, rotation: s.rotation, 
          points: s.points ? [...s.points] : undefined 
        });
      }
    });
    return result;
  };

  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = px - cx, dy = py - cy;
    return { x: dx * cos - dy * sin + cx, y: dx * sin + dy * cos + cy };
  };

  return {
    name: 'group-transform',
    priority: 60,
    onMouseDown: (e, hit, ctx) => {
      if ((e.nativeEvent as MouseEvent).button !== 0 || ctx.state.editingId) return false;

      const { selectedIds, shapes, zoom } = ctx.state;
      if (selectedIds.length <= 1) return false;

      const { x, y } = e;
      const rect = getMultiAABB(shapes, selectedIds);
      if (!rect) return false;

      const p = VISUAL_PADDING / zoom;
      const pivot = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      const threshold = 18 / zoom;
      
      const prepareDrag = (mode: DragMode, handle: ResizeHandle | null = null, fx: number = 0, fy: number = 0) => {
        setSnapshots(collectAllSnapshots(shapes, selectedIds));
        setInitialRect(rect);
        setStartMouse({ x, y });
        setDragMode(mode);
        setActiveHandle(handle);
        setFixedPoint({ x: fx, y: fy });
        setPivotPoint(pivot);
        setVisualRotation(0);
        setVisualScale({ sx: 1, sy: 1 });
        ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING' }), false);
      };

      // 1. Rotation handle check
      const rotPos = { x: pivot.x, y: rect.y - p - 30 / zoom };
      if (Math.hypot(x - rotPos.x, y - rotPos.y) < threshold) {
        prepareDrag('rotate');
        e.consume();
        return true;
      }

      // 2. Corner handles check
      const corners: ResizeHandle[] = ['tl', 'tr', 'bl', 'br'];
      for (const h of corners) {
        let hx = 0, hy = 0, fx = 0, fy = 0;
        if (h.includes('l')) { hx = rect.x - p; fx = rect.x + rect.w; } 
        else { hx = rect.x + rect.w + p; fx = rect.x; }
        if (h.includes('t')) { hy = rect.y - p; fy = rect.y + rect.h; } 
        else { hy = rect.y + rect.h + p; fy = rect.y; }

        if (Math.hypot(x - hx, y - hy) < threshold) {
          prepareDrag('resize', h, fx, fy);
          e.consume();
          return true;
        }
      }

      // 3. Move check
      if (hit && selectedIds.includes(hit.id)) {
        prepareDrag('move');
        e.consume();
        return true;
      }

      return false;
    },
    onMouseMove: (e, ctx) => {
      const { x, y } = e;
      if (!dragMode || snapshots.length === 0 || !initialRect) return;

      const dx = x - startMouse.x;
      const dy = y - startMouse.y;

      ctx.setState(prev => {
        let currentRotation = 0, scaleX = 1, scaleY = 1;

        if (dragMode === 'rotate') {
          currentRotation = Math.atan2(y - pivotPoint.y, x - pivotPoint.x) - Math.atan2(startMouse.y - pivotPoint.y, startMouse.x - pivotPoint.x);
          setVisualRotation(currentRotation);
        } else if (dragMode === 'resize') {
          const initialDistX = startMouse.x - fixedPoint.x || 1;
          const initialDistY = startMouse.y - fixedPoint.y || 1;
          scaleX = (x - fixedPoint.x) / initialDistX;
          scaleY = (y - fixedPoint.y) / initialDistY;
          if ((e.nativeEvent as MouseEvent).shiftKey) {
            const s = Math.max(Math.abs(scaleX), Math.abs(scaleY));
            scaleX = s * Math.sign(scaleX); scaleY = s * Math.sign(scaleY);
          }
          setVisualScale({ sx: scaleX, sy: scaleY });
        }

        const updateShapeList = (shapesList: Shape[]): Shape[] => {
          return shapesList.map(s => {
            const snap = snapshots.find(sn => sn.id === s.id);
            if (snap) {
              const uiShape = ctx.scene.getShapes().find(uis => uis.id === s.id);
              if (dragMode === 'move') {
                return { ...s, x: snap.x + dx, y: snap.y + dy };
              } else if (dragMode === 'rotate') {
                const oldCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
                const newCenter = rotatePoint(oldCenter.x, oldCenter.y, pivotPoint.x, pivotPoint.y, currentRotation);
                return {
                  ...s,
                  rotation: snap.rotation + currentRotation,
                  x: newCenter.x - snap.width / 2,
                  y: newCenter.y - snap.height / 2
                };
              } else if (dragMode === 'resize') {
                const oldCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
                const nextCx = fixedPoint.x + (oldCenter.x - fixedPoint.x) * scaleX;
                const nextCy = fixedPoint.y + (oldCenter.y - fixedPoint.y) * scaleY;
                const absScaleX = Math.abs(scaleX), absScaleY = Math.abs(scaleY);
                const updates = uiShape ? uiShape.transform({ 
                  width: snap.width * absScaleX, 
                  height: snap.height * absScaleY,
                  scaleX: absScaleX, scaleY: absScaleY
                }) : {};
                const finalW = updates.width ?? (snap.width * absScaleX);
                const finalH = updates.height ?? (snap.height * absScaleY);
                return {
                  ...s, ...updates,
                  width: finalW, height: finalH,
                  x: nextCx - finalW / 2, y: nextCy - finalH / 2
                };
              }
            }
            if (s.children) return { ...s, children: updateShapeList(s.children) };
            return s;
          });
        };
        return { ...prev, shapes: updateShapeList(prev.shapes) };
      }, false);
    },
    onMouseUp: (e, ctx) => {
      if (dragMode) ctx.setState(prev => ({ ...prev, interactionState: 'IDLE' }), true);
      setDragMode(null);
      setSnapshots([]);
      setInitialRect(null);
    },
    onRenderForeground: (ctx) => {
      const { selectedIds, shapes, zoom, offset, editingId } = ctx.state;
      if (selectedIds.length <= 1 || editingId || !ctx.renderer) return;

      const rect = dragMode ? initialRect : getMultiAABB(shapes, selectedIds);
      if (!rect) return;

      const dpr = window.devicePixelRatio || 1;
      const c = ctx.renderer.ctx, z = zoom, p = VISUAL_PADDING / z;
      
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); 
      c.translate(offset.x, offset.y);
      c.scale(z, z);
      
      // If transforming, apply group-level visual feedback
      if (dragMode === 'rotate') {
        c.translate(pivotPoint.x, pivotPoint.y);
        c.rotate(visualRotation);
        c.translate(-pivotPoint.x, -pivotPoint.y);
      } else if (dragMode === 'resize') {
        c.translate(fixedPoint.x, fixedPoint.y);
        c.scale(visualScale.sx, visualScale.sy);
        c.translate(-fixedPoint.x, -fixedPoint.y);
      }
      
      // Draw primary dashed border
      c.strokeStyle = '#6366f1'; 
      c.lineWidth = 1 / z;
      c.setLineDash([4 / z, 2 / z]); 
      c.strokeRect(rect.x - p, rect.y - p, rect.w + 2 * p, rect.h + 2 * p);
      c.setLineDash([]);
      
      // Draw handles if not currently dragging (or if rotating to show pivot)
      if (!dragMode) {
        // Rotation handle stem
        c.beginPath();
        c.moveTo(rect.x + rect.w / 2, rect.y - p);
        c.lineTo(rect.x + rect.w / 2, rect.y - p - 30 / z);
        c.stroke();

        // Rotation dot
        c.fillStyle = '#ffffff';
        c.lineWidth = 1.5 / z;
        c.beginPath();
        c.arc(rect.x + rect.w / 2, rect.y - p - 30 / z, HANDLE_RADIUS / z, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Corner dots
        const handles = ['tl', 'tr', 'bl', 'br'];
        handles.forEach(h => {
          let hx = 0, hy = 0;
          if (h.includes('l')) hx = rect.x - p; else hx = rect.x + rect.w + p;
          if (h.includes('t')) hy = rect.y - p; else hy = rect.y + rect.h + p;
          
          c.beginPath();
          c.arc(hx, hy, HANDLE_RADIUS / z, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        });
      }
      c.restore();
    }
  };
};
