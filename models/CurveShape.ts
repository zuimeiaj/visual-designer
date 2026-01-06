
import { UIShape, TransformParams } from "./UIShape";
import { Shape } from "../types";

export class CurveShape extends UIShape {
  public closed: boolean = false;

  constructor(data: Shape) {
    super(data);
    this.closed = !!data.closed;
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.closed !== undefined) this.closed = data.closed;
  }

  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    if (this.curvePoints && (params.scaleX !== undefined || params.scaleY !== undefined || params.width !== undefined || params.height !== undefined)) {
      const sx = params.scaleX ?? (params.width !== undefined ? params.width / this.width : 1);
      const sy = params.scaleY ?? (params.height !== undefined ? params.height / this.height : 1);
      updates.curvePoints = this.curvePoints.map(p => ({
        ...p,
        x: p.x * sx,
        y: p.y * sy,
        handleIn: p.handleIn ? { x: p.handleIn.x * sx, y: p.handleIn.y * sy } : undefined,
        handleOut: p.handleOut ? { x: p.handleOut.x * sx, y: p.handleOut.y * sy } : undefined
      }));
    }
    return updates;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    if (!this.curvePoints || this.curvePoints.length < 2) return;
    ctx.beginPath();
    const start = this.curvePoints[0];
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < this.curvePoints.length; i++) {
      const p = this.curvePoints[i];
      const prev = this.curvePoints[i-1];
      const cp1 = prev.handleOut ? { x: prev.x + prev.handleOut.x, y: prev.y + prev.handleOut.y } : { x: prev.x, y: prev.y };
      const cp2 = p.handleIn ? { x: p.x + p.handleIn.x, y: p.y + p.handleIn.y } : { x: p.x, y: p.y };
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
    }
    if (this.closed) {
      const last = this.curvePoints[this.curvePoints.length - 1];
      const first = this.curvePoints[0];
      const cp1 = last.handleOut ? { x: last.x + last.handleOut.x, y: last.y + last.handleOut.y } : { x: last.x, y: last.y };
      const cp2 = first.handleIn ? { x: first.x + first.handleIn.x, y: first.y + first.handleIn.y } : { x: first.x, y: first.y };
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, first.x, first.y);
      ctx.closePath();
      if (this.fill !== 'transparent') {
        ctx.fillStyle = this.fill;
        ctx.fill();
      }
    }
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
}

UIShape.register('curve', CurveShape);