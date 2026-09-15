import re

# DEPLOYMENT.md - remove image env vars from .env block
print('=== DEPLOYMENT.md ===')
lines = open('docs/BiteMeBaby_DEPLOYMENT.md', 'r', encoding='utf-8').readlines()
new_lines = []
for i, line in enumerate(lines):
    if 'VITE_OPENROUTER_IMAGE_MODEL' in line:
        print(f'  Removed line {i+1}')
        continue
    if '# OpenRouter — Image Pipeline' in line or '# OpenRouter - Image Pipeline' in line:
        print(f'  Removed line {i+1} (comment)')
        continue
    new_lines.append(line)
with open('docs/BiteMeBaby_DEPLOYMENT.md', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('DEPLOYMENT.md done')

# ARCHITECTURE.md - fix security note
print('\n=== ARCHITECTURE.md ===')
with open('docs/BiteMeBaby_ARCHITECTURE.md', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'\s*- Image Production Pipeline.*?source\n', '\n', content)
with open('docs/BiteMeBaby_ARCHITECTURE.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('ARCHITECTURE.md done')

# REALITY_MAP.md
print('\n=== REALITY_MAP.md ===')
with open('BiteMeBaby_REALITY_MAP.md', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'- ไม่มีโฟลเดอร์ `src/services/`.*?\n', '', content)
content = content.replace(
    'Target State ฉบับเต็ม (Image Production Pipeline + 3D Floating UI + drop-shadow layering + micro-interactions + Business Rules)',
    'Target State ฉบับเต็ม (3D Floating UI + Micro-interactions + Business Rules)'
)
with open('BiteMeBaby_REALITY_MAP.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('REALITY_MAP.md done')

# TARGET_PRODUCT_SPEC.md
print('\n=== TARGET_PRODUCT_SPEC.md ===')
with open('BiteMeBaby_TARGET_PRODUCT_SPEC.md', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    '### 7. 3D Floating Visual Layout และ Image Production Pipeline (เพิ่มใหม่ v1.5)',
    '### 7. 3D Floating Visual Layout (เพิ่มใหม่ v1.5)'
)
with open('BiteMeBaby_TARGET_PRODUCT_SPEC.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('TARGET_PRODUCT_SPEC.md done')

# COMPONENT_SPEC_UI.md F2 row - clean up
print('\n=== COMPONENT_SPEC_UI.md ===')
with open('docs/COMPONENT_SPEC_UI.md', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    '| F2 | ไม่มี `imageProductionService` — ใช้ Admin Upload แทน | NOT NEEDED | Admin อัปโหลดรูปผ่าน Products Management |',
    '| F2 | ไม่มีไฟล์ `imageProductionService` (ไม่ใช้แล้ว) — ใช้ Admin Upload แทน | ✅ Done | Admin อัปโหลดรูปผ่าน Products Management |'
)
with open('docs/COMPONENT_SPEC_UI.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('COMPONENT_SPEC_UI.md done')

print('\nAll remaining fixes applied!')
