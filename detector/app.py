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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment
STREAM_URL = os.getenv('STREAM_URL', 'https://wintereventsonenbreugel.s3.eu-west-1.amazonaws.com/hls/0/stream.m3u8')
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

def connect_to_stream():
    """Connect to video stream with retry logic"""
    max_retries = 5
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Attempting to connect to stream: {STREAM_URL} (attempt {attempt + 1}/{max_retries})")
            cap = cv2.VideoCapture(STREAM_URL, cv2.CAP_FFMPEG)
            
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
    logger.info(f"Stream URL: {STREAM_URL}")
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
    
    try:
        while running:
            current_time = time.time()
            
            # Check if we need to reconnect
            if current_time - last_reconnect_time > reconnect_interval:
                ret, test_frame = cap.read()
                if not ret:
                    logger.warning("Stream connection lost, attempting to reconnect...")
                    cap.release()
                    cap = connect_to_stream()
                    if cap is None:
                        logger.error("Reconnection failed, waiting before retry...")
                        time.sleep(10)
                        continue
                    last_reconnect_time = time.time()
            
            # Read frame
            ret, frame = cap.read()
            if not ret:
                logger.warning("Failed to read frame, skipping...")
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
        
        cap.release()
        logger.info("Detection service stopped")

if __name__ == "__main__":
    main()

