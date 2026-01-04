
import { UIShape, TransformParams } from "./UIShape";
import { Shape } from "../types";

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
    const paragraphs = this.text.split('\n');
    const lh = this.fontSize * 1.2;
    let currY = this.y;
    paragraphs.forEach(p => {
      const words = p.split('');
      let line = '';
      words.forEach(w => {
        const test = line + w;
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

UIShape.register('text', TextShape);
