
import { Shape } from "../types";

export abstract class UIShape {
  public id: string;
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

  constructor(data: Shape) {
    this.id = data.id;
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.height = data.height;
    this.rotation = data.rotation || 0;
    this.fill = data.fill;
    this.stroke = data.stroke;
    this.strokeWidth = data.strokeWidth;
    this.onCreated();
  }

  public onCreated(): void {}
  public onLayout(): void {}
  public onLayer(index: number): void {
    this.layer = index;
  }

  /**
   * Applies transformations and calls the concrete draw implementation.
   */
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

  /**
   * Hit test accounting for rotation by transforming point to local space.
   */
  public hitTest(px: number, py: number): boolean {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    
    // Translate point to origin relative to center
    const dx = px - cx;
    const dy = py - cy;
    
    // Rotate point inversely
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const lx = dx * cos - dy * sin + cx;
    const ly = dx * sin + dy * cos + cy;

    return lx >= this.x && lx <= this.x + this.width &&
           ly >= this.y && ly <= this.y + this.height;
  }

  public update(data: Partial<Shape>): void {
    Object.assign(this, data);
    this.onLayout();
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

export class CircleShape extends UIShape {
  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = this.fill;
    ctx.fill();
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }
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

  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.fill;
    ctx.font = `${this.fontSize}px Inter`;
    ctx.textBaseline = 'top';
    
    // Simple Multiline Wrapping
    const words = this.text.split(' ');
    let line = '';
    let y = this.y;
    const lineHeight = this.fontSize * 1.2;
    const maxWidth = this.width;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, this.x, y);
        line = words[n] + ' ';
        y += lineHeight;
        // Don't draw beyond height if we want strict clipping, 
        // but design tools usually allow overflow vertically or expand height.
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, this.x, y);
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.text !== undefined) this.text = data.text;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
  }
}

export class ImageShape extends UIShape {
  public src?: string;
  private img: HTMLImageElement | null = null;

  constructor(data: Shape) {
    super(data);
    this.src = data.src;
    this.load();
  }

  private load() {
    if (this.src) {
      this.img = new Image();
      this.img.src = this.src;
    }
  }

  public onDraw(ctx: CanvasRenderingContext2D): void {
    if (this.img?.complete) {
      ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.src !== undefined && data.src !== this.src) {
      this.src = data.src;
      this.load();
    }
  }
}
