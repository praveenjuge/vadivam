export const ICON_SIZE = 24;
export const COLUMN_STEP = 40;
export const ROW_STEP = 72;
export const COLUMNS_PER_ROW = 32;

export interface IconPosition {
  x: number;
  y: number;
}

export function getGridPositions(
  count: number,
  columns: number,
  origin: IconPosition,
): IconPosition[] {
  return Array.from({ length: count }, (_, index) => ({
    x: origin.x + (index % columns) * COLUMN_STEP,
    y: origin.y + Math.floor(index / columns) * ROW_STEP,
  }));
}

export function getBatchPositions(
  count: number,
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

  return getGridPositions(count, COLUMNS_PER_ROW, { x: startX, y: startY });
}
