
import { UIShape, TransformParams } from "./UIShape";
import { Shape, TableData, TableMerge } from "../types";

export class TableShape extends UIShape {
  public tableData: TableData;
  public fontSize?: number;

  constructor(data: Shape) {
    super(data);
    this.fontSize = data.fontSize;
    this.tableData = data.tableData || {
      rows: [30, 30, 30, 30, 30],
      cols: [80, 80, 80, 80, 80],
      cells: {},
      merges: []
    };
  }

  public transform(params: TransformParams): Partial<Shape> {
    const updates = super.transform(params);
    const sx = params.scaleX ?? (params.width !== undefined ? params.width / this.width : 1);
    const sy = params.scaleY ?? (params.height !== undefined ? params.height / this.height : 1);

    if (sx !== 1 || sy !== 1) {
      const newTableData: TableData = {
        ...this.tableData,
        rows: this.tableData.rows.map(h => h * sy),
        cols: this.tableData.cols.map(w => w * sx),
      };
      updates.tableData = newTableData;
      if (this.fontSize) {
        updates.fontSize = this.fontSize * Math.sqrt(sx * sy);
      }
    }
    return updates;
  }

  public update(data: Partial<Shape>): void {
    super.update(data);
    if (data.tableData) {
      this.tableData = data.tableData;
      this.width = this.tableData.cols.reduce((a, b) => a + b, 0);
      this.height = this.tableData.rows.reduce((a, b) => a + b, 0);
    }
    if (data.fontSize !== undefined) {
      this.fontSize = data.fontSize;
    }
  }

  private getMergeAt(r: number, c: number): TableMerge | null {
    if (!this.tableData.merges) return null;
    return this.tableData.merges.find(m => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) || null;
  }

  public onDraw(ctx: CanvasRenderingContext2D): void {
    const { rows, cols, cells } = this.tableData;
    const x = this.x;
    const y = this.y;

    // 1. Draw backgrounds
    ctx.save();
    let currentY = y;
    for (let r = 0; r < rows.length; r++) {
      let currentX = x;
      for (let c = 0; c < cols.length; c++) {
        const cell = cells[`${r},${c}`];
        const merge = this.getMergeAt(r, c);
        
        if (merge) {
          if (r === merge.r1 && c === merge.c1) {
            const mw = cols.slice(merge.c1, merge.c2 + 1).reduce((a, b) => a + b, 0);
            const mh = rows.slice(merge.r1, merge.r2 + 1).reduce((a, b) => a + b, 0);
            if (cell?.fill) {
              ctx.fillStyle = cell.fill;
              ctx.fillRect(currentX, currentY, mw, mh);
            }
          }
        } else if (cell?.fill) {
          ctx.fillStyle = cell.fill;
          ctx.fillRect(currentX, currentY, cols[c], rows[r]);
        }
        currentX += cols[c];
      }
      currentY += rows[r];
    }
    ctx.restore();

    // 2. Draw grid lines intelligently skipping inner merge lines
    ctx.save();
    ctx.strokeStyle = this.stroke || '#3f3f46';
    ctx.lineWidth = this.strokeWidth || 1;
    ctx.beginPath();

    // Horizontal segments
    let ty = y;
    for (let r = 0; r <= rows.length; r++) {
      let tx = x;
      for (let c = 0; c < cols.length; c++) {
        const cw = cols[c];
        if (r === 0 || r === rows.length) {
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + cw, ty);
        } else {
          const mAbove = this.getMergeAt(r - 1, c);
          const mBelow = this.getMergeAt(r, c);
          if (!mAbove || !mBelow || mAbove !== mBelow) {
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + cw, ty);
          }
        }
        tx += cw;
      }
      if (r < rows.length) ty += rows[r];
    }

    // Vertical segments
    let tx = x;
    for (let c = 0; c <= cols.length; c++) {
      let ty = y;
      for (let r = 0; r < rows.length; r++) {
        const rh = rows[r];
        if (c === 0 || c === cols.length) {
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx, ty + rh);
        } else {
          const mLeft = this.getMergeAt(r, c - 1);
          const mRight = this.getMergeAt(r, c);
          if (!mLeft || !mRight || mLeft !== mRight) {
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx, ty + rh);
          }
        }
        ty += rh;
      }
      if (c < cols.length) tx += cols[c];
    }
    ctx.stroke();
    ctx.restore();

    // 3. Draw content
    ctx.save();
    ctx.fillStyle = this.fill || '#ffffff';
    ctx.font = `${this.fontSize || 12}px Inter`;
    ctx.textBaseline = 'middle';
    
    currentY = y;
    for (let r = 0; r < rows.length; r++) {
      let currentX = x;
      for (let c = 0; c < cols.length; c++) {
        const merge = this.getMergeAt(r, c);
        const cell = cells[`${r},${c}`];
        
        if (cell?.text && (!merge || (r === merge.r1 && c === merge.c1))) {
           const cw = merge 
             ? cols.slice(merge.c1, merge.c2 + 1).reduce((a, b) => a + b, 0)
             : cols[c];
           const ch = merge
             ? rows.slice(merge.r1, merge.r2 + 1).reduce((a, b) => a + b, 0)
             : rows[r];
           
           ctx.save();
           ctx.beginPath();
           ctx.rect(currentX + 2, currentY + 2, cw - 4, ch - 4);
           ctx.clip();

           const align = cell.align || 'center';
           let tx = currentX + cw / 2;
           if (align === 'left') { tx = currentX + 5; ctx.textAlign = 'left'; }
           else if (align === 'right') { tx = currentX + cw - 5; ctx.textAlign = 'right'; }
           else { ctx.textAlign = 'center'; }

           ctx.fillText(cell.text, tx, currentY + ch / 2);
           ctx.restore();
        }
        currentX += cols[c];
      }
      currentY += rows[r];
    }
    ctx.restore();
  }

  public getCellAt(px: number, py: number): { r: number, c: number, x: number, y: number, w: number, h: number } | null {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx, dy = py - cy;
    const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    const lx = dx * cos - dy * sin + this.width / 2;
    const ly = dx * sin + dy * cos + this.height / 2;

    if (lx < 0 || lx > this.width || ly < 0 || ly > this.height) return null;

    let currentY = 0;
    for (let r = 0; r < this.tableData.rows.length; r++) {
      let currentX = 0;
      const rh = this.tableData.rows[r];
      if (ly >= currentY && ly <= currentY + rh) {
        for (let c = 0; c < this.tableData.cols.length; c++) {
          const cw = this.tableData.cols[c];
          if (lx >= currentX && lx <= currentX + cw) {
            const merge = this.getMergeAt(r, c);
            if (merge) {
              const startX = this.x + this.tableData.cols.slice(0, merge.c1).reduce((a, b) => a + b, 0);
              const startY = this.y + this.tableData.rows.slice(0, merge.r1).reduce((a, b) => a + b, 0);
              const mw = this.tableData.cols.slice(merge.c1, merge.c2 + 1).reduce((a, b) => a + b, 0);
              const mh = this.tableData.rows.slice(merge.r1, merge.r2 + 1).reduce((a, b) => a + b, 0);
              return { r: merge.r1, c: merge.c1, x: startX, y: startY, w: mw, h: mh };
            }
            return { r, c, x: currentX + this.x, y: currentY + this.y, w: cw, h: rh };
          }
          currentX += cw;
        }
      }
      currentY += rh;
    }
    return null;
  }
}

UIShape.register('table', TableShape);
