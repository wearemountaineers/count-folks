import cv2
import os
import time
import requests
import logging
from datetime import datetime, timedelta
from collections import deque
from ultralytics import YOLO
import signal
import sys
try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
except ImportError:
    YT_DLP_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment
STREAM_URL = os.getenv('STREAM_URL')
TWITCH_CHANNEL = os.getenv('TWITCH_CHANNEL')
TWITCH_CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
TWITCH_CHECK_INTERVAL = int(os.getenv('TWITCH_CHECK_INTERVAL', '60'))  # seconds
STREAM_ID = os.getenv('STREAM_ID', 'stream1')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://backend:3000')
CONFIDENCE_THRESHOLD = float(os.getenv('CONFIDENCE_THRESHOLD', '0.35'))
AGGREGATION_INTERVAL = int(os.getenv('AGGREGATION_INTERVAL', '15'))  # seconds - shorter for better camera switching handling

# Global state
running = True
counts_buffer = deque()
last_aggregation_time = time.time()

def signal_handler(sig, frame):
    global running
    logger.info("Shutdown signal received, stopping...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def load_model():
    """Load YOLO model"""
    model_path = '/app/yolov8n.pt'
    if not os.path.exists(model_path):
        logger.error(f"Model file not found at {model_path}")
        sys.exit(1)
    logger.info(f"Loading YOLO model from {model_path}")
    return YOLO(model_path)

def count_people(frame, model):
    """Count people in a frame using YOLO"""
    try:
        results = model(frame, verbose=False)
        person_count = 0
        
        if results and len(results) > 0 and results[0].boxes is not None:
            for box in results[0].boxes:
                # Check if class is person (0) and confidence meets threshold
                if len(box.cls) > 0 and int(box.cls[0]) == 0:
                    if len(box.conf) > 0 and float(box.conf[0]) >= CONFIDENCE_THRESHOLD:
                        person_count += 1
        
        return person_count
    except Exception as e:
        logger.error(f"Error counting people: {e}")
        return 0

def send_count_to_backend(window_start, window_end, avg_count):
    """Send aggregated count to backend API"""
    try:
        url = f"{BACKEND_URL}/counts"
        payload = {
            "streamId": STREAM_ID,
            "windowStart": window_start.isoformat(),
            "windowEnd": window_end.isoformat(),
            "avgCount": avg_count
        }
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
        logger.info(f"Sent count to backend: {avg_count} people (window: {window_start} to {window_end})")
        return True
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to send count to backend: {e}")
        return False

def aggregate_and_send():
    """Aggregate counts from buffer and send to backend"""
    global counts_buffer, last_aggregation_time
    
    if not counts_buffer:
        return
    
    # Calculate time window
    window_end = datetime.utcnow()
    window_start = window_end - timedelta(seconds=AGGREGATION_INTERVAL)
    
    # Calculate average count
    avg_count = sum(counts_buffer) / len(counts_buffer) if counts_buffer else 0
    
    # Send to backend
    send_count_to_backend(window_start, window_end, avg_count)
    
    # Clear buffer and update time
    counts_buffer.clear()
    last_aggregation_time = time.time()

def get_twitch_stream_url(channel_name, client_id=None):
    """Check if Twitch channel is live and get HLS stream URL using yt-dlp"""
    try:
        # First, check if stream is live using Twitch API (if Client-ID provided)
        if client_id and client_id.strip():
            try:
                url = f"https://api.twitch.tv/helix/streams?user_login={channel_name}"
                headers = {'Client-ID': client_id}
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                if not data.get('data') or len(data['data']) == 0:
                    logger.info(f"Twitch channel '{channel_name}' is offline")
                    return None
                logger.info(f"Twitch channel '{channel_name}' is live")
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 401:
                    logger.error("Twitch API authentication failed. Please check your TWITCH_CLIENT_ID.")
                    return None
                logger.warning(f"Error checking Twitch stream status: {e}")
        else:
            logger.warning("TWITCH_CLIENT_ID not provided. Cannot verify if stream is live.")
        
        # Use yt-dlp to get the actual stream URL
        # This handles authentication tokens automatically
        if not YT_DLP_AVAILABLE:
            logger.error("yt-dlp not available. Please install it: pip install yt-dlp")
            # Fallback: try direct HLS URL (may not work without tokens)
            logger.info("Attempting fallback to direct HLS URL (may require authentication)")
            return f"https://usher.ttvnw.net/api/channel/hls/{channel_name}.m3u8"
        
        try:
            # Use yt-dlp Python API to get stream info
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Get stream info
                info = ydl.extract_info(
                    f'https://www.twitch.tv/{channel_name}',
                    download=False
                )
                
                if not info:
                    logger.warning("yt-dlp returned no stream info")
                    return None
                
                # Get the best format URL (usually HLS)
                if 'url' in info:
                    hls_url = info['url']
                    logger.info(f"Retrieved Twitch stream URL via yt-dlp")
                    return hls_url
                elif 'formats' in info and len(info['formats']) > 0:
                    # Try to find HLS format
                    for format_info in info['formats']:
                        if format_info.get('protocol') == 'https' and format_info.get('ext') == 'm3u8':
                            hls_url = format_info.get('url')
                            if hls_url:
                                logger.info(f"Retrieved Twitch stream URL via yt-dlp")
                                return hls_url
                    # Fallback to first format
                    hls_url = info['formats'][0].get('url')
                    if hls_url:
                        logger.info(f"Retrieved Twitch stream URL via yt-dlp")
                        return hls_url
                
                logger.warning("yt-dlp returned stream info but no URL found")
                return None
                
        except yt_dlp.utils.DownloadError as e:
            if "is offline" in str(e).lower() or "does not exist" in str(e).lower():
                logger.info(f"Twitch channel '{channel_name}' is offline or does not exist")
                return None
            logger.warning(f"yt-dlp download error: {e}")
            # Fallback: try direct HLS URL (may not work without tokens)
            logger.info("Attempting fallback to direct HLS URL (may require authentication)")
            return f"https://usher.ttvnw.net/api/channel/hls/{channel_name}.m3u8"
        except Exception as e:
            logger.warning(f"yt-dlp error: {e}")
            # Fallback: try direct HLS URL (may not work without tokens)
            logger.info("Attempting fallback to direct HLS URL (may require authentication)")
            return f"https://usher.ttvnw.net/api/channel/hls/{channel_name}.m3u8"
            
    except Exception as e:
        logger.error(f"Unexpected error getting Twitch stream URL: {e}")
        return None

def resolve_stream_url():
    """Resolve stream URL from either direct URL or Twitch channel name"""
    # Priority: TWITCH_CHANNEL > STREAM_URL
    # Check if TWITCH_CHANNEL is set and not empty
    if TWITCH_CHANNEL and TWITCH_CHANNEL.strip():
        logger.info(f"Resolving Twitch channel: {TWITCH_CHANNEL}")
        stream_url = get_twitch_stream_url(TWITCH_CHANNEL, TWITCH_CLIENT_ID)
        if stream_url:
            return stream_url
        else:
            logger.warning(f"Twitch channel '{TWITCH_CHANNEL}' is offline or unavailable")
            return None
    # Check if STREAM_URL is set and not empty
    elif STREAM_URL and STREAM_URL.strip():
        logger.info(f"Using direct stream URL: {STREAM_URL}")
        return STREAM_URL
    else:
        logger.error("Neither STREAM_URL nor TWITCH_CHANNEL is configured")
        return None

def connect_to_stream():
    """Connect to video stream with retry logic"""
    max_retries = 5
    retry_delay = 5
    
    # Resolve stream URL (handles both direct URLs and Twitch channels)
    stream_url = resolve_stream_url()
    if not stream_url:
        logger.error("Could not resolve stream URL")
        return None
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Attempting to connect to stream: {stream_url} (attempt {attempt + 1}/{max_retries})")
            cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
            
            if not cap.isOpened():
                raise Exception("Failed to open video stream")
            
            # Test read
            ret, frame = cap.read()
            if not ret:
                cap.release()
                raise Exception("Failed to read initial frame")
            
            logger.info("Successfully connected to stream")
            return cap
        except Exception as e:
            logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                logger.error("Failed to connect to stream after all retries")
                return None
    
    return None

def main():
    """Main detection loop"""
    global running, counts_buffer, last_aggregation_time
    
    logger.info("Starting people detection service")
    if TWITCH_CHANNEL and TWITCH_CHANNEL.strip():
        logger.info(f"Twitch Channel: {TWITCH_CHANNEL}")
        if TWITCH_CLIENT_ID and TWITCH_CLIENT_ID.strip():
            logger.info("Twitch Client ID: configured")
    elif STREAM_URL and STREAM_URL.strip():
        logger.info(f"Stream URL: {STREAM_URL}")
    else:
        logger.error("Neither STREAM_URL nor TWITCH_CHANNEL is configured")
        sys.exit(1)
    logger.info(f"Stream ID: {STREAM_ID}")
    logger.info(f"Backend URL: {BACKEND_URL}")
    logger.info(f"Confidence threshold: {CONFIDENCE_THRESHOLD}")
    logger.info(f"Aggregation interval: {AGGREGATION_INTERVAL}s")
    
    # Load model
    model = load_model()
    
    # Connect to stream
    cap = connect_to_stream()
    if cap is None:
        logger.error("Failed to connect to stream, exiting")
        sys.exit(1)
    
    frame_count = 0
    last_reconnect_time = time.time()
    reconnect_interval = 300  # Try to reconnect every 5 minutes if needed
    last_twitch_check = time.time()
    
    try:
        while running:
            current_time = time.time()
            
            # For Twitch channels, periodically check if stream is still live
            if TWITCH_CHANNEL and (current_time - last_twitch_check) >= TWITCH_CHECK_INTERVAL:
                last_twitch_check = current_time
                stream_url = get_twitch_stream_url(TWITCH_CHANNEL, TWITCH_CLIENT_ID)
                if not stream_url:
                    logger.warning(f"Twitch channel '{TWITCH_CHANNEL}' appears to be offline, will retry...")
                    # Don't disconnect immediately, wait for read failure
            
            # Check if we need to reconnect
            if current_time - last_reconnect_time > reconnect_interval:
                ret, test_frame = cap.read()
                if not ret:
                    logger.warning("Stream connection lost, attempting to reconnect...")
                    cap.release()
                    cap = connect_to_stream()
                    if cap is None:
                        logger.error("Reconnection failed, waiting before retry...")
                        # For Twitch, wait and retry; for direct URLs, exit after max retries
                        if TWITCH_CHANNEL:
                            time.sleep(TWITCH_CHECK_INTERVAL)
                            last_twitch_check = time.time()  # Reset check timer
                        else:
                            time.sleep(10)
                        continue
                    last_reconnect_time = time.time()
            
            # Read frame
            ret, frame = cap.read()
            if not ret:
                logger.warning("Failed to read frame, skipping...")
                # For Twitch channels, try to reconnect if stream might have gone offline
                if TWITCH_CHANNEL:
                    time.sleep(1)
                    # Check if stream is still live
                    stream_url = get_twitch_stream_url(TWITCH_CHANNEL, TWITCH_CLIENT_ID)
                    if not stream_url:
                        logger.warning("Twitch stream appears offline, attempting to reconnect...")
                        cap.release()
                        cap = connect_to_stream()
                        if cap is None:
                            logger.warning("Reconnection failed, will retry...")
                            time.sleep(TWITCH_CHECK_INTERVAL)
                            last_twitch_check = time.time()
                else:
                    time.sleep(0.1)
                continue
            
            # Resize frame for processing (optional, can improve performance)
            frame = cv2.resize(frame, (1280, 720))
            
            # Count people
            person_count = count_people(frame, model)
            counts_buffer.append(person_count)
            frame_count += 1
            
            # Log periodically
            if frame_count % 30 == 0:
                logger.debug(f"Processed {frame_count} frames, current count: {person_count}")
            
            # Aggregate and send every AGGREGATION_INTERVAL seconds
            if current_time - last_aggregation_time >= AGGREGATION_INTERVAL:
                aggregate_and_send()
            
            # Small delay to prevent excessive CPU usage
            time.sleep(0.033)  # ~30 FPS processing rate
            
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error in main loop: {e}", exc_info=True)
    finally:
        # Final aggregation if buffer has data
        if counts_buffer:
            aggregate_and_send()
        
        if cap:
            cap.release()
        logger.info("Detection service stopped")

if __name__ == "__main__":
    main()

