# LENS MART - Real-Time Python Virtual Eyewear Try-On

An advanced, real-time computer vision virtual eyewear try-on application built with **Python**, **OpenCV**, and **NumPy** (inspired by Nikita Jaiswal's virtual try-on architecture, engineered with temporal smoothing, vectorized alpha-blending, affine rotation, and interactive controls).

---

## 🚀 Key Features

1. **Computer Vision Face & Eye Tracking**:
   - Uses OpenCV Haar Cascades (`haarcascade_frontalface_default.xml` & `haarcascade_eye.xml`) to detect faces and eye lines.
   - Computes head roll angle (`angle_deg`) so glasses tilt naturally as you tilt your head.

2. **Vectorized Alpha Blending & Affine Rotation**:
   - Seamlessly blends 4-channel BGRA transparent PNG glasses onto camera frames without clipping errors or black border artifacts.
   - Preserves high-definition transparency and drop shadows.

3. **Temporal Exponential Moving Average (EMA) Smoothing**:
   - Prevents micro-jitter and frame-by-frame shaking while remaining snappy during fast head motion.

4. **Multi-Model Cycling & Custom Upload**:
   - Built-in models:
     - Classic Wayfarer (`01_classic_wayfarer.png`)
     - Aviator Horizon Gold (`02_aviator_gold.png`)
     - Retro Round Titan (`03_retro_round.png`)
     - Sport Polarized Shield (`04_sport_polarized.png`)
     - Solstice Cat-Eye (`glass2.png`)
   - Drop any new transparent `.png` into `assets/sunglasses/` or upload via the web UI.

---

## 📦 Installation

Ensure you have Python 3.9+ installed:

```bash
cd vto_cv
pip install -r requirements.txt
```

---

## 🎮 1. Run Desktop Application (OpenCV Window)

Launch the standalone OpenCV desktop window:

```bash
python tryon.py
```

### Keyboard Shortcuts:
| Key | Action |
|---|---|
| `S` or `N` | Switch to **Next** glasses model |
| `P` | Switch to **Previous** glasses model |
| `+` or `=` | **Increase** eyewear scale |
| `-` | **Decrease** eyewear scale |
| `W` | Move glasses **UP** (adjust bridge height) |
| `X` | Move glasses **DOWN** |
| `C` | Capture high-res photo snapshot to `snapshots/` |
| `H` | Toggle on-screen Heads-Up Display (HUD) |
| `Q` or `E` or `ESC` | Exit application |

---

## 🌐 2. Run Web Server (Flask)

Launch the browser-based virtual try-on portal:

```bash
python app.py
```

Then open your browser at:
👉 **`http://localhost:5001`**

- Stream webcam feed with real-time glasses overlay.
- Upload new custom PNG glasses through the web form.
- Switch between models with one click.
- Calibrate size and bridge height using live sliders.

---

## 📁 Project Architecture

```
vto_cv/
├── assets/
│   └── sunglasses/          # Transparent PNG eyewear models (BGRA)
├── cascades/                # Optional custom Haar cascades
├── snapshots/               # Saved photo snapshots from try-on sessions
├── templates/
│   └── index.html           # Modern Tailwind CSS web interface
├── app.py                   # Flask streaming web server
├── face_detector.py         # OpenCV Haar cascade face & eye detector
├── overlay_engine.py        # Vectorized alpha blending and affine rotation
├── smoothing.py             # Velocity-adaptive temporal EMA smoother
├── tryon.py                 # Interactive OpenCV desktop application
└── requirements.txt         # Dependencies (opencv-python, numpy, Flask)
```
