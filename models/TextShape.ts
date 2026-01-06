
import { UIShape, TransformParams } from "./UIShape";
import { Shape, TextAlign } from "../types";

export class TextShape extends UIShape {
  public text: string = '';
  public fontSize: number = 16;
  public textAlign: TextAlign = 'left';
  
  constructor(data: Shape) {
    super(data);
    this.text = data.text || '';
    this.fontSize = data.fontSize || 16;
    this.textAlign = data.textAlign || 'left';
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.text !== undefined) this.text = data.text;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.textAlign !== undefined) this.textAlign = data.textAlign;
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
      const words = p.split('');
      let line = '';
      words.forEach(w => {
        const test = line + w;
        if (ctx.measureText(test).width > width) { lineCount++; line = w; }
        else line = test;
      });
      lineCount++;
    });
    return lineCount * fontSize * 1.2;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    if (isEditing) return;
    ctx.fillStyle = this.fill;
    ctx.font = `${this.fontSize}px Inter`;
    ctx.textBaseline = 'top';
    ctx.textAlign = this.textAlign;

    const paragraphs = this.text.split('\n');
    const lh = this.fontSize * 1.2;
    let currY = 0;

    paragraphs.forEach(p => {
      const words = p.split('');
      let line = '';
      words.forEach(w => {
        const test = line + w;
        if (ctx.measureText(test).width > this.width) {
          this.drawAlignedLine(ctx, line, currY);
          currY += lh; line = w;
        } else line = test;
      });
      this.drawAlignedLine(ctx, line, currY);
      currY += lh;
    });
  }

  private drawAlignedLine(ctx: CanvasRenderingContext2D, line: string, y: number) {
    let x = 0;
    if (this.textAlign === 'center') x = this.width / 2;
    if (this.textAlign === 'right') x = this.width;
    ctx.fillText(line, x, y);
  }
}

UIShape.register('text', TextShape);