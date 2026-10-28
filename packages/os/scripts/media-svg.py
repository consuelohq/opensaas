#!/usr/bin/env python3
import argparse
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from xml.etree import ElementTree as ET

SVG_NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG_NS)
ACTIONS = {'create','inspect','render','measure','edit','verify','snapshot','restore'}


def envelope(ok, code, message, data=None, stderr='', exit_code=None, start=None):
    return {
        'ok': ok,
        'code': code,
        'message': message,
        'data': data,
        'stderr': stderr,
        'exitCode': exit_code if exit_code is not None else (0 if ok else 1),
        'durationMs': int((time.time() - start) * 1000) if start else 0,
        'traceId': 'trc_' + uuid.uuid4().hex[:12],
        'apiVersion': '1.0.0',
    }


def parse_json(value, label):
    if value is None:
        return None
    try:
        return json.loads(value)
    except Exception as exc:
        raise ValueError(f'{label} must be valid JSON: {exc}')


def read_svg(args):
    if args.svg is not None:
        return args.svg
    if args.svg_file:
        return Path(args.svg_file).read_text()
    if args.input:
        return Path(args.input).read_text()
    raise ValueError('provide input, svg, or svgFile')


def write_text(path_value, text, dry_run=False):
    if not path_value:
        return None
    path = Path(path_value).expanduser().resolve()
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return str(path)


def parse_tree(svg_text):
    return ET.ElementTree(ET.fromstring(svg_text))


def qname(tag):
    return f'{{{SVG_NS}}}{tag}'


def local_name(tag):
    if '}' in tag:
        return tag.rsplit('}', 1)[1]
    return tag


def all_nodes(root):
    yield root
    for node in root.iter():
        if node is not root:
            yield node


def parent_map(root):
    return {child: parent for parent in root.iter() for child in parent}


def has_class(node, class_name):
    return class_name in node.attrib.get('class', '').split()


def find_node(root, selector):
    if not selector:
        return None
    if selector.startswith('#'):
        wanted = selector[1:]
        for node in all_nodes(root):
            if node.attrib.get('id') == wanted:
                return node
        return None
    if selector.startswith('.'):
        wanted = selector[1:]
        for node in all_nodes(root):
            if has_class(node, wanted):
                return node
        return None
    for node in all_nodes(root):
        if local_name(node.tag) == selector:
            return node
    return None


def require_node(root, selector):
    node = find_node(root, selector)
    if node is None:
        raise ValueError(f'selector not found: {selector}')
    return node


def serialize(root):
    return ET.tostring(root, encoding='unicode') + chr(10)


def build_svg(document):
    if not isinstance(document, dict):
        raise ValueError('document must be an object')
    attrs = {'xmlns': SVG_NS}
    attrs.update({k: str(v) for k, v in document.get('attrs', {}).items()})
    if 'width' in document:
        attrs['width'] = str(document['width'])
    if 'height' in document:
        attrs['height'] = str(document['height'])
    if document.get('viewBox'):
        attrs['viewBox'] = str(document['viewBox'])
    attr_text = ' '.join(f'{k}="{escape_attr(v)}"' for k, v in attrs.items())
    chunks = [f'<svg {attr_text}>']
    if document.get('defs'):
        chunks.append('<defs>')
        chunks.extend(str(x) for x in document['defs'])
        chunks.append('</defs>')
    if document.get('styles'):
        chunks.append('<style>')
        chunks.extend(str(x) for x in document['styles'])
        chunks.append('</style>')
    chunks.extend(str(x) for x in document.get('nodes', []))
    chunks.append('</svg>')
    return chr(10).join(chunks) + chr(10)


def escape_attr(value):
    return str(value).replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


