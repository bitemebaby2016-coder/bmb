f = "src/store/cartStore.ts"
with open(f, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

# Find the line with "Reject if adding without active context"
start_idx = None
for i, line in enumerate(lines):
    if "Reject if adding" in line:
        start_idx = i
        break

if start_idx is not None:
    print(f"Found block start at L{start_idx+1}")
    # The block is roughly lines start_idx through start_idx+5 (comment + 2 code blocks)
    # Remove lines start_idx to start_idx+4 (inclusive of return statement)
    end_idx = min(start_idx + 6, len(lines))
    
    new_lines = lines[:start_idx] + lines[end_idx:]
    print(f"Removed lines {start_idx+1} through {end_idx}")
    
    with open(f, "w", encoding="utf-8") as fh:
        fh.writelines(new_lines)
    print("DONE")
else:
    print("Pattern not found")
