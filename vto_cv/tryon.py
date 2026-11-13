"""
LENS MART Real-Time Virtual Try-On Desktop Application.

Features:
- Live webcam capture with OpenCV
- Haar cascade face and eye tracking
- Vectorized 4-channel BGRA alpha-blended eyewear overlay with affine rotation
- Temporal smoothing (EMA) to eliminate landmark jitter
- Interactive switching across multiple glasses models
- Real-time scale & bridge height adjustments
- High-resolution snapshot capture
- Clean Heads-Up Display (HUD)
"""

import os
import sys
import time
import glob
import cv2
import numpy as np

# Ensure module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from face_detector import FaceDetector
from overlay_engine import OverlayEngine
from smoothing import TemporalSmoother


class VirtualTryOnApp:
    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap = None

        self.detector = FaceDetector()
        self.smoother = TemporalSmoother(alpha_pos=0.40, alpha_size=0.25, alpha_angle=0.30)

        # Assets
        self.assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'sunglasses')
        self.snapshots_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snapshots')
        os.makedirs(self.snapshots_dir, exist_ok=True)

        self.glasses_models = []
        self.current_model_idx = 0
        self.current_glasses_img = None

        # User Calibration adjustments
        self.user_scale_multiplier = 1.05
        self.user_vertical_offset = 0
        self.show_hud = True
        self.show_landmarks = False

        self.load_models()

    def load_models(self):
        """Scans the assets folder for all PNG glasses images."""
        png_files = sorted(glob.glob(os.path.join(self.assets_dir, '*.png')))
        if not png_files:
            print(f"[!] Warning: No PNG files found in {self.assets_dir}")
            return

        self.glasses_models = []
        for path in png_files:
            filename = os.path.basename(path)
            # Friendly display name
            name = os.path.splitext(filename)[0].replace('_', ' ').title()
            img = OverlayEngine.load_glasses(path)
            if img is not None:
                self.glasses_models.append({
                    'name': name,
                    'path': path,
                    'image': img
                })

        if self.glasses_models:
            self.current_model_idx = 0
            self.current_glasses_img = self.glasses_models[0]['image']
            print(f"[+] Loaded {len(self.glasses_models)} eyewear models:")
            for i, m in enumerate(self.glasses_models):
                print(f"    [{i + 1}] {m['name']}")

    def next_model(self):
        if not self.glasses_models:
            return
        self.current_model_idx = (self.current_model_idx + 1) % len(self.glasses_models)
        self.current_glasses_img = self.glasses_models[self.current_model_idx]['image']

    def prev_model(self):
        if not self.glasses_models:
            return
        self.current_model_idx = (self.current_model_idx - 1 + len(self.glasses_models)) % len(self.glasses_models)
        self.current_glasses_img = self.glasses_models[self.current_model_idx]['image']

    def save_snapshot(self, frame: np.ndarray):
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"tryon_{timestamp}.jpg"
        filepath = os.path.join(self.snapshots_dir, filename)
        cv2.imwrite(filepath, frame)
        print(f"[✓] Snapshot saved to: {filepath}")

    def draw_hud(self, frame: np.ndarray, fps: float, face_detected: bool):
        h, w = frame.shape[:2]

        # Top Header Bar
        cv2.rectangle(frame, (0, 0), (w, 42), (18, 24, 38), -1)
        cv2.line(frame, (0, 42), (w, 42), (0, 180, 216), 2)

        # Title and Model Info
        model_name = self.glasses_models[self.current_model_idx]['name'] if self.glasses_models else 'None'
        title_text = f"LENS MART VTO  |  [{self.current_model_idx + 1}/{len(self.glasses_models)}] {model_name}"
        cv2.putText(frame, title_text, (15, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)

        # FPS & Status
        fps_text = f"{int(fps)} FPS"
        cv2.putText(frame, fps_text, (w - 180, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 229, 255), 1, cv2.LINE_AA)

        status_color = (0, 210, 100) if face_detected else (0, 165, 255)
        status_text = "FACE LOCKED" if face_detected else "SCANNING..."
        cv2.putText(frame, status_text, (w - 105, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.5, status_color, 2, cv2.LINE_AA)

        # Bottom Controls Hint Bar
        if self.show_hud:
            cv2.rectangle(frame, (0, h - 34), (w, h), (18, 24, 38), -1)
            cv2.line(frame, (0, h - 34), (w, h - 34), (0, 180, 216), 1)
            controls_text = "Next: [S/N]  |  Prev: [P]  |  Scale: [+/-]  |  Height: [W/X]  |  Photo: [C]  |  Quit: [Q/E]"
            cv2.putText(frame, controls_text, (15, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (200, 220, 235), 1, cv2.LINE_AA)

    def run(self):
        print("\n=======================================================")
        print("     LENS MART Virtual Try-On with Python & OpenCV     ")
        print("=======================================================")
        print("Controls:")
        print("  [S] or [N] : Next eyewear model")
        print("  [P]        : Previous eyewear model")
        print("  [+] or [=] : Increase frame scale")
        print("  [-]        : Decrease frame scale")
        print("  [W]        : Move glasses UP")
        print("  [X]        : Move glasses DOWN")
        print("  [C]        : Capture snapshot")
        print("  [H]        : Toggle HUD display")
        print("  [Q] or [E] : Quit")
        print("=======================================================\n")

        self.cap = cv2.VideoCapture(self.camera_index)
        if not self.cap.isOpened():
            print(f"[!] Error: Could not open camera {self.camera_index}")
            return

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        prev_time = time.time()
        fps = 30.0

        window_name = "LENS MART - Virtual Eyewear Try-On"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        while True:
            ret, frame = self.cap.read()
            if not ret:
                print("[!] Failed to grab webcam frame.")
                break

            # Mirror frame horizontally for natural mirror feel
            frame = cv2.flip(frame, 1)

            # Calculate FPS
            curr_time = time.time()
            fps = 1.0 / max(1e-4, curr_time - prev_time)
            prev_time = curr_time

            # Detect face
            face_result = self.detector.detect(frame)

            if face_result.detected:
                fx, fy, fw, fh = self.smoother.smooth_box(*face_result.box)
                angle = self.smoother.smooth_angle(face_result.angle_deg)

                # Glasses center anchor
                center_x = fx + fw // 2
                center_y = fy + int(fh * 0.36) + self.user_vertical_offset

                # Proportional eyewear sizing relative to face width
                glasses_width = int(fw * self.user_scale_multiplier)

                # Overlay glasses
                if self.current_glasses_img is not None:
                    frame = OverlayEngine.overlay_glasses(
                        frame=frame,
                        glasses_img=self.current_glasses_img,
                        center_x=center_x,
                        center_y=center_y,
                        target_width=glasses_width,
                        angle_deg=angle
                    )
            else:
                # Use last known smoothed box for stability if briefly lost
                last_box = self.smoother.get_last_box()
                if last_box and self.current_glasses_img is not None:
                    fx, fy, fw, fh = last_box
                    center_x = fx + fw // 2
                    center_y = fy + int(fh * 0.36) + self.user_vertical_offset
                    glasses_width = int(fw * self.user_scale_multiplier)
                    frame = OverlayEngine.overlay_glasses(
                        frame=frame,
                        glasses_img=self.current_glasses_img,
                        center_x=center_x,
                        center_y=center_y,
                        target_width=glasses_width,
                        angle_deg=0.0
                    )

            # Draw HUD
            self.draw_hud(frame, fps, face_result.detected)

            cv2.imshow(window_name, frame)

            # Key handling
            key = cv2.waitKey(1) & 0xFF
            if key in (ord('q'), ord('e'), 27):  # 'q', 'e', ESC
                break
            elif key in (ord('s'), ord('n')):    # Next model
                self.next_model()
            elif key == ord('p'):                # Previous model
                self.prev_model()
            elif key in (ord('+'), ord('=')):    # Scale up
                self.user_scale_multiplier = min(1.5, self.user_scale_multiplier + 0.05)
                print(f"Scale: {round(self.user_scale_multiplier, 2)}")
            elif key == ord('-'):                # Scale down
                self.user_scale_multiplier = max(0.7, self.user_scale_multiplier - 0.05)
                print(f"Scale: {round(self.user_scale_multiplier, 2)}")
            elif key == ord('w'):                # Move up
                self.user_vertical_offset -= 3
            elif key == ord('x'):                # Move down
                self.user_vertical_offset += 3
            elif key == ord('c'):                # Capture photo
                self.save_snapshot(frame)
            elif key == ord('h'):                # Toggle HUD
                self.show_hud = not self.show_hud

        self.cap.release()
        cv2.destroyAllWindows()
        print("[✓] Virtual Try-On session closed.")


if __name__ == '__main__':
    app = VirtualTryOnApp()
    app.run()
