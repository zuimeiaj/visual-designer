
import { UIShape } from "./UIShape";
import { Shape, TextAlign } from "../types";

export class RectShape extends UIShape {
  public text?: string;
  public fontSize?: number;
  public textColor?: string;
  public textAlign: TextAlign = 'center';

  constructor(data: Shape) {
    super(data);
    this.text = data.text;
    this.fontSize = data.fontSize || 14;
    this.textColor = data.textColor;
    this.textAlign = data.textAlign || 'center';
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.text !== undefined) this.text = data.text;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.textColor !== undefined) this.textColor = data.textColor;
    if (data.textAlign !== undefined) this.textAlign = data.textAlign;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    ctx.fillStyle = this.fill;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    if (this.text && !isEditing) {
      ctx.save();
      ctx.fillStyle = this.textColor || (this.fill === '#18181b' || this.fill === '#4f46e5' ? '#ffffff' : (this.stroke !== 'none' ? this.stroke : '#000000'));
      ctx.font = `${this.fontSize}px Inter`;
      ctx.textAlign = this.textAlign;
      ctx.textBaseline = 'middle';
      
      const lines = this.wrapText(ctx, this.text, this.width - 10);
      const lineHeight = (this.fontSize || 14) * 1.2;
      const totalHeight = lines.length * lineHeight;
      let startY = this.y + this.height / 2 - (totalHeight / 2) + (lineHeight / 2);

      lines.forEach(line => {
        let drawX = this.x + this.width / 2;
        if (this.textAlign === 'left') drawX = this.x + 10;
        if (this.textAlign === 'right') drawX = this.x + this.width - 10;
        
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
