"""Offline folder build: small HTML and local assets loaded on demand, without a server."""
from pathlib import Path
import re,json,base64,mimetypes,hashlib
ROOT=Path(__file__).resolve().parent;SRC=ROOT/'source';PACK=ROOT/'local-assets';PACK.mkdir(exist_ok=True)
files={p.relative_to(SRC).as_posix():p for p in SRC.rglob('*') if p.is_file()};modules={}
for key,p in files.items():
 if p.suffix!='.js' or '/draco/' in key:continue
 text=p.read_text(encoding='utf-8-sig').replace('./images/','./source/images/')
 def spec(m):
  s=m[3]
  if s=='three':target='vendor/three.module.js'
  elif s.startswith('.'):target=(p.parent/s).resolve().relative_to(SRC.resolve()).as_posix()
  else:return m[0]
  if target not in files:raise ValueError('Missing module '+target)
  return m[1]+m[2]+'ain/'+target+m[2]
 modules['ain/'+key]=re.sub(r'(\bfrom\s*|\bimport\s*)([\'"])([^\'"]+)\2',spec,text)
manifest={}
for key,p in files.items():
 if p.suffix not in ('.glb','.json','.wasm','.exr') and '/draco/' not in key:continue
 raw=p.read_bytes();digest=hashlib.sha256(raw).hexdigest();ident=digest[:20];parts=[]
 for i,start in enumerate(range(0,len(raw),768*1024)):
  part=f'{ident}-{i}.js';parts.append(part);encoded=base64.b64encode(raw[start:start+768*1024]).decode()
  (PACK/part).write_text('globalThis.__ainChunk('+json.dumps(key)+','+json.dumps(encoded)+');',encoding='ascii')
 manifest[key]={'parts':parts,'mime':mimetypes.guess_type(key)[0] or 'application/octet-stream','bytes':len(raw),'sha256':digest}
(PACK/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
bootstrap=(SRC/'offline-runtime.txt').read_text(encoding='utf-8').replace('__MANIFEST__',json.dumps(manifest,separators=(',',':'))).replace('__MODULES__',json.dumps(modules,separators=(',',':')))
(PACK/'runtime.js').write_text(bootstrap,encoding='utf-8')
for name,entry in [('index.html','main.js'),('operation.html','operation.js')]:
 text=(SRC/name).read_text(encoding='utf-8-sig');text=re.sub(r'<script\b[^>]*>.*?</script>','',text,flags=re.S)
 for filename in ['style.css','operation.css','glass.css']:text=text.replace('href="./'+filename+'"','href="./source/'+filename+'"')
 text=text.replace('src="./images/','src="./source/images/').replace('href="./"','href="./index.html"')
 text=text.replace('</body>',f'<script src="./local-assets/runtime.js" data-entry="{entry}"></script></body>')
 (ROOT/name).write_text(text,encoding='utf-8');print(name,(ROOT/name).stat().st_size,'bytes')
print('Local assets:',len(manifest),'runtime:',(PACK/'runtime.js').stat().st_size,'bytes')
