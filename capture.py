import cv2

ip_camera_url = "https://wintereventsonenbreugel.s3.eu-west-1.amazonaws.com/hls/0/stream.m3u8"  # Replace with your IP camera URL
cap = cv2.VideoCapture(ip_camera_url)

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to retrieve frame. Check the IP camera URL.")
        break
        
        print("Capturing frames")

    cv2.imshow("Camera Feed", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
