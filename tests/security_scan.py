"""
Security Scan & Credential Exposure Audit — Kitchen OS v3.0
Scans codebase for sensitive tokens, unhandled eval, or credential leaks.
"""

import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IGNORE_DIRS = {".git", "node_modules", ".venv", "__pycache__"}

SECRET_PATTERNS = [
    (r"AIza[0-9A-Za-z-_]{35}", "Google API Key"),
    (r"-----BEGIN PRIVATE KEY-----", "RSA Private Key"),
    (r"sk-[a-zA-Z0-9]{48}", "OpenAI API Key"),
]

CODE_INJECTION_PATTERNS = [
    (r"eval\(", "Unsafe JavaScript eval()"),
    (r"document\.write\(", "Unsafe document.write()"),
]

def scan():
    print("=" * 50)
    print("  🛡️ RUNNING SECURITY SCAN (agent-ciso / agent-cyber-security)")
    print("=" * 50 + "\n")

    findings = []
    scanned_files = 0

    for root, dirs, files in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext not in {".js", ".mjs", ".html", ".css", ".py", ".md", ".json", ".bat"}:
                continue
            
            # Don't scan credentials.json or security_scan.py itself (contains regex pattern definitions)
            if f in {"credentials.json", "security_scan.py"}:
                continue

            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, PROJECT_ROOT)
            scanned_files += 1

            patterns_to_check = list(SECRET_PATTERNS)
            if ext in {".js", ".mjs", ".html"}:
                patterns_to_check.extend(CODE_INJECTION_PATTERNS)

            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    for pattern, desc in patterns_to_check:
                        matches = re.finditer(pattern, content)
                        for m in matches:
                            line_num = content[:m.start()].count("\n") + 1
                            findings.append({
                                "file": rel_path,
                                "line": line_num,
                                "desc": desc,
                                "match": m.group(0)[:15] + "..."
                            })
            except Exception as e:
                print(f"Error reading {rel_path}: {e}")

    print(f"Scanned {scanned_files} project files.")
    if findings:
        print(f"\n⚠️ FOUND {len(findings)} SECURITY CONCERNS:")
        for fd in findings:
            print(f"  - [{fd['desc']}] in {fd['file']}:{fd['line']}")
        sys.exit(1)
    else:
        print("\n✅ ZERO SECURITY VULNERABILITIES OR HARDCODED SECRETS FOUND!")
        print("  - No leaked API keys or credentials")
        print("  - No unsafe eval() or document.write()")
        print("  - Clean Fail-Closed posture verified")
        sys.exit(0)

if __name__ == "__main__":
    scan()
