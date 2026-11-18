#!/usr/bin/env python3
"""从 JX3Box 拉技艺配方，生成 src/modules/tools/craft/craftData.json。

出新资料片后重跑一次即可：python3 scripts/build-craft-data.py

- 配方：node.jx3box.com/manufactures?type=<技艺>&ids=...（单次最多返回 20 条，只能按 ID 段批量拉）
- 物品名：node.jx3box.com/item_merged/id/<id,id,...>
- 只保留最近 MIN_DLC 及以后资料片的配方；梓匠（furniture）在 JX3Box 没有资料片标记，全部保留。
- 漏标资料片的新配方按产物物品 ID 补（见 untagged_new）。
"""
import json
import os
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

PROFESSIONS = {'cooking': '烹饪', 'tailoring': '缝纫', 'founding': '铸造', 'medicine': '医术', 'furniture': '梓匠'}
NO_DLC_TABS = {'furniture'}
MIN_DLC = 8
# 资料片配方名前缀：两个资料片都有的同款配方（如 风语·瀑沙熔锭 / 苍生·瀑沙熔锭）只留新资料片的
DLC_PREFIXES = ('风语', '苍生')
MAX_ID = 8000
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'modules', 'tools', 'craft', 'craftData.json')


def get_json(url, retries=4):
    # 用 curl 而不是 urllib：部分 Python 环境缺根证书，HTTPS 会校验失败
    # JX3Box 并发高时偶尔回空响应，重试几次
    for attempt in range(retries):
        raw = subprocess.run(['curl', '-s', '-m', '20', url], capture_output=True).stdout
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            if attempt == retries - 1:
                raise
            time.sleep(1 + attempt)


def fetch_recipes(tab):
    def batch(start):
        ids = ','.join(str(i) for i in range(start, start + 20))
        data = get_json(f'https://node.jx3box.com/manufactures?client=std&type={tab}&ids={ids}')
        return data if isinstance(data, list) else []
    with ThreadPoolExecutor(8) as ex:
        rows = [r for b in ex.map(batch, range(1, MAX_ID + 1, 20)) for r in b]
    return [r for r in rows if r.get('ID')]


def convert(tab, r):
    mats, outs = [], []
    for i in range(1, 9):
        count = r.get(f'RequireItemCount{i}')
        if count:
            mats.append([f"{r[f'RequireItemType{i}']}_{r[f'RequireItemIndex{i}']}", count])
        idx = r.get(f'CreateItemIndex{i}')
        if idx:
            prob = (r.get(f'CreateItemProbability{i}') or 1048576) / 1048576
            outs.append([f"{r[f'CreateItemType{i}']}_{idx}", r.get(f'CreateItemMin{i}') or 1,
                         r.get(f'CreateItemMax{i}') or 1, round(prob, 4)])
    return {
        'id': f"{tab}_{r['ID']}",
        'prof': PROFESSIONS[tab],
        'name': r['Name'],
        'vigor': r.get('CostVigor') or 0,
        'dlc': r.get('nDlc') or 0,
        'mats': mats,
        'outs': outs,
    }


def post_json(url, payload):
    raw = subprocess.run(['curl', '-s', '-m', '30', '-X', 'POST', '-H', 'Content-Type: application/json',
                          '-d', json.dumps(payload), url], capture_output=True).stdout
    data = json.loads(raw)
    return data if isinstance(data, list) else [data]


def fmt_duration(seconds):
    seconds = int(seconds)
    if seconds % 3600 == 0:
        return f'{seconds // 3600}小时'
    if seconds % 60 == 0:
        return f'{seconds // 60}分钟'
    return f'{seconds}秒'


def resolve_effects(rows):
    """把物品描述里的 <ENCHANT id> / <BUFF id lv desc|time> 解析成文字（JX3Box 物品页同款规则）。

    - 附魔：AttriName，有 Time（秒）时补「，持续 N 分钟」
    - 增益描述：Desc 里的 <BUFF atXxx> 换成该级增益 BeginAttribN == atXxx 对应的 BeginValueNA
    - 增益时长：Interval 是逻辑帧，16 帧 = 1 秒
    - 装备：没有「使用：」描述，用属性列表（体质提高618 / …）
    """
    texts = {}
    for x in rows:
        desc = x.get('Desc') or ''
        # 只取 font=105 的「使用：」段，font=100 的是风味文字
        parts = re.findall(r'text="(.*?)"\s*font=105', desc, re.S)
        text = ''.join(parts).replace('\\\n', '').replace('\\n', '').replace('\n', '').strip()
        if text:
            texts[x['id']] = text
    enchant_ids = sorted({m for t in texts.values() for m in re.findall(r'<ENCHANT (\d+)>', t)})
    buff_keys = sorted({f'{a}_{b}' for t in texts.values() for a, b, _ in re.findall(r'<BUFF (\d+) (\d+) (desc|time)>', t)})
    enchants = {str(e['ID']): e for e in post_json('https://node.jx3box.com/resource/std/enchant/', {'ids': enchant_ids})} if enchant_ids else {}
    buffs = {f"{b['BuffID']}_{b['Level']}": b for b in post_json('https://node.jx3box.com/resource/std/buff/', {'ids': buff_keys})} if buff_keys else {}

    def enchant_text(m):
        e = enchants.get(m.group(1))
        if not e:
            return ''
        return e.get('AttriName', '') + (f"，持续{fmt_duration(e['Time'])}" if e.get('Time') else '')

    def buff_text(m):
        b = buffs.get(f'{m.group(1)}_{m.group(2)}')
        if not b:
            return ''
        if m.group(3) == 'time':
            return fmt_duration(int(b.get('Interval') or 0) / 16)
        attrs = {b.get(f'BeginAttrib{i}'): b.get(f'BeginValue{i}A') for i in range(1, 15)}
        return re.sub(r'<BUFF (\w+)>', lambda a: str(attrs.get(a.group(1), '?')), b.get('Desc') or '')

    out = {}
    for x in rows:
        text = texts.get(x['id'])
        if text:
            text = re.sub(r'<ENCHANT (\d+)>', enchant_text, text)
            text = re.sub(r'<BUFF (\d+) (\d+) (desc|time)>', buff_text, text)
            text = re.sub(r'<[^>]+>', '', text)  # 其他没解析的模板直接去掉
            text = re.sub(r'^使用：', '', text).strip().rstrip('\\').strip()
        # 装备特效属性的 label 本身是一段 <Text text="..."> 标记，取出文字
        attrs = [re.sub(r'<Text>text="(.*?)".*?</text>', r'\1', a['label'], flags=re.S).strip()
                 for a in (x.get('attributes') or []) if a.get('label')]
        if attrs and (not text or '拆解' in text):
            text = ' / '.join(attrs)
        if text:
            out[x['id']] = text
    return out


