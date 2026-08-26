async function loadDashboard(){
  try{
    const [dash,att]=await Promise.all([
      apiRequest('/api/admin/dashboard'),
      apiRequest('/api/admin/attendance?page=1&pageSize=10')
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

const cleanupTodayBtn=document.getElementById('cleanupTodayBtn');
const cleanupMessage=document.getElementById('cleanupMessage');

cleanupTodayBtn?.addEventListener('click',async()=>{
  const confirmed=window.confirm('هل أنت متأكد من حذف بيانات الحضور والمحاولات المرفوضة الخاصة باليوم؟ هذا الإجراء لا يمكن التراجع عنه.');
  if(!confirmed)return;

  const originalText=cleanupTodayBtn.textContent;
  cleanupTodayBtn.disabled=true;
  cleanupTodayBtn.textContent='جاري الحذف...';
  cleanupMessage.innerHTML='';

  try{
    const response=await apiRequest('/api/admin/cleanup/today',{method:'DELETE'});
    const data=response.data||{};
    cleanupMessage.innerHTML=`<div class="alert alert-success">تم حذف بيانات اليوم بنجاح. تم حذف ${data.deletedAttendance??0} سجل حضور و${data.deletedRejectedAttempts??0} محاولات مرفوضة.</div>`;
    await loadDashboard();
  }catch(e){
    if(e?.status===401)return;
    const message=e?.data?.message||'تعذر حذف بيانات اليوم. حاول مرة أخرى.';
    cleanupMessage.innerHTML=`<div class="alert alert-danger">${esc(message)}</div>`;
  }finally{
    cleanupTodayBtn.disabled=false;
    cleanupTodayBtn.textContent=originalText;
  }
});

loadDashboard();
setInterval(loadDashboard,60000);
