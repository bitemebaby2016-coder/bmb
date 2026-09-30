f = "src/stores/useCartStore.ts"
c = open(f, "r", encoding="utf-8").read()
# Update AddToCartResult to include context_blocked
old = "export type AddToCartResult = 'added' | 'needs_confirmation'"
new = "export type AddToCartResult = 'added' | 'needs_confirmation' | 'context_blocked'"
if old in c:
    c = c.replace(old, new)
    print("Fixed AddToCartResult")
else:
    print("Pattern not found")
open(f, "w", encoding="utf-8").write(c)
print("DONE")
