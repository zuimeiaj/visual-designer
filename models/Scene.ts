
import { UIShape } from "./UIShape";
import { Shape, CanvasState } from "../types";
import { ConnectionShape } from "./ConnectionShape";

export class Scene {
  private shapes: UIShape[] = [];

  constructor(initialShapes: Shape[] = []) {
    initialShapes.forEach(s => this.add(s));
  }

  // Returns all UI shapes currently in the scene.
  public getShapes(): UIShape[] {
    return this.shapes;
  }

  // Adds a new shape to the scene.
  public add(data: Shape): UIShape {
    const uiShape = UIShape.create(data);
    this.shapes.push(uiShape);
    this.processLifecycle();
    return uiShape;
  }

  // Removes a shape from the scene by ID.
  public remove(id: string): void {
    this.shapes = this.shapes.filter(s => s.id !== id);
    this.processLifecycle();
  }

  // Performs hit testing at coordinates (x, y) returning the topmost shape.
  public hitTest(x: number, y: number): UIShape | null {
    // Iterate backwards to hit the top-most shape first (standard z-index behavior)
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      if (this.shapes[i].hitTest(x, y)) {
        return this.shapes[i];
      }
    }
    return null;
  }

  // Renders the scene's contents.
  public render(ctx: CanvasRenderingContext2D, state: CanvasState): void {
    this.shapes.forEach((shape) => {
      if (shape instanceof ConnectionShape) {
        shape.drawWithScene(ctx, this, state);
      } else {
        shape.draw(ctx, state.zoom, state.editingId === shape.id);
      }
    });
  }

  // Internal lifecycle updates for layers and order.
  private processLifecycle(): void {
    this.shapes.forEach((s, i) => s.onLayer(i));
  }
}
