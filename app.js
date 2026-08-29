document.addEventListener('DOMContentLoaded', function () {
  var $ = function(id){ return document.getElementById(id); };
  var loginBtn = $('loginBtn');
  var loginUser = $('loginUser');
  var loginPin = $('loginPin');
  var loginMsg = $('loginMsg');
  var loginScreen = $('loginScreen');
  var appShell = $('appShell');
  var whoami = $('whoami');
  var logoutBtn = $('logoutBtn');
  var session = null;
  var KEY = 'tncrm-live-v2';
  var defaultState = {customers:[], estimates:[], jobs:[], invoices:[], team:{Owner:'Jeff',Tech1:'Stan',Tech2:'Louis'}};
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || defaultState; } catch(e) { S = defaultState; }
  function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
  function money(n){ return '$' + Number(n || 0).toFixed(2); }
  function makeId(p){ return p + '-' + Date.now().toString().slice(-6); }
  function customerName(cid){ var c=S.customers.find(function(x){return x.id===cid;}); return c?c.name:'Unknown'; }
  function isOwner(){ return session && session.role==='Owner'; }
  function showMessage(m){ if(loginMsg) loginMsg.textContent=m; }

  loginBtn.addEventListener('click', function(){
    var u=(loginUser.value||'').trim();
    var p=(loginPin.value||'').trim();
    var roleMap={Jeff:'Owner',Stan:'Tech1',Louis:'Tech2'};
    if(!roleMap[u] || p!=='1234') { showMessage('Incorrect name or PIN.'); return; }
    session={name:u,role:roleMap[u]};
    loginScreen.hidden=true;
    appShell.hidden=false;
    whoami.textContent=u+' • '+(isOwner()?'Owner / Administrator':'Technician');
    document.querySelectorAll('.owner-only').forEach(function(x){x.style.display=isOwner()?'':'none';});
    hydrate(); render();
  });
  logoutBtn.addEventListener('click', function(){ location.reload(); });

  document.querySelectorAll('.tabs button').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('.tabs button').forEach(function(x){x.classList.toggle('active',x===b);});
      document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('active',x.id===b.dataset.tab);});
    });
  });
  function hydrate(){
    var o='<option value="">Select customer</option>'+S.customers.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
    ['eCustomer','jCustomer','iCustomer'].forEach(function(x){ if($(x)) $(x).innerHTML=o; });
    if($('iJob')) $('iJob').innerHTML='<option value="">Related job</option>'+S.jobs.map(function(j){return '<option value="'+j.id+'">'+j.id+' — '+j.service+'</option>';}).join('');
  }
  function card(title,status,meta,detail){
    var a=document.createElement('article'); a.className='record';
    a.innerHTML='<div class="record-head"><strong>'+title+'</strong><span class="badge">'+(status||'')+'</span></div><div class="record-meta">'+(meta||'')+'</div><div>'+(detail||'')+'</div><div class="record-actions"></div>';
    return a;
  }
  if($('saveCustomer')) $('saveCustomer').addEventListener('click',function(){
    var r={id:makeId('C'),name:$('cName').value.trim(),phone:$('cPhone').value.trim(),email:$('cEmail').value.trim(),address:$('cAddress').value.trim(),source:$('cSource').value,tags:$('cTags').value.trim(),notes:$('cNotes').value.trim()};
    if(!r.name){alert('Customer name required');return;} S.customers.push(r);save();hydrate();render();
  });
  if($('saveEstimate')) $('saveEstimate').addEventListener('click',function(){
    var r={id:makeId('EST'),customerId:$('eCustomer').value,service:$('eService').value.trim(),amount:Number($('eAmount').value||0),status:$('eStatus').value,scope:$('eScope').value.trim()};
    if(!r.customerId||!r.service){alert('Customer and service required');return;} S.estimates.push(r);save();render();
  });
  if($('saveJob')) $('saveJob').addEventListener('click',function(){
    var cid=$('jCustomer').value,c=S.customers.find(function(x){return x.id===cid;});
    var r={id:makeId('JOB'),customerId:cid,service:$('jService').value.trim(),address:$('jAddress').value.trim()||(c?c.address:''),price:Number($('jPrice').value||0),scheduled:$('jScheduled').value,assignedTo:$('jAssigned').value,status:'Scheduled',notes:$('jNotes').value.trim()};
    if(!r.customerId||!r.service){alert('Customer and service required');return;} S.jobs.push(r);save();hydrate();render();
  });
  if($('saveInvoice')) $('saveInvoice').addEventListener('click',function(){
    var r={id:makeId('INV'),customerId:$('iCustomer').value,jobId:$('iJob').value,amount:Number($('iAmount').value||0),status:$('iStatus').value};
    if(!r.customerId||!r.amount){alert('Customer and amount required');return;} S.invoices.push(r);save();render();
  });
  function render(){
    var cb=$('customerList'); if(cb){cb.innerHTML='';S.customers.forEach(function(c){cb.appendChild(card(c.name,c.source||'Customer',(c.phone||'')+' • '+(c.address||''),c.notes||''));});}
    var eb=$('estimateList'); if(eb){eb.innerHTML='';S.estimates.forEach(function(e){eb.appendChild(card(e.id+' — '+e.service,e.status,customerName(e.customerId)+' • '+money(e.amount),e.scope));});}
    var jb=$('jobList'); if(jb){jb.innerHTML='';S.jobs.filter(function(j){return isOwner()||j.assignedTo===session.role;}).forEach(function(j){var a=card(j.id+' — '+j.service,j.status,customerName(j.customerId)+' • '+S.team[j.assignedTo],(j.scheduled?new Date(j.scheduled).toLocaleString():'Not scheduled')+'<br>'+j.address+'<br>'+money(j.price));jb.appendChild(a);});}
    var ib=$('invoiceList'); if(ib){ib.innerHTML='';S.invoices.forEach(function(i){ib.appendChild(card(i.id,i.status,customerName(i.customerId),money(i.amount)));});}
    var jobs=S.jobs.filter(function(j){return isOwner()||j.assignedTo===session.role;});
    if($('statOpen')) $('statOpen').textContent=jobs.filter(function(j){return j.status!=='Completed';}).length;
    if($('statScheduled')) $('statScheduled').textContent=jobs.filter(function(j){return j.status==='Scheduled';}).length;
    if($('statCompleted')) $('statCompleted').textContent=jobs.filter(function(j){return j.status==='Completed';}).length;
    var paid=S.invoices.filter(function(i){return i.status==='Paid';}).reduce(function(s,i){return s+i.amount;},0);
    var ar=S.invoices.filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+i.amount;},0);
    if($('statRevenue')) $('statRevenue').textContent=money(paid); if($('statAR')) $('statAR').textContent=money(ar);
    if($('dashJobs')) $('dashJobs').innerHTML=jb?jb.innerHTML:''; renderCalendar();
  }
  function renderCalendar(){var b=$('calendarList');if(!b)return;b.innerHTML='';var d=$('calendarDate').value;S.jobs.filter(function(j){return (isOwner()||j.assignedTo===session.role)&&(!d||String(j.scheduled||'').indexOf(d)===0);}).forEach(function(j){b.appendChild(card(j.service,j.status,customerName(j.customerId),j.scheduled?new Date(j.scheduled).toLocaleString():''));});}
  if($('calendarDate')) $('calendarDate').addEventListener('change',renderCalendar);
  if($('exportBtn')) $('exportBtn').addEventListener('click',function(){var blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='top-notch-crm-backup.json';a.click();});
  if($('priceList')) $('priceList').innerHTML='<div class="record"><strong>Minimum Service Call</strong><div class="record-meta">Customer flat rate</div><div>$125.00</div></div>';
});