def inspect_svg(svg_text, selectors):
    root = parse_tree(svg_text).getroot()
    ids = []
    classes = []
    texts = []
    images = []
    counts = {'paths': 0, 'groups': 0, 'symbols': 0, 'styles': 0, 'clipPaths': 0, 'masks': 0, 'filters': 0, 'texts': 0, 'images': 0, 'ids': 0, 'classes': 0}
    for node in all_nodes(root):
        tag = local_name(node.tag)
        if node.attrib.get('id'):
            ids.append(node.attrib['id'])
        if node.attrib.get('class'):
            classes.extend(node.attrib['class'].split())
        if tag == 'text':
            texts.append({'attrs': dict(node.attrib), 'text': ''.join(node.itertext()).strip()})
        if tag == 'image':
            images.append(dict(node.attrib))
        if tag == 'path': counts['paths'] += 1
        if tag == 'g': counts['groups'] += 1
        if tag == 'symbol': counts['symbols'] += 1
        if tag == 'style': counts['styles'] += 1
        if tag == 'clipPath': counts['clipPaths'] += 1
        if tag == 'mask': counts['masks'] += 1
        if tag == 'filter': counts['filters'] += 1
    counts['texts'] = len(texts)
    counts['images'] = len(images)
    counts['ids'] = len(ids)
    counts['classes'] = len(classes)
    selector_data = {}
    for selector in selectors or []:
        node = find_node(root, selector)
        selector_data[selector] = {'found': node is not None, **({'tag': local_name(node.tag), 'attrs': dict(node.attrib)} if node is not None else {})}
    return {
        'root': {'width': root.attrib.get('width'), 'height': root.attrib.get('height'), 'viewBox': root.attrib.get('viewBox'), 'attrs': dict(root.attrib)},
        'counts': counts,
        'ids': ids,
        'classes': sorted(set(classes)),
        'texts': texts,
        'images': images,
        'hasEmbeddedRaster': 'base64' in svg_text or 'data:image' in svg_text,
        'missingHrefs': find_missing_hrefs(root),
        'selectors': selector_data,
    }


def find_missing_hrefs(root):
    ids = {node.attrib.get('id') for node in all_nodes(root) if node.attrib.get('id')}
    missing = []
    for node in all_nodes(root):
        href = node.attrib.get('href') or node.attrib.get('{http://www.w3.org/1999/xlink}href')
        if href and href.startswith('#') and href[1:] not in ids:
            missing.append(href)
    return sorted(set(missing))


def set_transform(node, transform):
    current = node.attrib.get('transform')
    node.set('transform', f'{current} {transform}' if current else transform)


def translate_node(node, dx, dy):
    if 'x' in node.attrib and 'y' in node.attrib:
        try:
            node.set('x', fmt(float(node.attrib['x']) + dx))
            node.set('y', fmt(float(node.attrib['y']) + dy))
            return
        except Exception:
            pass
    set_transform(node, f'translate({fmt(dx)} {fmt(dy)})')


def fmt(value):
    return str(round(float(value), 3)).rstrip('0').rstrip('.') if '.' in str(round(float(value), 3)) else str(round(float(value), 3))


def normalize_region(region):
    if isinstance(region, list):
        return {'x': float(region[0]), 'y': float(region[1]), 'width': float(region[2]) - float(region[0]), 'height': float(region[3]) - float(region[1])}
    return {'x': float(region['x']), 'y': float(region['y']), 'width': float(region['width']), 'height': float(region['height'])}


def center_region(region):
    box = normalize_region(region)
    return {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2}


def measure_spec(item):
    return {'name': item.get('name') or item.get('selector') or item.get('check') or item.get('op'), 'selector': item.get('selector'), 'region': item.get('region') or item.get('box'), 'mode': item.get('mode', 'dark'), 'threshold': item.get('threshold'), 'alpha': item.get('alpha')}


