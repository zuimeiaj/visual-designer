
import { CanvasState, CanvasPlugin, PluginContext } from "../types";
import { Scene } from "../models/Scene";

export class CanvasRenderer {
  public ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(state: CanvasState, scene: Scene, plugins: CanvasPlugin[], pluginCtx: PluginContext) {
    const dpr = window.devicePixelRatio || 1;
    
    // 1. 完全重置并清除画布（填充白色）
    this.clear();
    
    // 2. 渲染背景层插件
    plugins.forEach(p => p.onRenderBackground?.(pluginCtx));

    // 3. 进入主内容坐标系
    this.ctx.save();
    this.applyTransform(state, dpr);
    
    // 4. 渲染图形内容
    scene.render(this.ctx, state);
    
    this.ctx.restore();

    // 5. 渲染前景层插件
    plugins.forEach(p => p.onRenderForeground?.(pluginCtx));
  }

  private clear() {
    const canvas = this.ctx.canvas;
    // 使用 resetTransform 确保彻底回到初始状态
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 显式填充白色，解决 alpha: false 导致的初始黑色背景问题
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private applyTransform(state: CanvasState, dpr: number) {
    // 核心顺序：物理缩放 -> 全局平移 -> 全局缩放
    this.ctx.scale(dpr, dpr);
    this.ctx.translate(state.offset.x, state.offset.y);
    this.ctx.scale(state.zoom, state.zoom);
  }
}
