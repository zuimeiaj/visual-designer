
import { UIShape } from "./UIShape";
import { Shape, CanvasState } from "../types";
import { ConnectionShape } from "./ConnectionShape";

export class Scene {
  private shapes: UIShape[] = [];

  constructor(initialShapes: Shape[] = []) {
    initialShapes.forEach(s => this.add(s));
  }

  public getShapes(): UIShape[] {
    return this.shapes;
  }

  public add(data: Shape): UIShape {
    const uiShape = UIShape.create(data);
    this.shapes.push(uiShape);
    this.processLifecycle();
    return uiShape;
  }

  public remove(id: string): void {
    this.shapes = this.shapes.filter(s => s.id !== id);
    this.processLifecycle();
  }

  public hitTest(x: number, y: number): UIShape | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      if (this.shapes[i].hitTest(x, y)) {
        return this.shapes[i];
      }
    }
    return null;
  }

  /**
   * 渲染场景
   * @param viewport 可选的视口裁剪范围 {x, y, w, h} (世界坐标)
   */
  public render(ctx: CanvasRenderingContext2D, state: CanvasState, viewport?: { x: number, y: number, w: number, h: number }): void {
    const padding = 20; // 裁剪边距，防止边缘闪烁
    
    this.shapes.forEach((shape) => {
      // 视口裁剪逻辑
      if (viewport && !(shape instanceof ConnectionShape)) {
        const aabb = shape.getAABB();
        const isVisible = !(
          aabb.x + aabb.w < viewport.x - padding ||
          aabb.x > viewport.x + viewport.w + padding ||
          aabb.y + aabb.h < viewport.y - padding ||
          aabb.y > viewport.y + viewport.h + padding
        );
        if (!isVisible) return;
      }

      if (shape instanceof ConnectionShape) {
        shape.drawWithScene(ctx, this, state);
      } else {
        shape.draw(ctx, state.zoom, state.editingId === shape.id);
      }
    });
  }

  private processLifecycle(): void {
    this.shapes.forEach((s, i) => s.onLayer(i));
  }
}
