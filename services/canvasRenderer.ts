
import { CanvasState, CanvasPlugin, PluginContext } from "../types";
import { Scene } from "../models/Scene";

export class CanvasRenderer {
  public ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(state: CanvasState, scene: Scene, plugins: CanvasPlugin[], pluginCtx: PluginContext) {
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.ctx.canvas;
    
    // 1. 完全重置并清除画布（填充白色）
    this.clear();
    
    // 2. 渲染背景层插件
    plugins.forEach(p => p.onRenderBackground?.(pluginCtx));

    // 3. 计算可见视口 AABB (世界坐标系)
    // 逻辑：视口矩形在世界坐标系中的范围
    const viewport = {
      x: -state.offset.x / state.zoom,
      y: -state.offset.y / state.zoom,
      w: (canvas.width / dpr) / state.zoom,
      h: (canvas.height / dpr) / state.zoom
    };

    // 4. 进入主内容坐标系
    this.ctx.save();
    this.applyTransform(state, dpr);
    
    // 5. 渲染图形内容 (带裁剪)
    scene.render(this.ctx, state, viewport);
    
    this.ctx.restore();

    // 6. 渲染前景层插件
    plugins.forEach(p => p.onRenderForeground?.(pluginCtx));
  }

  private clear() {
    const canvas = this.ctx.canvas;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private applyTransform(state: CanvasState, dpr: number) {
    this.ctx.scale(dpr, dpr);
    this.ctx.translate(state.offset.x, state.offset.y);
    this.ctx.scale(state.zoom, state.zoom);
  }
}
