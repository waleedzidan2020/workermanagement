let employees=[];

async function loadSites(){
  const r=await apiRequest('/api/admin/sites?page=1&pageSize=100');
  const items=r.data?.items||r.data||[];
  employeeSiteForm.innerHTML=items.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
}

async function loadEmployees(){
  const q=employeeSearch.value.trim();
  const r=await apiRequest('/api/admin/employees?page=1&pageSize=100'+(q?`&search=${encodeURIComponent(q)}`:''));
  employees=r.data?.items||r.data||[];
  employeesBody.innerHTML=employees.map(x=>`<tr>
    <td>${esc(x.employeeCode)}</td><td>${esc(x.fullName)}</td><td>${esc(x.phoneNumber)}</td><td>${esc(x.siteName||'')}</td>
    <td>${x.isActive?'نشط':'غير نشط'}</td>
    <td>${x.hasRegisteredDevice?'<span class="badge text-bg-success">مسجل</span>':'<span class="badge text-bg-secondary">غير مسجل</span>'}</td>
    <td class="text-nowrap">
      <button class="btn btn-sm btn-outline-primary" onclick="editEmployee('${x.id}')">تعديل</button>
      <button class="btn btn-sm btn-outline-danger" onclick="disableEmployee('${x.id}')">تعطيل</button>
      ${x.hasRegisteredDevice
        ?`<button class="btn btn-sm btn-outline-warning" onclick="revokeEmployeeDevice('${x.id}')">إلغاء الجهاز</button>`
        :`<button class="btn btn-sm btn-outline-success" onclick="startEmployeeDeviceEnrollment('${x.id}')">تسجيل جهاز</button>`}
    </td></tr>`).join('');
}

window.editEmployee=id=>{
  const x=employees.find(e=>e.id===id);if(!x)return;
  employeeId.value=x.id;employeeCodeForm.value=x.employeeCode;employeeNameForm.value=x.fullName;
  employeePhoneForm.value=x.phoneNumber||'';employeeSiteForm.value=x.workSiteId||x.siteId||'';employeeActiveForm.checked=x.isActive;
  bootstrap.Modal.getOrCreateInstance(employeeModal).show();
};

window.disableEmployee=async id=>{
  if(!confirm('تعطيل العامل؟'))return;
  await apiRequest('/api/admin/employees/'+id,{method:'DELETE'});loadEmployees();
};

window.startEmployeeDeviceEnrollment=async id=>{
  employeeMessage.innerHTML='';
  try{
    const response=await apiRequest(`/api/admin/device-verification/employees/${id}/enrollment/start`,{method:'POST'});
    const data=response.data||{};
    deviceEnrollmentUrl.value=data.enrollmentUrl||'';
    deviceEnrollmentExpiry.textContent=data.expiresAtUtc?`تنتهي صلاحية الرابط: ${new Date(data.expiresAtUtc).toLocaleString('ar-EG')}`:'';
    bootstrap.Modal.getOrCreateInstance(deviceEnrollmentModal).show();
  }catch(e){
    employeeMessage.innerHTML='<div class="alert alert-danger">تعذر إنشاء رابط تسجيل الجهاز.</div>';
  }
};

window.revokeEmployeeDevice=async id=>{
  if(!confirm('هل تريد إلغاء الجهاز المسجل لهذا العامل؟ لن يستطيع استخدامه عند تفعيل التحقق من الجهاز.'))return;
  employeeMessage.innerHTML='';
  try{
    const response=await apiRequest(`/api/admin/device-verification/employees/${id}/credential/revoke`,{method:'POST'});
    const revoked=!!response.data?.revoked;
    employeeMessage.innerHTML=revoked
      ?'<div class="alert alert-success">تم إلغاء الجهاز المسجل.</div>'
      :'<div class="alert alert-info">لا يوجد جهاز WebCrypto نشط لإلغائه.</div>';
    await loadEmployees();
  }catch(e){
    employeeMessage.innerHTML='<div class="alert alert-danger">تعذر إلغاء الجهاز المسجل.</div>';
  }
};

copyEnrollmentUrlBtn.onclick=async()=>{
  if(!deviceEnrollmentUrl.value)return;
  try{
    await navigator.clipboard.writeText(deviceEnrollmentUrl.value);
    copyEnrollmentUrlBtn.textContent='تم النسخ';
    setTimeout(()=>copyEnrollmentUrlBtn.textContent='نسخ الرابط',1500);
  }catch(_){deviceEnrollmentUrl.select();document.execCommand('copy');}
};

addEmployeeBtn.onclick=()=>{employeeId.value='';employeeCodeForm.value='';employeeNameForm.value='';employeePhoneForm.value='';employeeActiveForm.checked=true;};

saveEmployeeBtn.onclick=async()=>{
  const id=employeeId.value;
  const body={employeeCode:employeeCodeForm.value.trim(),fullName:employeeNameForm.value.trim(),phoneNumber:employeePhoneForm.value.trim()||null,workSiteId:employeeSiteForm.value,isActive:employeeActiveForm.checked};
  await apiRequest(id?'/api/admin/employees/'+id:'/api/admin/employees',{method:id?'PUT':'POST',body:JSON.stringify(body)});
  bootstrap.Modal.getInstance(employeeModal)?.hide();loadEmployees();
};

employeeSearch.addEventListener('input',()=>{clearTimeout(window.empTimer);window.empTimer=setTimeout(loadEmployees,300)});
loadSites();loadEmployees();
