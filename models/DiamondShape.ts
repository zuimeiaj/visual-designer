
import { UIShape } from "./UIShape";
import { Shape } from "../types";

export class DiamondShape extends UIShape {
  public text?: string;
  public fontSize?: number;
  public textColor?: string;

  constructor(data: Shape) {
    super(data);
    this.text = data.text;
    this.fontSize = data.fontSize || 14;
    this.textColor = data.textColor;
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.text !== undefined) this.text = data.text;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.textColor !== undefined) this.textColor = data.textColor;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    ctx.beginPath();
    ctx.moveTo(cx, this.y);
    ctx.lineTo(this.x + this.width, cy);
    ctx.lineTo(cx, this.y + this.height);
    ctx.lineTo(this.x, cy);
    ctx.closePath();

    ctx.fillStyle = this.fill;
    ctx.fill();

    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }

    // 绘制文本 (编辑时不显示，由 TextEditPlugin 的 overlay 处理)
    if (this.text && !isEditing) {
      ctx.save();
      ctx.fillStyle = this.textColor || '#ffffff'; 
      ctx.font = `${this.fontSize}px Inter`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const lines = this.wrapText(ctx, this.text, this.width * 0.6);
      const lineHeight = (this.fontSize || 14) * 1.2;
      const totalHeight = lines.length * lineHeight;
      let startY = cy - (totalHeight / 2) + (lineHeight / 2);

      lines.forEach(line => {
        ctx.fillText(line, cx, startY);
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

  public hitTest(px: number, py: number): boolean {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx;
    const dy = py - cy;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const lx = Math.abs(dx * cos - dy * sin);
    const ly = Math.abs(dx * sin + dy * cos);
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    if (halfW === 0 || halfH === 0) return false;
    return (lx / halfW) + (ly / halfH) <= 1;
  }
}

UIShape.register('diamond', DiamondShape);
