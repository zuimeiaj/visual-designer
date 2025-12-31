
import { UIShape } from "./UIShape";

export class LineShape extends UIShape {
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    // Line is drawn centered vertically within its 'height' box
    const midY = this.y + this.height / 2;
    ctx.moveTo(this.x, midY);
    ctx.lineTo(this.x + this.width, midY);
    
    ctx.strokeStyle = this.stroke === 'none' ? this.fill : this.stroke;
    ctx.lineWidth = Math.max(1, this.strokeWidth || 2);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

UIShape.register('line', LineShape);
