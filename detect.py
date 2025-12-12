import cv2
from ultralytics import YOLO

# Load YOLO model
model = YOLO('yolov8n.pt')  # Nano model

# Connect to IP camera
ip_camera_url = "https://wintereventsonenbreugel.s3.eu-west-1.amazonaws.com/hls/0/stream.m3u8"  # Replace with your IP camera URL
cap = cv2.VideoCapture(ip_camera_url)

while True:
    ret, frame = cap.read()
    frame = cv2.resize(frame, (1280, 720))  # Resize to 640x360
    if not ret:
        print("Failed to retrieve frame.")
        break

    # Run inference
    results = model(frame)

    # Filter results for "person" class and count them
    person_count = sum(1 for r in results[0].boxes if r.cls == 0)  # YOLO class 0 = person

    # Draw bounding boxes
    for box in results[0].boxes:
        if box.cls == 0:  # Person class
            x1, y1, x2, y2 = map(int, box.xyxy[0])  # Bounding box coordinates
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

    # Display person count
    cv2.putText(frame, f"People Count: {person_count}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    # Show the video feed with detections
    cv2.imshow("People Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()





# import cv2
# import time
# from ultralytics import YOLO
#
# # Load YOLO model
# model = YOLO('yolov8n.pt')  # Nano model
#
# # Connect to IP camera
# ip_camera_url = "https://server3.mountaineers.nl/hls/0/stream.m3u8"  # Replace with your IP camera URL
# cap = cv2.VideoCapture(ip_camera_url)
#
# # Set the sampling interval in seconds
# sampling_interval = 5
# last_sample_time = 0
#
# while True:
#     # Get the current time
#     current_time = time.time()
#
#     # Check if the sampling interval has passed
#     if current_time - last_sample_time >= sampling_interval:
#         # Update the last sample time
#         last_sample_time = current_time
#
#         # Read a frame from the camera
#         ret, frame = cap.read()
#         if not ret:
#             print("Failed to retrieve frame.")
#             break
#
#         # Run inference on the current frame
#         results = model(frame)
#
#         # Filter results for "person" class and count them
#         person_count = sum(1 for r in results[0].boxes if r.cls == 0)  # YOLO class 0 = person
#
#         # Draw bounding boxes
#         for box in results[0].boxes:
#             if box.cls == 0:  # Person class
#                 x1, y1, x2, y2 = map(int, box.xyxy[0])  # Bounding box coordinates
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
#
#         # Display person count
#         cv2.putText(frame, f"People Count: {person_count}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
#
#         # Show the video feed with detections
#         cv2.imshow("People Detection", frame)
#
#     # Break the loop if 'q' is pressed
#     if cv2.waitKey(1) & 0xFF == ord('q'):
#         break
#
# cap.release()
# cv2.destroyAllWindows()