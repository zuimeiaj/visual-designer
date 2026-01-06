
import { useState, useRef, useCallback } from 'react';
import { CanvasPlugin, Shape, PluginContext, TransformType } from '../types';
import { UIShape } from '../models/UIShape';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';

interface ShapeSnapshot extends Shape {}

export const useTransformPlugin = (): CanvasPlugin => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [transformType, setTransformType] = useState<TransformType | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, ShapeSnapshot>>(new Map());
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [initialLocalDist, setInitialLocalDist] = useState({ x: 0, y: 0 });
  
  const isShiftPressed = useRef(false);
  const ctxRef = useRef<PluginContext | null>(null);

  const HIT_THRESHOLD = 16; // 稍微调小命中区域，匹配更小的视觉手柄
  const HANDLE_RADIUS = 4; // 手柄圆半径

  const collectSnapshots = (shapes: Shape[], targetIds: string[], recursive = false, map = new Map<string, ShapeSnapshot>()) => {
    shapes.forEach(s => {
      if (targetIds.includes(s.id) || recursive) {
        map.set(s.id, JSON.parse(JSON.stringify(s)));
        if (s.children) collectSnapshots(s.children, [], true, map);
      } else if (s.children) {
        collectSnapshots(s.children, targetIds, false, map);
      }
    });
    return map;
  };

  const toLocalVector = (dx: number, dy: number, rotation: number) => {
    const cos = Math.cos(-rotation), sin = Math.sin(-rotation);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  };

  const findHandleAt = (ctx: PluginContext, x: number, y: number): { h: ResizeHandle, fixed: {x:number, y:number} } | null => {
    const { selectedIds, shapes, zoom } = ctx.state;
    if (selectedIds.length !== 1) return null; 

    const main = shapes.find(s => s.id === selectedIds[0]);
    if (!main) return null;

    const threshold = HIT_THRESHOLD / zoom;
    const rotation = main.rotation;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const sw = main.width, sh = main.height;
    const cx = main.x + sw / 2, cy = main.y + sh / 2;

    const handles = ['tl', 'tr', 'bl', 'br'] as ResizeHandle[];
    for (const h of handles) {
      let lx = 0, ly = 0, fx = 0, fy = 0;
      if (h.includes('l')) { lx = -sw / 2; fx = sw / 2; } else if (h.includes('r')) { lx = sw / 2; fx = -sw / 2; }
      if (h.includes('t')) { ly = -sh / 2; fy = sh / 2; } else if (h.includes('b')) { ly = sh / 2; fy = -sh / 2; }
      
      const wp = { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
      const fp = { x: cx + fx * cos - fy * sin, y: cy + fx * sin + fy * cos };
      
      if (Math.hypot(x - wp.x, y - wp.y) < threshold) return { h, fixed: fp };
    }
    return null;
  };

  const performUpdate = useCallback((worldX: number, worldY: number) => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state.interactionState !== 'TRANSFORMING' || snapshots.size === 0) return;
    
    const dx = worldX - startMouse.x;
    const dy = worldY - startMouse.y;
    
    ctx.setState(prev => {
      const isSingle = prev.selectedIds.length === 1;
      const mainId = isSingle ? prev.selectedIds[0] : null;
      const snapMain = mainId ? snapshots.get(mainId) : null;
      if (!snapMain && transformType !== 'MOVE') return prev;

      let scaleX = 1, scaleY = 1;
      const baseRot = snapMain ? snapMain.rotation : 0;

      if (transformType === 'RESIZE' && activeHandle) {
        const currentLocal = toLocalVector(worldX - fixedPoint.x, worldY - fixedPoint.y, baseRot);
        scaleX = initialLocalDist.x !== 0 ? currentLocal.x / initialLocalDist.x : 1;
        scaleY = initialLocalDist.y !== 0 ? currentLocal.y / initialLocalDist.y : 1;
        
        if (isShiftPressed.current) {
          const s = Math.max(Math.abs(scaleX), Math.abs(scaleY));
          scaleX = s * Math.sign(scaleX); scaleY = s * Math.sign(scaleY);
        }
      }

      const updateRecursive = (list: Shape[]): Shape[] => {
        return list.map(s => {
          const snap = snapshots.get(s.id);
          if (!snap) return s.children ? { ...s, children: updateRecursive(s.children) } : s;
          let news = { ...s };
          if (transformType === 'MOVE') {
            news.x = snap.x + dx; news.y = snap.y + dy;
          } else if (transformType === 'RESIZE') {
            const ui = UIShape.create(snap);
            const asx = Math.abs(scaleX), asy = Math.abs(scaleY);
            const updates = ui.transform({ width: snap.width * asx, height: snap.height * asy, scaleX: asx, scaleY: asy });
            const fw = updates.width ?? (snap.width * asx), fh = updates.height ?? (snap.height * asy);
            const vOld = toLocalVector((snap.x + snap.width/2) - fixedPoint.x, (snap.y + snap.height/2) - fixedPoint.y, baseRot);
            const esx = snap.width !== 0 ? (fw / snap.width) * Math.sign(scaleX) : 1;
            const esy = snap.height !== 0 ? (fh / snap.height) * Math.sign(scaleY) : 1;
            // Corrected vNew.y assignment to use vOld.y
            const vNew = { x: vOld.x * esx, y: vOld.y * esy };
            const cos = Math.cos(baseRot), sin = Math.sin(baseRot);
            news = { ...news, ...updates, x: fixedPoint.x + (vNew.x * cos - vNew.y * sin) - fw/2, y: fixedPoint.y + (vNew.x * sin + vNew.y * cos) - fh/2, width: fw, height: fh };
          }
          if (s.children) news.children = updateRecursive(s.children);
          return news;
        });
      };
      return { ...prev, shapes: updateRecursive(prev.shapes) };
    }, false);
  }, [snapshots, transformType, startMouse, fixedPoint, activeHandle, initialLocalDist]);

  return {
    name: 'transform',
    priority: 50,

    onMouseDown: (e, hit, ctx) => {
      ctxRef.current = ctx;
      const handle = findHandleAt(ctx, e.x, e.y);
      if (!handle) return false;

      const main = ctx.state.shapes.find(s => s.id === ctx.state.selectedIds[0]);
      setTransformType('RESIZE');
      setActiveHandle(handle.h);
      setFixedPoint(handle.fixed);
      const rot = main ? main.rotation : 0;
      setInitialLocalDist(toLocalVector(e.x - handle.fixed.x, e.y - handle.fixed.y, rot));

      setSnapshots(collectSnapshots(ctx.state.shapes, ctx.state.selectedIds));
      setStartMouse({ x: e.x, y: e.y });
      ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
      e.consume();
      return true;
    },

    onTransformStart: (e, ctx) => {
      ctxRef.current = ctx;
      if (transformType) return; 
      
      setTransformType('MOVE');
      setStartMouse({ x: e.x, y: e.y });
      setSnapshots(collectSnapshots(ctx.state.shapes, e.targetIds));
      ctx.setState(prev => ({ ...prev, activeTransformType: 'MOVE' }), false);
    },

    onTransformUpdate: (e, ctx) => {
      ctxRef.current = ctx;
      isShiftPressed.current = (e.nativeEvent as MouseEvent).shiftKey;
      performUpdate(e.x, e.y);
    },

    onTransformEnd: (e, ctx) => {
      ctxRef.current = ctx;
      setTransformType(null); setActiveHandle(null); setSnapshots(new Map());
      ctx.setState(prev => ({ ...prev, activeTransformType: null }), true);
    },

    onRenderForeground: (ctx) => {
      const { selectedIds, shapes, zoom, offset, editingId } = ctx.state;
      if (selectedIds.length !== 1 || editingId || !ctx.renderer) return;
      
      const main = shapes.find(s => s.id === selectedIds[0]);
      if (!main) return;

      const dpr = window.devicePixelRatio || 1;
      const c = ctx.renderer.ctx, z = zoom;
      c.save(); 
      c.setTransform(dpr, 0, 0, dpr, 0, 0); 
      c.translate(offset.x, offset.y); c.scale(z, z);
      
      const cx = main.x + main.width / 2, cy = main.y + main.height / 2;
      c.save();
      c.translate(cx, cy); c.rotate(main.rotation);
      
      // 绘制主边框
      c.strokeStyle = '#6366f1'; 
      c.lineWidth = 1 / z;
      c.strokeRect(-main.width / 2, -main.height / 2, main.width, main.height);
      
      // 绘制 4 个角落圆形手柄
      const handles = ['tl', 'tr', 'bl', 'br'];
      c.fillStyle = '#ffffff';
      c.lineWidth = 1.5 / z;
      handles.forEach(h => {
        let hx = 0, hy = 0;
        if (h.includes('l')) hx = -main.width / 2; else if (h.includes('r')) hx = main.width / 2;
        if (h.includes('t')) hy = -main.height / 2; else if (h.includes('b')) hy = main.height / 2;
        
        c.beginPath();
        c.arc(hx, hy, HANDLE_RADIUS / z, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      });

      c.restore();
      c.restore();
    }
  };
};