def apply_operations(svg_text, operations, render_options):
    root = parse_tree(svg_text).getroot()
    applied = []
    for op in operations or []:
        before = serialize(root)
        name = op['op']
        if name == 'set-css-var':
            style = ET.Element(qname('style'))
            var_name = str(op.get('name', ''))
            if not var_name.startswith('--'):
                var_name = '--' + var_name
            style.text = f':root {{ {var_name}: {op.get("value", "")}; }}'
            root.insert(0, style)
        else:
            selector = op.get('selector')
            node = require_node(root, selector)
            if name == 'set-attr': node.set(str(op['name']), str(op.get('value', '')))
            elif name == 'remove-attr': node.attrib.pop(str(op['name']), None)
            elif name == 'set-style':
                current = node.attrib.get('style', '')
                addition = f'{op["name"]}: {op.get("value", "")}'
                node.set('style', (current.rstrip('; ') + '; ' + addition).strip('; '))
            elif name == 'set-viewbox': node.set('viewBox', str(op.get('viewBox') or op.get('value')))
            elif name == 'set-text': node.text = str(op.get('text') if 'text' in op else op.get('value', ''))
            elif name == 'set-font-family': node.set('font-family', str(op.get('value') or op.get('fontFamily')))
            elif name == 'set-font-size': node.set('font-size', str(op.get('value') or op.get('fontSize')))
            elif name == 'set-font-weight': node.set('font-weight', str(op.get('value') or op.get('fontWeight')))
            elif name == 'set-text-anchor': node.set('text-anchor', str(op.get('value') or op.get('textAnchor')))
            elif name == 'translate': translate_node(node, float(op.get('dx', op.get('x', 0))), float(op.get('dy', op.get('y', 0))))
            elif name == 'scale': set_transform(node, f'scale({fmt(float(op.get("scale", op.get("sx", 1))))} {fmt(float(op.get("sy", op.get("scale", op.get("sx", 1)))) )})')
            elif name == 'remove-node': parent_map(root)[node].remove(node)
            elif name == 'replace-node':
                parent = parent_map(root)[node]
                idx = list(parent).index(node)
                parent.remove(node)
                parent.insert(idx, ET.fromstring(str(op.get('node') or op.get('value') or '<g />')))
            elif name == 'wrap-node':
                parent = parent_map(root)[node]
                idx = list(parent).index(node)
                parent.remove(node)
                tag = str(op.get('tag') or 'g')
                wrapper_tag = qname(tag) if tag and ':' not in tag and not tag.startswith('{') else tag
                wrapper = ET.Element(wrapper_tag)
                for key, value in (op.get('attrs') or {}).items():
                    wrapper.set(str(key), str(value))
                wrapper.append(node)
                parent.insert(idx, wrapper)
            elif name == 'center-visible-bbox':
                m = measure_svg(serialize(root), [measure_spec(op)], render_options)[0]
                if not m.get('visibleBBox'):
                    raise ValueError(f'could not measure {selector}')
                target = op.get('target') or center_region(op.get('region') or op.get('box'))
                dx = float(target.get('x', target[0] if isinstance(target, list) else 0)) - m['center']['x']
                dy = float(target.get('y', target[1] if isinstance(target, list) else 0)) - m['center']['y']
                translate_node(node, dx, dy)
            elif name == 'fit-visible-bbox':
                box = normalize_region(op.get('region') or op.get('box'))
                m = measure_svg(serialize(root), [measure_spec(op)], render_options)[0]
                if not m.get('visibleBBox'):
                    raise ValueError(f'could not measure {selector}')
                pad = float(op.get('padding', 0))
                scale = min((box['width'] - pad * 2) / m['visibleBBox']['width'], (box['height'] - pad * 2) / m['visibleBBox']['height'])
                set_transform(node, f'scale({fmt(scale)})')
            else:
                raise ValueError(f'unsupported operation: {name}')
        applied.append({'op': name, 'selector': op.get('selector'), 'changed': serialize(root) != before})
    return serialize(root), applied


def apply_color_scheme(svg_text, scheme):
    if scheme != 'dark' or 'prefers-color-scheme' not in svg_text:
        return svg_text
    marker = 'prefers-color-scheme: dark'
    start = svg_text.find(marker)
    root_start = svg_text.find(':root', start)
    brace_start = svg_text.find('{', root_start)
    brace_end = svg_text.find('}', brace_start)
    if root_start == -1 or brace_start == -1 or brace_end == -1:
        return svg_text
    vars_text = svg_text[brace_start + 1:brace_end].strip()
    override = f'<style id="media-svg-color-scheme-override">:root {{ {vars_text} }}</style>'
    return svg_text.replace('</svg>', override + '</svg>')


def render_svg(svg_text, options=None, output=None):
    options = options or {}
    tmp = tempfile.mkdtemp(prefix='media-svg-')
    input_path = Path(tmp) / 'input.svg'
    input_path.write_text(apply_color_scheme(svg_text, options.get('colorScheme')))
    png = Path(output).expanduser().resolve() if output else Path(tmp) / 'render.png'
    cmd = ['rsvg-convert']
    if options.get('width'): cmd += ['--width', str(options['width'])]
    if options.get('height'): cmd += ['--height', str(options['height'])]
    if options.get('scale'): cmd += ['--zoom', str(options['scale'])]
    cmd += [str(input_path), '-o', str(png)]
    result = subprocess.run(cmd, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr or 'rsvg-convert failed')
    if options.get('background') and options.get('background') != 'transparent':
        composite_background(png, options['background'])
    return {'path': str(png), 'tempDir': tmp, 'colorScheme': options.get('colorScheme', 'no-preference'), 'width': options.get('width'), 'height': options.get('height')}


def composite_background(png, background):
    from PIL import Image, ImageColor
    im = Image.open(png).convert('RGBA')
    bg = Image.new('RGBA', im.size, ImageColor.getcolor(background, 'RGBA'))
    bg.alpha_composite(im)
    bg.save(png)


