
import { UIShape } from "./UIShape";
import { Shape, TextAlign } from "../types";

export class RectShape extends UIShape {
  public text?: string;
  public fontSize?: number;
  public textColor?: string;
  public textAlign: TextAlign = 'center';
  public cornerRadius: number = 0;
  public hideControls: boolean = false; 

  constructor(data: Shape) {
    super(data);
    this.text = data.text;
    this.fontSize = data.fontSize || 14;
    this.textColor = data.textColor;
    this.textAlign = data.textAlign || 'center';
    this.cornerRadius = data.cornerRadius || 0;
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.text !== undefined) this.text = data.text;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.textColor !== undefined) this.textColor = data.textColor;
    if (data.textAlign !== undefined) this.textAlign = data.textAlign;
    if (data.cornerRadius !== undefined) this.cornerRadius = data.cornerRadius;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    ctx.beginPath();
    const r = Math.min(this.cornerRadius, this.width / 2, this.height / 2);
    if (r > 0) {
      if (ctx.roundRect) {
        // @ts-ignore
        ctx.roundRect(0, 0, this.width, this.height, r);
      } else {
        ctx.moveTo(r, 0);
        ctx.arcTo(this.width, 0, this.width, this.height, r);
        ctx.arcTo(this.width, this.height, 0, this.height, r);
        ctx.arcTo(0, this.height, 0, 0, r);
        ctx.arcTo(0, 0, this.width, 0, r);
        ctx.closePath();
      }
    } else {
      ctx.rect(0, 0, this.width, this.height);
    }
    
    ctx.fillStyle = this.fill;
    ctx.fill();
    
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }

    if (this.text && !isEditing) {
      ctx.save();
      ctx.fillStyle = this.textColor || (this.fill === '#18181b' || this.fill === '#4f46e5' ? '#ffffff' : (this.stroke !== 'none' ? this.stroke : '#000000'));
      ctx.font = `${this.fontSize}px Inter`;
      ctx.textAlign = this.textAlign;
      ctx.textBaseline = 'middle';
      
      const padding = 10 + r;
      const lines = this.wrapText(ctx, this.text, this.width - padding * 2);
      const lineHeight = (this.fontSize || 14) * 1.2;
      const totalHeight = lines.length * lineHeight;
      let startY = this.height / 2 - (totalHeight / 2) + (lineHeight / 2);

      lines.forEach(line => {
        let drawX = this.width / 2;
        if (this.textAlign === 'left') drawX = padding;
        if (this.textAlign === 'right') drawX = this.width - padding;
        ctx.fillText(line, drawX, startY);
        startY += lineHeight;
      });
      ctx.restore();
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');
    paragraphs.forEach(p => {
      const words = p.split(''); 
      let currentLine = '';
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i];
        if (ctx.measureText(testLine).width > maxWidth && i > 0) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
    });
    return lines;
  }
}

UIShape.register('rect', RectShape);
