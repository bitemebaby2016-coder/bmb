f = "src/lib/brandResolver.ts"
c = open(f, "r", encoding="utf-8").read()
# Replace brandSlug) with opts.urlParams?.brandSlug)
old = "not active:', brandSlug)"
new = "not active:', opts.urlParams?.brandSlug)"
if old in c:
    c = c.replace(old, new)
    print("Found and replaced")
else:
    print("Pattern not found, printing surrounding lines:")
    lines = c.split("\n")
    for i,l in enumerate(lines):
        if "Brand not found or not active" in l:
            print(f"L{i+1}: [{l}]")
open(f, "w", encoding="utf-8").write(c)
print("DONE")
