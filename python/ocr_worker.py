#!/usr/bin/env python3
"""
常驻 OCR worker，通过 stdin/stdout JSON 行协议与 Electron 主进程通信。

协议：
  就绪信号：{"ready": true}
  请求：    {"id": "uuid", "image_b64": "base64..."}
  响应：    {"id": "uuid", "ok": true, "text": "...", "words": [...], "icons": [...]}
  错误：    {"id": "uuid", "ok": false, "error": "traceback"}
"""
import sys
import os
import json
import base64
import traceback
import numpy as np
import cv2

# ─── 模型目录：由 Electron 通过环境变量传入，确保所有数据在 app 目录下 ────
MODEL_DIR = os.environ.get('OCR_MODEL_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models'))
MODEL_DIR = os.path.abspath(MODEL_DIR)
os.makedirs(MODEL_DIR, exist_ok=True)

# 将所有缓存重定向到 app 目录，确保不依赖用户 home 目录
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'
os.environ['PADDLE_PDX_CACHE_HOME'] = MODEL_DIR
os.environ['HF_HOME'] = os.path.join(MODEL_DIR, '.hf')
os.environ['HF_HUB_CACHE'] = os.path.join(MODEL_DIR, '.hf', 'hub')

from paddleocr import PaddleOCR

# 确保 stdout 行缓冲，防止 Node.js 读不到数据
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# ─── 初始化 PaddleOCR ─────────────────────────────────────────────────────────
DET_MODEL_DIR = os.path.join(MODEL_DIR, 'official_models', 'PP-OCRv5_server_det')
REC_MODEL_DIR = os.path.join(MODEL_DIR, 'official_models', 'PP-OCRv5_server_rec')

def _send_status(msg):
    """向 Electron 发送初始化状态消息。"""
    print(json.dumps({'status': msg}), flush=True)

def _check_models_cached():
    """检查 PaddleOCR 模型是否已缓存到本地。"""
    return os.path.isdir(DET_MODEL_DIR) and os.path.isdir(REC_MODEL_DIR)

if _check_models_cached():
    _send_status('正在加载 OCR 模型...')
else:
    _send_status('首次使用，正在下载 OCR 模型...')

ocr = PaddleOCR(
    lang='ch',
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    text_det_thresh=0.2,
    text_det_box_thresh=0.4,
    text_recognition_batch_size=16,
)

_send_status('OCR 模型加载完成')

# ─── 加载图标模板 ──────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_icon_templates():
    """加载金币和金砖模板，生成多尺度灰度模板用于匹配。"""
    templates = {}
    for name in ('金币', '金砖'):
        path = os.path.join(SCRIPT_DIR, f'{name}.png')
        if not os.path.exists(path):
            print(f'[OCR] Warning: icon template not found: {path}', file=sys.stderr)
            continue
        img = cv2.imread(path, cv2.IMREAD_COLOR)
        if img is None:
            continue
        templates[name] = img
    return templates


ICON_TEMPLATES = load_icon_templates()


def preprocess_image(img):
    """
    对游戏截图进行预处理以提升 OCR 准确率：
    1. 统一缩放到合理高度（过矮的图放大）
    2. 转灰度 + 对比度增强（CLAHE）
    3. 自适应阈值二值化
    """
    h, w = img.shape[:2]

    # 矮图放大（单行截图通常 < 80px），确保文字高度足够
    min_height = 80
    if h < min_height:
        scale = max(2, min_height / h)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    return img


