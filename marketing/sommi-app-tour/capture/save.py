import json, base64, sys, glob, os
src = sorted(glob.glob(os.path.expanduser("~/.cursor/browser-logs/cdp-response-Page.captureScreenshot-*.json")))[-1]
d = json.load(open(src))
data = d.get("data") or d.get("result", {}).get("data")
out = sys.argv[1]
open(out, "wb").write(base64.b64decode(data))
print(out, os.path.getsize(out))
