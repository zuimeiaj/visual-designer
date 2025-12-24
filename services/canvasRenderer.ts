
import { CanvasState, CanvasPlugin, PluginContext } from "../types";
import { Scene } from "../models/Scene";

export class CanvasRenderer {
  public ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(state: CanvasState, scene: Scene, plugins: CanvasPlugin[], pluginCtx: PluginContext) {
    const { width, height } = this.ctx.canvas;
    this.clear(width, height);
    
    // 1. 渲染背景层插件
    plugins.forEach(p => p.onRenderBackground?.(pluginCtx));

    this.ctx.save();
    this.applyTransform(state);
    
    // 2. 基础图形渲染
    scene.render(this.ctx, state);
    
    this.ctx.restore();

    // 3. 渲染前景层插件 (标尺、辅助线、控制柄等)
    plugins.forEach(p => p.onRenderForeground?.(pluginCtx));
  }

  private clear(width: number, height: number) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
  }

  private applyTransform(state: CanvasState) {
    this.ctx.translate(state.offset.x, state.offset.y);
    this.ctx.scale(state.zoom, state.zoom);
  }
}
