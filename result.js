function getResultId(){
    return new URLSearchParams(location.search).get("id");
}
async function loadResult(){
    const id=getResultId();
    if(!id){document.getElementById("resultSubtitle").textContent="Result not found.";return;}
    try{
        const me=await fetch("/api/me",{credentials:"include"});
        if(!me.ok){location.href="/loginPrem.html";return;}
        const user=await me.json();
        if(!user.loggedIn){location.href="/loginPrem.html";return;}
        const response=await fetch("/api/student/results",{credentials:"include"});
        const data=await response.json();
        if(!response.ok)throw new Error(data.message||"Could not load result.");
        const result=(data.results||[]).find(item=>String(item.id)===String(id));
        if(!result)throw new Error("Result not found.");
        document.getElementById("resultTitle").textContent=result.examTitle;
        document.getElementById("resultSubtitle").textContent=
            `${result.subject} • ${result.code} • ${result.questionCount} Questions`;
        document.getElementById("resultPercentage").textContent=`${result.percentage}%`;
        document.getElementById("resultScore").textContent=`${result.score}/${result.totalMarks}`;
        document.getElementById("resultCorrect").textContent=result.correctAnswers;
        document.getElementById("resultIncorrect").textContent=result.incorrectAnswers;
        document.getElementById("resultSubmitted").textContent=
            new Date(result.submittedAt).toLocaleString();
        if(result.autoSubmitted){
            document.getElementById("autoSubmitNote").textContent=
                "The timer reached zero, so the exam was submitted automatically.";
        }
    }catch(error){
        document.getElementById("resultSubtitle").textContent=error.message;
    }
}
function goDashboard(){location.href="/student-dashboard.html";}
document.addEventListener("DOMContentLoaded",loadResult);
