import React from 'react';
import { format } from 'date-fns';
import './DateSelector.css';

export function DateSelector({ selectedDate, onDateChange }) {
  const handleDateChange = (e) => {
    const date = new Date(e.target.value);
    onDateChange(date);
  };

  return (
    <div className="date-selector">
      <label htmlFor="date-picker">Select Date: </label>
      <input
        id="date-picker"
        type="date"
        value={format(selectedDate, 'yyyy-MM-dd')}
        onChange={handleDateChange}
        className="date-input"
      />
      <span className="date-display">
        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
      </span>
    </div>
  );
}


