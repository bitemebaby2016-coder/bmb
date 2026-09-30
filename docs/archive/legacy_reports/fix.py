f = "src/App.tsx"
with open(f, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

new_lines = []
for line in lines:
    if "admin/brands" in line:
        # Remove trailing } from "} />}" making it "} />"
        stripped = line.rstrip("\r\n")
        if stripped.endswith("} />}"):
            fixed = stripped[:-1] + "\n"
            new_lines.append(fixed)
            print(f"Fixed line ending: {repr(stripped[-10:])} -> {repr(fixed[-10:].rstrip(chr(10))+'[NEWLINE]')}")
        else:
            new_lines.append(line)
            print(f"Line already OK or different pattern: {repr(line[-10:])}")
    else:
        new_lines.append(line)

with open(f, "w", encoding="utf-8") as fh:
    fh.writelines(new_lines)
print("DONE")
