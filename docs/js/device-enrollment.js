const registerDeviceBtn=document.getElementById('registerDeviceBtn');
const enrollmentInfo=document.getElementById('enrollmentInfo');
const enrollmentMessage=document.getElementById('enrollmentMessage');
const enrollmentToken=new URLSearchParams(location.search).get('token')||'';
let enrollmentState=null;

function enrollmentError(text){enrollmentMessage.innerHTML=`<div class="alert alert-danger">${esc(text)}</div>`;}

function enrollmentApiError(code){
  if(code==='INVALID_ENROLLMENT_TOKEN')return 'رابط التسجيل غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا من المسؤول.';
  if(code==='EMPLOYEE_INACTIVE')return 'حساب العامل غير مفعل حاليًا. يجب على المسؤول تفعيل العامل أولًا ثم إنشاء رابط تسجيل جديد.';
  if(code==='EMPLOYEE_NOT_FOUND')return 'العامل المرتبط بهذا الرابط غير موجود.';
  if(code==='RATE_LIMITED')return 'تم إرسال محاولات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.';
  return 'تعذر بدء تسجيل الجهاز. تحقق من حالة العامل والرابط ثم حاول مرة أخرى.';
}

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
    enrollmentState=null;
    registerDeviceBtn.disabled=true;
    enrollmentInfo.className='alert alert-danger';
    enrollmentInfo.textContent=enrollmentApiError(e?.data?.errorCode);
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
    if(code==='INVALID_ENROLLMENT_TOKEN')enrollmentError('رابط التسجيل غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا من المسؤول.');
    else if(code==='EMPLOYEE_INACTIVE')enrollmentError('حساب العامل غير مفعل. يجب تفعيله من لوحة التحكم أولًا ثم إنشاء رابط تسجيل جديد.');
    else if(code==='EXPIRED_AUTHENTICATION_CHALLENGE')enrollmentError('انتهت صلاحية طلب التسجيل. اطلب رابطًا جديدًا من المسؤول.');
    else if(code==='INVALID_DEVICE_PUBLIC_KEY')enrollmentError('تعذر إنشاء مفتاح الجهاز بشكل صحيح. حاول مرة أخرى.');
    else if(code==='INVALID_DEVICE_CREDENTIAL')enrollmentError('بيانات تسجيل الجهاز غير متطابقة. اطلب رابط تسجيل جديد من المسؤول.');
    else if(code==='DEVICE_CRYPTO_UNSUPPORTED')enrollmentError('هذا المتصفح لا يدعم التشفير الآمن المطلوب.');
    else if(code==='RATE_LIMITED')enrollmentError('تم إرسال محاولات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.');
    else enrollmentError('تعذر تسجيل الجهاز. حاول مرة أخرى أو اطلب رابطًا جديدًا من المسؤول.');
    registerDeviceBtn.disabled=false;
  }finally{registerDeviceBtn.textContent=original;}
});

loadEnrollment();
