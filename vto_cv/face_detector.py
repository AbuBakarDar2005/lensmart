"""
Face and Eye Detection Module for Virtual Try-On.

Uses OpenCV Haar Cascades to detect facial regions and eye coordinates,
calculating precise position, scale, and head roll angle.
"""

import cv2
import numpy as np
from typing import Optional, Tuple, NamedTuple


class FaceDetectionResult(NamedTuple):
    detected: boolean = False
    box: Tuple[int, int, int, int] = (0, 0, 0, 0)
    center_x: int = 0
    center_y: int = 0
    width: int = 0
    angle_deg: float = 0.0
    left_eye: Optional[Tuple[int, int]] = None
    right_eye: Optional[Tuple[int, int]] = None


class FaceDetector:
    def __init__(self):
        # Locate Haar Cascades from cv2.data.haarcascades
        cascade_dir = getattr(cv2, 'data', None)
        if cascade_dir and hasattr(cascade_dir, 'haarcascades'):
            haardir = cv2.data.haarcascades
        else:
            haardir = ''

        self.face_cascade = cv2.CascadeClassifier(haardir + 'haarcascade_frontalface_default.xml')
        if self.face_cascade.empty():
            self.face_cascade = cv2.CascadeClassifier(haardir + 'haarcascade_frontalface_alt2.xml')

        self.eye_cascade = cv2.CascadeClassifier(haardir + 'haarcascade_eye_tree_eyeglasses.xml')
        if self.eye_cascade.empty():
            self.eye_cascade = cv2.CascadeClassifier(haardir + 'haarcascade_eye.xml')

    def detect(self, frame: np.ndarray) -> FaceDetectionResult:
        """
        Detects primary face in frame and computes eyewear positioning.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Contrast normalization
        gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.15,
            minNeighbors=5,
            minSize=(80, 80),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(faces) == 0:
            return FaceDetectionResult(detected=False)

        # Select largest face in frame (closest to camera)
        primary_face = max(faces, key=lambda f: f[2] * f[3])
        fx, fy, fw, fh = primary_face

        # Eye ROI is in the upper half of face
        eye_roi_y = fy + int(fh * 0.18)
        eye_roi_h = int(fh * 0.38)
        roi_gray = gray[eye_roi_y:eye_roi_y + eye_roi_h, fx:fx + fw]

        eyes = self.eye_cascade.detectMultiScale(
            roi_gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(20, 20)
        )

        left_eye = None
        right_eye = None
        angle_deg = 0.0

        if len(eyes) >= 2:
            # Sort eyes left-to-right
            sorted_eyes = sorted(eyes, key=lambda e: e[0])
            e1 = sorted_eyes[0]
            e2 = sorted_eyes[-1]

            # In mirrored image: e1 is on the left, e2 is on the right
            pt1 = (fx + e1[0] + e1[2] // 2, eye_roi_y + e1[1] + e1[3] // 2)
            pt2 = (fx + e2[0] + e2[2] // 2, eye_roi_y + e2[1] + e2[3] // 2)

            left_eye = pt1
            right_eye = pt2

            dx = pt2[0] - pt1[0]
            dy = pt2[1] - pt1[1]
            if dx > 10:
                angle_deg = -float(np.degrees(np.arctan2(dy, dx)))

            center_x = (pt1[0] + pt2[0]) // 2
            center_y = (pt1[1] + pt2[1]) // 2
        else:
            # Anthropomorphic fallback: eyes at 35% height, center at 50% width
            center_x = fx + fw // 2
            center_y = fy + int(fh * 0.36)

        return FaceDetectionResult(
            detected=True,
            box=(fx, fy, fw, fh),
            center_x=center_x,
            center_y=center_y,
            width=fw,
            angle_deg=angle_deg,
            left_eye=left_eye,
            right_eye=right_eye
        )
