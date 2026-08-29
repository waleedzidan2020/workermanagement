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
 if(c==='DEVICE_NOT_REGISTERED')return '❌ هذا العامل لم يتم تسجيل جهاز له بعد. يرجى التواصل مع المسؤول.';
 if(c==='WEBAUTHN_VERIFICATION_FAILED'||c==='INVALID_DEVICE_CREDENTIAL')return '❌ تعذر التحقق من الجهاز المسجل لهذا العامل.';
 if(c==='EXPIRED_AUTHENTICATION_CHALLENGE')return '⚠️ انتهت صلاحية طلب التحقق. حاول مرة أخرى.';
 if(c==='INVALID_AUTHENTICATION_CHALLENGE')return '⚠️ طلب التحقق غير صالح أو تم استخدامه من قبل.';
 if(c==='DEVICE_VERIFICATION_REQUIRED')return '❌ يجب التحقق من الجهاز قبل تسجيل الحضور.';
 return 'حدث خطأ أثناء تنفيذ العملية. يرجى المحاولة مرة أخرى.';
}

async function getAttendanceAuthorization(code,attemptType){
 const optionsResponse=await apiRequest('/api/device-verification/authentication/options',{
   method:'POST',body:JSON.stringify({employeeCode:code,attemptType})
 });
 const data=optionsResponse.data||{};
 if(!data.required)return null;
 if(!webAuthnSupported())throw {data:{errorCode:'WEBAUTHN_UNSUPPORTED'}};

 const publicKey=prepareAssertionOptions(data.options);
 let credential;
 try{
   credential=await navigator.credentials.get({publicKey});
 }catch(e){
   if(e?.name==='NotAllowedError')throw {data:{errorCode:'WEBAUTHN_CANCELLED'}};
   throw e;
 }
 if(!credential)throw {data:{errorCode:'WEBAUTHN_VERIFICATION_FAILED'}};

 const complete=await apiRequest('/api/device-verification/authentication/complete',{
   method:'POST',
   body:JSON.stringify({
     employeeCode:code,
     attemptType,
     challengeId:data.challengeId,
     credential:serializeAssertionCredential(credential)
   })
 });
 return complete.data?.attendanceAuthorization||null;
}

actionBtn.addEventListener('click',async()=>{
 const code=codeEl.value.trim();
 if(!code){showMessage('<div class="alert alert-warning">أدخل كود العامل أولًا.</div>');return;}
 localStorage.setItem('employeeCode',code); actionBtn.disabled=true;
 try{
   const attemptType=state.isCheckedIn?2:1;
   actionBtn.textContent='جاري التحقق...';
   const attendanceAuthorization=await getAttendanceAuthorization(code,attemptType);

   actionBtn.textContent='جاري تحديد الموقع...';
   const loc=await getFreshLocation();
   const body={requestId:crypto.randomUUID(),employeeCode:code,...loc,attendanceAuthorization};
   const endpoint=state.isCheckedIn?'/api/attendance/checkout':'/api/attendance/checkin';
   const r=await apiRequest(endpoint,{method:'POST',body:JSON.stringify(body)}); const d=r.data||{};
   result.classList.remove('d-none');
   result.innerHTML=`<div class="alert alert-success text-center"><div class="display-6 mb-2">✅</div><h2 class="h4">${state.isCheckedIn?'تم تسجيل الانصراف':'تم تسجيل حضورك'}</h2><div>${esc(d.employeeName||'')}</div><div>${esc(d.siteName||'')}</div><div class="mt-2">${state.isCheckedIn?`وقت الانصراف: ${localTime(d.checkOutTimeUtc)}`:`وقت الحضور: ${localTime(d.checkInTimeUtc)}`}</div></div>`;
   showMessage(''); await refreshStatus();
 }catch(e){
   const code=e?.data?.errorCode;
   let text;
   if(code==='WEBAUTHN_UNSUPPORTED')text='❌ هذا الجهاز أو المتصفح لا يدعم التحقق الآمن المطلوب لتسجيل الحضور.';
   else if(code==='WEBAUTHN_CANCELLED')text='تم إلغاء التحقق من الجهاز.';
   else text=mapError(e?.data);
   showMessage(`<div class="alert alert-danger">${text}</div>`);
 }finally{actionBtn.disabled=false;actionBtn.textContent=state.isCheckedIn?'CHECK OUT':'CHECK IN';}
});

codeEl.addEventListener('change',refreshStatus);
if(codeEl.value)refreshStatus();
