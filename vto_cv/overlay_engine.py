"""
High-Precision Eyewear Overlay Engine for Virtual Try-On.

Handles 4-channel (BGRA) alpha blending, proportional scaling, affine rotation,
and boundary clamping to cleanly overlay glasses onto video frames without clipping errors.
"""

import cv2
import numpy as np
from typing import Tuple, Optional


class OverlayEngine:
    """
    Renders transparent PNG glasses models onto camera frames with full alpha blending.
    """

    @staticmethod
    def load_glasses(image_path: str) -> Optional[np.ndarray]:
        """
        Loads a PNG glasses image with alpha transparency (BGRA).
        """
        img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            return None
        # Ensure 4 channels
        if img.shape[2] == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        return img

    @staticmethod
    def rotate_image(image: np.ndarray, angle_deg: float) -> np.ndarray:
        """
        Rotates an RGBA image around its center without cutting off corners.
        """
        if abs(angle_deg) < 0.5:
            return image

        h, w = image.shape[:2]
        center = (w // 2, h // 2)

        rot_mat = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
        cos = np.abs(rot_mat[0, 0])
        sin = np.abs(rot_mat[0, 1])

        # Compute new bounding dimensions
        new_w = int((h * sin) + (w * cos))
        new_h = int((h * cos) + (w * sin))

        rot_mat[0, 2] += (new_w / 2) - center[0]
        rot_mat[1, 2] += (new_h / 2) - center[1]

        return cv2.warpAffine(
            image,
            rot_mat,
            (new_w, new_h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0, 0)
        )

    @classmethod
    def overlay_glasses(
        cls,
        frame: np.ndarray,
        glasses_img: np.ndarray,
        center_x: int,
        center_y: int,
        target_width: int,
        angle_deg: float = 0.0
    ) -> np.ndarray:
        """
        Overlays glasses image centered at (center_x, center_y) with target_width and roll angle.
        Uses vectorized NumPy alpha blending.
        """
        if glasses_img is None or target_width <= 10:
            return frame

        orig_h, orig_w = glasses_img.shape[:2]
        aspect = orig_h / float(orig_w)
        target_height = max(1, int(target_width * aspect))

        # 1. Resize to target dimensions
        resized = cv2.resize(glasses_img, (target_width, target_height), interpolation=cv2.INTER_AREA)

        # 2. Rotate if angle specified
        if abs(angle_deg) >= 0.5:
            resized = cls.rotate_image(resized, angle_deg)
            target_height, target_width = resized.shape[:2]

        # 3. Calculate bounding coordinates on destination frame
        x1 = int(center_x - target_width // 2)
        y1 = int(center_y - target_height // 2)
        x2 = x1 + target_width
        y2 = y1 + target_height

        frame_h, frame_w = frame.shape[:2]

        # Check if entirely outside frame
        if x2 <= 0 or y2 <= 0 or x1 >= frame_w or y1 >= frame_h:
            return frame

        # 4. Clip bounds to frame limits
        overlay_x1 = max(0, -x1)
        overlay_y1 = max(0, -y1)
        overlay_x2 = target_width - max(0, x2 - frame_w)
        overlay_y2 = target_height - max(0, y2 - frame_h)

        frame_x1 = max(0, x1)
        frame_y1 = max(0, y1)
        frame_x2 = min(frame_w, x2)
        frame_y2 = min(frame_h, y2)

        if overlay_x2 <= overlay_x1 or overlay_y2 <= overlay_y1:
            return frame

        # 5. Extract regions
        overlay_crop = resized[overlay_y1:overlay_y2, overlay_x1:overlay_x2]
        frame_roi = frame[frame_y1:frame_y2, frame_x1:frame_x2]

        # Extract RGB and normalized alpha channel
        overlay_rgb = overlay_crop[:, :, :3]
        alpha = (overlay_crop[:, :, 3] / 255.0)[:, :, np.newaxis]

        # Vectorized Alpha Blending
        blended = (alpha * overlay_rgb + (1.0 - alpha) * frame_roi).astype(np.uint8)
        frame[frame_y1:frame_y2, frame_x1:frame_x2] = blended

        return frame
