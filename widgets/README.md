# OBS Widgets

HTML widgets for displaying count-folks data in OBS Studio.

## Busyness Widget

**File:** `obs-busyness-widget.html`

Displays current busyness level and comparison to yesterday.

### Features

- Shows current busyness level (Empty, Low, Medium, High, Very High) in Dutch
- Compares to yesterday's same time period
- Shows percentage change with color-coded indicator
- Updates every 30 seconds
- Styled to match your existing weather widget

### Configuration

Edit the configuration section in the HTML file:

```javascript
const API_URL = 'http://localhost:3000'; // Your API URL
const STREAM_ID = 'stream1'; // Your stream ID
const UPDATE_INTERVAL = 30000; // Update interval in milliseconds
```

### Usage in OBS

1. Add a **Browser Source** in OBS
2. Set the local file path to `obs-busyness-widget.html`
3. Set width: 800px, height: 200px (or adjust as needed)
4. Check "Shutdown source when not visible" for performance

### For Production/Remote API

If your API is on a different server:

1. Update `API_URL` in the HTML file:
   ```javascript
   const API_URL = 'http://10.0.0.106:3000'; // Production API
   ```

2. If using HTTPS or different port, update accordingly:
   ```javascript
   const API_URL = 'https://api.example.com:3000';
   ```

### Customization

- **Position**: Edit the `#lowerthird` CSS `bottom` and `left` values
- **Colors**: Modify the `.status-dot` background colors
- **Font sizes**: Adjust `#busyness-level` and `#comparison` font sizes
- **Update interval**: Change `UPDATE_INTERVAL` value
- **Language**: Modify the Dutch translations in `getBusynessText()` and `getComparisonText()`

### Troubleshooting

**Widget shows "Fout" or "Geen verbinding":**
- Check that the API URL is correct
- Verify the API is accessible from your OBS machine
- Check browser console (F12) for CORS errors
- Ensure the backend CORS is enabled (it should be by default)

**No data showing:**
- Verify your stream ID matches what's in the database
- Check that there's recent data (within last 5 minutes)
- Ensure the detector is running and sending data

**CORS errors:**
- The backend should have CORS enabled by default
- If accessing from a different domain, you may need to update backend CORS settings

