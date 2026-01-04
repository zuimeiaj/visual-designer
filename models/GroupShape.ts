
import { UIShape } from "./UIShape";
import { Shape } from "../types";

export class GroupShape extends UIShape {
  public children: UIShape[] = [];
  constructor(data: Shape) {
    super(data);
    if (data.children) this.children = data.children.map(c => UIShape.create(c));
  }

  public update(data: Partial<Shape>): void {
    const { children, ...rest } = data;
    super.update(rest);
    if (children) this.children = children.map(c => UIShape.create(c));
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    this.children.forEach(child => child.draw(ctx, zoom, isEditing));
  }

  public hitTest(px: number, py: number): boolean {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx, dy = py - cy;
    const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    const lx = dx * cos - dy * sin + cx;
    const ly = dx * sin + dy * cos + cy;
    
    return this.children.some(child => child.hitTest(lx, ly));
  }
}

UIShape.register('group', GroupShape);
