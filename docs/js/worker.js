const state={location:null,isCheckedIn:false};
const codeEl=document.getElementById('employeeCode');
const locationBtn=document.getElementById('locationBtn');
const actionBtn=document.getElementById('attendanceBtn');
const statusEl=document.getElementById('locationStatus');
const msg=document.getElementById('messageBox');
const result=document.getElementById('resultPanel');
codeEl.value=localStorage.getItem('employeeCode')||'';

function showMessage(html){msg.innerHTML=html;}
function getFreshLocation(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject({code:'UNSUPPORTED'});navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0});});}

async function refreshStatus(){
 const code=codeEl.value.trim(); if(!code)return;
 localStorage.setItem('employeeCode',code);
 try{
   const r=await apiRequest(`/api/attendance/status?employeeCode=${encodeURIComponent(code)}`);
   state.isCheckedIn=!!r.data?.isCheckedIn;
   actionBtn.textContent=state.isCheckedIn?'CHECK OUT':'CHECK IN';
   showMessage(state.isCheckedIn?'<div class="alert alert-success">🟢 أنت مسجل حضور حاليًا.</div>':'');
 }catch(e){
   if(e.data?.errorCode==='EMPLOYEE_NOT_FOUND')showMessage('<div class="alert alert-danger">❌ كود العامل غير صحيح.</div>');
   else showMessage('<div class="alert alert-danger">تعذر الاتصال بالخادم.</div>');
 }
}

locationBtn.addEventListener('click',async()=>{
 statusEl.classList.remove('d-none'); statusEl.className='status-box mt-3 alert alert-info'; statusEl.textContent='جاري تحديد موقعك...';
 try{
   state.location=await getFreshLocation();
   statusEl.className='status-box mt-3 alert alert-success';
   statusEl.textContent=`✅ تم تحديد موقعك — الدقة: ${Math.round(state.location.accuracy)} متر`;
   actionBtn.disabled=false; await refreshStatus();
 }catch(_){
   statusEl.className='status-box mt-3 alert alert-danger';
   statusEl.textContent='تعذر الوصول للموقع. فعّل GPS واسمح للموقع باستخدامه.';
   actionBtn.disabled=true;
 }
});

function mapError(d){
 const c=d?.errorCode;
 if(c==='ALREADY_CHECKED_IN')return '⚠️ تم تسجيل حضورك بالفعل.';
 if(c==='NO_ACTIVE_CHECKIN')return '⚠️ لا يوجد حضور مفتوح.';
 if(c==='OUTSIDE_GEOFENCE')return `❌ أنت خارج نطاق موقع العمل${d.data?.distanceMeters!=null?` — المسافة ${Math.round(d.data.distanceMeters)} متر`:''}.`;
 if(c==='POOR_LOCATION_ACCURACY')return '⚠️ دقة الموقع غير كافية. فعّل GPS وانتظر قليلًا ثم حاول مجددًا.';
 if(c==='EMPLOYEE_NOT_FOUND')return '❌ كود العامل غير صحيح.';
 if(c==='EMPLOYEE_INACTIVE')return '❌ الحساب غير مفعل. راجع المسؤول.';
 return 'حدث خطأ أثناء تنفيذ العملية. يرجى المحاولة مرة أخرى.';
}

actionBtn.addEventListener('click',async()=>{
 const code=codeEl.value.trim();
 if(!code){showMessage('<div class="alert alert-warning">أدخل كود العامل أولًا.</div>');return;}
 localStorage.setItem('employeeCode',code); actionBtn.disabled=true;
 try{
   const loc=await getFreshLocation();
   const body={requestId:crypto.randomUUID(),employeeCode:code,...loc};
   const endpoint=state.isCheckedIn?'/api/attendance/checkout':'/api/attendance/checkin';
   const r=await apiRequest(endpoint,{method:'POST',body:JSON.stringify(body)}); const d=r.data||{};
   result.classList.remove('d-none');
   result.innerHTML=`<div class="alert alert-success text-center"><div class="display-6 mb-2">✅</div><h2 class="h4">${state.isCheckedIn?'تم تسجيل الانصراف':'تم تسجيل حضورك'}</h2><div>${esc(d.employeeName||'')}</div><div>${esc(d.siteName||'')}</div><div class="mt-2">${state.isCheckedIn?`وقت الانصراف: ${localTime(d.checkOutTimeUtc)}`:`وقت الحضور: ${localTime(d.checkInTimeUtc)}`}</div></div>`;
   showMessage(''); await refreshStatus();
 }catch(e){showMessage(`<div class="alert alert-danger">${mapError(e.data)}</div>`);}finally{actionBtn.disabled=false;actionBtn.textContent=state.isCheckedIn?'CHECK OUT':'CHECK IN';}
});

codeEl.addEventListener('change',refreshStatus);
if(codeEl.value)refreshStatus();