def main():
    all_recipes = []
    for tab in PROFESSIONS:
        rows = fetch_recipes(tab)
        print(f'{tab}: {len(rows)} 条配方')
        all_recipes += [convert(tab, r) for r in rows]

    # 补精力食物（转神餐 / 佛跳墙）的配方是老配方，单独补进来，供「自制补精力」算成本
    vigor_food_ids = {'5_31013', '5_31012'}

    # JX3Box 有些新配方漏标资料片（百炼水煮鱼、引元丹、营地道具等）。
    # 按产物物品 ID 判断：比 MIN_DLC 之前所有资料片产物 ID 都大的，就是新资料片的东西
    def out_index(r):
        return int(r['outs'][0][0].split('_')[1]) if r['outs'] else 0
    old_max = max(out_index(r) for r in all_recipes if 0 < r['dlc'] < MIN_DLC)

    def untagged_new(r):
        return r['dlc'] == 0 and r['id'].split('_')[0] not in NO_DLC_TABS and out_index(r) > old_max

    picked = [r for r in all_recipes
              if r['dlc'] >= MIN_DLC or r['id'].split('_')[0] in NO_DLC_TABS or untagged_new(r)
              or (r['outs'] and r['outs'][0][0] in vigor_food_ids)]
    print(f'未标资料片、按物品 ID（> {old_max}）补进来：', ' '.join(r['name'] for r in picked if untagged_new(r)))

    # 同技艺里去掉资料片前缀和括号属性后同名的，只保留资料片号最大的那条
    def stem(name):
        name = re.sub(r'^(%s)·' % '|'.join(DLC_PREFIXES), '', name)
        return re.sub(r'（.*?）', '', name)
    newest = {}
    for r in picked:
        if r['dlc']:
            k = (r['prof'], stem(r['name']))
            newest[k] = max(newest.get(k, 0), r['dlc'])
    dropped = [r for r in picked if r['dlc'] and r['dlc'] < newest[(r['prof'], stem(r['name']))]]
    if dropped:
        print('被新资料片同款替换：', ' '.join(r['name'] for r in dropped))
    drop_ids = {r['id'] for r in dropped}
    picked = [r for r in picked if r['id'] not in drop_ids]

    recipes = sorted(picked, key=lambda r: (r['prof'], -r['dlc'], r['id']))

    # 中间件：当前配方用到、且本技艺有配方能做出来的材料（锭/布/酱料/药引等），页面顶部单独展示实时价
    made_by = {}
    for r in all_recipes:
        if r['outs']:
            made_by.setdefault(r['outs'][0][0], set()).add(r['prof'])
    mids = {}
    for r in recipes:
        for item, _ in r['mats']:
            if r['prof'] in made_by.get(item, ()):
                mids.setdefault(r['prof'], [])
                if item not in mids[r['prof']]:
                    mids[r['prof']].append(item)

    # 中间件自己的配方在 JX3Box 上没有资料片标记（nDlc = 0），要单独补进来，否则「配方」取价算不出来
    mid_ids = {i for l in mids.values() for i in l}
    have = {r['id'] for r in recipes}
    recipes += [r for r in all_recipes if r['id'] not in have and r['outs'] and r['outs'][0][0] in mid_ids]
    recipes.sort(key=lambda r: (r['prof'], -r['dlc'], r['id']))

    keys = sorted({k for r in recipes for k, *_ in r['mats'] + r['outs']})

    def lookup(chunk):
        return get_json(f"https://node.jx3box.com/item_merged/id/{','.join(chunk)}?client=std&per=50")['list']
    with ThreadPoolExecutor(6) as ex:
        rows = [x for b in ex.map(lookup, [keys[i:i + 40] for i in range(0, len(keys), 40)]) for x in b]
    items = {x['id']: {'name': x['Name'], 'q': x.get('Quality') or 1} for x in rows}
    # 产物效果（梓匠家具没有使用效果，跳过）
    product_ids = {o[0] for r in recipes if not r['id'].startswith('furniture_') for o in r['outs']}
    for item_id, fx in resolve_effects([x for x in rows if x['id'] in product_ids]).items():
        items[item_id]['fx'] = fx
    missing = [k for k in keys if k not in items]
    if missing:
        print('以下物品查不到名字：', missing)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'recipes': recipes, 'items': items, 'mids': mids}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'写入 {len(recipes)} 条配方、{len(items)} 个物品 -> {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
