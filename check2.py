f = "src/store/cartStore.ts"
with open(f, "r", encoding="utf-8") as fh:
    c = fh.read()
print("Has TEN-05 Reject comment:", "Reject if adding without active" in c)
print("Has context_blocked return:", "return \'context_blocked\'" in c)
lines = c.split("\n")
for i, l in enumerate(lines):
    if "Reject" in l and "TEN-05" in l:
        print(f"REMAINING L{i+1}: {l.strip()}")
    if "context_blocked" in l and "export type" not in l:
        print(f"context_blocked usage L{i+1}: {l.strip()}")
