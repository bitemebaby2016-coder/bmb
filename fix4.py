f = "src/store/cartStore.ts"
with open(f, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

new_lines = []
skip_until_blank = False
for i, line in enumerate(lines):
    if "TEN-05: Reject if adding without active context" in line:
        # Skip this block (2 comment + 1 code lines) and next blank line
        skip_until_blank = True
        print(f"Removed context-blocking block at line {i+1}")
        continue
    if skip_until_blank:
        if line.strip() == "":
            skip_until_blank = False
        continue
    new_lines.append(line)

with open(f, "w", encoding="utf-8") as fh:
    fh.writelines(new_lines)
print("DONE — removed context_blocked blocking from addItem")