def isolated_svg_for_selector(svg_text, selector):
    if not selector:
        return svg_text
    tree = parse_tree(svg_text)
    root = tree.getroot()
    node = find_node(root, selector)
    if node is None:
        return svg_text
    isolated = ET.Element(root.tag, dict(root.attrib))
    parents = parent_map(root)
    for child in list(root):
        if child is node:
            continue
        if local_name(child.tag) in ('defs', 'style'):
            isolated.append(copy.deepcopy(child))
    wrapped = copy.deepcopy(node)
    current = node
    wrappers = []
    while current in parents and parents[current] is not root:
        current = parents[current]
        attrs = {key: value for key, value in current.attrib.items() if key in ('transform', 'style', 'class', 'opacity', 'fill', 'stroke', 'color')}
        if attrs or local_name(current.tag) == 'g':
            wrappers.append((current.tag, attrs))
    for tag, attrs in reversed(wrappers):
        wrapper = ET.Element(tag, attrs)
        wrapper.append(wrapped)
        wrapped = wrapper
    isolated.append(wrapped)
    return serialize(isolated)


def measure_svg(svg_text, specs, render_options=None):
    from PIL import Image
    results = []
    for index, spec in enumerate(specs or [{}]):
        measure_text = isolated_svg_for_selector(svg_text, spec.get('selector')) if spec.get('selector') else svg_text
        rendered = render_svg(measure_text, render_options or {})
        try:
            im = Image.open(rendered['path']).convert('RGBA')
            pix = im.load()
            width, height = im.size
            region = spec.get('region')
            if region:
                box = normalize_region(region)
                x0, y0, x1, y1 = int(box['x']), int(box['y']), int(box['x'] + box['width']), int(box['y'] + box['height'])
            else:
                x0, y0, x1, y1 = 0, 0, width, height
            mode = spec.get('mode', 'dark')
            threshold = int(spec.get('threshold') if spec.get('threshold') is not None else (80 if mode == 'dark' else 40))
            alpha = int(spec.get('alpha') if spec.get('alpha') is not None else 80)
            xs, ys = [], []
            for y in range(max(0, y0), min(height, y1)):
                for x in range(max(0, x0), min(width, x1)):
                    if include_pixel(pix[x, y], mode, threshold, alpha):
                        xs.append(x); ys.append(y)
            if xs:
                left, top, right, bottom = min(xs), min(ys), max(xs) + 1, max(ys) + 1
                bbox = {'x': left, 'y': top, 'width': right - left, 'height': bottom - top}
                center = {'x': (left + right) / 2, 'y': (top + bottom) / 2}
            else:
                bbox, center = None, None
            results.append({'name': spec.get('name') or spec.get('selector') or f'measure-{index+1}', 'selector': spec.get('selector'), 'mode': mode, 'region': {'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}, 'visibleBBox': bbox, 'center': center, 'pixelCount': len(xs)})
        finally:
            shutil.rmtree(rendered['tempDir'], ignore_errors=True)
    return results


def include_pixel(pixel, mode, threshold, alpha):
    r, g, b, a = pixel
    if a < alpha: return False
    if mode == 'non-transparent': return True
    if mode == 'saturated': return max(r, g, b) - min(r, g, b) > threshold and not (r > 245 and g > 245 and b > 245)
    if mode in ('not-white', 'not-transparent-not-white'): return not (r > threshold and g > threshold and b > threshold)
    return r < threshold and g < threshold and b < threshold


def run_checks(svg_text, checks, render_options):
    out, measurements = [], []
    for check in checks or []:
        try:
            result, measurement = run_check(svg_text, check, render_options)
            out.append(result)
            if measurement: measurements.append(measurement)
        except Exception as exc:
            out.append({'check': check.get('check'), 'selector': check.get('selector'), 'pass': False, 'error': str(exc)})
    return out, measurements


def run_check(svg_text, check, render_options):
    name = check['check']
    if name == 'valid-svg':
        try: parse_tree(svg_text); ok = True
        except Exception: ok = False
        return {'check': name, 'pass': ok}, None
    if name == 'renderable':
        rendered = render_svg(svg_text, render_options)
        shutil.rmtree(rendered['tempDir'], ignore_errors=True)
        return {'check': name, 'pass': True, 'colorScheme': rendered['colorScheme']}, None
    if name == 'selector-exists':
        root = parse_tree(svg_text).getroot()
        return {'check': name, 'selector': check.get('selector'), 'pass': find_node(root, check.get('selector')) is not None}, None
    if name == 'no-missing-hrefs':
        missing = find_missing_hrefs(parse_tree(svg_text).getroot())
        return {'check': name, 'pass': not missing, 'missing': missing}, None
    if name == 'max-file-size':
        size = len(svg_text.encode())
        max_bytes = int(check.get('maxBytes') or check.get('bytes'))
        return {'check': name, 'pass': size <= max_bytes, 'bytes': size, 'maxBytes': max_bytes}, None
    if name == 'no-unexpected-raster-embeds':
        count = svg_text.count('data:image') + svg_text.count('base64')
        allowed = int(check.get('allowed', 0))
        return {'check': name, 'pass': count <= allowed, 'count': count, 'allowed': allowed}, None
    if name in ('text-exists', 'text-content-equals', 'font-family-declared', 'font-renderable'):
        node = require_node(parse_tree(svg_text).getroot(), check.get('selector'))
        text = ''.join(node.itertext()).strip()
        if name == 'text-exists': return {'check': name, 'selector': check.get('selector'), 'pass': bool(text), 'text': text}, None
        if name == 'text-content-equals':
            expected = str(check.get('text', check.get('value', '')))
            return {'check': name, 'selector': check.get('selector'), 'pass': text == expected, 'text': text, 'expected': expected}, None
        if name == 'font-family-declared':
            has_font = 'font-family' in node.attrib or 'font-family' in node.attrib.get('style', '')
            return {'check': name, 'selector': check.get('selector'), 'pass': has_font, 'fontFamily': node.attrib.get('font-family')}, None
        return {'check': name, 'selector': check.get('selector'), 'pass': True, 'note': 'font rendering is environment-dependent; text node found'}, None
    if name in ('visible-bbox-centered', 'visible-bbox-inside', 'no-visible-clipping', 'text-visible-bbox-inside'):
        measurement = measure_svg(svg_text, [measure_spec(check)], render_options)[0]
        result = {'check': name, 'selector': check.get('selector'), 'pass': bool(measurement.get('visibleBBox')), 'measurement': measurement}
        if result['pass'] and name == 'visible-bbox-centered':
            target = check.get('target') or center_region(check.get('region') or check.get('box'))
            tx = float(target.get('x', target[0] if isinstance(target, list) else 0))
            ty = float(target.get('y', target[1] if isinstance(target, list) else 0))
            dx, dy = tx - measurement['center']['x'], ty - measurement['center']['y']
            tolerance = float(check.get('tolerance', 1))
            result['offset'] = {'x': round(dx, 3), 'y': round(dy, 3)}
            result['tolerance'] = tolerance
            result['pass'] = abs(dx) <= tolerance and abs(dy) <= tolerance
        if result['pass'] and name in ('visible-bbox-inside', 'text-visible-bbox-inside'):
            region = normalize_region(check.get('region') or check.get('box'))
            bbox = measurement['visibleBBox']
            result['pass'] = bbox['x'] >= region['x'] and bbox['y'] >= region['y'] and bbox['x'] + bbox['width'] <= region['x'] + region['width'] and bbox['y'] + bbox['height'] <= region['y'] + region['height']
        if result['pass'] and name == 'no-visible-clipping':
            region = normalize_region(check.get('region') or check.get('box'))
            bbox = measurement['visibleBBox']; margin = float(check.get('margin', 0))
            result['pass'] = bbox['x'] > region['x'] + margin and bbox['y'] > region['y'] + margin and bbox['x'] + bbox['width'] < region['x'] + region['width'] - margin and bbox['y'] + bbox['height'] < region['y'] + region['height'] - margin
        return result, measurement
    raise ValueError(f'unsupported check: {name}')


def snapshot_path(input_path, name=None):
    src = Path(input_path).expanduser().resolve()
    stamp = time.strftime('%Y-%m-%dT%H-%M-%S')
    return src.parent / '.media-history' / src.stem / f'{name or stamp}.svg'


def create_snapshot(input_path, name=None, dry_run=False):
    if not input_path: raise ValueError('input is required for snapshot')
    src = Path(input_path).expanduser().resolve(); dst = snapshot_path(src, name)
    if not dry_run:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        manifest = dst.parent / 'manifest.json'
        current = json.loads(manifest.read_text()) if manifest.exists() else {'source': str(src), 'snapshots': []}
        current['snapshots'].append({'path': str(dst), 'createdAt': time.strftime('%Y-%m-%dT%H:%M:%S')})
        manifest.write_text(json.dumps(current, indent=2))
    return str(dst)


def main():
    start = time.time()
    parser = argparse.ArgumentParser()
    parser.add_argument('action', nargs='?')
    parser.add_argument('--input')
    parser.add_argument('--output')
    parser.add_argument('--svg')
    parser.add_argument('--svg-file')
    parser.add_argument('--document-json')
    parser.add_argument('--operations-json')
    parser.add_argument('--checks-json')
    parser.add_argument('--render-json')
    parser.add_argument('--selectors-json')
    parser.add_argument('--snapshot', action='store_true')
    parser.add_argument('--snapshot-name')
    parser.add_argument('--restore-from')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    if args.action not in ACTIONS:
        raise ValueError(f'unsupported action: {args.action}')
    document = parse_json(args.document_json, '--document-json')
    operations = parse_json(args.operations_json, '--operations-json') or []
    checks = parse_json(args.checks_json, '--checks-json') or []
    render_options = parse_json(args.render_json, '--render-json') or {}
    selectors = parse_json(args.selectors_json, '--selectors-json') or []
    data = {'action': args.action, 'dryRun': args.dry_run}
    svg_text = None
    snap = None
    if args.action == 'create':
        svg_text = build_svg(document) if document else read_svg(args)
        if args.snapshot and args.output and Path(args.output).exists(): snap = create_snapshot(args.output, args.snapshot_name, args.dry_run)
        data['output'] = write_text(args.output, svg_text, args.dry_run)
    elif args.action == 'restore':
        if not args.restore_from or not (args.output or args.input): raise ValueError('restore requires restoreFrom and output or input')
        if not args.dry_run:
            Path(args.output or args.input).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(Path(args.restore_from), Path(args.output or args.input))
        data['output'] = str(Path(args.output or args.input).resolve())
    elif args.action == 'snapshot':
        data['snapshot'] = create_snapshot(args.input, args.snapshot_name, args.dry_run)
    else:
        svg_text = read_svg(args)
    if svg_text is not None and args.action == 'inspect': data['inspect'] = inspect_svg(svg_text, selectors)
    if svg_text is not None and args.action == 'render':
        out = args.output or str(Path((args.input or 'media-svg.svg')).with_suffix('.preview.png'))
        if args.dry_run:
            data['renders'] = [{'path': str(Path(out).expanduser().resolve()), 'colorScheme': render_options.get('colorScheme', 'no-preference'), 'width': render_options.get('width'), 'height': render_options.get('height'), 'dryRun': True}]
        else:
            r = render_svg(svg_text, render_options, out)
            data['renders'] = [{'path': r['path'], 'colorScheme': r['colorScheme'], 'width': r['width'], 'height': r['height']}]
    if svg_text is not None and args.action == 'measure':
        specs = checks if checks else [{'selector': s, 'name': s} if isinstance(s, str) else s for s in (selectors or [{}])]
        data['measurements'] = measure_svg(svg_text, specs, render_options)
    if svg_text is not None and args.action == 'edit':
        if args.snapshot and args.input: snap = create_snapshot(args.input, args.snapshot_name, args.dry_run)
        svg_text, applied = apply_operations(svg_text, operations, render_options)
        data['operations'] = applied; data['snapshot'] = snap
        data['output'] = write_text(args.output or args.input, svg_text, args.dry_run)
    if svg_text is not None and args.action == 'verify':
        results, measurements = run_checks(svg_text, checks or [{'check': 'renderable'}], render_options)
        data['checks'] = results; data['measurements'] = measurements; data['pass'] = all(c.get('pass') is True for c in results)
    if svg_text is not None and args.action in ('create', 'edit') and checks:
        results, measurements = run_checks(svg_text, checks, render_options)
        data['checks'] = results; data['measurements'] = measurements; data['pass'] = all(c.get('pass') is True for c in results)
    if snap: data['snapshot'] = snap
    ok = data.get('pass') is not False
    result = envelope(ok, 'OK' if ok and not args.dry_run else ('DRY_RUN' if ok else 'VERIFY_FAILED'), f'media.svg {args.action} completed' if ok else 'SVG verification failed', data, exit_code=0 if ok else 1, start=start)
    print(json.dumps(result if args.json else data, indent=2))
    if not ok: sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        result = envelope(False, 'COMMAND_FAILED', str(exc), stderr=str(exc), exit_code=1)
        print(json.dumps(result if '--json' in sys.argv else {'error': str(exc)}, indent=2))
        sys.exit(1)
