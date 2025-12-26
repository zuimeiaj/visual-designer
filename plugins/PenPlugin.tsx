
import { useState, useCallback, useRef } from 'react';
import { CanvasPlugin, PluginContext, Shape, ShapeType } from '../types';

export const usePenPlugin = (): CanvasPlugin => {
  // --- 路径创建状态 ---
  const [currentPoints, setCurrentPoints] = useState<{ x: number, y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

  // --- 路径编辑状态 ---
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  // 计算 AABB 并将点转为相对坐标
  const finalizePathData = (points: { x: number, y: number }[]) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;

    // 将点转换为相对于 (minX, minY) 的坐标
    const relativePoints = points.map(p => ({
      x: p.x - minX,
      y: p.y - minY
    }));

    return { x: minX, y: minY, width, height, relativePoints };
  };

  const finishPathCreation = useCallback((ctx: PluginContext) => {
    if (currentPoints.length < 2) {
      setCurrentPoints([]);
      setIsDrawing(false);
      return;
    }

    const { x, y, width, height, relativePoints } = finalizePathData(currentPoints);

    const newPath: Shape = {
      id: 'path-' + Math.random().toString(36).substr(2, 9),
      type: 'path' as ShapeType,
      x,
      y,
      width,
      height,
      rotation: 0,
      fill: 'transparent',
      stroke: '#818cf8',
      strokeWidth: 2,
      points: relativePoints
    };

    ctx.setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, newPath],
      selectedIds: [newPath.id]
    }), true);

    setCurrentPoints([]);
    setIsDrawing(false);
  }, [currentPoints]);

  return {
    name: 'pen-plugin',

    onMouseDown: (e, hit, ctx) => {
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const zoom = ctx.state.zoom;

      // --- 场景 1: 正在编辑已有路径的点 ---
      if (ctx.state.editingId) {
        const shape = ctx.state.shapes.find(s => s.id === ctx.state.editingId);
        if (shape && shape.type === 'path' && shape.points) {
          const handleSize = 10 / zoom;
          const hitIdx = shape.points.findIndex(p => {
            // 注意：编辑时点是相对坐标，需要加上 shape.x, shape.y
            // 这里暂不考虑旋转，路径编辑通常在 0 旋转下效果最好
            return Math.abs(x - (shape.x + p.x)) < handleSize && Math.abs(y - (shape.y + p.y)) < handleSize;
          });

          if (hitIdx !== -1) {
            setDraggingPointIndex(hitIdx);
            e.stopPropagation();
            return;
          }
        }
      }

      // --- 场景 2: 正在创建新路径 ---
      if (ctx.state.activeTool === 'path') {
        if (!hit) {
          setCurrentPoints(prev => [...prev, { x, y }]);
          setIsDrawing(true);
          e.stopPropagation();
        }
      }
    },

    onMouseMove: (e, ctx) => {
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);

      // --- 处理点拖拽编辑 ---
      if (draggingPointIndex !== null && ctx.state.editingId) {
        ctx.setState(prev => {
          const shapes = prev.shapes.map(s => {
            if (s.id !== prev.editingId || !s.points) return s;
            
            // 1. 更新被拖拽的点（转回相对坐标）
            const newPoints = [...s.points];
            newPoints[draggingPointIndex] = { x: x - s.x, y: y - s.y };

            // 2. 重新计算整体包围盒以适配 UI 框架
            // 先转回绝对坐标
            const absPoints = newPoints.map(p => ({ x: p.x + s.x, y: p.y + s.y }));
            const { x: nx, y: ny, width: nw, height: nh, relativePoints: nrp } = finalizePathData(absPoints);

            return { ...s, x: nx, y: ny, width: nw, height: nh, points: nrp };
          });
          return { ...prev, shapes };
        }, false);
        return;
      }

      // --- 处理新路径预览 ---
      if (ctx.state.activeTool === 'path' && isDrawing) {
        setMousePos({ x, y });
        ctx.setCursor('crosshair');
      }
    },

    onMouseUp: () => {
      setDraggingPointIndex(null);
    },

    onDoubleClick: (e, hit, ctx) => {
      // 如果活跃工具是路径，双击完成创建
      if (ctx.state.activeTool === 'path' && isDrawing) {
        finishPathCreation(ctx);
        e.stopPropagation();
        return;
      }

      // 如果活跃工具是选择，双击路径进入编辑模式
      if (ctx.state.activeTool === 'select' && hit && hit.type === 'path') {
        ctx.setState(prev => ({
          ...prev,
          editingId: hit.id,
          selectedIds: [hit.id]
        }), false);
        e.stopPropagation();
      }
    },

    onKeyDown: (e, ctx) => {
      // 退出编辑模式
      if (e.key === 'Escape' || e.key === 'Enter') {
        if (ctx.state.editingId) {
          ctx.setState(prev => ({ ...prev, editingId: null }), true);
          return true;
        }
        if (isDrawing) {
          finishPathCreation(ctx);
          return true;
        }
      }
      return false;
    },

    onRenderForeground: (ctx: PluginContext) => {
      const { zoom, offset, activeTool, editingId, shapes } = ctx.state;
      const c = ctx.renderer?.ctx;
      if (!c) return;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      // --- 绘制正在创建的路径预览 ---
      if (activeTool === 'path' && isDrawing && currentPoints.length > 0) {
        c.beginPath();
        c.lineWidth = 2 / zoom;
        c.strokeStyle = '#818cf8';
        c.setLineDash([5 / zoom, 5 / zoom]);
        c.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          c.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        if (mousePos) c.lineTo(mousePos.x, mousePos.y);
        c.stroke();
        c.setLineDash([]);

        // 绘制锚点
        const dotSize = 4 / zoom;
        c.fillStyle = '#ffffff';
        currentPoints.forEach(p => {
          c.beginPath();
          c.arc(p.x, p.y, dotSize, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        });
      }

      // --- 绘制正在编辑的路径点手柄 ---
      if (editingId) {
        const shape = shapes.find(s => s.id === editingId);
        if (shape && shape.type === 'path' && shape.points) {
          const handleSize = 6 / zoom;
          c.fillStyle = '#ffffff';
          c.strokeStyle = '#6366f1';
          c.lineWidth = 1.5 / zoom;
          
          shape.points.forEach((p, idx) => {
            const px = shape.x + p.x;
            const py = shape.y + p.y;
            c.fillRect(px - handleSize / 2, py - handleSize / 2, handleSize, handleSize);
            c.strokeRect(px - handleSize / 2, py - handleSize / 2, handleSize, handleSize);
          });
        }
      }

      c.restore();
    }
  };
};
