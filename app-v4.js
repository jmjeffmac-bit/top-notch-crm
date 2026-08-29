document.addEventListener('DOMContentLoaded',function(){
  const $=id=>document.getElementById(id);
  const loginBtn=$('loginBtn'), loginUser=$('loginUser'), loginPin=$('loginPin'), loginMsg=$('loginMsg');
  const loginScreen=$('loginScreen'), appShell=$('appShell'), whoami=$('whoami'), logoutBtn=$('logoutBtn');
  let session=null;
  const KEY='tncrm-live-v4';
  const defaults={customers:[],estimates:[],jobs:[],invoices:[],team:{Owner:'Jeff',Tech1:'Stan',Tech2:'Louis'}};
  let S;
  try{S=JSON.parse(localStorage.getItem(KEY))||defaults;}catch(e){S=defaults;}
  const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
  const money=n=>'$'+Number(n||0).toFixed(2);
  const makeId=p=>p+'-'+Date.now().toString().slice(-6);
  const customerName=id=>{const c=S.customers.find(x=>x.id===id);return c?c.name:'Unknown';};
  const isOwner=()=>session&&session.role==='Owner';

  function signIn(){
    const u=(loginUser.value||'').trim().toLowerCase();
    const p=(loginPin.value||'').trim();
    const map={jeff:'Owner',stan:'Tech1',louis:'Tech2'};
    if(!map[u]||p!=='1234'){loginMsg.textContent='Incorrect name or PIN.';return;}
    const display=u.charAt(0).toUpperCase()+u.slice(1);
    session={name:display,role:map[u]};
    loginScreen.hidden=true; appShell.hidden=false;
    whoami.textContent=display+' • '+(isOwner()?'Owner / Administrator':'Technician');
    document.querySelectorAll('.owner-only').forEach(x=>x.style.display=isOwner()?'':'none');
    hydrate(); render();
  }
  loginBtn.addEventListener('click',signIn);
  loginPin.addEventListener('keydown',e=>{if(e.key==='Enter')signIn();});
  logoutBtn.addEventListener('click',()=>location.reload());

  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x===b));
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));
  }));

  function hydrate(){
    const opts='<option value="">Select customer</option>'+S.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    ['eCustomer','jCustomer','iCustomer'].forEach(id=>{if($(id))$(id).innerHTML=opts;});
    if($('iJob'))$('iJob').innerHTML='<option value="">Related job</option>'+S.jobs.map(j=>`<option value="${j.id}">${j.id} — ${j.service}</option>`).join('');
  }
  function card(title,status,meta,detail){const a=document.createElement('article');a.className='record';a.innerHTML=`<div class="record-head"><strong>${title}</strong><span class="badge">${status||''}</span></div><div class="record-meta">${meta||''}</div><div>${detail||''}</div>`;return a;}
  if($('saveCustomer'))$('saveCustomer').addEventListener('click',()=>{const r={id:makeId('C'),name:$('cName').value.trim(),phone:$('cPhone').value.trim(),email:$('cEmail').value.trim(),address:$('cAddress').value.trim(),source:$('cSource').value,tags:$('cTags').value.trim(),notes:$('cNotes').value.trim()};if(!r.name){alert('Customer name required');return;}S.customers.push(r);save();hydrate();render();});
  if($('saveEstimate'))$('saveEstimate').addEventListener('click',()=>{const r={id:makeId('EST'),customerId:$('eCustomer').value,service:$('eService').value.trim(),amount:Number($('eAmount').value||0),status:$('eStatus').value,scope:$('eScope').value.trim()};if(!r.customerId||!r.service){alert('Customer and service required');return;}S.estimates.push(r);save();render();});
  if($('saveJob'))$('saveJob').addEventListener('click',()=>{const cid=$('jCustomer').value,c=S.customers.find(x=>x.id===cid);const r={id:makeId('JOB'),customerId:cid,service:$('jService').value.trim(),address:$('jAddress').value.trim()||(c?c.address:''),price:Number($('jPrice').value||0),scheduled:$('jScheduled').value,assignedTo:$('jAssigned').value,status:'Scheduled',notes:$('jNotes').value.trim()};if(!r.customerId||!r.service){alert('Customer and service required');return;}S.jobs.push(r);save();hydrate();render();});
  if($('saveInvoice'))$('saveInvoice').addEventListener('click',()=>{const r={id:makeId('INV'),customerId:$('iCustomer').value,jobId:$('iJob').value,amount:Number($('iAmount').value||0),status:$('iStatus').value};if(!r.customerId||!r.amount){alert('Customer and amount required');return;}S.invoices.push(r);save();render();});

  function render(){
    const cb=$('customerList');if(cb){cb.innerHTML='';S.customers.forEach(c=>cb.appendChild(card(c.name,c.source||'Customer',(c.phone||'')+' • '+(c.address||''),c.notes||'')));}
    const eb=$('estimateList');if(eb){eb.innerHTML='';S.estimates.forEach(e=>eb.appendChild(card(e.id+' — '+e.service,e.status,customerName(e.customerId)+' • '+money(e.amount),e.scope)));}
    const visibleJobs=S.jobs.filter(j=>isOwner()||j.assignedTo===session.role);
    const jb=$('jobList');if(jb){jb.innerHTML='';visibleJobs.forEach(j=>jb.appendChild(card(j.id+' — '+j.service,j.status,customerName(j.customerId)+' • '+S.team[j.assignedTo],(j.scheduled?new Date(j.scheduled).toLocaleString():'Not scheduled')+'<br>'+j.address+'<br>'+money(j.price))));}
    const ib=$('invoiceList');if(ib){ib.innerHTML='';S.invoices.forEach(i=>ib.appendChild(card(i.id,i.status,customerName(i.customerId),money(i.amount))));}
    if($('statOpen'))$('statOpen').textContent=visibleJobs.filter(j=>j.status!=='Completed').length;
    if($('statScheduled'))$('statScheduled').textContent=visibleJobs.filter(j=>j.status==='Scheduled').length;
    if($('statCompleted'))$('statCompleted').textContent=visibleJobs.filter(j=>j.status==='Completed').length;
    const paid=S.invoices.filter(i=>i.status==='Paid').reduce((s,i)=>s+i.amount,0), ar=S.invoices.filter(i=>i.status!=='Paid').reduce((s,i)=>s+i.amount,0);
    if($('statRevenue'))$('statRevenue').textContent=money(paid);if($('statAR'))$('statAR').textContent=money(ar);
    const d=$('dashJobs');if(d){d.innerHTML='';visibleJobs.slice(0,10).forEach(j=>d.appendChild(card(j.service,j.status,customerName(j.customerId),j.scheduled?new Date(j.scheduled).toLocaleString():'')));}
    renderCalendar();
  }
  function renderCalendar(){const b=$('calendarList');if(!b)return;b.innerHTML='';const d=$('calendarDate').value;S.jobs.filter(j=>(isOwner()||j.assignedTo===session.role)&&(!d||String(j.scheduled||'').startsWith(d))).forEach(j=>b.appendChild(card(j.service,j.status,customerName(j.customerId),j.scheduled?new Date(j.scheduled).toLocaleString():'')));}
  if($('calendarDate'))$('calendarDate').addEventListener('change',renderCalendar);
  if($('exportBtn'))$('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='top-notch-crm-backup.json';a.click();});
  if($('priceList'))$('priceList').innerHTML='<div class="record"><strong>Minimum Service Call</strong><div class="record-meta">Customer flat rate</div><div>$125.00</div></div>';
});