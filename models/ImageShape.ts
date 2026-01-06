
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
      ctx.drawImage(this.img, 0, 0, this.width, this.height);
    } else {
      // Light background for the placeholder
      ctx.fillStyle = '#f8fafc'; // Slate 50
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Soft border
      ctx.strokeStyle = '#e2e8f0'; // Slate 200
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(0, 0, this.width, this.height);
      
      // Draw a simple image icon (mountain + sun)
      const iconSize = Math.min(this.width, this.height) * 0.3;
      const centerX = this.width / 2;
      const centerY = this.height / 2 - 5;
      
      ctx.save();
      ctx.translate(centerX - iconSize / 2, centerY - iconSize / 2);
      ctx.strokeStyle = '#94a3b8'; // Slate 400
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      // Icon Box
      ctx.strokeRect(0, 0, iconSize, iconSize);
      
      // Mountains
      ctx.beginPath();
      ctx.moveTo(2, iconSize - 2);
      ctx.lineTo(iconSize * 0.4, iconSize * 0.4);
      ctx.lineTo(iconSize * 0.6, iconSize * 0.7);
      ctx.lineTo(iconSize * 0.8, iconSize * 0.5);
      ctx.lineTo(iconSize - 2, iconSize - 2);
      ctx.stroke();
      
      // Sun
      ctx.beginPath();
      ctx.arc(iconSize * 0.7, iconSize * 0.3, iconSize * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      // Placeholder Text
      ctx.fillStyle = '#64748b'; // Slate 500
      ctx.font = `600 ${Math.max(8, 10)}px Inter`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Double-click to upload', this.width / 2, centerY + iconSize / 2 + 15);
    }
  }
}

UIShape.register('image', ImageShape);
