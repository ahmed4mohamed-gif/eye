"""Build double-click HTML entries using only the Python standard library."""
from pathlib import Path
import re,json,base64,mimetypes
ROOT=Path(__file__).resolve().parent;SRC=ROOT/'source'
def data(path):return base64.b64encode(path.read_bytes()).decode()
def css(path):
 text=path.read_text(encoding='utf-8-sig')
 text=re.sub(r'@import\s+url\([\'"]([^\'"]+)[\'"]\);',lambda m:css((path.parent/m[1]).resolve()),text)
 def asset(m):
  p=(path.parent/m[1]).resolve()
  return 'url("data:'+(mimetypes.guess_type(p)[0] or 'font/ttf')+';base64,'+data(p)+'")' if p.is_file() else m[0]
 return re.sub(r'url\([\'"]([^\'"]+)[\'"]\)',asset,text)
files={p.relative_to(SRC).as_posix():p for p in SRC.rglob('*') if p.is_file()}
modules={}
for key,p in files.items():
 if p.suffix!='.js' or '/draco/' in key:continue
 text=p.read_text(encoding='utf-8-sig')
 def spec(m):
  s=m[2]
  if s=='three':target='vendor/three.module.js'
  elif s.startswith('.'):target=(p.parent/s).resolve().relative_to(SRC.resolve()).as_posix()
  else:return m[0]
  if target not in files:raise ValueError('Missing module '+target)
  return m[1]+m[3]+'ain/'+target+m[3]
 text=re.sub(r'(\bfrom\s*|\bimport\s*)([\'"])([^\'"]+)\2',lambda m:spec(type('Match',(),{'__getitem__':lambda _,i:{0:m[0],1:m[1],2:m[3],3:m[2]}[i]})()),text)
 modules['ain/'+key]=text
assets={k:{'mime':mimetypes.guess_type(k)[0] or 'application/octet-stream','b64':data(p)} for k,p in files.items() if p.suffix not in ('.html','.css','.js') or '/draco/' in k}
bootstrap=r'''const packed=__ASSETS__, modules=__MODULES__, urls={};
function localKey(value){try{const path=decodeURIComponent(new URL(value,location.href).pathname);return Object.keys(packed).find(k=>path.endsWith('/'+k))}catch{return null}}
function assetURL(key){if(!urls[key]){const a=packed[key],b=atob(a.b64),out=new Uint8Array(b.length);for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);urls[key]=URL.createObjectURL(new Blob([out],{type:a.mime}));delete a.b64;}return urls[key]}
const networkFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,init)=>{const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;const key=localKey(value);return networkFetch(key?assetURL(key):input,init)};
function images(node){if(node.nodeType!==1)return;for(const img of [...(node.matches('img')?[node]:[]),...node.querySelectorAll('img')]){const k=localKey(img.getAttribute('src'));if(k)img.src=assetURL(k)}}
new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')images(r.target);for(const n of r.addedNodes)images(n)}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});images(document.body);
const imports={};for(const [key,code] of Object.entries(modules))imports[key]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
for(const entry of __ENTRIES__){const script=document.createElement('script');script.type='module';script.textContent='import '+JSON.stringify('ain/'+entry);document.body.append(script)}
'''
for name,entry in [('index.html','main.js'),('operation.html','operation.js')]:
 text=(SRC/name).read_text(encoding='utf-8-sig')
 text=re.sub(r'<script\b[^>]*>.*?</script>','',text,flags=re.S)
 text=re.sub(r'<link rel="stylesheet" href="\./([^\"]+)"\s*>',lambda m:'<style>'+css(SRC/m[1])+'</style>',text)
 text=text.replace('href="./"','href="./index.html"')
 boot=bootstrap.replace('__ASSETS__',json.dumps(assets,separators=(',',':'))).replace('__MODULES__',json.dumps(modules,separators=(',',':'))).replace('__ENTRIES__',json.dumps([entry,'glass.js']))
 boot=boot.replace('</script','<\\/script')
 text=text.replace('</body>','<script>'+boot+'</script></body>')
 (ROOT/name).write_text(text,encoding='utf-8')
 print(name,round((ROOT/name).stat().st_size/1024/1024,1),'MiB')
