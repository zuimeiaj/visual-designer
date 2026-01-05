
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
    
    // 清除物理像素区域
    this.clear();
    
    // 渲染背景层插件
    plugins.forEach(p => p.onRenderBackground?.(pluginCtx));

    this.ctx.save();
    // 应用设备缩放和用户坐标系
    this.applyTransform(state, dpr);
    
    // 渲染图形内容
    scene.render(this.ctx, state);
    
    this.ctx.restore();

    // 渲染前景层插件 (标尺、辅助线等)
    plugins.forEach(p => p.onRenderForeground?.(pluginCtx));
  }

  private clear() {
    const canvas = this.ctx.canvas;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private applyTransform(state: CanvasState, dpr: number) {
    // 首先应用设备像素缩放
    this.ctx.scale(dpr, dpr);
    // 然后应用用户的平移和缩放
    this.ctx.translate(state.offset.x, state.offset.y);
    this.ctx.scale(state.zoom, state.zoom);
  }
}
