import re
from pathlib import Path

path = Path('js/transcription-modal.js')
content = path.read_text(encoding='utf-8')

def replace(pattern: str, replacement: str):
    global content
    if not re.search(pattern, content, re.S):
        raise SystemExit(f'pattern not found: {pattern}')
    content = re.sub(pattern, replacement, content, flags=re.S)

replacement_extract = """dummy"""

replace(
    r"    async extractAudio\(file\) \{[\s\S]*?\n    async transcribeWithWhisper",
    replacement_extract
)

content = content.replace('\r\n', '\n')
content = content.replace('\r', '\n')
content = content.replace('\n', '\r\n')

path.write_text(content, encoding='utf-8')
