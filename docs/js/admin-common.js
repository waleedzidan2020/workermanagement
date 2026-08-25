document.getElementById('menuBtn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));
document.getElementById('logoutBtn')?.addEventListener('click',async()=>{try{await apiRequest('/api/admin/auth/logout',{method:'POST'});}catch(_){}window.location.href='login.html';});
