
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

  public hitTest(px: number, py: number): boolean {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx;
    const dy = py - cy;
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

  /**
   * Internal helper to calculate wrapped lines based on width and font.
   */
  private static getWrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
    ctx.font = `${fontSize}px Inter`;
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
      if (paragraph === '') {
        lines.push('');
        return;
      }
      const words = paragraph.split(' ');
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width <= maxWidth) {
          currentLine = testLine;
        } else {
          // If the word itself is too long for a single line, we break it character by character
          if (ctx.measureText(word).width > maxWidth) {
            if (currentLine) lines.push(currentLine);
            currentLine = '';

            let charLine = '';
            for (let j = 0; j < word.length; j++) {
              const testCharLine = charLine + word[j];
              if (ctx.measureText(testCharLine).width > maxWidth) {
                if (charLine) lines.push(charLine);
                charLine = word[j];
              } else {
                charLine = testCharLine;
              }
            }
            currentLine = charLine;
          } else {
            // Standard word wrap
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
      }
      lines.push(currentLine);
    });
    return lines;
  }

  public static measureHeight(text: string, width: number, fontSize: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return fontSize * 1.2;
    
    const lines = this.getWrappedLines(ctx, text, width, fontSize);
    return lines.length * fontSize * 1.2;
  }

  public onDraw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.fill;
    ctx.font = `${this.fontSize}px Inter`;
    ctx.textBaseline = 'top';
    
    const lines = TextShape.getWrappedLines(ctx, this.text, this.width, this.fontSize);
    const lineHeight = this.fontSize * 1.2;
    
    lines.forEach((line, index) => {
      ctx.fillText(line, this.x, this.y + index * lineHeight);
    });
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
