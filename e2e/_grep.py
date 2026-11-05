import pathlib, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
pat = sys.argv[1]
if len(pat) >= 2 and pat[0] == pat[-1] and pat[0] in "\"'":
    pat = pat[1:-1]
roots = sys.argv[2:] or ["src", "server", "supabase"]
rx = re.compile(pat, re.IGNORECASE)
print("pat=" + repr(pat) + " roots=" + repr(roots), file=sys.stderr)
n = 0
for root in roots:
    base = pathlib.Path(root)
    files = [base] if base.is_file() else [p for p in base.rglob("*") if p.is_file()]
    for p in files:
        if p.suffix not in (".ts", ".tsx", ".js", ".cjs", ".sql"):
            continue
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(txt.splitlines(), 1):
            if rx.search(line):
                n += 1
                print(f"{p}:{i}:{line.strip()[:200]}")
print("matches=" + str(n), file=sys.stderr)