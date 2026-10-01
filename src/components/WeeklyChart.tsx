import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { TimeEntry } from '../types';

interface WeeklyChartProps {
  entries: TimeEntry[];
  isDarkMode?: boolean;
}

export default function WeeklyChart({ entries, isDarkMode = true }: WeeklyChartProps) {
  const chartData = useMemo(() => {
    // Initialize 5 weeks (most months span 4-6 weeks, but 5 is a good visual average for buckets)
    const weeks = [
      { name: 'Semana 1', hours: 0 },
      { name: 'Semana 2', hours: 0 },
      { name: 'Semana 3', hours: 0 },
      { name: 'Semana 4', hours: 0 },
      { name: 'Semana 5', hours: 0 },
    ];

    entries.forEach(entry => {
      const [h, m] = entry.hours.split(':').map(Number);
      const decimalHours = (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m / 60);
      
      // Simple logic: 1-7, 8-14, 15-21, 22-28, 29+
      let weekIndex = 0;
      if (entry.day <= 7) weekIndex = 0;
      else if (entry.day <= 14) weekIndex = 1;
      else if (entry.day <= 21) weekIndex = 2;
      else if (entry.day <= 28) weekIndex = 3;
      else weekIndex = 4;

      weeks[weekIndex].hours += decimalHours;
    });

    return weeks;
  }, [entries]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`border p-3 rounded-lg shadow-2xl ${isDarkMode ? 'bg-[#1f1f1f] border-white/10' : 'bg-white border-black/10'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>{label}</p>
          <p className="text-sm font-black text-blue-600">{payload[0].value.toFixed(1)} Horas</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#ffffff10' : '#00000010'} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: isDarkMode ? '#ffffff40' : '#00000040', fontSize: 10, fontWeight: 800 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: isDarkMode ? '#ffffff40' : '#00000040', fontSize: 10, fontWeight: 800 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: isDarkMode ? '#ffffff05' : '#00000005' }} />
          <Bar 
            dataKey="hours" 
            radius={[4, 4, 0, 0]} 
            barSize={32}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.hours > 0 ? '#2563eb' : isDarkMode ? '#333333' : '#e5e7eb'} 
                className="transition-all duration-500"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
