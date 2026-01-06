
import { UIShape, TransformParams } from "./UIShape";
import { Shape } from "../types";

export class GroupShape extends UIShape {
  public children: UIShape[] = [];
  
  constructor(data: Shape) {
    super(data);
    if (data.children) {
      this.children = data.children.map(c => UIShape.create(c));
    }
  }

  public update(data: Partial<Shape>): void {
    const { children, ...rest } = data;
    super.update(rest);
    if (children) {
      this.children = children.map(c => UIShape.create(c));
    }
  }

  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    
    const sx = params.scaleX ?? (params.width !== undefined ? params.width / this.width : 1);
    const sy = params.scaleY ?? (params.height !== undefined ? params.height / this.height : 1);

    if (this.children && (sx !== 1 || sy !== 1)) {
      updates.children = this.children.map(child => {
        const childData = (child as any).data || child;
        
        const childUpdates = child.transform({
          width: child.width * Math.abs(sx),
          height: child.height * Math.abs(sy),
          scaleX: sx,
          scaleY: sy
        });

        return {
          ...childData,
          ...childUpdates,
          x: child.x * Math.abs(sx),
          y: child.y * Math.abs(sy),
          width: childUpdates.width ?? child.width * Math.abs(sx),
          height: childUpdates.height ?? child.height * Math.abs(sy),
        } as Shape;
      });
    }

    return updates;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    // Context is already at Group's top-left thanks to UIShape.draw refactor
    this.children.forEach(child => {
      child.draw(ctx, zoom, isEditing);
    });
  }

  public hitTest(px: number, py: number): boolean {
    const local = this.toLocal(px, py);
    return this.children.some(child => child.hitTest(local.x, local.y));
  }

  private toLocal(px: number, py: number) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx, dy = py - cy;
    const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return { x: lx + this.width / 2, y: ly + this.height / 2 };
  }

  public getInternalHit(px: number, py: number): any {
    const local = this.toLocal(px, py);
    for (let i = this.children.length - 1; i >= 0; i--) {
      const hit = this.children[i].getInternalHit(local.x, local.y);
      if (hit) return hit;
    }
    return super.getInternalHit(px, py);
  }
}

UIShape.register('group', GroupShape);