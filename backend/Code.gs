const CRM_SHEETS = {
  customers: ['id','name','phone','email','address','source','tags','notes','createdAt','updatedAt'],
  estimates: ['id','customerId','service','amount','status','validUntil','scope','createdAt','updatedAt'],
  jobs: ['id','customerId','service','address','price','materials','scheduled','assignedTo','status','notes','photos','signatureUrl','createdAt','updatedAt'],
  invoices: ['id','customerId','jobId','amount','dueDate','status','paymentMethod','notes','createdAt','updatedAt'],
  pricebook: ['id','code','service','basePrice','hours','materials','internalRate','scope','active','createdAt','updatedAt']
};

const SESSION_SECONDS = 21600; // 6 hours

function doGet() {
  return json_({ok:true, service:'Top Notch CRM backend', status:'ready'});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');
    if (action === 'health') return json_({ok:true,status:'ready'});
    if (action === 'login') return json_(login_(body));
    if (action === 'logout') return json_(logout_(body));

    const session = requireSession_(body.token);
    if (action === 'bootstrap') return json_(bootstrap_(session));
    if (action === 'saveCustomer') return json_(saveRecord_('customers', body.record, session));
    if (action === 'saveEstimate') return json_(saveRecord_('estimates', body.record, session));
    if (action === 'saveJob') return json_(saveRecord_('jobs', body.record, session));
    if (action === 'saveInvoice') return json_(saveRecord_('invoices', body.record, session));
    if (action === 'savePricebook') return json_(saveRecord_('pricebook', body.record, session));
    if (action === 'updateJobStatus') return json_(updateJobStatus_(body, session));
    return json_({ok:false,error:'Unknown action'});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function setupCRM() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SPREADSHEET_ID');
  let ss;
  if (!id) {
    ss = SpreadsheetApp.create('Top Notch CRM Database');
    id = ss.getId();
    props.setProperty('SPREADSHEET_ID', id);
  } else {
    ss = SpreadsheetApp.openById(id);
  }
  Object.keys(CRM_SHEETS).forEach(name => ensureSheet_(ss, name, CRM_SHEETS[name]));
  return {spreadsheetId:id, spreadsheetUrl:ss.getUrl()};
}

function setInitialSecurity(ownerPin, stanPin, louisPin) {
  if (!ownerPin || !stanPin || !louisPin) throw new Error('All three PINs are required.');
  const p = PropertiesService.getScriptProperties();
  p.setProperties({
    USER_JEFF_ROLE:'Owner', USER_JEFF_NAME:'Jeff', USER_JEFF_PIN_HASH:hash_(String(ownerPin)),
    USER_STAN_ROLE:'Tech1', USER_STAN_NAME:'Stan', USER_STAN_PIN_HASH:hash_(String(stanPin)),
    USER_LOUIS_ROLE:'Tech2', USER_LOUIS_NAME:'Louis', USER_LOUIS_PIN_HASH:hash_(String(louisPin))
  }, false);
  return 'Security saved in Script Properties.';
}

function login_(body) {
  const username = String(body.username || '').trim().toUpperCase();
  const pin = String(body.pin || '').trim();
  const p = PropertiesService.getScriptProperties();
  const role = p.getProperty('USER_' + username + '_ROLE');
  const name = p.getProperty('USER_' + username + '_NAME');
  const saved = p.getProperty('USER_' + username + '_PIN_HASH');
  if (!role || !saved || hash_(pin) !== saved) return {ok:false,error:'Incorrect name or PIN.'};
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('SESSION_' + token, JSON.stringify({username,name,role}), SESSION_SECONDS);
  return {ok:true,token,user:{name,role},expiresIn:SESSION_SECONDS};
}

function logout_(body) {
  if (body.token) CacheService.getScriptCache().remove('SESSION_' + body.token);
  return {ok:true};
}

function requireSession_(token) {
  if (!token) throw new Error('Sign-in required.');
  const raw = CacheService.getScriptCache().get('SESSION_' + token);
  if (!raw) throw new Error('Session expired. Please sign in again.');
  return JSON.parse(raw);
}

function bootstrap_(session) {
  const out = {ok:true,user:{name:session.name,role:session.role}};
  if (session.role === 'Owner') {
    out.customers = readAll_('customers');
    out.estimates = readAll_('estimates');
    out.jobs = readAll_('jobs');
    out.invoices = readAll_('invoices');
    out.pricebook = readAll_('pricebook');
  } else {
    out.customers = [];
    out.estimates = [];
    out.invoices = [];
    out.pricebook = [];
    out.jobs = readAll_('jobs').filter(j => String(j.assignedTo) === session.role);
  }
  return out;
}

function saveRecord_(table, record, session) {
  if (!CRM_SHEETS[table]) throw new Error('Invalid table.');
  const ownerOnly = ['customers','estimates','invoices','pricebook'];
  if (ownerOnly.indexOf(table) >= 0 && session.role !== 'Owner') throw new Error('Owner access required.');
  if (!record || typeof record !== 'object') throw new Error('Record required.');

  if (table === 'jobs' && session.role !== 'Owner') {
    const existing = record.id ? findById_('jobs', record.id) : null;
    if (!existing || String(existing.assignedTo) !== session.role) throw new Error('This job is not assigned to you.');
    const allowed = ['Accepted','In Progress','Completed'];
    if (allowed.indexOf(String(record.status)) < 0) throw new Error('Technicians may only update workflow status.');
    return updateJobStatus_({jobId:record.id,status:record.status}, session);
  }

  const headers = CRM_SHEETS[table];
  const now = new Date().toISOString();
  const clean = {};
  headers.forEach(h => clean[h] = record[h] == null ? '' : record[h]);
  clean.id = clean.id || makeId_(table);
  clean.createdAt = clean.createdAt || now;
  clean.updatedAt = now;
  upsert_(table, clean);
  return {ok:true,record:clean};
}

function updateJobStatus_(body, session) {
  const job = findById_('jobs', body.jobId);
  if (!job) throw new Error('Job not found.');
  if (session.role !== 'Owner' && String(job.assignedTo) !== session.role) throw new Error('This job is not assigned to you.');
  const allowedTech = ['Accepted','In Progress','Completed'];
  if (session.role !== 'Owner' && allowedTech.indexOf(String(body.status)) < 0) throw new Error('Status not allowed.');
  job.status = String(body.status || job.status);
  job.updatedAt = new Date().toISOString();
  upsert_('jobs', job);
  return {ok:true,record:job};
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Run setupCRM() first.');
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function readAll_(table) {
  const sh = getSpreadsheet_().getSheetByName(table);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  return values.filter(r => r.some(v => v !== '')).map(r => {
    const o = {}; headers.forEach((h,i) => o[h] = r[i]); return o;
  });
}

function findById_(table, id) {
  return readAll_(table).find(r => String(r.id) === String(id)) || null;
}

function upsert_(table, record) {
  const sh = getSpreadsheet_().getSheetByName(table);
  const headers = CRM_SHEETS[table];
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let i=1;i<values.length;i++) if (String(values[i][0]) === String(record.id)) { row = i+1; break; }
  const data = headers.map(h => record[h] == null ? '' : record[h]);
  if (row > 0) sh.getRange(row,1,1,headers.length).setValues([data]);
  else sh.appendRow(data);
}

function makeId_(table) {
  const prefix = {customers:'CUST',estimates:'EST',jobs:'JOB',invoices:'INV',pricebook:'PB'}[table] || 'REC';
  return prefix + '-' + Utilities.getUuid().split('-')[0].toUpperCase();
}

function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
