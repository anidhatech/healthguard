/**
 * Averages over calendar windows, used for "average daily steps" and similar
 * metrics. A window needs a minimum number of days with data; otherwise the
 * result is null ("not enough data"), never a guess.
 */
export interface DailyPoint {
  /** `YYYY-MM-DD` */
  date: string;
  value: number;
}

export interface WindowAverage {
  from: string;
  to: string;
  windowDays: number;
  daysWithData: number;
  value: number | null;
}

/** Mean of points with `from <= date <= to` (inclusive, ISO date strings). */
export function averageOverWindow(
  points: readonly DailyPoint[],
  from: string,
  to: string,
  minDaysWithData: number,
): WindowAverage {
  const inWindow = points.filter((point) => point.date >= from && point.date <= to);
  const windowDays =
    Math.round(
      (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;
  const sum = inWindow.reduce((total, point) => total + point.value, 0);
  return {
    from,
    to,
    windowDays,
    daysWithData: inWindow.length,
    value: inWindow.length >= minDaysWithData ? Math.round(sum / inWindow.length) : null,
  };
}
