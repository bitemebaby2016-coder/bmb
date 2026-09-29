f = "src/store/cartStore.ts"
with open(f, "r", encoding="utf-8") as fh:
    c = fh.read()
print("Has context_blocked return:", "return \'context_blocked\'" in c)
lines = c.split("\n")
for i, l in enumerate(lines):
    if "Reject" in l and "TEN-05" in l:
        print(f"L{i+1}: {l.strip()}")
    if "context_blocked" in l:
        print(f"L{i+1} has context_blocked: {l.strip()}")
    if "active_context_tenant_id ||" in l:
        print(f"L{i+1} has active_context check: {l.strip()}")
