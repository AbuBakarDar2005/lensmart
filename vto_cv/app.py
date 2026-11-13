"""
LENS MART Flask Web Application for Virtual Eyewear Try-On.

Recreates and upgrades Nikita's Flask Try-On web architecture:
- Streaming video endpoint (/video_feed)
- Glasses gallery & upload endpoint (/upload)
- Snapshot capture API
- Responsive browser-based UI
"""

import os
import sys
import time
import glob
import cv2
from flask import Flask, render_template, Response, request, redirect, url_for, jsonify

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from face_detector import FaceDetector
from overlay_engine import OverlayEngine
from smoothing import TemporalSmoother

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'sunglasses')
app.config['SNAPSHOT_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snapshots')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['SNAPSHOT_FOLDER'], exist_ok=True)

detector = FaceDetector()
smoother = TemporalSmoother(alpha_pos=0.40, alpha_size=0.25, alpha_angle=0.30)

active_glasses_idx = 0
user_scale = 1.05
user_offset_y = 0


def get_glasses_models():
    files = sorted(glob.glob(os.path.join(app.config['UPLOAD_FOLDER'], '*.png')))
    models = []
    for idx, path in enumerate(files):
        fname = os.path.basename(path)
        name = os.path.splitext(fname)[0].replace('_', ' ').title()
        models.append({
            'id': idx,
            'name': name,
            'filename': fname,
            'path': path
        })
    return models


camera = None

def get_camera():
    global camera
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return camera


def generate_frames():
    global active_glasses_idx, user_scale, user_offset_y
    cam = get_camera()

    while True:
        success, frame = cam.read()
        if not success:
            break

        frame = cv2.flip(frame, 1)

        # Detect face
        face_result = detector.detect(frame)
        models = get_glasses_models()

        if models and 0 <= active_glasses_idx < len(models):
            glasses_path = models[active_glasses_idx]['path']
            glasses_img = OverlayEngine.load_glasses(glasses_path)

            if face_result.detected:
                fx, fy, fw, fh = smoother.smooth_box(*face_result.box)
                angle = smoother.smooth_angle(face_result.angle_deg)
                cx = fx + fw // 2
                cy = fy + int(fh * 0.36) + user_offset_y
                gw = int(fw * user_scale)

                frame = OverlayEngine.overlay_glasses(
                    frame=frame,
                    glasses_img=glasses_img,
                    center_x=cx,
                    center_y=cy,
                    target_width=gw,
                    angle_deg=angle
                )
            else:
                last_box = smoother.get_last_box()
                if last_box:
                    fx, fy, fw, fh = last_box
                    cx = fx + fw // 2
                    cy = fy + int(fh * 0.36) + user_offset_y
                    gw = int(fw * user_scale)
                    frame = OverlayEngine.overlay_glasses(
                        frame=frame,
                        glasses_img=glasses_img,
                        center_x=cx,
                        center_y=cy,
                        target_width=gw,
                        angle_deg=0.0
                    )

        # Watermark
        cv2.putText(frame, "LENS MART Web VTO", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 180, 216), 2, cv2.LINE_AA)

        ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


@app.route('/')
def index():
    models = get_glasses_models()
    return render_template('index.html', models=models, active_idx=active_glasses_idx)


@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/select_model/<int:idx>', methods=['POST'])
def select_model(idx):
    global active_glasses_idx
    models = get_glasses_models()
    if 0 <= idx < len(models):
        active_glasses_idx = idx
        return jsonify({'success': True, 'model': models[idx]})
    return jsonify({'success': False, 'error': 'Invalid model index'}), 400


@app.route('/upload', methods=['POST'])
def upload_glasses():
    global active_glasses_idx
    if 'file' not in request.files:
        return redirect(url_for('index'))
    f = request.files['file']
    if f.filename == '':
        return redirect(url_for('index'))

    if f and f.filename.lower().endswith('.png'):
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], f.filename)
        f.save(save_path)
        models = get_glasses_models()
        active_glasses_idx = len(models) - 1

    return redirect(url_for('index'))


@app.route('/api/adjust', methods=['POST'])
def adjust():
    global user_scale, user_offset_y
    data = request.get_json() or {}
    if 'scale' in data:
        user_scale = float(data['scale'])
    if 'offset_y' in data:
        user_offset_y = int(data['offset_y'])
    return jsonify({'success': True, 'scale': user_scale, 'offset_y': user_offset_y})


if __name__ == '__main__':
    print("[*] Starting LENS MART Flask Try-On Server on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)
