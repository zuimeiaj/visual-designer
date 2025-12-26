
import { Shape, ShapeType } from "../types";

export interface TransformParams {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

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
    
    const padding = (this.type === 'line' || this.type === 'path') ? 10 : 0;
    return lx >= this.x - padding && lx <= this.x + this.width + padding && 
           ly >= this.y - padding && ly <= this.y + this.height + padding;
  }

  public update(data: Partial<Shape>): void {
    Object.assign(this, data);
  }

  public static create(data: Shape): UIShape {
    switch (data.type) {
      case 'rect': return new RectShape(data);
      case 'circle': return new CircleShape(data);
      case 'text': return new TextShape(data);
      case 'image': return new ImageShape(data);
      case 'group': return new GroupShape(data);
      case 'line': return new LineShape(data);
      case 'path': return new PathShape(data);
      default: return new RectShape(data);
    }
  }
}

export class RectShape extends UIShape {
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.fill;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
  }
}

export class LineShape extends UIShape {
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + this.height / 2);
    ctx.lineTo(this.x + this.width, this.y + this.height / 2);
    ctx.strokeStyle = this.stroke === 'none' ? this.fill : this.stroke;
    ctx.lineWidth = this.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export class PathShape extends UIShape {
  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    if (this.points && (params.scaleX !== undefined || params.scaleY !== undefined)) {
      const sx = params.scaleX ?? (params.width !== undefined ? params.width / this.width : 1);
      const sy = params.scaleY ?? (params.height !== undefined ? params.height / this.height : 1);
      updates.points = this.points.map(p => ({ x: p.x * sx, y: p.y * sy }));
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

export class CircleShape extends UIShape {
  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    if (updates.width !== undefined || updates.height !== undefined) {
      const size = Math.max(updates.width ?? this.width, updates.height ?? this.height);
      updates.width = size; updates.height = size;
    }
    return updates;
  }
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height / 2, Math.min(this.width, this.height) / 2, 0, Math.PI * 2);
    ctx.fillStyle = this.fill; ctx.fill();
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke; ctx.lineWidth = this.strokeWidth; ctx.stroke();
    }
  }
}

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

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number): void {
    // Group does not draw itself content, it manages children.
    this.children.forEach(child => child.draw(ctx, zoom));
  }

  public hitTest(px: number, py: number): boolean {
    // Need to test hit in rotated coordinate system
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx, dy = py - cy;
    const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    const lx = dx * cos - dy * sin + cx;
    const ly = dx * sin + dy * cos + cy;
    
    return this.children.some(child => child.hitTest(lx, ly));
  }
}

export class TextShape extends UIShape {
  public text: string = '';
  public fontSize: number = 16;
  constructor(data: Shape) {
    super(data);
    this.text = data.text || '';
    this.fontSize = data.fontSize || 16;
  }

  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    if (updates.width !== undefined) {
      updates.height = TextShape.measureHeight(this.text, updates.width, this.fontSize);
    }
    return updates;
  }

  public static measureHeight(text: string, width: number, fontSize: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return fontSize * 1.2;
    ctx.font = `${fontSize}px Inter`;
    const paragraphs = text.split('\n');
    let lineCount = 0;
    paragraphs.forEach(p => {
      if (!p) { lineCount++; return; }
      const words = p.split(' ');
      let line = '';
      words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > width) { lineCount++; line = w; }
        else line = test;
      });
      lineCount++;
    });
    return lineCount * fontSize * 1.2;
  }
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.fill;
    ctx.font = `${this.fontSize}px Inter`;
    ctx.textBaseline = 'top';
    const paragraphs = this.text.split('\n');
    const lh = this.fontSize * 1.2;
    let currY = this.y;
    paragraphs.forEach(p => {
      const words = p.split(' ');
      let line = '';
      words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > this.width) {
          ctx.fillText(line, this.x, currY);
          currY += lh; line = w;
        } else line = test;
      });
      ctx.fillText(line, this.x, currY);
      currY += lh;
    });
  }
}

export class ImageShape extends UIShape {
  private img: HTMLImageElement | null = null;
  constructor(data: Shape) {
    super(data);
    if (data.src) { this.img = new Image(); this.img.src = data.src; }
  }
  public onDraw(ctx: CanvasRenderingContext2D): void {
    if (this.img?.complete) ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    else { ctx.fillStyle = '#18181b'; ctx.fillRect(this.x, this.y, this.width, this.height); }
  }
}
