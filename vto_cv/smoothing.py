"""
Temporal Smoothing Module for Virtual Try-On.

Provides Exponential Moving Average (EMA) smoothing to eliminate high-frequency
landmark jitter and provide smooth, lag-free transitions in real-time camera feeds.
Works in pure Python with zero external dependencies for maximum speed and compatibility.
"""

from typing import Optional, Tuple


class TemporalSmoother:
    """
    Exponential Moving Average (EMA) filter with velocity-adaptive smoothing.
    """
    def __init__(self, alpha_pos: float = 0.35, alpha_size: float = 0.25, alpha_angle: float = 0.30):
        self.alpha_pos = alpha_pos
        self.alpha_size = alpha_size
        self.alpha_angle = alpha_angle

        self.smoothed_x: Optional[float] = None
        self.smoothed_y: Optional[float] = None
        self.smoothed_w: Optional[float] = None
        self.smoothed_h: Optional[float] = None
        self.smoothed_angle: float = 0.0

        self.smoothed_left_eye: Optional[Tuple[float, float]] = None
        self.smoothed_right_eye: Optional[Tuple[float, float]] = None

        self.lost_frames: int = 0
        self.max_hold_frames: int = 10  # Hold last position for up to 10 dropped frames

    def reset(self):
        """Reset all smoothed states."""
        self.smoothed_x = None
        self.smoothed_y = None
        self.smoothed_w = None
        self.smoothed_h = None
        self.smoothed_angle = 0.0
        self.smoothed_left_eye = None
        self.smoothed_right_eye = None
        self.lost_frames = 0

    def smooth_box(self, x: int, y: int, w: int, h: int) -> Tuple[int, int, int, int]:
        """Smooth bounding box coordinates."""
        if self.smoothed_x is None:
            self.smoothed_x = float(x)
            self.smoothed_y = float(y)
            self.smoothed_w = float(w)
            self.smoothed_h = float(h)
            self.lost_frames = 0
            return x, y, w, h

        # Velocity-adaptive alpha: higher speed -> more responsive
        dx = abs(x - self.smoothed_x)
        dy = abs(y - self.smoothed_y)
        speed = (dx * dx + dy * dy) ** 0.5
        adaptive_pos = min(0.70, max(self.alpha_pos, speed * 0.03))

        self.smoothed_x += adaptive_pos * (x - self.smoothed_x)
        self.smoothed_y += adaptive_pos * (y - self.smoothed_y)
        self.smoothed_w += self.alpha_size * (w - self.smoothed_w)
        self.smoothed_h += self.alpha_size * (h - self.smoothed_h)
        self.lost_frames = 0

        return (
            int(round(self.smoothed_x)),
            int(round(self.smoothed_y)),
            int(round(self.smoothed_w)),
            int(round(self.smoothed_h))
        )

    def smooth_angle(self, angle_deg: float) -> float:
        """Smooth rotation angle in degrees."""
        if self.smoothed_angle == 0.0:
            self.smoothed_angle = angle_deg
            return angle_deg

        self.smoothed_angle += self.alpha_angle * (angle_deg - self.smoothed_angle)
        return self.smoothed_angle

    def smooth_eyes(
        self,
        left_eye: Tuple[int, int],
        right_eye: Tuple[int, int]
    ) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """Smooth eye center points."""
        lx, ly = left_eye
        rx, ry = right_eye

        if self.smoothed_left_eye is None:
            self.smoothed_left_eye = (float(lx), float(ly))
            self.smoothed_right_eye = (float(rx), float(ry))
            return left_eye, right_eye

        slx, sly = self.smoothed_left_eye
        srx, sry = self.smoothed_right_eye

        new_slx = slx + self.alpha_pos * (lx - slx)
        new_sly = sly + self.alpha_pos * (ly - sly)
        new_srx = srx + self.alpha_pos * (rx - srx)
        new_sry = sry + self.alpha_pos * (ry - sry)

        self.smoothed_left_eye = (new_slx, new_sly)
        self.smoothed_right_eye = (new_srx, new_sry)

        return (
            (int(round(new_slx)), int(round(new_sly))),
            (int(round(new_srx)), int(round(new_sry)))
        )

    def get_last_box(self) -> Optional[Tuple[int, int, int, int]]:
        """Return last known bounding box if within hold window."""
        self.lost_frames += 1
        if self.smoothed_x is not None and self.lost_frames <= self.max_hold_frames:
            return (
                int(round(self.smoothed_x)),
                int(round(self.smoothed_y)),
                int(round(self.smoothed_w)),
                int(round(self.smoothed_h))
            )
        return None
