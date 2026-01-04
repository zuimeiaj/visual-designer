
import { UIShape } from "./UIShape";
import { Shape } from "../types";

export class ImageShape extends UIShape {
  private img: HTMLImageElement | null = null;
  
  constructor(data: Shape) {
    super(data);
    if (data.src) {
      this.img = new Image();
      this.img.src = data.src;
    }
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.src !== undefined) {
      if (!this.img) this.img = new Image();
      this.img.src = data.src;
    }
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    if (this.img && this.img.src && this.img.complete && this.img.naturalWidth > 0) {
      ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      
      ctx.fillStyle = '#71717a';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Double-click to upload', this.x + this.width / 2, this.y + this.height / 2);
    }
  }
}

UIShape.register('image', ImageShape);
