'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = ['#2654a8', '#c41e3a', '#5589d4', '#1e4289', '#22c55e', '#f59e0b', '#8b5cf6', '#64748b'];

function SourcePieChart({ data, emptyMessage, height = 300 }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">{emptyMessage}</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={2}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.name === 'Other' ? '#94a3b8' : CHART_COLORS[i % CHART_COLORS.length]}
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [v, 'Leads']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StatusBarChart({ data, emptyMessage, height = 300 }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">{emptyMessage}</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="status" width={75} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [v, 'Leads']} />
        <Bar dataKey="count" name="Leads" fill="#2654a8" radius={[0, 4, 4, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DashboardCharts({ chart, data, emptyMessage, height }) {
  if (chart === 'source') return <SourcePieChart data={data} emptyMessage={emptyMessage} height={height} />;
  if (chart === 'status') return <StatusBarChart data={data} emptyMessage={emptyMessage} height={height} />;
  return null;
}
