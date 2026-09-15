import re

with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove §101.1 (Image Pipeline section)
pattern101 = r'## 101\.1 Image Production Pipeline \(หลังบ้าน\)\n\n.*?(?=\n## 101\.2 )'
match = re.search(pattern101, content, re.DOTALL)
if match:
    removed = match.group(0)
    content = content.replace(removed, '')
    print(f'Removed §101.1 ({len(removed)} chars)')
else:
    print('§101.1 not found or already removed')

# Update §101 title - remove Image Production Pipeline
content = content.replace(
    '# 101. IMAGE PRODUCTION PIPELINE & 3D FLOATING VISUAL LAYOUT',
    '# 101. 3D FLOATING VISUAL LAYOUT AND ADMIN IMAGE UPLOAD'
)
print('Updated §101 title')

# Change all references from "Image Pipeline" to "Admin Upload" in §101 area
# Already handled by removing 101.1 section above

with open('README.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('README.md updated')

