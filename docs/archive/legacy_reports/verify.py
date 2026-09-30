f = "src/store/cartStore.ts"
with open(f, "r", encoding="utf-8") as fh:
    c = fh.read()
print("Has TEN-05 Reject:", "Reject if adding without active" in c)
print("Has context_blocked return:", "return \'context_blocked\'" in c)
lines = c.split("\n")
for i, l in enumerate(lines):
    if "context_blocked" in l:
        print(f"L{i+1}: {l.strip()}")
    if "context_tenant_id !== active_context_tenant_id" in l:
        print(f"L{i+1}: Context mismatch check STILL PRESENT: {l.strip()}")
