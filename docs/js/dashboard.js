function getEgyptDateString(){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Africa/Cairo',
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
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
      ['إجمالي العمال',d.totalEmployees],
      ['الحضور اليوم',d.presentToday],
      ['الغياب',d.absentToday],
      ['المتأخر',d.lateToday],
      ['محاولات مرفوضة',d.rejectedAttemptsToday],
      ['الموجودون الآن',d.currentlyCheckedIn]
    ];

    document.getElementById('dashboardCards').innerHTML=cards
      .map(x=>`<div class="col-6 col-xl-2"><div class="stat-card"><div class="stat-value">${x[1]??0}</div><div class="stat-label">${x[0]}</div></div></div>`)
      .join('');

    const items=att.data?.items||[];
    document.getElementById('attendanceBody').innerHTML=items
      .map(x=>`<tr><td>${esc(x.employeeName)}</td><td>${esc(x.employeeCode)}</td><td>${esc(x.siteName)}</td><td>${localTime(x.checkInTimeUtc)}</td><td>${localTime(x.checkOutTimeUtc)}</td><td>${esc(x.status)}</td></tr>`)
      .join('')||'<tr><td colspan="6" class="text-center text-muted py-4">لا توجد بيانات</td></tr>';

    document.getElementById('lastUpdated').textContent='آخر تحديث '+new Date().toLocaleTimeString('ar-EG');
  }catch(e){
    console.error(e);
  }
}

const cleanupDate=document.getElementById('cleanupDate');
const cleanupByDateBtn=document.getElementById('cleanupByDateBtn');
const cleanupMessage=document.getElementById('cleanupMessage');

if(cleanupDate&&!cleanupDate.value){
  cleanupDate.value=getEgyptDateString();
}

cleanupByDateBtn?.addEventListener('click',async()=>{
  const selectedDate=cleanupDate?.value;

  if(!selectedDate){
    cleanupMessage.innerHTML='<div class="alert alert-warning">من فضلك اختر التاريخ المراد مسح بياناته.</div>';
    return;
  }

  const displayDate=formatDateForArabic(selectedDate);
  const confirmed=window.confirm(`هل أنت متأكد من حذف سجلات الحضور والمحاولات المرفوضة ليوم ${displayDate}؟\nهذا الإجراء لا يمكن التراجع عنه.`);
  if(!confirmed)return;

  const originalText=cleanupByDateBtn.textContent;
  cleanupByDateBtn.disabled=true;
  cleanupByDateBtn.textContent='جاري الحذف...';
  cleanupMessage.innerHTML='';

  try{
    const response=await apiRequest('/api/admin/cleanup/by-date',{
      method:'POST',
      body:JSON.stringify({date:selectedDate})
    });
    const data=response.data||{};
    const deletedAttendance=data.deletedAttendance??0;
    const deletedRejectedAttempts=data.deletedRejectedAttempts??0;

    if(deletedAttendance===0&&deletedRejectedAttempts===0){
      cleanupMessage.innerHTML=`<div class="alert alert-info">لا توجد بيانات للحذف في تاريخ ${esc(displayDate)}.</div>`;
    }else{
      cleanupMessage.innerHTML=`<div class="alert alert-success">تم حذف بيانات ${esc(displayDate)} بنجاح. تم حذف ${deletedAttendance} سجل حضور و${deletedRejectedAttempts} محاولات مرفوضة.</div>`;
    }

    if(selectedDate===getEgyptDateString()){
      await loadDashboard();
    }
  }catch(e){
    if(e?.status===401)return;
    const message=e?.data?.message||'تعذر حذف بيانات التاريخ المحدد. حاول مرة أخرى.';
    cleanupMessage.innerHTML=`<div class="alert alert-danger">${esc(message)}</div>`;
  }finally{
    cleanupByDateBtn.disabled=false;
    cleanupByDateBtn.textContent=originalText;
  }
});

loadDashboard();
setInterval(loadDashboard,60000);
