
import { CanvasPlugin, PluginContext } from '../types';
import { useState } from 'react';

export const useRulerPlugin = (): CanvasPlugin => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const RULER_SIZE = 24;
  const COLOR_TICK = '#f8f8f8'; 
  const COLOR_TEXT = '#c0c0c5'; 
  const COLOR_ACCENT = '#6366f1'; 
  
  const GRID_COLOR_PRIMARY = 'rgba(0, 0, 0, 0.035)';
  const GRID_COLOR_MACRO = 'rgba(0, 0, 0, 0.05)';

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
      if (native.ctrlKey || native.metaKey) {
        const canvas = ctx.canvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = native.clientX - rect.left;
        const mouseY = native.clientY - rect.top;
        ctx.setState((prev) => {
          const worldX = (mouseX - prev.offset.x) / prev.zoom;
          const worldY = (mouseY - prev.offset.y) / prev.zoom;
          const delta = -native.deltaY * 0.005;
          const newZoom = Math.min(20, Math.max(0.05, prev.zoom * (1 + delta)));
          const newOffsetX = mouseX - worldX * newZoom;
          const newOffsetY = mouseY - worldY * newZoom;
          return { ...prev, zoom: newZoom, offset: { x: newOffsetX, y: newOffsetY } };
        }, false);
        e.consume();
      } else {
        ctx.setState((prev) => ({
          ...prev,
          offset: { x: prev.offset.x - native.deltaX, y: prev.offset.y - native.deltaY }
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
      c.setTransform(dpr, 0, 0, dpr, 0, 0); // 关键：适配高 DPI 屏幕
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
      const { zoom, offset } = ctx.state;

      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); // 关键：适配高 DPI 屏幕

      c.fillStyle = 'rgba(255, 255, 255, 0.9)';
      c.fillRect(0, 0, canvasWidth, RULER_SIZE); 
      c.fillRect(0, 0, RULER_SIZE, canvasHeight); 
      
      const drawRuler = (isVertical: boolean) => {
        const length = isVertical ? canvasHeight : canvasWidth;
        const scroll = isVertical ? offset.y : offset.x;
        let step = 10;
        while (step * zoom < 40) step *= 2; 
        if (step * zoom < 60) step *= 2.5; 
        const startValue = Math.floor(-scroll / (zoom * step)) * step;
        const endValue = Math.ceil((length - scroll) / (zoom * step)) * step;
        c.beginPath(); c.strokeStyle = '#f0f0f0'; c.fillStyle = COLOR_TEXT; c.font = '500 9px Inter';
        c.textAlign = isVertical ? 'right' : 'left'; c.textBaseline = 'middle';
        for (let v = startValue; v <= endValue; v += step) {
          const pos = v * zoom + scroll;
          if (pos < RULER_SIZE) continue;
          if (isVertical) {
            c.moveTo(RULER_SIZE - 4, pos); c.lineTo(RULER_SIZE, pos);
            c.save(); c.translate(RULER_SIZE - 7, pos); c.rotate(-Math.PI / 2); c.fillText(v.toString(), 0, 0); c.restore();
          } else {
            c.moveTo(pos, RULER_SIZE - 4); c.lineTo(pos, RULER_SIZE); c.fillText(v.toString(), pos + 4, RULER_SIZE / 2);
          }
        }
        c.stroke();
        const mPos = (isVertical ? mousePos.y : mousePos.x) * zoom + scroll;
        if (mPos >= RULER_SIZE && mPos <= length) {
          c.beginPath(); c.strokeStyle = COLOR_ACCENT; c.lineWidth = 1;
          if (isVertical) { c.moveTo(RULER_SIZE - 8, mPos); c.lineTo(RULER_SIZE, mPos); }
          else { c.moveTo(mPos, RULER_SIZE - 8); c.lineTo(mPos, RULER_SIZE); }
          c.stroke();
        }
      };
      drawRuler(false); drawRuler(true);  
      c.strokeStyle = '#f2f2f2'; c.lineWidth = 1; c.beginPath();
      c.moveTo(0, RULER_SIZE); c.lineTo(canvasWidth, RULER_SIZE);
      c.moveTo(RULER_SIZE, 0); c.lineTo(RULER_SIZE, canvasHeight);
      c.stroke();
      c.restore();
    }
  };
};
