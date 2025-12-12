import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { CountsChart } from './components/CountsChart';
import { DateSelector } from './components/DateSelector';
import { StatsCard } from './components/StatsCard';
import { countsService } from './services/countsService';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [counts, setCounts] = useState([]);
  const [busynessData, setBusynessData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamId, setStreamId] = useState('stream1');
  const [viewMode, setViewMode] = useState('busyness'); // 'counts' or 'busyness'
  const [bucketSize, setBucketSize] = useState('5min');
  const [compareMode, setCompareMode] = useState(false);
  const [compareDays, setCompareDays] = useState(7);

  const fetchCounts = async (date, streamId) => {
    setLoading(true);
    setError(null);
    try {
      const from = startOfDay(date).toISOString();
      const to = endOfDay(date).toISOString();
      
      if (viewMode === 'busyness') {
        if (compareMode) {
          const data = await countsService.getBusynessWithComparison(streamId, from, to, bucketSize, compareDays);
          setBusynessData(data);
        } else {
          const data = await countsService.getBusyness(streamId, from, to, bucketSize);
          setBusynessData(data);
        }
        setCounts([]);
      } else {
        const data = await countsService.getCounts(streamId, from, to);
        setCounts(data);
        setBusynessData([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch counts');
      console.error('Error fetching counts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts(selectedDate, streamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, streamId, viewMode, bucketSize, compareMode, compareDays]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleStreamIdChange = (e) => {
    setStreamId(e.target.value);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  const handleBucketSizeChange = (e) => {
    setBucketSize(e.target.value);
  };

  const handleCompareModeChange = (e) => {
    setCompareMode(e.target.checked);
  };

  const handleCompareDaysChange = (e) => {
    setCompareDays(parseInt(e.target.value, 10));
  };

  // Calculate stats based on view mode
  const getStats = () => {
    if (viewMode === 'busyness') {
      if (busynessData.length === 0) {
        return { total: 0, average: 0, peak: 0, dataPoints: 0, avgBusyness: 'N/A', avgChange: 'N/A' };
      }
      const peak = Math.max(...busynessData.map(d => d.maxCount || 0));
      const total = busynessData.reduce((sum, d) => sum + (d.maxCount || 0), 0);
      const average = total / busynessData.length;
      const busynessLevels = busynessData.map(d => d.busynessLevel);
      const mostCommonBusyness = busynessLevels.sort((a, b) =>
        busynessLevels.filter(v => v === a).length - busynessLevels.filter(v => v === b).length
      ).pop();
      
      // Calculate average percentage change if in compare mode
      let avgChange = 'N/A';
      if (compareMode && busynessData[0]?.percentageChange !== undefined) {
        const changes = busynessData
          .filter(d => d.percentageChange !== undefined)
          .map(d => d.percentageChange);
        if (changes.length > 0) {
          const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
          avgChange = `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`;
        }
      }
      
      return {
        total: total.toFixed(0),
        average: average.toFixed(2),
        peak: peak.toFixed(0),
        dataPoints: busynessData.length,
        avgBusyness: mostCommonBusyness || 'N/A',
        avgChange
      };
    } else {
      const totalCount = counts.reduce((sum, count) => sum + (parseFloat(count.avgCount) || 0), 0);
      const averageCount = counts.length > 0 ? totalCount / counts.length : 0;
      const maxCount = counts.length > 0 ? Math.max(...counts.map(c => parseFloat(c.avgCount) || 0)) : 0;
      
        return {
          total: totalCount.toFixed(0),
          average: averageCount.toFixed(2),
          peak: maxCount.toFixed(0),
          dataPoints: counts.length,
          avgBusyness: 'N/A',
          avgChange: 'N/A'
        };
    }
  };

  const stats = getStats();

  return (
    <div className="App">
      <header className="App-header">
        <h1>People Counting Dashboard</h1>
        <div className="header-controls">
          <div className="stream-selector">
            <label htmlFor="streamId">Stream ID: </label>
            <input
              id="streamId"
              type="text"
              value={streamId}
              onChange={handleStreamIdChange}
              placeholder="stream1"
            />
          </div>
        </div>
      </header>
      
      <main className="App-main">
        <div className="controls-section">
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
          <div className="view-controls">
            <div className="view-toggle">
              <button
                className={viewMode === 'busyness' ? 'active' : ''}
                onClick={() => handleViewModeChange('busyness')}
              >
                Busyness View
              </button>
              <button
                className={viewMode === 'counts' ? 'active' : ''}
                onClick={() => handleViewModeChange('counts')}
              >
                Detailed Counts
              </button>
            </div>
            {viewMode === 'busyness' && (
              <div className="bucket-selector">
                <label htmlFor="bucketSize">Time Bucket: </label>
                <select
                  id="bucketSize"
                  value={bucketSize}
                  onChange={handleBucketSizeChange}
                >
                  <option value="1min">1 Minute</option>
                  <option value="5min">5 Minutes</option>
                  <option value="15min">15 Minutes</option>
                  <option value="1hour">1 Hour</option>
                </select>
              </div>
            )}
            {viewMode === 'busyness' && (
              <div className="compare-controls">
                <label htmlFor="compareMode" className="compare-checkbox">
                  <input
                    id="compareMode"
                    type="checkbox"
                    checked={compareMode}
                    onChange={handleCompareModeChange}
                  />
                  Compare to Historical
                </label>
                {compareMode && (
                  <div className="compare-days-selector">
                    <label htmlFor="compareDays">Days: </label>
                    <select
                      id="compareDays"
                      value={compareDays}
                      onChange={handleCompareDaysChange}
                    >
                      <option value="1">Yesterday</option>
                      <option value="3">Last 3 Days</option>
                      <option value="7">Last 7 Days</option>
                      <option value="14">Last 14 Days</option>
                      <option value="30">Last 30 Days</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <div className="stats-section">
              <StatsCard title="Peak Count" value={stats.peak} />
              <StatsCard title="Average Count" value={stats.average} />
              {viewMode === 'busyness' && (
                <StatsCard title="Typical Busyness" value={stats.avgBusyness} />
              )}
              {viewMode === 'busyness' && compareMode && (
                <StatsCard title="Avg Change" value={stats.avgChange} />
              )}
              <StatsCard title="Data Points" value={stats.dataPoints.toString()} />
            </div>

            <div className="chart-section">
              <h2>
                {viewMode === 'busyness' 
                  ? `Crowd Busyness Over Time - ${format(selectedDate, 'MMMM d, yyyy')}${compareMode ? ' (vs Historical)' : ''}`
                  : `People Count Over Time - ${format(selectedDate, 'MMMM d, yyyy')}`
                }
              </h2>
              {(viewMode === 'busyness' ? busynessData.length > 0 : counts.length > 0) ? (
                <CountsChart 
                  data={viewMode === 'busyness' ? busynessData : counts} 
                  viewMode={viewMode}
                  compareMode={compareMode}
                />
              ) : (
                <div className="no-data">No data available for selected date</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;

