import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';

export function CountsChart({ data, viewMode = 'counts', compareMode = false }) {
  const getBusynessColor = (level) => {
    switch (level) {
      case 'Empty': return '#95a5a6';
      case 'Low': return '#2ecc71';
      case 'Medium': return '#f39c12';
      case 'High': return '#e67e22';
      case 'Very High': return '#e74c3c';
      default: return '#3498db';
    }
  };

  const getChangeColor = (percentageChange) => {
    if (!percentageChange && percentageChange !== 0) return '#3498db';
    if (percentageChange >= 20) return '#e74c3c'; // Much busier
    if (percentageChange >= 0) return '#e67e22'; // Busier
    if (percentageChange >= -20) return '#f39c12'; // Similar
    return '#2ecc71'; // Quieter
  };

  const chartData = data.map(item => {
    if (viewMode === 'busyness') {
      const baseData = {
        time: format(parseISO(item.windowStart), 'HH:mm'),
        timestamp: item.windowStart,
        count: parseFloat(item.maxCount) || 0,
        busynessLevel: item.busynessLevel,
        color: getBusynessColor(item.busynessLevel),
        fullTime: format(parseISO(item.windowStart), 'MMM d, HH:mm')
      };
      
      if (compareMode && item.historicalAverage !== undefined) {
        baseData.historicalAverage = parseFloat(item.historicalAverage) || 0;
        baseData.historicalMax = parseFloat(item.historicalMax) || 0;
        baseData.percentageChange = item.percentageChange;
        baseData.relativeIndicator = item.relativeIndicator;
        baseData.comparisonDays = item.comparisonDays;
        baseData.changeColor = getChangeColor(item.percentageChange);
      }
      
      return baseData;
    } else {
      return {
        time: format(parseISO(item.windowStart), 'HH:mm'),
        timestamp: item.windowStart,
        count: parseFloat(item.avgCount) || 0,
        fullTime: format(parseISO(item.windowStart), 'MMM d, HH:mm')
      };
    }
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p>{data.fullTime}</p>
          <p style={{ color: data.color || '#3498db', fontWeight: 'bold' }}>
            {viewMode === 'busyness' ? (
              <>
                Peak Count: {data.count.toFixed(0)}<br />
                Busyness: <span style={{ color: data.color }}>{data.busynessLevel}</span>
                {compareMode && data.historicalAverage !== undefined && (
                  <>
                    <br /><br />
                    <span style={{ fontSize: '0.9em', fontWeight: 'normal' }}>
                      Historical Avg: {data.historicalAverage.toFixed(1)}<br />
                      Historical Max: {data.historicalMax.toFixed(1)}<br />
                      Change: <span style={{ color: data.changeColor, fontWeight: 'bold' }}>
                        {data.percentageChange >= 0 ? '+' : ''}{data.percentageChange.toFixed(1)}%
                      </span><br />
                      <span style={{ color: data.changeColor }}>
                        {data.relativeIndicator}
                      </span>
                    </span>
                  </>
                )}
              </>
            ) : (
              `Count: ${data.count.toFixed(2)}`
            )}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (viewMode === 'busyness' && payload.color) {
      return <circle cx={cx} cy={cy} r={4} fill={payload.color} />;
    }
    return <circle cx={cx} cy={cy} r={4} fill="#3498db" />;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          interval="preserveStartEnd"
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          label={{ 
            value: viewMode === 'busyness' ? 'Peak People Count' : 'People Count', 
            angle: -90, 
            position: 'insideLeft' 
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="count"
          stroke={viewMode === 'busyness' ? '#e74c3c' : '#3498db'}
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 6 }}
          name={viewMode === 'busyness' ? 'Peak Count (Busyness)' : 'People Count'}
        />
        {compareMode && viewMode === 'busyness' && chartData.some(d => d.historicalAverage !== undefined) && (
          <Line
            type="monotone"
            dataKey="historicalAverage"
            stroke="#95a5a6"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="Historical Average"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

