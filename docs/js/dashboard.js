function getEgyptDateString(){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDateForArabic(dateString){
  const [year,month,day]=dateString.split('-');
  return `${day}/${month}/${year}`;
}

async function loadDashboard(){
  try{
    const today=getEgyptDateString();
    const [dash,att]=await Promise.all([
      apiRequest('/api/admin/dashboard'),
      apiRequest(`/api/admin/attendance?date=${encodeURIComponent(today)}&page=1&pageSize=10`)
    ]);

    const d=dash.data||{};
    const cards=[
      ['إجمالي العمال',d.totalEmployees],['الحضور اليوم',d.presentToday],['الغياب',d.absentToday],
      ['المتأخر',d.lateToday],['محاولات مرفوضة',d.rejectedAttemptsToday],['الموجودون الآن',d.currentlyCheckedIn]
    ];

    document.getElementById('dashboardCards').innerHTML=cards
      .map(x=>`<div class="col-6 col-xl-2"><div class="stat-card"><div class="stat-value">${x[1]??0}</div><div class="stat-label">${x[0]}</div></div></div>`).join('');

    const items=att.data?.items||[];
    document.getElementById('attendanceBody').innerHTML=items
      .map(x=>`<tr><td>${esc(x.employeeName)}</td><td>${esc(x.employeeCode)}</td><td>${esc(x.siteName)}</td><td>${localTime(x.checkInTimeUtc)}</td><td>${localTime(x.checkOutTimeUtc)}</td><td>${esc(x.status)}</td></tr>`)
      .join('')||'<tr><td colspan="6" class="text-center text-muted py-4">لا توجد بيانات</td></tr>';

    document.getElementById('lastUpdated').textContent='آخر تحديث '+new Date().toLocaleTimeString('ar-EG');
  }catch(e){console.error(e);}
}

const deviceVerificationStatus=document.getElementById('deviceVerificationStatus');
const deviceVerificationToggleBtn=document.getElementById('deviceVerificationToggleBtn');
const deviceVerificationMessage=document.getElementById('deviceVerificationMessage');
let deviceVerificationEnabled=false;

function renderDeviceVerificationSetting(enabled){
  deviceVerificationEnabled=!!enabled;
  deviceVerificationStatus.textContent=enabled?'مفعّل':'متوقف';
  deviceVerificationStatus.className=`badge ${enabled?'text-bg-success':'text-bg-secondary'}`;
  deviceVerificationToggleBtn.textContent=enabled?'تعطيل':'تفعيل';
  deviceVerificationToggleBtn.className=`btn ${enabled?'btn-outline-danger':'btn-outline-success'}`;
  deviceVerificationToggleBtn.disabled=false;
}

async function loadDeviceVerificationSetting(){
  try{
    const response=await apiRequest('/api/admin/device-verification/setting');
    renderDeviceVerificationSetting(!!response.data?.enabled);
  }catch(e){
    if(e?.status===401)return;
    deviceVerificationStatus.textContent='تعذر التحميل';
    deviceVerificationToggleBtn.disabled=true;
  }
}

deviceVerificationToggleBtn?.addEventListener('click',async()=>{
  const next=!deviceVerificationEnabled;
  const message=next
    ?'هل تريد تفعيل التحقق من جهاز العامل؟ العمال بدون جهاز مسجل لن يتمكنوا من تسجيل الحضور.'
    :'هل تريد تعطيل التحقق من جهاز العامل؟ سيعود تسجيل الحضور للعمل بدون التحقق من الجهاز.';
  if(!window.confirm(message))return;

  deviceVerificationToggleBtn.disabled=true;
  deviceVerificationMessage.innerHTML='';
  try{
    const response=await apiRequest('/api/admin/device-verification/setting',{
      method:'POST',body:JSON.stringify({enabled:next})
    });
    renderDeviceVerificationSetting(!!response.data?.enabled);
    deviceVerificationMessage.innerHTML=`<div class="alert alert-success mb-0">تم ${next?'تفعيل':'تعطيل'} التحقق من جهاز العامل بنجاح.</div>`;
  }catch(e){
    if(e?.status===401)return;
    deviceVerificationMessage.innerHTML='<div class="alert alert-danger mb-0">تعذر تغيير إعداد التحقق من الجهاز.</div>';
    deviceVerificationToggleBtn.disabled=false;
  }
});

const cleanupDate=document.getElementById('cleanupDate');
const cleanupByDateBtn=document.getElementById('cleanupByDateBtn');
const cleanupMessage=document.getElementById('cleanupMessage');

if(cleanupDate&&!cleanupDate.value)cleanupDate.value=getEgyptDateString();

cleanupByDateBtn?.addEventListener('click',async()=>{
  const selectedDate=cleanupDate?.value;
  if(!selectedDate){cleanupMessage.innerHTML='<div class="alert alert-warning">من فضلك اختر التاريخ المراد مسح بياناته.</div>';return;}

  const displayDate=formatDateForArabic(selectedDate);
  if(!window.confirm(`هل أنت متأكد من حذف سجلات الحضور والمحاولات المرفوضة ليوم ${displayDate}؟\nهذا الإجراء لا يمكن التراجع عنه.`))return;

  const originalText=cleanupByDateBtn.textContent;
  cleanupByDateBtn.disabled=true;cleanupByDateBtn.textContent='جاري الحذف...';cleanupMessage.innerHTML='';
  try{
    const response=await apiRequest('/api/admin/cleanup/by-date',{method:'POST',body:JSON.stringify({date:selectedDate})});
    const data=response.data||{};
    const deletedAttendance=data.deletedAttendance??0;
    const deletedRejectedAttempts=data.deletedRejectedAttempts??0;
    cleanupMessage.innerHTML=deletedAttendance===0&&deletedRejectedAttempts===0
      ?`<div class="alert alert-info">لا توجد بيانات للحذف في تاريخ ${esc(displayDate)}.</div>`
      :`<div class="alert alert-success">تم حذف بيانات ${esc(displayDate)} بنجاح. تم حذف ${deletedAttendance} سجل حضور و${deletedRejectedAttempts} محاولات مرفوضة.</div>`;
    if(selectedDate===getEgyptDateString())await loadDashboard();
  }catch(e){
    if(e?.status===401)return;
    const message=e?.data?.message||'تعذر حذف بيانات التاريخ المحدد. حاول مرة أخرى.';
    cleanupMessage.innerHTML=`<div class="alert alert-danger">${esc(message)}</div>`;
  }finally{cleanupByDateBtn.disabled=false;cleanupByDateBtn.textContent=originalText;}
});

loadDashboard();
loadDeviceVerificationSetting();
setInterval(loadDashboard,60000);
