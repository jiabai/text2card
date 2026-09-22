#!/usr/bin/env python3
"""从 text2card 网页版仓库同步文案。

网页版是 Next.js 项目（D:\\Github\\text2card），文案散落在各专题页的模板字符串里。
这个脚本把它们抽出来，转成小程序可直接 require 的 CommonJS 模块。

用法：
    python tools/sync-presets.py

产出：
    config/presets.js   { quote: [...], morning: [...], birthday: [...] }

注意：本脚本不再导出配色。卡片风格已改为对齐线上新版 Text2Card
（card.pomodiary.com）的五套版式风格，定义手写在 config/styles.js 里，
网页版仓库的 colorThemes.ts 是旧版的配色主题，两者不是一回事。

处理规则：
  - 正文字符串按空行切成段落。
  - 末段如果是 "- xxx" 形式且足够短，当成署名剥离出来，交给卡片渲染。
  - 按正文前 80 字符去重（网页版里存在重复条目）。
"""

import json
import os
import re
import sys

WEB = os.environ.get('T2C_WEB_ROOT', r'D:\Github\text2card')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'config')

SOURCES = {
    'quote': (r'app\inspirational-quotes\page.tsx', 'inspirationalQuotes', 'array'),
    'morning': (r'app\good-morning-images\GoodMorningClient.tsx', 'morningGreetings', 'array'),
    'birthday': (r'app\happy-birthday-images\page.tsx', 'defaultBirthdayText', 'single'),
}


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def grab_array(src, varname):
    i = src.find('const ' + varname)
    if i < 0:
        raise SystemExit('找不到变量 ' + varname)
    k = src.find('[', i)
    j = src.find('];', k)
    return re.findall(r'`([^`]*)`', src[k:j + 1], re.S)


def grab_single(src, varname):
    i = src.find('const ' + varname)
    if i < 0:
        raise SystemExit('找不到变量 ' + varname)
    k = src.find('`', i)
    j = src.find('`', k + 1)
    return src[k + 1:j]


def split_author(text):
    text = text.strip()
    parts = [p.strip() for p in text.split('\n\n') if p.strip()]
    if len(parts) > 1:
        last = parts[-1]
        if last.startswith('- ') and len(last) < 60:
            return '\n\n'.join(parts[:-1]).strip(), last[2:].strip()
    return text, ''


def pack(raws):
    out, seen = [], set()
    for raw in raws:
        content, author = split_author(raw)
        if not content:
            continue
        key = content[:80]
        if key in seen:
            continue
        seen.add(key)
        out.append({'content': content, 'author': author})
    return out


def dump(path, header, payload):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(header)
        f.write('module.exports = ')
        f.write(json.dumps(payload, ensure_ascii=False, indent=2))
        f.write(';\n')


def main():
    os.makedirs(OUT, exist_ok=True)

    presets = {}
    for key, (rel, varname, kind) in SOURCES.items():
        src = read(os.path.join(WEB, rel))
        raws = grab_array(src, varname) if kind == 'array' else [grab_single(src, varname)]
        presets[key] = pack(raws)
        print('%-9s %d 条' % (key, len(presets[key])))

    dump(
        os.path.join(OUT, 'presets.js'),
        '// 文案库：由 tools/sync-presets.py 从 text2card 网页版自动导出，请勿手改。\n'
        '// author 为从正文末段 "- xxx" 剥离出的署名，交给卡片右下角小字渲染。\n',
        presets,
    )

    print('写入目录 ' + OUT)


if __name__ == '__main__':
    sys.exit(main())
