
import { CanvasState } from "../types";
import { Scene } from "../models/Scene";

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(state: CanvasState, scene: Scene, width: number, height: number) {
    this.clear(width, height);
    
    this.ctx.save();
    this.applyTransform(state);
    
    this.drawGrid(state, width, height);
    
    scene.render(this.ctx, state);
    
    this.drawInteractiveHandles(state, scene);
    
    this.ctx.restore();
  }

  private clear(width: number, height: number) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
  }

  private applyTransform(state: CanvasState) {
    this.ctx.translate(state.offset.x, state.offset.y);
    this.ctx.scale(state.zoom, state.zoom);
  }

  private drawGrid(state: CanvasState, width: number, height: number) {
    const ctx = this.ctx;
    const gridSize = 40;
    const zoom = state.zoom;
    
    const left = -state.offset.x / zoom;
    const top = -state.offset.y / zoom;
    const right = (width - state.offset.x) / zoom;
    const bottom = (height - state.offset.y) / zoom;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1 / zoom;

    for (let x = Math.floor(left / gridSize) * gridSize; x <= right; x += gridSize) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / gridSize) * gridSize; y <= bottom; y += gridSize) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  private drawInteractiveHandles(state: CanvasState, scene: Scene) {
    if (!state.selectedId) return;
    const shape = scene.getShapes().find(s => s.id === state.selectedId);
    if (!shape) return;

    const ctx = this.ctx;
    const zoom = state.zoom;
    const padding = 4 / zoom;
    const handleSize = 8 / zoom;

    ctx.save();
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(shape.rotation);
    ctx.translate(-cx, -cy);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1 / zoom;

    // Corner Resize Handles
    const corners = [
      { x: shape.x - padding, y: shape.y - padding }, // TL
      { x: shape.x + shape.width + padding, y: shape.y - padding }, // TR
      { x: shape.x - padding, y: shape.y + shape.height + padding }, // BL
      { x: shape.x + shape.width + padding, y: shape.y + shape.height + padding }, // BR
    ];

    corners.forEach(corner => {
      ctx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
    });

    // Rotation Handle (Top Center)
    const rotateLineHeight = 24 / zoom;
    ctx.beginPath();
    ctx.moveTo(shape.x + shape.width / 2, shape.y - padding);
    ctx.lineTo(shape.x + shape.width / 2, shape.y - padding - rotateLineHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(shape.x + shape.width / 2, shape.y - padding - rotateLineHeight, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
