// The source file's grid: one icon frame every 40 px across and 72 px down.
export const COLUMN_STEP = 40;
export const ROW_STEP = 72;
// The published component set keeps a fixed width; Arrange columns are a per-user setting.
export const LIBRARY_COLUMNS = 40;

export interface IconPosition {
  x: number;
  y: number;
}

export function getGridPositions(count: number, columns: number, origin: IconPosition): IconPosition[] {
  return Array.from({ length: count }, (_, index) => ({
    x: origin.x + (index % columns) * COLUMN_STEP,
    y: origin.y + Math.floor(index / columns) * ROW_STEP,
  }));
}

// A batch starts one row below the lowest icon, or at the viewport in an empty file.
export function getBatchPositions(
  count: number,
  columns: number,
  existing: readonly IconPosition[],
  viewportCenter: IconPosition,
): IconPosition[] {
  const startX =
    existing.length > 0
      ? Math.min(...existing.map((position) => position.x))
      : Math.round(viewportCenter.x / COLUMN_STEP) * COLUMN_STEP;
  const startY =
    existing.length > 0
      ? Math.max(...existing.map((position) => position.y)) + ROW_STEP
      : Math.round(viewportCenter.y / ROW_STEP) * ROW_STEP;
  return getGridPositions(count, columns, { x: startX, y: startY });
}
