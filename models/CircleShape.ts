
import { UIShape, TransformParams } from "./UIShape";
import { Shape } from "../types";

export class CircleShape extends UIShape {
  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    if (updates.width !== undefined || updates.height !== undefined) {
      const size = Math.max(updates.width ?? this.width, updates.height ?? this.height);
      updates.width = size; updates.height = size;
    }
    return updates;
  }
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height / 2, Math.min(this.width, this.height) / 2, 0, Math.PI * 2);
    ctx.fillStyle = this.fill; ctx.fill();
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke; ctx.lineWidth = this.strokeWidth; ctx.stroke();
    }
  }
}

UIShape.register('circle', CircleShape);
