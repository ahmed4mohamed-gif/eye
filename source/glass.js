// Original SVG controls; no Apple platform assets are redistributed.
const paths={eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',panel:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m-3-11h0m0 3h0"/>',home:'<path d="m3 10 9-7 9 7M5 9v11h14V9m-10 11v-7h6v7"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',rotate:'<path d="M20 8A8 8 0 1 0 21 14M20 3v5h-5"/>'};
const svg=id=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[id]}</svg>`;
const dock=document.createElement('nav');dock.className='ui-dock';dock.setAttribute('aria-label','إظهار الواجهة');
dock.innerHTML=`<button id="toggle-ui" title="إخفاء أو إظهار الواجهة (H)" aria-label="إخفاء الواجهة" aria-pressed="false">${svg('eye')}</button>${document.querySelector('.inspector')?`<button id="toggle-panel" title="قائمة الأجهزة" aria-label="إخفاء قائمة الأجهزة" aria-expanded="true">${svg('panel')}</button>`:''}`;document.body.append(dock);
function store(k,v){try{localStorage.setItem(k,String(v))}catch{}}
function toggleUI(){const on=document.body.classList.toggle('ui-hidden');const b=document.querySelector('#toggle-ui');b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'إظهار الواجهة':'إخفاء الواجهة');if(on)b.focus();}
document.querySelector('#toggle-ui').onclick=toggleUI;
const inspector=document.querySelector('.inspector');
const panelButton=document.querySelector('#toggle-panel');
if(inspector&&panelButton){inspector.id='system-sidebar';panelButton.setAttribute('aria-controls',inspector.id);panelButton.classList.add('sidebar-toggle');document.body.append(panelButton);}
function panel(hide){document.body.classList.toggle('panel-hidden',hide);const el=document.querySelector('.inspector');if(el){el.inert=hide;el.setAttribute('aria-hidden',String(hide));}const b=document.querySelector('#toggle-panel');b?.setAttribute('aria-expanded',String(!hide));b?.setAttribute('aria-label',hide?'فتح القائمة الجانبية':'إغلاق القائمة الجانبية');if(b){b.title=hide?'فتح القائمة الجانبية':'إغلاق القائمة الجانبية';b.innerHTML=svg('panel')+`<span>${hide?'فتح القائمة':'إغلاق القائمة'}</span>`;}store('ain-panel-hidden',hide);}
document.querySelector('#toggle-panel')?.addEventListener('click',()=>panel(!document.body.classList.contains('panel-hidden')));
try{panel(localStorage.getItem('ain-panel-hidden')==='true'||(localStorage.getItem('ain-panel-hidden')===null&&innerWidth<900));}catch{}
document.addEventListener('keydown',e=>{if(/input|textarea|select/i.test(e.target.tagName)||e.target.isContentEditable||document.querySelector('dialog[open]'))return;if(e.code==='KeyH'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();toggleUI()}if(e.key==='Escape'&&document.body.classList.contains('ui-hidden'))toggleUI();});
for(const [id,icon] of Object.entries({'home-view':'home','zoom-in':'plus','zoom-out':'minus',rotate:'rotate',restart:'rotate'})){const b=document.getElementById(id);if(b){b.innerHTML=svg(icon);b.classList.add('icon-button');}}
