
import { UIShape } from "./UIShape";

export class LineShape extends UIShape {
  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    ctx.beginPath();
    const midY = this.height / 2;
    ctx.moveTo(0, midY);
    ctx.lineTo(this.width, midY);
    
    ctx.strokeStyle = this.stroke === 'none' ? this.fill : this.stroke;
    ctx.lineWidth = Math.max(1, this.strokeWidth || 2);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

UIShape.register('line', LineShape);
