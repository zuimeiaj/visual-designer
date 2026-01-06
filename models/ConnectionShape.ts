
import { UIShape } from "./UIShape";
import { Shape, AnchorPort, CanvasState } from "../types";
import { Scene } from "./Scene";

export const PORT_OFFSET = 20; // 强制垂直段的长度
export const CORNER_RADIUS = 8;
export const OBSTACLE_MARGIN = 12; // 线条与形状的最小间距

interface Point { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; }

export class ConnectionShape extends UIShape {
  public fromId: string = '';
  public toId: string = '';
  public fromPort: AnchorPort = 'top';
  public toPort: AnchorPort = 'top';

  constructor(data: Shape) {
    super(data);
    this.fromId = data.fromId || '';
    this.toId = data.toId || '';
    this.fromPort = data.fromPort || 'top';
    this.toPort = data.toPort || 'top';
  }

  public static getPointWithOffset(shape: UIShape | Shape, port: AnchorPort, offset: number) {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    let lx = 0, ly = 0;
    switch (port) {
      case 'top': lx = 0; ly = -shape.height / 2 - offset; break;
      case 'right': lx = shape.width / 2 + offset; ly = 0; break;
      case 'bottom': lx = 0; ly = shape.height / 2 + offset; break;
      case 'left': lx = -shape.width / 2 - offset; ly = 0; break;
    }
    const cos = Math.cos(shape.rotation), sin = Math.sin(shape.rotation);
    return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
  }

