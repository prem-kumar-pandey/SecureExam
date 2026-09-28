const state={user:null,exams:[],results:[],performance:null,stats:null};
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function dt(v){if(!v)return "-";const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString(undefined,{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
async function api(url,opt={}){const r=await fetch(url,{credentials:"include",...opt});const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.message||"Request failed.");return x;}
async function auth(){const x=await api("/api/me");if(!x.loggedIn||!x.user){location.href="/loginPrem.html";return false;}if(x.user.role&&x.user.role!=="teacher"){location.href="/student-dashboard.html";return false;}state.user=x.user;document.querySelectorAll("[data-user-name]").forEach(e=>e.textContent=x.user.fullname||"Teacher");return true;}
async function load(){state.exams=(await api("/api/teacher/exams")).exams||[];state.results=(await api("/api/teacher/results")).results||[];state.performance=await api("/api/teacher/performance");state.stats=await api("/api/teacher/dashboard");render();}
async function logout(){await fetch("/api/logout",{method:"POST",credentials:"include"}).catch(()=>{});location.href="/loginPrem.html";}
function startRealtime(){load().catch(console.error);setInterval(()=>load().catch(console.error),5000);}

async function render(){const data=await api("/api/teacher/notifications");const g=document.getElementById("grid");const a=data.notifications||[];g.innerHTML=a.length?a.map(x=>`<article class="portal-card"><div class="portal-row"><span class="exam-status active-status">${esc(x.type||"UPDATE")}</span></div><h2>${esc(x.title)}</h2><p>${esc(x.message)}</p><p class="portal-note">${dt(x.createdAt)}</p></article>`).join(""):`<div class="portal-empty">No new notifications.</div>`;}
document.addEventListener("DOMContentLoaded",async()=>{if(await auth()){await render();setInterval(()=>render().catch(console.error),5000);}});
