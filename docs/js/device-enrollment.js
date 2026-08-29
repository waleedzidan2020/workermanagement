const registerDeviceBtn=document.getElementById('registerDeviceBtn');
const enrollmentInfo=document.getElementById('enrollmentInfo');
const enrollmentMessage=document.getElementById('enrollmentMessage');
const enrollmentToken=new URLSearchParams(location.search).get('token')||'';
let enrollmentChallenge=null;

function enrollmentError(text){enrollmentMessage.innerHTML=`<div class="alert alert-danger">${esc(text)}</div>`;}

async function loadEnrollment(){
  if(!enrollmentToken){enrollmentInfo.className='alert alert-danger';enrollmentInfo.textContent='رابط تسجيل الجهاز غير صالح.';return;}
  if(!webAuthnSupported()){enrollmentInfo.className='alert alert-danger';enrollmentInfo.textContent='هذا الجهاز أو المتصفح لا يدعم التحقق الآمن المطلوب.';return;}

  try{
    const response=await apiRequest('/api/device-verification/enrollment/options',{
      method:'POST',body:JSON.stringify({enrollmentToken})
    });
    enrollmentChallenge=response.data;
    enrollmentInfo.className='alert alert-info';
    enrollmentInfo.textContent=`سيتم تسجيل هذا الجهاز للعامل: ${response.data?.employeeName||''}`;
    registerDeviceBtn.disabled=false;
  }catch(e){
    enrollmentInfo.className='alert alert-danger';
    enrollmentInfo.textContent=e?.data?.errorCode==='INVALID_ENROLLMENT_TOKEN'?'رابط التسجيل غير صالح أو انتهت صلاحيته.':'تعذر بدء تسجيل الجهاز.';
  }
}

registerDeviceBtn.addEventListener('click',async()=>{
  if(!enrollmentChallenge)return;
  registerDeviceBtn.disabled=true;
  const original=registerDeviceBtn.textContent;
  registerDeviceBtn.textContent='جاري تسجيل الجهاز...';
  enrollmentMessage.innerHTML='';
  try{
    const credential=await navigator.credentials.create({publicKey:prepareCreationOptions(enrollmentChallenge.options)});
    if(!credential)throw new Error('Credential creation failed');
    await apiRequest('/api/device-verification/enrollment/complete',{
      method:'POST',
      body:JSON.stringify({
        enrollmentToken,
        challengeId:enrollmentChallenge.challengeId,
        credential:serializeRegistrationCredential(credential)
      })
    });
    enrollmentInfo.className='alert alert-success';
    enrollmentInfo.textContent='تم تسجيل الجهاز بنجاح.';
    enrollmentMessage.innerHTML='<div class="alert alert-success">✅ أصبح هذا الجهاز مسجلًا للعامل ويمكن استخدامه للتحقق قبل الحضور والانصراف.</div>';
    registerDeviceBtn.classList.add('d-none');
    history.replaceState({},document.title,'device-enrollment.html');
  }catch(e){
    if(e?.name==='NotAllowedError')enrollmentError('تم إلغاء تسجيل الجهاز أو لم يتم التحقق من قفل الجهاز.');
    else if(e?.data?.errorCode==='INVALID_ENROLLMENT_TOKEN')enrollmentError('رابط التسجيل غير صالح أو انتهت صلاحيته.');
    else enrollmentError('تعذر تسجيل الجهاز. حاول مرة أخرى أو اطلب رابطًا جديدًا من المسؤول.');
    registerDeviceBtn.disabled=false;
  }finally{registerDeviceBtn.textContent=original;}
});

loadEnrollment();
