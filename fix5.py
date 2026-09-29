f = "src/store/cartStore.ts"
with open(f, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    # Remove the entire TEN-05: Reject context block (lines 84-89 approximately)
    if "// \u274c TEN-05: Reject if adding without active context" in line:
        print(f"Removing reject block starting at L{i+1}")
        # Skip comment line + code lines until we hit next non-blocked code
        i += 1
        while i < len(lines):
            cur = lines[i].strip()
            # Stop when we hit actual code (not blank/comment/warning)
            if cur == "" or cur.startswith("//"):
                i += 1
            elif cur.startswith("console.warn"):
                i += 1  # skip warning
            elif cur.startswith("return"):
                i += 1  # skip return
                break   # stop skipping here
            else:
                i += 1
        continue
    
    new_lines.append(line)
    i += 1

with open(f, "w", encoding="utf-8") as fh:
    fh.writelines(new_lines)
print("DONE — removed reject-context block")
