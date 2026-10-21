'use strict';
const $=id=>document.getElementById(id);
const sourceNums=['01','03','04','05','06','07','08','09','10','11','13','14','15','16'];
const sourcePath=n=>n==='14'?'../drafts/lecture-14-bank.json':'../tests/lecture-'+n+'-bank.json';
const manifestPath=n=>'../drafts/collections/collection-'+n+'.json';
const store=new Map();
let current=[],index=0,score=0,errors=[],answered=false,loaded=null;
const shuffle=a=>{let x=a.slice();for(let i=x.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const text=(id,value)=>$(id).textContent=value;
const show=(id,yes)=>$(id).classList.toggle('hide',!yes);
async function readJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Не удалось загрузить '+path+' (HTTP '+r.status+')');return r.json()}
async function load(){const num=Number($('collection').value);if(loaded&&loaded.collection===num)return loaded;
const [manifest,...banks]=await Promise.all([readJson(manifestPath(num)),...sourceNums.map(n=>store.has(n)?Promise.resolve(store.get(n)):readJson(sourcePath(n)))]);
const byId=new Map();banks.forEach((b,i)=>{store.set(sourceNums[i],b);if(!Array.isArray(b.questions))throw Error('Некорректный банк '+sourceNums[i]);b.questions.forEach(q=>{if(byId.has(q.id))throw Error('Повтор ID '+q.id);byId.set(q.id,q)})});
if(byId.size!==488)throw Error('Ожидается 488 вопросов, найдено '+byId.size);
if(manifest.variants.length!==10)throw Error('Ожидается десять вариантов');
const seen=new Set();manifest.variants.forEach((v,i)=>{if(v.number!==i+1||v.questionIds.length!==(i<8?49:48))throw Error('Некорректная длина варианта '+(i+1));for(const id of v.questionIds){if(!byId.has(id)||seen.has(id))throw Error('Пропуск или повтор ID '+id);seen.add(id)}});
if(seen.size!==488)throw Error('Неполное распределение вопросов');
loaded={collection:num,manifest,byId};return loaded}
function variants(){const select=$('variant');const prev=select.value;select.replaceChildren();for(let i=1;i<=10;i++){const size=i<=8?49:48;select.add(new Option('Тест '+i+' — '+size+' вопросов',String(i)))}if(prev)select.value=prev;else select.value='1'}
function choiceRow(o,q){const d=document.createElement('div');d.className='option';const l=document.createElement('label');const el=document.createElement('input');el.type=q.correct.length===1?'radio':'checkbox';el.name='answer';el.value=o.id;l.append(el,document.createTextNode(o.text));d.append(l);return d}
function render(){const q=current[index];if(!q){finish();return}
answered=false;text('progress','Вопрос '+(index+1)+' из '+current.length);text('question',q.question);$('options').replaceChildren(...q.display.map(o=>choiceRow(o,q)));text('alert','');text('feedback','');show('feedback',false);$('check').disabled=false;$('next').disabled=true;$('next').textContent=index===current.length-1?'Результат →':'Следующий вопрос →'}
function selected(){return Array.from(document.querySelectorAll('#options input:checked'),x=>x.value)}
function checkedAnswer(){if(answered)return;const q=current[index],given=selected();if(!given.length){text('alert','Выберите ответ.');return}
answered=true;text('alert','');const correct=new Set(q.correct),picked=new Set(given),ok=correct.size===picked.size&&[...correct].every(x=>picked.has(x));if(ok)score++;else errors.push({position:index+1,q,given});
document.querySelectorAll('.option').forEach(node=>{const input=node.querySelector('input');input.disabled=true;if(correct.has(input.value))node.classList.add('correct');else if(picked.has(input.value))node.classList.add('wrong')});
const explanation=document.createElement('div');const b=document.createElement('strong');b.textContent=ok?'Верно.':'Ошибка.';explanation.append(b,document.createTextNode(' '+(q.explanation||'')));$('feedback').replaceChildren(explanation);show('feedback',true);$('check').disabled=true;$('next').disabled=false}
function line(label,opts){const p=document.createElement('p');const b=document.createElement('strong');b.textContent=label;p.append(b,document.createTextNode(' '+(opts.length?opts.join('; '):'—')));return p}
function finish(){show('exam',false);show('results',true);const root=$('results');root.replaceChildren();const h=document.createElement('h2');h.textContent='Результат';root.append(h);const p=document.createElement('p');p.className='score';p.textContent=score+' из '+current.length+' — '+(100*score/current.length).toFixed(1).replace('.',',')+'%';root.append(p);
if(errors.length){const e=document.createElement('h3');e.textContent='Разбор ошибок';root.append(e);for(const err of errors){const d=document.createElement('div');d.className='review';const h=document.createElement('h4');h.textContent='Вопрос '+err.position+'. '+err.q.question;d.append(h);const chosen=err.q.options.filter(o=>err.given.includes(o.id)).map(o=>o.text);const right=err.q.options.filter(o=>err.q.correct.includes(o.id)).map(o=>o.text);d.append(line('Ваш ответ:',chosen),line('Правильный ответ:',right));if(err.q.explanation){const p=document.createElement('p');p.textContent=err.q.explanation;d.append(p)}root.append(d)}}const btn=document.createElement('button');btn.textContent='К выбору теста';btn.onclick=reset;root.append(btn)}
function reset(){show('exam',false);show('results',false);show('setup',true);text('status','')}
$('collection').addEventListener('change',()=>{loaded=null;variants();text('status','')});
$('start').addEventListener('click',async()=>{const btn=$('start');btn.disabled=true;text('status','Загрузка вопросов…');try{const data=await load(),n=Number($('variant').value);const ids=data.manifest.variants[n-1].questionIds;current=ids.map(id=>{const q=data.byId.get(id);if(!Array.isArray(q.options)||!Array.isArray(q.correct)||!q.correct.length||!q.correct.every(key=>q.options.some(o=>o.id===key)))throw Error('Некорректный ключ '+id);return {...q,display:shuffle(q.options)}});index=0;score=0;errors=[];show('setup',false);show('results',false);show('exam',true);render();history.replaceState(null,'','?collection='+data.collection+'&variant='+n)}catch(e){text('status',e.message)}finally{btn.disabled=false}});
$('check').addEventListener('click',checkedAnswer);$('next').addEventListener('click',()=>{if(!answered)return;index++;render()});$('exit').addEventListener('click',reset);
variants();const qs=new URLSearchParams(location.search);if(/^[123]$/.test(qs.get('collection')||''))$('collection').value=qs.get('collection');if(/^(10|[1-9])$/.test(qs.get('variant')||''))$('variant').value=qs.get('variant');
