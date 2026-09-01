const registerDeviceBtn=document.getElementById('registerDeviceBtn');
const enrollmentInfo=document.getElementById('enrollmentInfo');
const enrollmentMessage=document.getElementById('enrollmentMessage');
const enrollmentToken=new URLSearchParams(location.search).get('token')||'';
let enrollmentState=null;

function enrollmentError(text){enrollmentMessage.innerHTML=`<div class="alert alert-danger">${esc(text)}</div>`;}

async function loadEnrollment(){
  if(!enrollmentToken){enrollmentInfo.className='alert alert-danger';enrollmentInfo.textContent='رابط تسجيل الجهاز غير صالح.';return;}
  if(!deviceCryptoSupported()){enrollmentInfo.className='alert alert-danger';enrollmentInfo.textContent='هذا الجهاز أو المتصفح لا يدعم التخزين والتشفير الآمن المطلوب.';return;}

  try{
    const response=await apiRequest('/api/device-verification/enrollment/options',{
      method:'POST',body:JSON.stringify({enrollmentToken})
    });
    enrollmentState=response.data;
    enrollmentInfo.className='alert alert-info';
    enrollmentInfo.textContent=`سيتم تسجيل هذا المتصفح على هذا الجهاز للعامل: ${response.data?.employeeName||''}`;
    registerDeviceBtn.disabled=false;
  }catch(e){
    enrollmentInfo.className='alert alert-danger';
    enrollmentInfo.textContent=e?.data?.errorCode==='INVALID_ENROLLMENT_TOKEN'?'رابط التسجيل غير صالح أو انتهت صلاحيته.':'تعذر بدء تسجيل الجهاز.';
  }
}

registerDeviceBtn.addEventListener('click',async()=>{
  if(!enrollmentState?.deviceId)return;
  registerDeviceBtn.disabled=true;
  const original=registerDeviceBtn.textContent;
  registerDeviceBtn.textContent='جاري تسجيل الجهاز...';
  enrollmentMessage.innerHTML='';
  let localKeyCreated=false;
  try{
    const publicKey=await generateAndStoreDeviceCredential(enrollmentState.deviceId);
    localKeyCreated=true;

    await apiRequest('/api/device-verification/enrollment/complete',{
      method:'POST',
      body:JSON.stringify({
        enrollmentToken,
        challengeId:enrollmentState.challengeId,
        deviceId:enrollmentState.deviceId,
        publicKey
      })
    });

    try{await deleteOtherDeviceCredentials(enrollmentState.deviceId);}catch(e){console.warn('Could not clean old local device keys',e);}
    enrollmentInfo.className='alert alert-success';
    enrollmentInfo.textContent='تم تسجيل الجهاز بنجاح.';
    enrollmentMessage.innerHTML='<div class="alert alert-success">✅ أصبح هذا المتصفح على هذا الجهاز مسجلًا للعامل ويمكن استخدامه قبل الحضور والانصراف.</div>';
    registerDeviceBtn.classList.add('d-none');
    history.replaceState({},document.title,'device-enrollment.html');
  }catch(e){
    if(localKeyCreated){try{await deleteDeviceCredential(enrollmentState.deviceId);}catch(cleanupError){console.warn('Could not remove failed local key',cleanupError);}}
    const code=e?.data?.errorCode||e?.message;
    if(code==='INVALID_ENROLLMENT_TOKEN')enrollmentError('رابط التسجيل غير صالح أو انتهت صلاحيته.');
    else if(code==='EXPIRED_AUTHENTICATION_CHALLENGE')enrollmentError('انتهت صلاحية طلب التسجيل. اطلب رابطًا جديدًا من المسؤول.');
    else if(code==='INVALID_DEVICE_PUBLIC_KEY')enrollmentError('تعذر إنشاء مفتاح الجهاز بشكل صحيح. حاول مرة أخرى.');
    else if(code==='DEVICE_CRYPTO_UNSUPPORTED')enrollmentError('هذا المتصفح لا يدعم التشفير الآمن المطلوب.');
    else enrollmentError('تعذر تسجيل الجهاز. حاول مرة أخرى أو اطلب رابطًا جديدًا من المسؤول.');
    registerDeviceBtn.disabled=false;
  }finally{registerDeviceBtn.textContent=original;}
});

loadEnrollment();
