import os, re

print('=== FINAL VERIFICATION ===')
print()

# Check file deletion
print('imageProductionService deleted:', not os.path.exists('src/services/imageProductionService.ts'))

# Check types removed
t = open('src/types/index.ts', encoding='utf-8', errors='ignore').read()
print('ImageJobResult in types:', 'ImageJobResult' in t)
print('ImageGenerationStatus in types:', 'ImageGenerationStatus' in t)

# Check FoodMenuCard
c = open('src/components/FoodMenuCard.tsx', encoding='utf-8', errors='ignore').read()
print('FoodMenuCard overflow-visible:', 'overflow-visible' in c)
print('FoodMenuCard zIndex 60:', 'zIndex: 60' in c)
print('FoodMenuCard no studioImageUrl prop:', 'studioImageUrl?:' not in c)

# Check .env.example
e = open('.env.example', encoding='utf-8', errors='ignore').read()
print('No IMAGE_MODEL in .env.example:', 'VITE_OPENROUTER_IMAGE_MODEL' not in e)

# Scan all md files for remaining AI image refs
bad_files = []
for root, dirs, files in os.walk('.'):
    if '.git' in root or '__pycache__' in root: continue
    for fn in files:
        if not fn.endswith('.md'): continue
        fp = os.path.join(root, fn)
        try:
            content = open(fp, encoding='utf-8', errors='ignore').read()
            bad = re.findall(r'Image Production Pipeline|imageProductionService|VITE_OPENROUTER_IMAGE_MODEL|nano-banana|seedream|Master Prompt.*image', content)
            if bad:
                bad_files.append((fn, len(bad)))
        except: pass

print()
if bad_files:
    print('Remaining Image Pipeline refs:')
    for f, n in bad_files:
        print(f'  {f}: {n}')
else:
    print('ALL CLEAR - No Image Pipeline references remain in any doc')
