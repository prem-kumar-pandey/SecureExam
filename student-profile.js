const state={user:null,exams:{available:[],upcoming:[],expired:[]},results:[],dashboard:{}};
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function dt(v){if(!v)return "-";const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString(undefined,{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function d(v){if(!v)return "-";const x=new Date(v);return Number.isNaN(x.getTime())?"-":x.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});}
async function api(url,opt={}){const r=await fetch(url,{credentials:"include",...opt});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message||"Request failed.");return data;}
async function auth(){const x=await api("/api/me");if(!x.loggedIn||!x.user){location.href="/loginPrem.html";return false;}if(x.user.role&&x.user.role!=="student"){location.href="/teacher-dashboard.html";return false;}state.user=x.user;document.querySelectorAll("[data-user-name]").forEach(e=>e.textContent=x.user.fullname||"Student");return true;}
async function load(){state.exams=await api("/api/student/exams");state.results=(await api("/api/student/results")).results||[];state.dashboard=await api("/api/student/dashboard");render();}
function goExam(id){location.href=`/exam.html?id=${encodeURIComponent(id)}`;}
async function logout(){await fetch("/api/logout",{method:"POST",credentials:"include"}).catch(()=>{});location.href="/loginPrem.html";}
async function startRealtime(){await load();setInterval(load,5000);}

function render(){document.getElementById("profile").innerHTML=`<div class="portal-card"><h2>${esc(state.user.fullname||"Student")}</h2><p>${esc(state.user.email||"")}</p><div class="meta"><div><span>Role</span><strong>Student</strong></div><div><span>Username</span><strong>${esc(state.user.username||"-")}</strong></div><div><span>Provider</span><strong>${esc(state.user.provider||"local")}</strong></div></div></div>`;}
document.addEventListener("DOMContentLoaded",async()=>{if(await auth())render();});
