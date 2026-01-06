
import { UIShape, TransformParams } from "./UIShape";
import { Shape, TableData, InternalHit } from "../types";
import { RectShape } from "./RectShape";

export class TableShape extends UIShape {
  public tableData: TableData;
  public fontSize: number = 14;
  public textColor?: string;
  public activeCell: { r: number, c: number } | null = null;
  private cellRenderers: Map<string, RectShape> = new Map();

  constructor(data: Shape) {
    super(data);
    this.fontSize = data.fontSize || 14;
    this.textColor = data.textColor;
    this.tableData = data.tableData || {
      rows: [30, 30, 30],
      cols: [100, 100, 100],
      cells: {},
      merges: []
    };
    this.syncCellRenderers();
  }

  private syncCellRenderers() {
    const { rows, cols } = this.tableData;
    const currentKeys = new Set<string>();
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const key = `${r},${c}`;
        currentKeys.add(key);
        if (!this.cellRenderers.has(key)) {
          const renderer = new RectShape({
            id: `${this.id}-cell-${key}`,
            type: 'rect',
            x: 0, y: 0, width: 0, height: 0, rotation: 0,
            fill: 'transparent',
            stroke: 'none',
            strokeWidth: 0
          });
          renderer.hideControls = true;
          this.cellRenderers.set(key, renderer);
        }
      }
    }
    for (const key of this.cellRenderers.keys()) {
      if (!currentKeys.has(key)) this.cellRenderers.delete(key);
    }
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
    }
    return updates;
  }

  public update(data: Partial<Shape>): void {
    const oldRowCount = this.tableData.rows.length;
    const oldColCount = this.tableData.cols.length;
    super.update(data);
    if (data.tableData) {
      this.tableData = data.tableData;
      this.width = this.tableData.cols.reduce((a, b) => a + b, 0);
      this.height = this.tableData.rows.reduce((a, b) => a + b, 0);
      if (oldRowCount !== this.tableData.rows.length || oldColCount !== this.tableData.cols.length) {
        this.syncCellRenderers();
      }
    }
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.textColor !== undefined) this.textColor = data.textColor;
  }

  public onDraw(ctx: CanvasRenderingContext2D, zoom: number, isEditing: boolean): void {
    const { rows, cols, cells } = this.tableData;

    if (this.fill && this.fill !== 'transparent') {
      ctx.fillStyle = this.fill;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    let currentY = 0;
    for (let r = 0; r < rows.length; r++) {
      let currentX = 0;
      for (let c = 0; c < cols.length; c++) {
        const cellKey = `${r},${c}`;
        const cellData = cells[cellKey];
        const renderer = this.cellRenderers.get(cellKey);

        if (renderer) {
          const isCellBeingEdited = this.activeCell && this.activeCell.r === r && this.activeCell.c === c;
          // Note: renderer.x/y are relative to parent (TableShape origin)
          renderer.update({
            x: currentX, y: currentY, width: cols[c], height: rows[r],
            fill: cellData?.fill || 'transparent',
            text: cellData?.text || '',
            fontSize: cellData?.fontSize || this.fontSize,
            textColor: cellData?.textColor || this.textColor || '#1f2937',
            textAlign: cellData?.align || 'center'
          });
          renderer.draw(ctx, zoom, !!isCellBeingEdited);
        }
        currentX += cols[c];
      }
      currentY += rows[r];
    }

    ctx.beginPath();
    ctx.strokeStyle = (this.stroke && this.stroke !== 'none') ? this.stroke : '#000000';
    ctx.lineWidth = 1 / zoom;

    let ty = 0;
    for (let i = 0; i <= rows.length; i++) {
      ctx.moveTo(0, ty);
      ctx.lineTo(this.width, ty);
      if (i < rows.length) ty += rows[i];
    }
    let tx = 0;
    for (let j = 0; j <= cols.length; j++) {
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx, this.height);
      if (j < cols.length) tx += cols[j];
    }
    ctx.stroke();

    if (this.stroke !== 'none' && this.stroke !== 'transparent') {
      ctx.strokeStyle = this.stroke || '#000000';
      ctx.lineWidth = this.strokeWidth || 1;
      ctx.strokeRect(0, 0, this.width, this.height);
    }
  }

  public getInternalHit(px: number, py: number): InternalHit | null {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = px - cx, dy = py - cy;
    const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    const lx = dx * cos - dy * sin + this.width / 2;
    const ly = dx * sin + dy * cos + this.height / 2;
    const hitTolerance = 6;
    if (lx < -hitTolerance || lx > this.width + hitTolerance || ly < -hitTolerance || ly > this.height + hitTolerance) return null;
    let currentX = 0;
    for (let c = 0; c < this.tableData.cols.length; c++) {
      currentX += this.tableData.cols[c];
      if (Math.abs(lx - currentX) < hitTolerance) {
        return { type: 'col-resize', id: this.id, metadata: { index: c } };
      }
    }
    let currentY = 0;
    for (let r = 0; r < this.tableData.rows.length; r++) {
      currentY += this.tableData.rows[r];
      if (Math.abs(ly - currentY) < hitTolerance) {
        return { type: 'row-resize', id: this.id, metadata: { index: r } };
      }
    }
    let cellY = 0;
    for (let r = 0; r < this.tableData.rows.length; r++) {
      let cellX = 0;
      const rh = this.tableData.rows[r];
      if (ly >= cellY && ly <= cellY + rh) {
        for (let c = 0; c < this.tableData.cols.length; c++) {
          const cw = this.tableData.cols[c];
          if (lx >= cellX && lx <= cellX + cw) {
            return { type: 'cell', id: this.id, metadata: { r, c } };
          }
          cellX += cw;
        }
      }
      cellY += rh;
    }
    return { type: 'shape', id: this.id };
  }
}
UIShape.register('table', TableShape);