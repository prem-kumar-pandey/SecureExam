const state={user:null,exams:[],results:[],performance:null,stats:null};
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function dt(v){if(!v)return "-";const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString(undefined,{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
async function api(url,opt={}){const r=await fetch(url,{credentials:"include",...opt});const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.message||"Request failed.");return x;}
async function auth(){const x=await api("/api/me");if(!x.loggedIn||!x.user){location.href="/loginPrem.html";return false;}if(x.user.role&&x.user.role!=="teacher"){location.href="/student-dashboard.html";return false;}state.user=x.user;document.querySelectorAll("[data-user-name]").forEach(e=>e.textContent=x.user.fullname||"Teacher");return true;}
async function load(){state.exams=(await api("/api/teacher/exams")).exams||[];state.results=(await api("/api/teacher/results")).results||[];state.performance=await api("/api/teacher/performance");state.stats=await api("/api/teacher/dashboard");render();}
async function logout(){await fetch("/api/logout",{method:"POST",credentials:"include"}).catch(()=>{});location.href="/loginPrem.html";}
function startRealtime(){load().catch(console.error);setInterval(()=>load().catch(console.error),5000);}

function render(){const g=document.getElementById("grid");g.innerHTML=state.exams.length?state.exams.map(x=>`<article class="portal-card"><h2>${esc(x.title)}</h2><p>${esc(x.subject)} • ${esc(x.code)}</p><div class="meta"><div><span>Questions</span><strong>${x.questionCount}</strong></div><div><span>Total Marks</span><strong>${x.totalMarks}</strong></div><div><span>Duration</span><strong>${x.duration} min</strong></div></div></article>`).join(""):`<div class="portal-empty">No question bank items yet. Create an exam with questions first.</div>`;}
document.addEventListener("DOMContentLoaded",async()=>{if(await auth())startRealtime();});
