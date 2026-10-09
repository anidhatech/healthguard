'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate, formatNumber } from '@/lib/utils';

export interface TrendPoint {
  date: string;
  value: number;
}

/** A simple, accessible line chart; the data is also available as a table on the page. */
export function TrendChart({
  points,
  unit,
  label,
  referenceHigh,
  average,
  locale = 'en-IN',
  digits = 1,
}: {
  points: TrendPoint[];
  unit: string;
  label: string;
  referenceHigh?: number | null;
  average?: number | null;
  locale?: string;
  digits?: number;
}) {
  return (
    <figure className="w-full">
      <div className="h-56 w-full" role="img" aria-label={`${label}: ${points.length} values`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#dfe5ea" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatDate(value, locale).replace(/ \d{4}$/, '')}
              fontSize={11}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              fontSize={11}
              width={48}
              tickFormatter={(value: number) => formatNumber(value, digits)}
            />
            <Tooltip
              formatter={(value) => [`${formatNumber(Number(value), digits)} ${unit}`, label]}
              labelFormatter={(value) =>
                typeof value === 'string' ? formatDate(value, locale) : ''
              }
            />
            {referenceHigh !== null && referenceHigh !== undefined ? (
              <ReferenceLine y={referenceHigh} stroke="#a35b00" strokeDasharray="4 4" />
            ) : null}
            {average !== null && average !== undefined ? (
              <ReferenceLine y={average} stroke="#1e66b4" strokeDasharray="2 4" />
            ) : null}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0d5c63"
              strokeWidth={2}
              dot={points.length < 40}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
