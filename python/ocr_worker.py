#!/usr/bin/env python3
"""
常驻 OCR worker，通过 stdin/stdout JSON 行协议与 Electron 主进程通信。

协议：
  就绪信号：{"ready": true}
  请求：    {"id": "uuid", "image_b64": "base64..."}
  响应：    {"id": "uuid", "ok": true, "text": "...", "words": [{text,x0,y0,x1,y1}]}
  错误：    {"id": "uuid", "ok": false, "error": "traceback"}
"""
import sys
import json
import base64
import traceback
import io
import numpy as np
import cv2
from rapidocr_onnxruntime import RapidOCR

# 确保 stdout 行缓冲，防止 Node.js 读不到数据
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

ocr = RapidOCR()


def b64_to_numpy(image_b64: str) -> np.ndarray:
    """将 base64 图片（支持 data URL 和纯 base64）转为 numpy BGR 数组。"""
    if ',' in image_b64:
        image_b64 = image_b64.split(',', 1)[1]
    data = base64.b64decode(image_b64)
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('cv2.imdecode returned None, invalid image data')
    return img


def process_request(req: dict) -> dict:
    req_id = req.get('id', '')
    image_b64 = req.get('image_b64', '')
    img = b64_to_numpy(image_b64)

    result, _ = ocr(img)

    words = []
    text_lines = []

    if result:
        for item in result:
            # item: [box_points, text, score]
            # box_points: [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] 四边形角点
            box = item[0]
            text = item[1] if len(item) > 1 else ''

            xs = [pt[0] for pt in box]
            ys = [pt[1] for pt in box]
            x0 = int(min(xs))
            y0 = int(min(ys))
            x1 = int(max(xs))
            y1 = int(max(ys))

            words.append({
                'text': text,
                'x0': x0,
                'y0': y0,
                'x1': x1,
                'y1': y1
            })
            text_lines.append(text)

    full_text = '\n'.join(text_lines)
    return {'id': req_id, 'ok': True, 'text': full_text, 'words': words}


def main():
    # 发送就绪信号
    print(json.dumps({'ready': True}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = ''
        try:
            req = json.loads(line)
            req_id = req.get('id', '')
            response = process_request(req)
        except Exception:
            response = {
                'id': req_id,
                'ok': False,
                'error': traceback.format_exc()
            }
        print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
