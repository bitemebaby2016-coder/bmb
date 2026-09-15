import re

# ============ ARCHITECTURE.md ============
print('=== ARCHITECTURE.md ===')
lines = open('docs/BiteMeBaby_ARCHITECTURE.md', 'r', encoding='utf-8').readlines()

# Remove Data Flow 5
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if '### 5. Image Production Pipeline' in line:
        start_idx = i
    if start_idx is not None and ('## Key Architectural' in line or '### Key Architectural' in line):
        end_idx = i
        break

if start_idx and end_idx:
    removed = lines[start_idx:end_idx]
    new_lines = lines[:start_idx] + lines[end_idx:]
    print(f'  Removed {len(removed)} lines of Data Flow 5')
    lines = new_lines

content = ''.join(lines)

# Remove src/services/ references
before = len(content)
content = content.replace('| `src/services/` | Domain services (PLANNED)\n', '')
content = content.replace('│   └── imageProductionService.ts # OpenRouter image pipeline (PLANNED)\n', '')
content = content.replace('     └── imageProductionService.ts # OpenRouter image pipeline (PLANNED)\n', '')
if before != len(content):
    print(f'  Removed src/services/ refs ({before - len(content)} chars)')

# Remove security note about Image Pipeline
before = len(content)
content = re.sub(r' - Image Production Pipeline.*?ใน source\n', '', content)
if before != len(content):
    print(f'  Removed security note ({before - len(content)} chars)')

with open('docs/BiteMeBaby_ARCHITECTURE.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('ARCHITECTURE.md done')

# ============ DEPLOYMENT.md ============
print('\n=== DEPLOYMENT.md ===')
with open('docs/BiteMeBaby_DEPLOYMENT.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove image env vars
pattern = r'# OpenRouter — Image Pipeline \(production images\)\nVITE_OPENROUTER_IMAGE_MODEL=google/nano-banana-2-lite\nVITE_OPENROUTER_IMAGE_MODEL_FALLBACK=bytedance/seedream-4\.5\n'
m = re.search(pattern, content)
if m:
    content = content[:m.start()] + content[m.end():]
    print('  Removed VITE_OPENROUTER_IMAGE_MODEL env vars')

# Update deployment note
content = content.replace(
    "ตัวแปร `VITE_OPENROUTER_*` ใช้โดย AI Chat (`aiService.ts`) และ Image Production Pipeline (`src/services/imageProductionService.ts` — PLANNED ตาม `docs/COMPONENT_SPEC_UI.md`)",
    "ตัวแปร `VITE_OPENROUTER_*` ใช้โดย AI Chat (`aiService.ts`) เท่านั้น"
)
print('  Updated deployment note')

# Remove checklist item
before = len(content)
content = content.replace("- [ ] Image Production Pipeline env vars ครบ (`VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_IMAGE_MODEL`, `VITE_OPENROUTER_IMAGE_MODEL_FALLBACK`)\n", '')
if before != len(content):
    print('  Removed checklist item')

with open('docs/BiteMeBaby_DEPLOYMENT.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('DEPLOYMENT.md done')

# ============ REALITY_MAP.md ============
print('\n=== REALITY_MAP.md ===')
with open('BiteMeBaby_REALITY_MAP.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Update §7 Current State - remove imagePipeline references
content = re.sub(
    r'- ไม่มีโฟลเดอร์ `src/services/`.*?(?:PLANNED|ไม่มีโค้ด)',
    '- Admin อัปโหลดรูปอาหารผ่าน Products Management (ไม่ต้องใช้ imageProductionService)',
    content
)
content = re.sub(
    r'Target State ฉบับเต็ม.*?COMPONENT_SPEC_UI\.md.*?\n',
    'Target State ฉบับเต็ม (3D Floating UI + Micro-interactions):\n',
    content
)
print('  Updated §7 Current State')

with open('BiteMeBaby_REALITY_MAP.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('REALITY_MAP.md done')

print('\nAll done!')
