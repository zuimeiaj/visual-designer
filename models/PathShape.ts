
import { UIShape, TransformParams } from "./UIShape";
import { Shape } from "../types";

export class PathShape extends UIShape {
  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    
    // Scale points relative to the coordinate space of the shape
    if (this.points && (params.scaleX !== undefined || params.scaleY !== undefined || params.width !== undefined || params.height !== undefined)) {
      const sx = params.scaleX ?? (params.width !== undefined ? params.width / this.width : 1);
      const sy = params.scaleY ?? (params.height !== undefined ? params.height / this.height : 1);
      
      updates.points = this.points.map(p => ({
        x: p.x * sx,
        y: p.y * sy
      }));
    }
    
    return updates;
  }

  public onDraw(ctx: CanvasRenderingContext2D): void {
    if (!this.points || this.points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(this.x + this.points[0].x, this.y + this.points[0].y);
    
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.x + this.points[i].x, this.y + this.points[i].y);
    }
    
    ctx.strokeStyle = this.stroke === 'none' ? this.fill : this.stroke;
    ctx.lineWidth = this.strokeWidth || 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

UIShape.register('path', PathShape);