def preprocess_for_ocr(img):
    """
    生成用于 OCR 的增强图像（不影响原图上的模板匹配）。
    对深色背景浅色文字场景做反色+对比度增强。
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 判断是否深色背景（取四角均值）
    corners = [
        gray[0, 0], gray[0, w - 1],
        gray[h - 1, 0], gray[h - 1, w - 1]
    ]
    avg_corner = np.mean(corners)

    if avg_corner < 128:
        # 深色背景 → 反色，让文字变黑底白
        gray = cv2.bitwise_not(gray)

    # CLAHE 自适应对比度增强
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 转回 BGR（PaddleOCR 期望 3 通道）
    return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)


def detect_icons(img):
    """
    用多尺度模板匹配检测金币和金砖图标。
    返回图标列表：[{type: "金币"|"金砖", x0, y0, x1, y1, cx, cy}]
    """
    if not ICON_TEMPLATES:
        return []

    icons = []
    h_img, w_img = img.shape[:2]

    # 图标在图中的预期高度范围：行高的 40%~120%
    # 游戏 UI 中图标与文字等高或略小
    for icon_name, template in ICON_TEMPLATES.items():
        th, tw = template.shape[:2]

        # 多尺度匹配：根据图像高度估算合理的图标尺寸范围
        # 单行截图图标大约占高度的 30%~80%
        min_icon_h = max(10, int(h_img * 0.2))
        max_icon_h = max(min_icon_h + 1, int(h_img * 0.9))

        best_val = -1
        best_loc = None
        best_scale = 1.0

        for icon_h in range(min_icon_h, max_icon_h + 1, max(1, (max_icon_h - min_icon_h) // 10)):
            scale = icon_h / th
            icon_w = int(tw * scale)
            if icon_w < 5 or icon_h < 5:
                continue
            if icon_w >= w_img or icon_h >= h_img:
                continue

            resized = cv2.resize(template, (icon_w, icon_h), interpolation=cv2.INTER_AREA)
            result = cv2.matchTemplate(img, resized, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)

            if max_val > best_val:
                best_val = max_val
                best_loc = max_loc
                best_scale = scale

        # 阈值：0.55 对游戏截图的金色图标足够可靠
        if best_val >= 0.55 and best_loc is not None:
            icon_w = int(tw * best_scale)
            icon_h = int(th * best_scale)
            x0, y0 = best_loc
            # 查找所有匹配位置（同一尺度下可能有多个图标）
            resized = cv2.resize(template, (icon_w, icon_h), interpolation=cv2.INTER_AREA)
            result = cv2.matchTemplate(img, resized, cv2.TM_CCOEFF_NORMED)

            # 找所有超过阈值的位置
            locations = np.where(result >= max(0.55, best_val * 0.85))
            matched_points = list(zip(locations[1].tolist(), locations[0].tolist()))

            # NMS：合并邻近的检测点
            merged = _nms_points(matched_points, icon_w, icon_h)
            for (mx, my) in merged:
                icons.append({
                    'type': icon_name,
                    'x0': mx,
                    'y0': my,
                    'x1': mx + icon_w,
                    'y1': my + icon_h,
                    'cx': mx + icon_w // 2,
                    'cy': my + icon_h // 2,
                    'confidence': float(best_val)
                })

    # 跨类型 NMS：同一位置只保留置信度最高的图标
    icons.sort(key=lambda i: -i['confidence'])
    final = []
    for ic in icons:
        overlap = False
        for kept in final:
            if abs(ic['cx'] - kept['cx']) < (ic['x1'] - ic['x0']) * 0.5 and \
               abs(ic['cy'] - kept['cy']) < (ic['y1'] - ic['y0']) * 0.5:
                overlap = True
                break
        if not overlap:
            final.append(ic)

    final.sort(key=lambda i: i['x0'])
    return final


def _nms_points(points, w, h):
    """简单的非极大值抑制：合并距离小于 icon 尺寸一半的点。"""
    if not points:
        return []
    # 按 x 排序
    pts = sorted(points, key=lambda p: (p[0], p[1]))
    merged = [pts[0]]
    for p in pts[1:]:
        last = merged[-1]
        if abs(p[0] - last[0]) < w * 0.5 and abs(p[1] - last[1]) < h * 0.5:
            continue
        merged.append(p)
    return merged


def erase_icons_from_image(img, icons):
    """将检测到的图标区域用周围背景色填充，避免干扰 OCR。"""
    if not icons:
        return img

    result = img.copy()
    h, w = result.shape[:2]

    for icon in icons:
        x0 = max(0, icon['x0'] - 1)
        y0 = max(0, icon['y0'] - 1)
        x1 = min(w, icon['x1'] + 1)
        y1 = min(h, icon['y1'] + 1)

        # 取图标右侧或左侧的背景色
        bg_x = min(x1 + 2, w - 1)
        if bg_x >= w:
            bg_x = max(x0 - 2, 0)
        bg_color = result[h // 2, bg_x].tolist()
        result[y0:y1, x0:x1] = bg_color

    return result


def b64_to_numpy(image_b64):
    """将 base64 图片（支持 data URL 和纯 base64）转为 numpy BGR 数组。"""
    if ',' in image_b64:
        image_b64 = image_b64.split(',', 1)[1]
    data = base64.b64decode(image_b64)
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('cv2.imdecode returned None, invalid image data')
    return img


def process_request(req):
    req_id = req.get('id', '')
    image_b64 = req.get('image_b64', '')
    img = b64_to_numpy(image_b64)

    # 1. 预处理（缩放）
    img = preprocess_image(img)

    # 2. 图标检测（在原图上做，颜色信息完整）
    icons = detect_icons(img)

    # 3. 擦除图标区域
    cleaned = erase_icons_from_image(img, icons)

    # 4. OCR 预处理（对比度增强等）
    ocr_img = preprocess_for_ocr(cleaned)

    # 5. PaddleOCR 识别 (v3.4+ API: predict 返回 OCRResult 迭代器)
    words = []
    text_lines = []

    for result in ocr.predict(ocr_img):
        rec_texts = result.get('rec_texts', [])
        rec_scores = result.get('rec_scores', [])
        rec_polys = result.get('rec_polys', [])

        for i, text in enumerate(rec_texts):
            score = rec_scores[i] if i < len(rec_scores) else 0.0
            poly = rec_polys[i] if i < len(rec_polys) else None

            if poly is not None:
                xs = [int(pt[0]) for pt in poly]
                ys = [int(pt[1]) for pt in poly]
                x0 = min(xs)
                y0 = min(ys)
                x1 = max(xs)
                y1 = max(ys)
            else:
                x0 = y0 = x1 = y1 = 0

            words.append({
                'text': text,
                'x0': x0,
                'y0': y0,
                'x1': x1,
                'y1': y1,
                'confidence': round(float(score), 4)
            })
            text_lines.append(text)

    full_text = '\n'.join(text_lines)

    # 简化图标信息返回给前端
    icon_results = [{
        'type': ic['type'],
        'x0': ic['x0'],
        'y0': ic['y0'],
        'x1': ic['x1'],
        'y1': ic['y1'],
        'cx': ic['cx'],
        'cy': ic['cy'],
    } for ic in icons]

    return {
        'id': req_id,
        'ok': True,
        'text': full_text,
        'words': words,
        'icons': icon_results
    }


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
