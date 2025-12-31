
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext, TransformType } from '../types';
import { UIShape } from '../models/UIShape';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr' | 'p1' | 'p2';

interface ShapeSnapshot extends Shape {}

export const useTransformPlugin = (): CanvasPlugin => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [transformType, setTransformType] = useState<TransformType | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, ShapeSnapshot>>(new Map());
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [pivotPoint, setPivotPoint] = useState({ x: 0, y: 0 });
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [initialLocalDist, setInitialLocalDist] = useState({ x: 0, y: 0 });
  
  const VISUAL_PADDING = 4;

  const collectSnapshots = (shapes: Shape[], targetIds: string[], recursive = false, map = new Map<string, ShapeSnapshot>()) => {
    shapes.forEach(s => {
      const isTarget = targetIds.includes(s.id);
      if (isTarget || recursive) {
        map.set(s.id, JSON.parse(JSON.stringify(s)));
        if (s.children) {
          collectSnapshots(s.children, [], true, map);
        }
      } else if (s.children) {
        collectSnapshots(s.children, targetIds, false, map);
      }
    });
    return map;
  };

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

  const getMultiAABB = (shapes: Shape[], ids: string[]) => {
    const selected = shapes.filter(s => ids.includes(s.id));
    if (selected.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(s => {
      const b = getAABB(s);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = px - cx, dy = py - cy;
    return { x: dx * cos - dy * sin + cx, y: dx * sin + dy * cos + cy };
  };

  const toLocalVector = (dx: number, dy: number, rotation: number) => {
    const cos = Math.cos(-rotation), sin = Math.sin(-rotation);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  };

  const getLinePoints = (shape: Shape) => {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const p1 = rotatePoint(shape.x, cy, cx, cy, shape.rotation);
    const p2 = rotatePoint(shape.x + shape.width, cy, cx, cy, shape.rotation);
    return { p1, p2 };
  };

  return {
    name: 'transform',
    priority: 50,

    onMouseDown: (e, hit, ctx) => {
      const { selectedIds, shapes, zoom } = ctx.state;
      if (selectedIds.length === 0) return false;

      const threshold = 15 / zoom;
      const isSingle = selectedIds.length === 1;
      const mainShape = shapes.find(s => s.id === selectedIds[0]);

      // Special handling for Line: Only 2 end handles, no separate rotate handle
      if (isSingle && mainShape?.type === 'line') {
        const { p1, p2 } = getLinePoints(mainShape);
        if (Math.hypot(e.x - p1.x, e.y - p1.y) < threshold) {
          setTransformType('RESIZE');
          setActiveHandle('p1');
          setFixedPoint(p2);
          setSnapshots(collectSnapshots(shapes, selectedIds));
          ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
          e.consume();
          return true;
        }
        if (Math.hypot(e.x - p2.x, e.y - p2.y) < threshold) {
          setTransformType('RESIZE');
          setActiveHandle('p2');
          setFixedPoint(p1);
          setSnapshots(collectSnapshots(shapes, selectedIds));
          ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
          e.consume();
          return true;
        }
        return false;
      }

      const rect = isSingle && mainShape ? null : getMultiAABB(shapes, selectedIds);
      if (!mainShape && !rect) return false;

      const p = VISUAL_PADDING / zoom;
      const rotation = (isSingle && mainShape) ? mainShape.rotation : 0;
      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      
      const cx = isSingle && mainShape ? mainShape.x + mainShape.width / 2 : (rect!.x + rect!.w / 2);
      const cy = isSingle && mainShape ? mainShape.y + mainShape.height / 2 : (rect!.y + rect!.h / 2);
      const sw = isSingle && mainShape ? mainShape.width : rect!.w;
      const sh = isSingle && mainShape ? mainShape.height : rect!.h;

      // Rotate handle (not for lines)
      const localRotPos = { x: 0, y: -sh / 2 - p - 30 / zoom };
      const rotPosWorld = isSingle ? {
          x: cx + localRotPos.x * cos - localRotPos.y * sin,
          y: cy + localRotPos.x * sin + localRotPos.y * cos
      } : { x: cx, y: (rect!.y) - p - 30 / zoom };

      if (Math.hypot(e.x - rotPosWorld.x, e.y - rotPosWorld.y) < threshold) {
        setTransformType('ROTATE');
        setPivotPoint({ x: cx, y: cy });
        setStartMouse({ x: e.x, y: e.y });
        setSnapshots(collectSnapshots(shapes, selectedIds));
        ctx.setState(prev => ({ 
          ...prev, 
          interactionState: 'TRANSFORMING',
          activeTransformType: 'ROTATE'
        }), false);
        e.consume();
        return true;
      }

      // Resize handles
      const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
      for (const h of handles) {
        let lx = 0, ly = 0, lfx = 0, lfy = 0;
        if (h.includes('l')) { lx = -sw / 2 - p; lfx = sw / 2; } 
        else if (h.includes('r')) { lx = sw / 2 + p; lfx = -sw / 2; } 
        else { lx = 0; lfx = 0; }
        if (h.includes('t')) { ly = -sh / 2 - p; lfy = sh / 2; } 
        else if (h.includes('b')) { ly = sh / 2 + p; lfy = -sh / 2; } 
        else { ly = 0; lfy = 0; }

        const hPosWorld = isSingle ? {
            x: cx + lx * cos - ly * sin,
            y: cy + lx * sin + ly * cos
        } : { x: cx + lx, y: cy + ly };
        
        if (Math.hypot(e.x - hPosWorld.x, e.y - hPosWorld.y) < threshold) {
          const fPosWorld = isSingle ? {
              x: cx + lfx * cos - lfy * sin,
              y: cy + lfx * sin + lfy * cos
          } : { x: cx + lfx, y: cy + lfy };
          
          setTransformType('RESIZE');
          setActiveHandle(h);
          setFixedPoint(fPosWorld);
          setStartMouse({ x: e.x, y: e.y });
          setInitialLocalDist(toLocalVector(e.x - fPosWorld.x, e.y - fPosWorld.y, rotation));
          setSnapshots(collectSnapshots(shapes, selectedIds));
          ctx.setState(prev => ({ 
            ...prev, 
            interactionState: 'TRANSFORMING',
            activeTransformType: 'RESIZE'
          }), false);
          e.consume();
          return true;
        }
      }

      return false;
    },

    onTransformStart: (e, ctx) => {
      if (transformType) return; 
      setTransformType('MOVE');
      setStartMouse({ x: e.x, y: e.y });
      setSnapshots(collectSnapshots(ctx.state.shapes, e.targetIds));
      ctx.setState(prev => ({ ...prev, activeTransformType: 'MOVE' }), false);
    },

    onTransformUpdate: (e, ctx) => {
      if (ctx.state.interactionState !== 'TRANSFORMING' || snapshots.size === 0) return;
      
      const dx = e.x - startMouse.x;
      const dy = e.y - startMouse.y;

      ctx.setState(prev => {
        const isSingle = prev.selectedIds.length === 1;
        const mainId = isSingle ? prev.selectedIds[0] : null;
        const snapMain = mainId ? snapshots.get(mainId) : null;
        const baseRotation = snapMain ? snapMain.rotation : 0;

        let scaleX = 1, scaleY = 1, rotationDelta = 0;

        if (transformType === 'ROTATE') {
          rotationDelta = Math.atan2(e.y - pivotPoint.y, e.x - pivotPoint.x) - Math.atan2(startMouse.y - pivotPoint.y, startMouse.x - pivotPoint.x);
        } else if (transformType === 'RESIZE' && activeHandle && !activeHandle.startsWith('p')) {
          const currentLocalDist = toLocalVector(e.x - fixedPoint.x, e.y - fixedPoint.y, baseRotation);
          scaleX = initialLocalDist.x !== 0 ? currentLocalDist.x / initialLocalDist.x : 1;
          scaleY = initialLocalDist.y !== 0 ? currentLocalDist.y / initialLocalDist.y : 1;
          if (activeHandle === 'tm' || activeHandle === 'bm') scaleX = 1;
          if (activeHandle === 'ml' || activeHandle === 'mr') scaleY = 1;
        }

        const updateRecursive = (shapeList: Shape[]): Shape[] => {
          return shapeList.map(s => {
            const snap = snapshots.get(s.id);
            if (!snap) {
              if (s.children) return { ...s, children: updateRecursive(s.children) };
              return s;
            }

            let news = { ...s };

            if (transformType === 'MOVE') {
              news.x = snap.x + dx;
              news.y = snap.y + dy;
            } else if (transformType === 'ROTATE') {
              const snapCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
              const newCenter = rotatePoint(snapCenter.x, snapCenter.y, pivotPoint.x, pivotPoint.y, rotationDelta);
              news.rotation = snap.rotation + rotationDelta;
              news.x = newCenter.x - snap.width / 2;
              news.y = newCenter.y - snap.height / 2;
            } else if (transformType === 'RESIZE') {
              if (s.type === 'line' && activeHandle?.startsWith('p')) {
                // Line 2-point transformation logic
                const pFixed = fixedPoint;
                const pMoving = { x: e.x, y: e.y };
                const newLength = Math.max(1, Math.hypot(pMoving.x - pFixed.x, pMoving.y - pFixed.y));
                const newRotation = Math.atan2(pMoving.y - pFixed.y, pMoving.x - pFixed.x);
                const newCenter = { x: (pFixed.x + pMoving.x) / 2, y: (pFixed.y + pMoving.y) / 2 };
                
                // If we dragged p1, the rotation should be handled carefully as atan2(p2-p1) is the standard.
                // Our atan2 above is atan2(moving - fixed).
                // If activeHandle is p1, fixed is p2. Vector is p2 -> p1.
                // Line orientation is p1 -> p2. So if we drag p1, vector moving -> fixed is p1 -> p2.
                let finalRotation = newRotation;
                if (activeHandle === 'p1') {
                   // Vector is fixed(p2) -> moving(p1). 
                   // Line logic: x is p1, width is length towards p2.
                   // So vector p1 -> p2 is the orientation.
                   finalRotation = Math.atan2(pFixed.y - pMoving.y, pFixed.x - pMoving.x);
                }

                news.width = newLength;
                news.height = snap.height; // maintain thickness
                news.rotation = finalRotation;
                news.x = newCenter.x - newLength / 2;
                news.y = newCenter.y - snap.height / 2;
              } else {
                const uiShape = UIShape.create(snap);
                const absScaleX = Math.abs(scaleX);
                const absScaleY = Math.abs(scaleY);
                
                const updates = uiShape.transform({ 
                  width: snap.width * absScaleX, 
                  height: snap.height * absScaleY,
                  scaleX: absScaleX,
                  scaleY: absScaleY
                });
                
                const finalW = updates.width ?? (snap.width * absScaleX);
                const finalH = updates.height ?? (snap.height * absScaleY);
                const snapCx = snap.x + snap.width / 2;
                const snapCy = snap.y + snap.height / 2;
                const vOldLocal = toLocalVector(snapCx - fixedPoint.x, snapCy - fixedPoint.y, baseRotation);
                const effectiveScaleX = snap.width !== 0 ? (finalW / snap.width) * Math.sign(scaleX) : 1;
                const effectiveScaleY = snap.height !== 0 ? (finalH / snap.height) * Math.sign(scaleY) : 1;
                const vNewLocal = { x: vOldLocal.x * effectiveScaleX, y: vOldLocal.y * effectiveScaleY };
                const cos = Math.cos(baseRotation), sin = Math.sin(baseRotation);
                const newCx = fixedPoint.x + (vNewLocal.x * cos - vNewLocal.y * sin);
                const newCy = fixedPoint.y + (vNewLocal.x * sin + vNewLocal.y * cos);

                news = { 
                  ...news, 
                  ...updates, 
                  x: newCx - finalW / 2, 
                  y: newCy - finalH / 2, 
                  width: finalW, 
                  height: finalH 
                };
              }
            }

            if (s.children) {
              news.children = updateRecursive(s.children);
            }
            return news;
          });
        };

        return { ...prev, shapes: updateRecursive(prev.shapes) };
      }, false);
    },

    onTransformEnd: (e, ctx) => {
      setTransformType(null);
      setSnapshots(new Map());
      setActiveHandle(null);
      ctx.setState(prev => ({ ...prev, activeTransformType: null }), false);
    },

    onRenderForeground: (ctx) => {
      const { selectedIds, shapes, zoom, offset, editingId, interactionState } = ctx.state;
      if (selectedIds.length === 0 || editingId || !ctx.renderer) return;

      const c = ctx.renderer.ctx, z = zoom, p = VISUAL_PADDING / z;
      const isSingle = selectedIds.length === 1;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(z, z);
      c.strokeStyle = '#6366f1'; 
      c.lineWidth = 1.5 / z;
      if (interactionState === 'TRANSFORMING') c.setLineDash([5/z, 3/z]);

      const mainShape = isSingle ? shapes.find(s => s.id === selectedIds[0]) : null;
      
      // Specialized UI for Line
      if (isSingle && mainShape?.type === 'line') {
        const { p1, p2 } = getLinePoints(mainShape);
        const hs = 8 / z;
        c.fillStyle = '#fff';
        c.setLineDash([]);
        
        // Only draw end handles, no bounding box for single lines
        c.beginPath();
        c.arc(p1.x, p1.y, 5/z, 0, Math.PI*2);
        c.fill(); c.stroke();
        
        c.beginPath();
        c.arc(p2.x, p2.y, 5/z, 0, Math.PI*2);
        c.fill(); c.stroke();
        
        c.restore();
        return;
      }

      const rect = isSingle && mainShape ? null : getMultiAABB(shapes, selectedIds);
      if (!mainShape && !rect) { c.restore(); return; }

      if (isSingle && mainShape) {
        c.save();
        const cx = mainShape.x + mainShape.width / 2, cy = mainShape.y + mainShape.height / 2;
        c.translate(cx, cy);
        c.rotate(mainShape.rotation);
        c.strokeRect(-mainShape.width / 2 - p, -mainShape.height / 2 - p, mainShape.width + 2 * p, mainShape.height + 2 * p);
        
        if (interactionState !== 'TRANSFORMING' && interactionState !== 'MARQUEE') {
          const hs = 8 / z;
          c.fillStyle = '#fff';
          c.setLineDash([]);
          c.beginPath(); c.moveTo(0, -mainShape.height / 2 - p); c.lineTo(0, -mainShape.height / 2 - p - 30 / z); c.stroke();
          c.beginPath(); c.arc(0, -mainShape.height / 2 - p - 30 / z, 5 / z, 0, Math.PI * 2); c.fill(); c.stroke();
          ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].forEach(h => {
            let hx = 0, hy = 0;
            if (h.includes('l')) hx = -mainShape.width / 2 - p; else if (h.includes('r')) hx = mainShape.width / 2 + p; else hx = 0;
            if (h.includes('t')) hy = -mainShape.height / 2 - p; else if (h.includes('b')) hy = mainShape.height / 2 + p; else hy = 0;
            c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
          });
        }
        c.restore();
      } else if (rect) {
        c.strokeRect(rect.x - p, rect.y - p, rect.w + 2 * p, rect.h + 2 * p);
        if (interactionState !== 'TRANSFORMING' && interactionState !== 'MARQUEE') {
          c.setLineDash([]);
          const hs = 8 / z;
          c.fillStyle = '#fff';
          const rl = { x: rect.x + rect.w / 2, y: rect.y - p - 30 / z };
          c.beginPath(); c.moveTo(rl.x, rect.y - p); c.lineTo(rl.x, rl.y); c.stroke();
          c.beginPath(); c.arc(rl.x, rl.y, 5 / z, 0, Math.PI * 2); c.fill(); c.stroke();
          ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].forEach(h => {
            let hx = 0, hy = 0;
            if (h.includes('l')) hx = rect.x - p; else if (h.includes('r')) hx = rect.x + rect.w + p; else hx = rect.x + rect.w / 2;
            if (h.includes('t')) hy = rect.y - p; else if (h.includes('b')) hy = rect.y + rect.h + p; else hy = rect.y + rect.h / 2;
            c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
          });
        }
      }
      c.restore();
    }
  };
};
