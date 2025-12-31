
import { UIShape } from "./UIShape";

export class RectShape extends UIShape {
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.fill;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
  }
}

UIShape.register('rect', RectShape);
