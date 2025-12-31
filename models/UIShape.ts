
import { Shape, ShapeType, CurvePoint } from "../types";

export interface TransformParams {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export type UIShapeConstructor = new (data: Shape) => UIShape;

export abstract class UIShape {
  public id: string;
  public type: ShapeType;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public rotation: number = 0;
  public fill: string;
  public stroke: string;
  public strokeWidth: number;
  public layer: number = 0;
  public isSelected: boolean = false;
  public points?: { x: number; y: number }[];
  public curvePoints?: CurvePoint[];

  private static registry = new Map<string, UIShapeConstructor>();

  constructor(data: Shape) {
    this.id = data.id;
    this.type = data.type;
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.height = data.height;
    this.rotation = data.rotation || 0;
    this.fill = data.fill;
    this.stroke = data.stroke;
    this.strokeWidth = data.strokeWidth;
    this.points = data.points;
    this.curvePoints = data.curvePoints;
  }

  /**
   * Registers a shape class to the factory.
   */
  public static register(type: string, constructor: UIShapeConstructor) {
    this.registry.set(type, constructor);
  }

  /**
   * Dynamic factory method using the registry.
   */
  public static create(data: Shape): UIShape {
    const Constructor = this.registry.get(data.type);
    if (!Constructor) {
      console.error(`UIShape: No constructor registered for type "${data.type}". Defaulting to Rect.`);
      // We could return a NullShape or a default Rect if registration fails
      const Rect = this.registry.get('rect');
      return Rect ? new Rect(data) : (null as any);
    }
    return new Constructor(data);
  }

  public onCreated(): void {}
  public onLayout(): void {}
  public onLayer(index: number): void { this.layer = index; }

  public transform(params: TransformParams): Partial<Shape> {
    const updates: Partial<Shape> = {};
    if (params.x !== undefined) updates.x = params.x;
    if (params.y !== undefined) updates.y = params.y;
    if (params.width !== undefined) updates.width = params.width;
    if (params.height !== undefined) updates.height = params.height;
    if (params.rotation !== undefined) updates.rotation = params.rotation;
    return updates;
  }

  public draw(ctx: CanvasRenderingContext2D, zoom: number): void {
    ctx.save();
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    ctx.translate(-cx, -cy);
    this.onDraw(ctx, zoom);
    ctx.restore();
  }

  public abstract onDraw(ctx: CanvasRenderingContext2D, zoom: number): void;

  public getCorners() {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const hw = this.width / 2;
    const hh = this.height / 2;
    return [
      { x: -hw, y: -hh }, { x: hw, y: -hh },
      { x: hw, y: hh }, { x: -hw, y: hh }
    ].map(p => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos
    }));
  }

  public getAABB(): { x: number, y: number, w: number, h: number } {
    const corners = this.getCorners();
    const xs = corners.map(p => p.x);
    const ys = corners.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  }

  public hitTest(px: number, py: number): boolean {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx, dy = py - cy;
    const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    const lx = dx * cos - dy * sin + cx;
    const ly = dx * sin + dy * cos + cy;
    
    const padding = (this.type === 'line' || this.type === 'path' || this.type === 'curve') ? 10 : 0;
    return lx >= this.x - padding && lx <= this.x + this.width + padding && 
           ly >= this.y - padding && ly <= this.y + this.height + padding;
  }

  public update(data: Partial<Shape>): void {
    Object.assign(this, data);
  }
}
