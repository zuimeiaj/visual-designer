
import { CanvasPlugin, Shape } from '../types';
import { useState } from 'react';
import { UIShape } from '../models/UIShape';

export const useRulerPlugin = (): CanvasPlugin => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const RULER_SIZE = 24;
  const COLOR_TICK = '#e5e7eb'; // 更清晰的刻度线
  const COLOR_SUB_TICK = '#f3f4f6'; // 较淡的二级刻度
  const COLOR_TEXT = '#71717a'; // 加深文字颜色
  const COLOR_ACCENT = '#6366f1'; // 鼠标指示线颜色
  const COLOR_SELECTION_INDICATOR = 'rgba(99, 102, 241, 0.12)'; // 选中图形在标尺上的高亮背景

  const GRID_COLOR_PRIMARY = 'rgba(0, 0, 0, 0.035)';
  const GRID_COLOR_MACRO = 'rgba(0, 0, 0, 0.05)';

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

  return {
    name: 'ruler',
    priority: 5,

    onInteraction: (type, e) => {
      if (type === 'mousemove') {
        setMousePos({ x: e.x, y: e.y });
      }
    },

    onViewChange: (e, ctx) => {
      const native = e.nativeEvent as WheelEvent;
      const canvas = ctx.canvas;
      if (!canvas) return;

      if (native.ctrlKey || native.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = native.clientX - rect.left;
        const mouseY = native.clientY - rect.top;

        ctx.setState((prev) => {
          const worldX = (mouseX - prev.offset.x) / prev.zoom;
          const worldY = (mouseY - prev.offset.y) / prev.zoom;
          
          const delta = -native.deltaY * 0.002;
          const newZoom = Math.min(20, Math.max(0.05, prev.zoom * (1 + delta)));
          
          const newOffsetX = mouseX - worldX * newZoom;
          const newOffsetY = mouseY - worldY * newZoom;
          
          return { ...prev, zoom: newZoom, offset: { x: newOffsetX, y: newOffsetY } };
        }, false);
        e.consume();
      } else {
        ctx.setState((prev) => ({
          ...prev,
          offset: { 
            x: prev.offset.x - native.deltaX, 
            y: prev.offset.y - native.deltaY 
          }
        }), false);
        e.consume();
      }
    },

    onRenderBackground: (ctx) => {
      if (!ctx.renderer) return;
      const dpr = window.devicePixelRatio || 1;
      const c = ctx.renderer.ctx;
      const { width, height } = c.canvas;
      const { zoom, offset } = ctx.state;

      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); 
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, width / dpr, height / dpr);
      
      let baseStep = 10;
      while (baseStep * zoom < 50) baseStep *= 5;
      while (baseStep * zoom > 250) baseStep /= 5;

      const drawGrid = (step: number, color: string, lineWidth: number) => {
        c.beginPath();
        c.strokeStyle = color;
        c.lineWidth = lineWidth;
        const startX = (offset.x % (step * zoom));
        const startY = (offset.y % (step * zoom));
        for (let x = startX; x <= width / dpr; x += step * zoom) {
          c.moveTo(x, 0); c.lineTo(x, height / dpr);
        }
        for (let y = startY; y <= height / dpr; y += step * zoom) {
          c.moveTo(0, y); c.lineTo(width / dpr, y);
        }
        c.stroke();
      };

      const subStep = baseStep / 5;
      const subStepOnScreen = subStep * zoom;
      if (subStepOnScreen > 25) {
        const opacity = Math.min(1, (subStepOnScreen - 25) / 40);
        drawGrid(subStep, `rgba(0, 0, 0, ${0.015 * opacity})`, 0.2);
      }
      drawGrid(baseStep, GRID_COLOR_PRIMARY, 0.3);
      drawGrid(baseStep * 5, GRID_COLOR_MACRO, 0.5);
      c.restore();
    },

    onRenderForeground: (ctx) => {
      if (!ctx.renderer) return;
      const dpr = window.devicePixelRatio || 1;
      const c = ctx.renderer.ctx;
      const canvasWidth = c.canvas.width / dpr;
      const canvasHeight = c.canvas.height / dpr;
      const { zoom, offset, selectedIds, shapes } = ctx.state;

      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 绘制标尺底色
      c.fillStyle = 'rgba(255, 255, 255, 0.95)';
      c.fillRect(0, 0, canvasWidth, RULER_SIZE); 
      c.fillRect(0, 0, RULER_SIZE, canvasHeight); 

      // 绘制选中项的投影指示
      const selectionAABB = getSelectionAABB(shapes, selectedIds);
      if (selectionAABB) {
        c.fillStyle = COLOR_SELECTION_INDICATOR;
        const screenX1 = selectionAABB.x * zoom + offset.x;
        const screenX2 = (selectionAABB.x + selectionAABB.w) * zoom + offset.x;
        const screenY1 = selectionAABB.y * zoom + offset.y;
        const screenY2 = (selectionAABB.y + selectionAABB.h) * zoom + offset.y;

        // 水平标尺投影
        if (screenX2 > RULER_SIZE) {
          const drawX1 = Math.max(RULER_SIZE, screenX1);
          const drawX2 = Math.min(canvasWidth, screenX2);
          if (drawX2 > drawX1) {
            c.fillRect(drawX1, 0, drawX2 - drawX1, RULER_SIZE);
          }
        }
        // 垂直标尺投影
        if (screenY2 > RULER_SIZE) {
          const drawY1 = Math.max(RULER_SIZE, screenY1);
          const drawY2 = Math.min(canvasHeight, screenY2);
          if (drawY2 > drawY1) {
            c.fillRect(0, drawY1, RULER_SIZE, drawY2 - drawY1);
          }
        }
      }
      
      const drawRuler = (isVertical: boolean) => {
        const length = isVertical ? canvasHeight : canvasWidth;
        const scroll = isVertical ? offset.y : offset.x;
        
        let step = 10;
        while (step * zoom < 40) step *= 2; 
        if (step * zoom < 60) step *= 2.5; 
        
        const subStep = step / 5;
        const startValue = Math.floor(-scroll / (zoom * step)) * step;
        const endValue = Math.ceil((length - scroll) / (zoom * step)) * step;

        c.strokeStyle = COLOR_TICK;
        c.fillStyle = COLOR_TEXT;
        c.font = '500 9px Inter';
        c.textAlign = isVertical ? 'right' : 'left'; 
        c.textBaseline = 'middle';
        
        for (let v = startValue; v <= endValue; v += step) {
          // 绘制二级刻度 (Sub-ticks)
          for (let s = 1; s < 5; s++) {
            const sv = v + s * subStep;
            const spos = sv * zoom + scroll;
            if (spos < RULER_SIZE || spos > length) continue;
            
            c.beginPath();
            c.strokeStyle = COLOR_SUB_TICK;
            if (isVertical) {
              c.moveTo(RULER_SIZE - 4, spos); c.lineTo(RULER_SIZE, spos);
            } else {
              c.moveTo(spos, RULER_SIZE - 4); c.lineTo(spos, RULER_SIZE);
            }
            c.stroke();
          }

          // 绘制主刻度
          const pos = v * zoom + scroll;
          if (pos < RULER_SIZE || pos > length) continue;
          
          c.beginPath();
          c.strokeStyle = COLOR_TICK;
          if (isVertical) {
            c.moveTo(RULER_SIZE - 8, pos); c.lineTo(RULER_SIZE, pos);
            c.save(); 
            c.translate(RULER_SIZE - 10, pos); 
            c.rotate(-Math.PI / 2); 
            c.fillText(v.toString(), 0, 0); 
            c.restore();
          } else {
            c.moveTo(pos, RULER_SIZE - 8); c.lineTo(pos, RULER_SIZE); 
            c.fillText(v.toString(), pos + 4, RULER_SIZE / 2);
          }
          c.stroke();
        }

        // 绘制鼠标当前位置指示线
        const mPos = (isVertical ? mousePos.y : mousePos.x) * zoom + scroll;
        if (mPos >= RULER_SIZE && mPos <= length) {
          c.beginPath(); 
          c.strokeStyle = COLOR_ACCENT; 
          c.lineWidth = 1;
          if (isVertical) { c.moveTo(RULER_SIZE - 12, mPos); c.lineTo(RULER_SIZE, mPos); }
          else { c.moveTo(mPos, RULER_SIZE - 12); c.lineTo(mPos, RULER_SIZE); }
          c.stroke();
        }
      };

      drawRuler(false); 
      drawRuler(true);  

      // 标尺边框线
      c.strokeStyle = '#f2f2f2'; 
      c.lineWidth = 1; 
      c.beginPath();
      c.moveTo(0, RULER_SIZE); c.lineTo(canvasWidth, RULER_SIZE);
      c.moveTo(RULER_SIZE, 0); c.lineTo(RULER_SIZE, canvasHeight);
      c.stroke();
      
      c.restore();
    }
  };
};
