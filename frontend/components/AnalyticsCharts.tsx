"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

const barData = [
  { name: 'Mon', volume: 12 },
  { name: 'Tue', volume: 19 },
  { name: 'Wed', volume: 15 },
  { name: 'Thu', volume: 22 },
  { name: 'Fri', volume: 14 },
];

const pieData = [
  { name: 'Resolved', value: 75 },
  { name: 'Pending', value: 25 },
];
const COLORS = ['#22c55e', '#eab308'];

const lineData = [
  { week: 'W1', conflicts: 12, alignment: 80 },
  { week: 'W2', conflicts: 10, alignment: 82 },
  { week: 'W3', conflicts: 15, alignment: 78 },
  { week: 'W4', conflicts: 8, alignment: 88 },
];

export function VolumeChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData}>
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#181b21', borderColor: '#272a30', color: '#f8fafc', borderRadius: '8px' }} />
          <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusPieChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: '#181b21', borderColor: '#272a30', color: '#f8fafc', borderRadius: '8px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={lineData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#272a30" vertical={false} />
          <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip contentStyle={{ backgroundColor: '#181b21', borderColor: '#272a30', color: '#f8fafc', borderRadius: '8px' }} />
          <Line type="monotone" dataKey="alignment" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="conflicts" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
