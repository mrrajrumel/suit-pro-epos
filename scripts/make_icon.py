from PIL import Image
from pathlib import Path

src = Path('public/icon.png')
out = Path('public/favicon.ico')
img = Image.open(src).convert('RGBA')
img.save(out, format='ICO', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(out)
