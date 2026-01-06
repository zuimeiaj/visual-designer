
import { UIShape, TransformParams } from "./UIShape";
import { Shape, TextAlign } from "../types";

export class CircleShape extends UIShape {
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

  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    if (updates.width !== undefined || updates.height !== undefined) {
      const size = Math.max(updates.width ?? this.width, updates.height ?? this.height);
      updates.width = size; updates.height = size;
    }
    return updates;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const radius = Math.min(this.width, this.height) / 2;

    // 绘制圆形背景
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.fill;
    ctx.fill();

    // 绘制描边
    if (this.stroke !== 'none') {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }

    // 绘制文本（非编辑状态）
    if (this.text && !isEditing) {
      ctx.save();
      // 如果没有指定颜色，则根据背景色自动选择黑或白
      ctx.fillStyle = this.textColor || (this.fill === '#18181b' || this.fill === '#4f46e5' ? '#ffffff' : '#000000');
      ctx.font = `${this.fontSize}px Inter`;
      ctx.textAlign = this.textAlign;
      ctx.textBaseline = 'middle';
      
      // 圆内文本区域限制（取正方形区域的 70%）
      const maxWidth = this.width * 0.7;
      const lines = this.wrapText(ctx, this.text, maxWidth);
      const lineHeight = (this.fontSize || 14) * 1.2;
      const totalHeight = lines.length * lineHeight;
      let startY = cy - (totalHeight / 2) + (lineHeight / 2);

      lines.forEach(line => {
        let drawX = cx;
        if (this.textAlign === 'left') drawX = cx - maxWidth / 2;
        if (this.textAlign === 'right') drawX = cx + maxWidth / 2;
        
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

UIShape.register('circle', CircleShape);
