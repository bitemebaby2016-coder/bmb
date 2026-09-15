import re

# ============ 1. TARGET_PRODUCT_SPEC.md ============
print("=== Editing TARGET_PRODUCT_SPEC.md ===")
with open('BiteMeBaby_TARGET_PRODUCT_SPEC.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Feature 7 - remove Image Pipeline bullet
content = re.sub(
    r'- \*\*Image Production Pipeline\*\* — รับภาพถ่ายอาหารเดิมจากร้าน.*?ผ่าน OpenRouter Image Endpoint.*?configurable ผ่าน env\)\s*\n',
    '',
    content,
    flags=re.DOTALL
)
print("  - Removed Image Pipeline from Feature 7 bullet 1")

# Fix tech stack - remove AI Image Generation row
content = content.replace(
    '| AI Image Generation | OpenRouter Image API (`google/nano-banana-2-lite` / `bytedance/seedream-4.5`) |\n',
    ''
)
print("  - Removed AI Image Generation from tech stack")

# Fix Product model - change image_url description
content = content.replace(
    "- `image_url` รองรับวงจรภาพ 2 สถานะ: ภาพถ่ายร้านจริง (raw) → ภาพสตูดิโอโปร่งใส `.webp` (ผลิตโดย Image Production Pipeline)",
    "- `image_url` เป็นรูปอาหารที่ Admin อัปโหลด/แก้ไขผ่าน Products Management"
)
print("  - Updated Product model image_url description")

# Fix version history v1.5
content = content.replace(
    "- v1.5: เพิ่ม 3D Floating Visual Layout และ Image Production Pipeline (OpenRouter) บนหน้า PWA Home/Menu (2026-09-14)",
    "- v1.5: เพิ่ม 3D Floating Visual Layout (Admin อัปโหลดรูปเอง) บนหน้า PWA Home/Menu (2026-09-14)"
)
print("  - Updated v1.5 history entry")

with open('BiteMeBaby_TARGET_PRODUCT_SPEC.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("TARGET_PRODUCT_SPEC.md done\n")


# ============ 2. GAP_ANALYSIS.md ============
print("=== Editing GAP_ANALYSIS.md ===")
with open('docs/BiteMeBaby_GAP_ANALYSIS.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove entire GAP กลุ่ม 5 (Visual & Image Pipeline)
start_marker = "### 5. Visual & Image Pipeline"
end_marker = "\n\nรายละเอียดข้อกำหนด"
if start_marker in content and end_marker in content:
    start_idx = content.index(start_marker)
    end_idx = content.index(end_marker)
    removed = content[start_idx:end_idx]
    new_content = content[:start_idx] + content[end_idx:]
    print(f"  - Removed {len(removed)} chars of GAP กลุ่ม 5")
    content = new_content

# Fix Priority Action ข้อ 6
content = content.replace(
    "6. 🔵 **FoodMenuCard 3D Floating UI + Image Production Pipeline ตาม `docs/COMPONENT_SPEC_UI.md`** — Phase 2.5 (หลังอนุมัติเอกสาร)",
    "6. 🔵 **FoodMenuCard 3D Floating UI ตาม `docs/COMPONENT_SPEC_UI.md`** — Phase 2.5 (หลังอนุมัติเอกสาร)"
)
print("  - Fixed Priority Action ข้อ 6")

with open('docs/BiteMeBaby_GAP_ANALYSIS.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("GAP_ANALYSIS.md done\n")


# ============ 3. IMPLEMENTATION_ROADMAP.md ============
print("=== Editing IMPLEMENTATION_ROADMAP.md ===")
with open('docs/BiteMeBaby_IMPLEMENTATION_ROADMAP.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove IMG task rows
for img_id in ['IMG-04', 'IMG-01', 'IMG-02', 'IMG-03']:
    pattern = rf'\| {img_id} \|.*?\|(\n|$)'
    content = re.sub(pattern, '', content)
print("  - Removed IMG-01~04 tasks")

# Update Phase 2.5 overview
content = content.replace(
    "- สร้าง Image Production Pipeline ผ่าน OpenRouter (ภาพร้าน → ภาพสตูดิโออัตโนมัติ)",
    "- ปรับปรุงการอัปโหลดรูปอาหารโดย Admin (ไม่ใช่ AI Generate)"
)
print("  - Updated Phase 2.5 overview")

# Update summary table
content = content.replace('| Phase 2.5 | 2 | ~36 | 10% |', '| Phase 2.5 | 1 | ~20 | 6% |')
print("  - Updated Phase 2.5 summary hours")

with open('docs/BiteMeBaby_IMPLEMENTATION_ROADMAP.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("IMPLEMENTATION_ROADMAP.md done\n")


# ============ 4. API.md ============
print("=== Editing API.md ===")
with open('docs/BiteMeBaby_API.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove entire Image Production Service section
start = "## Image Production Service (PLANNED"
end = "\n---\n"
if start in content and end in content:
    start_idx = content.index(start)
    end_idx = content.index(end, start_idx)
    removed = content[start_idx:end_idx]
    new_content = content[:start_idx] + content[end_idx:]
    if len(removed) > 10:
        print(f"  - Removed Image Production Service section ({len(removed)} chars)")
        content = new_content
    else:
        print("  - Image Production Service section already empty or small")

with open('docs/BiteMeBaby_API.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("API.md done\n")


# ============ 5. ARCHITECTURE.md ============
print("=== Editing ARCHITECTURE.md ===")
with open('docs/BiteMeBaby_ARCHITECTURE.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove Data Flow 5 (Image Pipeline flow)
pattern_df5 = r'### 5\. Image Production Pipeline \(PLANNED.*?Documentation Gate\)\s*\n\s*\n```\s*\nAdmin อัปโหลด.*?group-hover/group-active micro-interactions\)\s*\n```'
replacement = re.sub(pattern_df5, '', content, flags=re.DOTALL)
if replacement != content:
    print("  - Removed Data Flow 5")
    content = replacement
else:
    print("  - Data Flow 5 pattern not exact, trying manual removal...")
    # Manual approach
    start_line = "### 5. Image Production Pipeline"
    end_lines = ["### Key Architectural", "## Key"]
    if start_line in content:
        lines = content.split('\n')
        start_idx = None
        for i, line in enumerate(lines):
            if start_line in line:
                start_idx = i
                break
        if start_idx is not None:
            end_idx = None
            for el in end_lines:
                for j in range(start_idx + 1, len(lines)):
                    if el in lines[j]:
                        end_idx = j
                        break
                if end_idx:
                    break
            if end_idx:
                removed_lines = lines[start_idx:end_idx]
                content = '\n'.join(lines[:start_idx] + lines[end_idx:])
                print(f"  - Removed {len(removed_lines)} lines of Data Flow 5")

# Remove src/services/ directory reference
content = content.replace(
    "| `src/services/` | Domain services (OpenRouter image-to-image pipeline — PLANNED)\n",
    ""
)
content = content.replace(
    "│   └── imageProductionService.ts # OpenRouter image pipeline (PLANNED)",
    ""
)
print("  - Removed src/services/ references")

# Remove security note about Image Pipeline
content = content.replace(
    " - Image Production Pipeline (PLANNED) อ่าน key/model จาก env vars (`VITE_OPENROUTER_*`) — ห้าม hardcode ใน source",
    ""
)
print("  - Removed security note about Image Pipeline")

with open('docs/BiteMeBaby_ARCHITECTURE.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("ARCHITECTURE.md done\n")


# ============ 6. DEPLOYMENT.md ============
print("=== Editing DEPLOYMENT.md ===")
with open('docs/BiteMeBaby_DEPLOYMENT.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove image env vars from .env example
content = re.sub(
    r'# OpenRouter — Image Pipeline \(production images\)\nVITE_OPENROUTER_IMAGE_MODEL=google/nano-banana-2-lite\nVITE_OPENROUTER_IMAGE_MODEL_FALLBACK=bytedance/seedream-4\.5\n',
    '',
    content
)
print("  - Removed VITE_OPENROUTER_IMAGE_MODEL env vars")

# Update deployment note
content = content.replace(
    "ตัวแปร `VITE_OPENROUTER_*` ใช้โดย AI Chat (`aiService.ts`) และ Image Production Pipeline (`src/services/imageProductionService.ts` — PLANNED ตาม `docs/COMPONENT_SPEC_UI.md`)",
    "ตัวแปร `VITE_OPENROUTER_*` ใช้โดย AI Chat (`aiService.ts`) เท่านั้น"
)
print("  - Updated deployment note")

# Remove checklist item
content = content.replace(
    "- [ ] Image Production Pipeline env vars ครบ (`VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_IMAGE_MODEL`, `VITE_OPENROUTER_IMAGE_MODEL_FALLBACK`)\n",
    ""
)
print("  - Removed checklist item")

with open('docs/BiteMeBaby_DEPLOYMENT.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("DEPLOYMENT.md done\n")

print("All remaining document fixes applied!")
