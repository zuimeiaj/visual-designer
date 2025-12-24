
import { UIShape, RectShape, CircleShape, TextShape, ImageShape } from "./UIShape";
import { Shape, CanvasState } from "../types";

export class Scene {
  private shapes: UIShape[] = [];

  constructor(initialShapes: Shape[] = []) {
    initialShapes.forEach(s => this.add(s));
  }

  public add(data: Shape): UIShape {
    let uiShape: UIShape;
    switch (data.type) {
      case 'rect': uiShape = new RectShape(data); break;
      case 'circle': uiShape = new CircleShape(data); break;
      case 'text': uiShape = new TextShape(data); break;
      case 'image': uiShape = new ImageShape(data); break;
      default: uiShape = new RectShape(data);
    }
    
    this.shapes.push(uiShape);
    this.processLifecycle();
    return uiShape;
  }

  public remove(id: string): void {
    this.shapes = this.shapes.filter(s => s.id !== id);
    this.processLifecycle();
  }

  public updateShape(id: string, updates: Partial<Shape>): void {
    const shape = this.shapes.find(s => s.id === id);
    if (shape) {
      shape.update(updates);
      this.processLifecycle();
    }
  }

  private processLifecycle(): void {
    this.shapes.forEach(s => s.onLayout());
    this.shapes.forEach((s, idx) => s.onLayer(idx));
    this.shapes.sort((a, b) => a.layer - b.layer);
  }

  public getShapes(): UIShape[] {
    return this.shapes;
  }

  public hitTest(x: number, y: number): UIShape | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      if (this.shapes[i].hitTest(x, y)) return this.shapes[i];
    }
    return null;
  }

  public render(ctx: CanvasRenderingContext2D, state: CanvasState): void {
    this.shapes.forEach(shape => {
      // SKIP rendering if this shape is currently being edited via an overlay
      if (state.editingId === shape.id) return;

      shape.draw(ctx, state.zoom);
      
      // Only draw individual selection frame if ONLY one shape is selected
      // This prevents visual double-bordering when GroupTransformPlugin is active
      if (state.selectedIds.length === 1 && state.selectedIds.includes(shape.id)) {
        ctx.save();
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(shape.rotation);
        ctx.translate(-cx, -cy);

        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / state.zoom;
        const p = 4 / state.zoom; // Padding for selection box
        ctx.strokeRect(shape.x - p, shape.y - p, shape.width + p * 2, shape.height + p * 2);
        
        ctx.restore();
      }
    });
  }
}
