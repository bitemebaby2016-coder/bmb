f = "src/store/cartStore.ts"
with open(f, "r", encoding="utf-8") as fh:
    lines = fh.readlines()
for i in range(84, min(100, len(lines))):
    print(f"L{i+1}: {lines[i].rstrip()}")