  public drawWithScene(ctx: CanvasRenderingContext2D, scene: Scene, state: CanvasState) {
    const fromShape = scene.getShapes().find(s => s.id === this.fromId);
    const toShape = scene.getShapes().find(s => s.id === this.toId);
    if (!fromShape || !toShape) return;

    const zoom = state.zoom;
    // 获取起始点和强制正交偏移点
    const pStartEdge = ConnectionShape.getPointWithOffset(fromShape, this.fromPort, 0);
    const pStartOffset = ConnectionShape.getPointWithOffset(fromShape, this.fromPort, PORT_OFFSET / zoom);
    const pEndEdge = ConnectionShape.getPointWithOffset(toShape, this.toPort, 0);
    const pEndOffset = ConnectionShape.getPointWithOffset(toShape, this.toPort, PORT_OFFSET / zoom);

    // 获取画布上所有可能的障碍物
    const obstacles = scene.getShapes()
      .filter(s => s.type !== 'connection' && s.id !== this.id)
      .map(s => s.getAABB());

    // 计算从 startOffset 到 endOffset 的避障路径
    const innerPath = this.calculateSmartPath(pStartOffset, pEndOffset, obstacles, zoom);
    
    // 组合完整路径：边缘 -> 偏移点 -> 内部路径 -> 偏移点 -> 边缘
    // 这确保了线段的首尾两段始终是垂直于形状边缘的
    const points = this.simplifyPath([pStartEdge, pStartOffset, ...innerPath, pEndOffset, pEndEdge]);
    
    const isSelected = state.selectedIds.includes(this.id);
    ctx.save();
    
    // 绘制选中光晕
    if (isSelected) {
      ctx.beginPath();
      this.drawPathWithCorners(ctx, points, zoom);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.lineWidth = (this.strokeWidth || 2) + 10 / zoom;
      ctx.stroke();
    }

    // 绘制主线条
    ctx.beginPath();
    this.drawPathWithCorners(ctx, points, zoom);
    ctx.strokeStyle = isSelected ? '#4f46e5' : (this.stroke || '#94a3b8');
    ctx.lineWidth = isSelected ? (this.strokeWidth || 2) + 1 / zoom : (this.strokeWidth || 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 绘制终点箭头
    if (points.length >= 2) {
      const pLast = points[points.length - 1];
      const pPrev = points[points.length - 2];
      const angle = Math.atan2(pLast.y - pPrev.y, pLast.x - pPrev.x);
      ctx.beginPath();
      ctx.moveTo(pLast.x, pLast.y);
      const arrowSize = 10 / zoom;
      ctx.lineTo(pLast.x - arrowSize * Math.cos(angle - Math.PI/6), pLast.y - arrowSize * Math.sin(angle - Math.PI/6));
      ctx.lineTo(pLast.x - arrowSize * Math.cos(angle + Math.PI/6), pLast.y - arrowSize * Math.sin(angle + Math.PI/6));
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
    ctx.restore();
  }

  private calculateSmartPath(start: Point, end: Point, obstacles: Rect[], zoom: number): Point[] {
    const margin = OBSTACLE_MARGIN / zoom;
    
    // 1. 构建智能网格坐标
    // 为了保证正交，网格点必须包含起点和终点的横纵坐标，以及所有障碍物边缘扩展出的坐标
    const xCoords = new Set<number>([start.x, end.x]);
    const yCoords = new Set<number>([start.y, end.y]);
    
    obstacles.forEach(obs => {
      // 在障碍物四周增加间隙
      xCoords.add(obs.x - margin);
      xCoords.add(obs.x + obs.w + margin);
      yCoords.add(obs.y - margin);
      yCoords.add(obs.y + obs.h + margin);
      // 同时考虑中间对齐线
      xCoords.add(obs.x + obs.w / 2);
      yCoords.add(obs.y + obs.h / 2);
    });

    const sortedX = Array.from(xCoords).sort((a, b) => a - b);
    const sortedY = Array.from(yCoords).sort((a, b) => a - b);

    // 2. A* 搜索算法
    type Direction = 'h' | 'v' | null;
    interface Node { point: Point; path: Point[]; cost: number; dir: Direction; }
    
    const queue: Node[] = [{ point: start, path: [start], cost: 0, dir: null }];
    const visited = new Map<string, number>();
    
    let iterations = 0;
    const MAX_ITER = 1200;

    while (queue.length > 0 && iterations++ < MAX_ITER) {
      // 曼哈顿启发式排序
      queue.sort((a, b) => {
        const hA = Math.abs(a.point.x - end.x) + Math.abs(a.point.y - end.y);
        const hB = Math.abs(b.point.x - end.x) + Math.abs(b.point.y - end.y);
        return (a.cost + hA) - (b.cost + hB);
      });

      const { point, path, cost, dir } = queue.shift()!;
      
      const key = `${Math.round(point.x)},${Math.round(point.y)},${dir}`;
      if (visited.has(key) && visited.get(key)! <= cost) continue;
      visited.set(key, cost);

      // 到达目标
      if (Math.abs(point.x - end.x) < 1 && Math.abs(point.y - end.y) < 1) return path;

      const xIdx = sortedX.indexOf(point.x);
      const yIdx = sortedY.indexOf(point.y);

      // 寻找四个方向的相邻网格点
      const neighbors: { p: Point; d: Direction }[] = [];
      if (xIdx > 0) neighbors.push({ p: { x: sortedX[xIdx - 1], y: point.y }, d: 'h' });
      if (xIdx < sortedX.length - 1) neighbors.push({ p: { x: sortedX[xIdx + 1], y: point.y }, d: 'h' });
      if (yIdx > 0) neighbors.push({ p: { x: point.x, y: sortedY[yIdx - 1] }, d: 'v' });
      if (yIdx < sortedY.length - 1) neighbors.push({ p: { x: point.x, y: sortedY[yIdx + 1] }, d: 'v' });

      for (const next of neighbors) {
        if (!this.isSegmentBlocked(point, next.p, obstacles, margin)) {
          const moveDist = Math.abs(next.p.x - point.x) + Math.abs(next.p.y - point.y);
          // 代价计算：距离 + 转弯惩罚（转弯成本很高，以促使算法走直线）
          const turnPenalty = (dir !== null && dir !== next.d) ? 500 : 0;
          const nextCost = cost + moveDist + turnPenalty;
          
          queue.push({ point: next.p, path: [...path, next.p], cost: nextCost, dir: next.d });
        }
      }
    }
    
    // 如果没有找到路径，返回保底路径（折线）
    return [start, { x: start.x, y: end.y }, end];
  }

  private isSegmentBlocked(p1: Point, p2: Point, obstacles: Rect[], margin: number) {
    const x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
    const y1 = Math.min(p1.y, p2.y), y2 = Math.max(p1.y, p2.y);
    
    return obstacles.some(obs => {
      // 检查矩形区域是否与障碍物（考虑 margin）重叠
      const obsX1 = obs.x - margin + 0.5;
      const obsX2 = obs.x + obs.w + margin - 0.5;
      const obsY1 = obs.y - margin + 0.5;
      const obsY2 = obs.y + obs.h + margin - 0.5;

      if (Math.abs(p1.x - p2.x) < 0.1) { // 垂直线段
        if (p1.x > obsX1 && p1.x < obsX2) {
          return !(y2 <= obsY1 || y1 >= obsY2);
        }
      } else if (Math.abs(p1.y - p2.y) < 0.1) { // 水平线段
        if (p1.y > obsY1 && p1.y < obsY2) {
          return !(x2 <= obsX1 || x1 >= obsX2);
        }
      }
      return false;
    });
  }

  private simplifyPath(points: Point[]): Point[] {
    if (points.length <= 2) return points;
    const result: Point[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];
      const next = points[i + 1];

      // 移除非常靠近的点
      const distToPrev = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
      if (distToPrev < 0.1) continue;

      // 移除共线点（保持正交路径）
      const d1x = curr.x - prev.x, d1y = curr.y - prev.y;
      const d2x = next.x - curr.x, d2y = next.y - curr.y;
      
      // 使用叉积判断共线，使用点积判断方向
      const crossProduct = d1x * d2y - d1y * d2x;
      const isCollinear = Math.abs(crossProduct) < 0.1;
      const dotProduct = d1x * d2x + d1y * d2y;
      const isSameDirection = dotProduct > 0;

      if (!(isCollinear && isSameDirection)) {
        result.push(curr);
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  private drawPathWithCorners(ctx: CanvasRenderingContext2D, points: Point[], zoom: number) {
    if (points.length < 2) return;
    const defaultRadius = CORNER_RADIUS / zoom;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1], curr = points[i], next = points[i + 1];
      const d1 = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
      const d2 = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);
      
      const radius = Math.min(defaultRadius, d1 / 2.1, d2 / 2.1);
      if (radius > 0.5) {
        ctx.arcTo(curr.x, curr.y, next.x, next.y, radius);
      } else {
        ctx.lineTo(curr.x, curr.y);
      }
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }

  public static getPathPoints(scene: Scene, conn: Shape, zoom: number) {
    const from = scene.getShapes().find(s => s.id === conn.fromId), to = scene.getShapes().find(s => s.id === conn.toId);
    if (!from || !to) return [];
    
    const pStartEdge = ConnectionShape.getPointWithOffset(from, conn.fromPort || 'top', 0);
    const pStartOffset = ConnectionShape.getPointWithOffset(from, conn.fromPort || 'top', PORT_OFFSET / zoom);
    const pEndEdge = ConnectionShape.getPointWithOffset(to, conn.toPort || 'top', 0);
    const pEndOffset = ConnectionShape.getPointWithOffset(to, conn.toPort || 'top', PORT_OFFSET / zoom);
    
    const obstacles = scene.getShapes()
      .filter(s => s.type !== 'connection' && s.id !== conn.id)
      .map(s => s.getAABB());
      
    const inst = new ConnectionShape(conn);
    return inst.simplifyPath([
      pStartEdge, 
      pStartOffset, 
      ...inst.calculateSmartPath(pStartOffset, pEndOffset, obstacles, zoom), 
      pEndOffset, 
      pEndEdge
    ]);
  }

  public draw(ctx: CanvasRenderingContext2D, zoom: number): void {}
  public onDraw(ctx: CanvasRenderingContext2D, zoom: number): void {}
  public hitTest(px: number, py: number): boolean { return false; }
}
UIShape.register('connection', ConnectionShape);
