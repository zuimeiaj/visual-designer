
import { UIShape, TransformParams } from "./UIShape";
import { Shape } from "../types";
import * as AntIcons from "@ant-design/icons-svg";

export class IconShape extends UIShape {
  public iconName: string = 'HomeOutlined';

  constructor(data: Shape) {
    super(data);
    this.iconName = data.iconName || 'HomeOutlined';
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.iconName !== undefined) this.iconName = data.iconName;
  }

  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    // Enforce proportional scaling: width must equal height for icons
    if (updates.width !== undefined || updates.height !== undefined) {
      const size = Math.max(updates.width ?? this.width, updates.height ?? this.height);
      updates.width = size;
      updates.height = size;
    }
    return updates;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    // @ts-ignore - access by dynamic name
    const iconDef = AntIcons[this.iconName] || AntIcons.HomeOutlined;
    if (!iconDef || !iconDef.icon) return;

    ctx.save();
    
    // Ant Design icons are based on a 1024x1024 viewBox
    const scale = Math.min(this.width, this.height) / 1024;
    ctx.scale(scale, scale);
    
    // Function to render children of icon definition
    const renderNode = (node: any) => {
      if (node.tag === 'path') {
        const p = new Path2D(node.attrs.d);
        ctx.fillStyle = this.fill;
        ctx.fill(p);
        
        if (this.stroke !== 'none' && this.strokeWidth > 0) {
          ctx.strokeStyle = this.stroke;
          ctx.lineWidth = this.strokeWidth / scale;
          ctx.stroke(p);
        }
      }
      if (node.children) {
        node.children.forEach(renderNode);
      }
    };

    renderNode(iconDef.icon);
    
    ctx.restore();
  }
}

UIShape.register('icon', IconShape);
