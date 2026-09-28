
/* =========================================
   EXAMSECURE TEACHER DASHBOARD
   Existing UI preserved; functionality connected
========================================= */

let teacherUser = null;
let teacherExams = [];
let teacherResults = [];
let teacherPerformance = null;
let teacherDashboardStats = null;

function showTeacherMessage(message, type = "success") {
    const element = document.getElementById("examFormMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`;

    window.clearTimeout(showTeacherMessage.timer);
    showTeacherMessage.timer = window.setTimeout(() => {
        element.textContent = "";
    }, 4500);
}


/* =========================================
   LOAD TEACHER
========================================= */

async function loadTeacher() {

    try {

        const response = await fetch("/api/me", {
            credentials: "include"
        });

        if (!response.ok) {
            window.location.href = "/loginPrem.html";
            return;
        }

        const data = await response.json();

        if (!data.loggedIn || !data.user) {
            window.location.href = "/loginPrem.html";
            return;
        }

        if (data.user.role && data.user.role !== "teacher") {
            alert("This account is registered as a student.");
            window.location.href = "/student-dashboard.html";
            return;
        }

        teacherUser = data.user;

        const name = teacherUser.fullname || "Teacher";
        const email = teacherUser.email || "";

        const mappings = {
            teacherName: name,
            teacherEmail: email,
            headerTeacherName: name,
            topTeacherName: name,
            profileFullName: name,
            profileEmail: email
        };

        Object.entries(mappings).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        const firstLetter =
            name.trim().charAt(0).toUpperCase() || "T";

        ["teacherInitial", "topTeacherInitial", "profileInitial"]
            .forEach(id => {
                const element = document.getElementById(id);
                if (element && !teacherUser.photo) {
                    element.textContent = firstLetter;
                }
            });

        if (teacherUser.photo) {

            ["teacherProfilePhoto", "topTeacherPhoto"]
                .forEach(id => {

                    const photo = document.getElementById(id);

                    if (photo) {
                        photo.src = teacherUser.photo;
                        photo.style.display = "block";
                    }

                });

            ["teacherInitial", "topTeacherInitial"]
                .forEach(id => {

                    const initial = document.getElementById(id);

                    if (initial) {
                        initial.style.display = "none";
                    }

                });

        }

    } catch (error) {

        console.error("Error loading teacher:", error);
        alert("Could not load your teacher session.");

    }
}


/* =========================================
   SECTION NAVIGATION
========================================= */

function openSection(sectionName) {

    const sections = document.querySelectorAll(".content-section");

    sections.forEach(section => {
        section.classList.remove("active-section");
    });

    const target =
        document.getElementById(`${sectionName}Section`);

    if (target) {
        target.classList.add("active-section");
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");

        if (item.dataset.section === sectionName) {
            item.classList.add("active");
        }
    });

    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
        sidebar.classList.remove("sidebar-open");
    }

    if (sectionName === "create-exam") {
        if (!document.querySelector(".question-editor")) {
            resetExamForm();
        }
    }

    if (sectionName === "my-exams") {
        loadTeacherExams();
    }

    if (sectionName === "question-bank") {
        loadQuestionBank();
    }

    if (sectionName === "results") {
        loadTeacherResults();
    }

    if (sectionName === "performance") {
        loadTeacherPerformance();
    }

    if (sectionName === "notifications") {
        loadTeacherNotifications();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================
   SIDEBAR
========================================= */

function toggleSidebar() {

    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
        sidebar.classList.toggle("sidebar-open");
    }
}


/* =========================================
   EXAM FORM
========================================= */

function addQuestion(question = null) {

    const container =
        document.getElementById("questionsContainer");

    if (!container) return;

    const index =
        container.querySelectorAll(".question-editor").length;

    const questionElement =
        document.createElement("div");

    questionElement.className = "question-editor";

    const safe = value =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    const options =
        question?.options || ["", "", "", ""];

    const correct =
        Number.isInteger(Number(question?.correctAnswer))
            ? Number(question.correctAnswer)
            : 0;

    questionElement.innerHTML = `
        <div class="question-editor-top">
            <strong>Question ${index + 1}</strong>
            <button type="button"
                    class="question-remove"
                    onclick="removeQuestion(this)"
                    ${index === 0 ? "disabled" : ""}>
                <i class="fa-solid fa-trash"></i>
                Remove
            </button>
        </div>

        <label class="full-width">
            Question
            <textarea class="question-text"
                      rows="3"
                      required
                      placeholder="Enter the question">${safe(question?.text)}</textarea>
        </label>

        <div class="option-grid">
            ${options.map((option, optionIndex) => `
                <label>
                    Option ${String.fromCharCode(65 + optionIndex)}
                    <input type="text"
                           class="question-option"
                           value="${safe(option)}"
                           required
                           placeholder="Enter option ${String.fromCharCode(65 + optionIndex)}">
                </label>
            `).join("")}
        </div>

        <div class="question-meta">
            <label>
                Correct Answer
                <select class="question-correct">
                    ${options.map((_, optionIndex) => `
                        <option value="${optionIndex}"
                                ${correct === optionIndex ? "selected" : ""}>
                            Option ${String.fromCharCode(65 + optionIndex)}
                        </option>
                    `).join("")}
                </select>
            </label>

            <label>
                Question Marks
                <input type="number"
                       class="question-marks"
                       min="1"
                       value="${Math.max(1, Number(question?.marks) || 1)}"
                       required>
            </label>
        </div>
    `;

    container.appendChild(questionElement);
    renumberQuestions();
}


function removeQuestion(button) {

    const editor =
        button.closest(".question-editor");

    if (editor) {
        editor.remove();
    }

    renumberQuestions();
}


function renumberQuestions() {

    document
        .querySelectorAll(".question-editor")
        .forEach((editor, index) => {

            const title =
                editor.querySelector(".question-editor-top strong");

            if (title) {
                title.textContent =
                    `Question ${index + 1}`;
            }

            const remove =
                editor.querySelector(".question-remove");

            if (remove) {
                remove.disabled = index === 0;
            }

        });
}


function collectQuestions() {

    const editors =
        document.querySelectorAll(".question-editor");

    return Array.from(editors).map((editor, index) => {

        const text =
            editor.querySelector(".question-text").value.trim();

        const options =
            Array.from(
                editor.querySelectorAll(".question-option")
            ).map(input => input.value.trim());

        const correctAnswer =
            Number(
                editor.querySelector(".question-correct").value
            );

        const marks =
            Number(
                editor.querySelector(".question-marks").value
            );

        if (!text || options.length !== 4 || options.some(option => !option)) {
            throw new Error(
                `Please complete all fields for Question ${index + 1}.`
            );
        }

        if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
            throw new Error(
                `Choose a correct answer for Question ${index + 1}.`
            );
        }

        return {
            text,
            options,
            correctAnswer,
            marks: Math.max(1, marks || 1)
        };

    });

}


function resetExamForm() {

    const form = document.getElementById("examForm");
    const container = document.getElementById("questionsContainer");

    if (!form || !container) return;

    form.reset();

    document.getElementById("editingExamId").value = "";
    document.getElementById("examStatus").value = "published";
    document.getElementById("examDuration").value = 30;
    document.getElementById("examTotalMarks").value = 10;
    document.getElementById(
    "examSessionEndsAt"
).value = "";

    container.innerHTML = "";

    addQuestion();

    const heading = document.getElementById("createExamHeading");
    const submitText = document.getElementById("examSubmitText");

    if (heading) heading.textContent = "Create Exam";
    if (submitText) submitText.textContent = "Create Exam";

    showTeacherMessage("", "success");
}


function loadExamIntoForm(exam) {

    openSection("create-exam");

    document.getElementById("editingExamId").value = exam.id;
    document.getElementById("examTitle").value = exam.title;
    document.getElementById("examSubject").value = exam.subject;
    document.getElementById("examCode").value = exam.code;
    document.getElementById("examDuration").value = exam.duration;
    document.getElementById("examTotalMarks").value = exam.totalMarks;
    document.getElementById("examStatus").value = exam.status;
    document.getElementById(
    "examScheduledAt"
).value =
    exam.scheduledAt
        ? toDateTimeLocal(
            exam.scheduledAt
        )
        : "";

document.getElementById(
    "examSessionEndsAt"
).value =
    exam.sessionEndsAt
        ? toDateTimeLocal(
            exam.sessionEndsAt
        )
        : "";





    const container =
        document.getElementById("questionsContainer");

    container.innerHTML = "";

    exam.questions.forEach(question => addQuestion(question));

    const heading = document.getElementById("createExamHeading");
    const submitText = document.getElementById("examSubmitText");

    if (heading) heading.textContent = "Edit Exam";
    if (submitText) submitText.textContent = "Save Changes";
}


function toDateTimeLocal(value) {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const offset = date.getTimezoneOffset();

    return new Date(date.getTime() - offset * 60000)
        .toISOString()
        .slice(0, 16);
}


async function saveExam(event) {

    event.preventDefault();

    try {

        const questions = collectQuestions();

        if (!questions.length) {
            throw new Error("Add at least one question.");
        }

        const calculatedMarks =
    questions.reduce(
        (sum, question) => sum + Number(question.marks || 0),
        0
    );

const totalMarks = calculatedMarks;

const totalMarksInput =
    document.getElementById("examTotalMarks");

if (totalMarksInput) {
    totalMarksInput.value = totalMarks;
}

        if (!calculatedMarks) {
            throw new Error("Question marks must be greater than zero.");
        }

        const payload = {
            title:
                document.getElementById("examTitle").value.trim(),

            subject:
                document.getElementById("examSubject").value.trim(),

            code:
                document.getElementById("examCode").value.trim(),

            duration:
                Number(document.getElementById("examDuration").value),

            totalMarks,

            status:
                document.getElementById("examStatus").value,

            scheduledAt:
    document.getElementById(
        "examScheduledAt"
    ).value,

sessionEndsAt:
    document.getElementById(
        "examSessionEndsAt"
    ).value,

            questions
        };

        if (
    !payload.title ||
    !payload.subject ||
    !payload.code ||
    !payload.duration ||
    !payload.scheduledAt ||
    !payload.sessionEndsAt
) {
    throw new Error(
        "Complete the exam schedule before saving."
    );
}

        const editingId =
            document.getElementById("editingExamId").value;

        const url =
            editingId
                ? `/api/exams/${editingId}`
                : "/api/exams";

        const method =
            editingId ? "PUT" : "POST";

        const response =
            await fetch(url, {
                method,
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not save exam.");
        }

        showTeacherMessage(
            editingId
                ? "Exam updated successfully."
                : "Exam created successfully. Published exams are now visible to students.",
            "success"
        );

        await loadTeacherExams();
        resetExamForm();
        openSection("my-exams");

    } catch (error) {

        console.error("Save exam error:", error);
        showTeacherMessage(error.message, "error");

    }

}


async function loadTeacherDashboardStats() {
    try {
        const response = await fetch("/api/teacher/dashboard", { credentials: "include" });
        if (!response.ok) return;
        teacherDashboardStats = await response.json();
        const map = {
            totalExams: teacherDashboardStats.totalExams,
            publishedExams: teacherDashboardStats.publishedExams,
            totalStudents: teacherDashboardStats.totalStudents,
            averageScore: `${Number(teacherDashboardStats.averageScore || 0).toFixed(1)}%`
        };
        Object.entries(map).forEach(([id,value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    } catch (error) {
        console.error("Teacher dashboard stats error:", error);
    }
}


/* =========================================
   TEACHER EXAMS
========================================= */

async function loadTeacherExams() {

    try {

        const response =
            await fetch("/api/teacher/exams", {
                credentials: "include"
            });

        if (!response.ok) {
            throw new Error("Could not load exams.");
        }

        const data = await response.json();
        teacherExams = data.exams || [];

        renderTeacherExams();
        renderRecentTeacherExams();
        renderTeacherUpcoming();
        updateTeacherStats();

    } catch (error) {

        console.error(error);

        const container =
            document.getElementById("teacherExamsList");

        if (container) {
            container.innerHTML =
                `<div class="empty-state">${escapeHtml(error.message)}</div>`;
        }

    }

}


function renderRecentTeacherExams() {

    const container =
        document.getElementById("recentTeacherExams");

    if (!container) return;

    const exams = teacherExams.slice(0, 4);

    if (!exams.length) {

        container.innerHTML =
            `<div class="empty-state">No exams created yet. Use Create New Exam to add your first exam.</div>`;

        return;
    }

    container.innerHTML =
        exams.map(exam => `
            <div class="exam-row">
                <div class="exam-subject-icon purple-bg">
                    <i class="fa-solid fa-file-lines"></i>
                </div>

                <div class="exam-info">
                    <strong>${escapeHtml(exam.title)}</strong>
                    <span>
                        ${escapeHtml(exam.subject)} •
                        ${exam.questionCount} Questions •
                        ${exam.totalMarks} Marks •
                        ${exam.duration} Minutes
                    </span>
                </div>

                <div class="exam-status ${exam.status}">
                    ${exam.status === "published" ? "Published" : "Draft"}
                </div>

                <div class="exam-actions">
                    <button title="Edit"
                            onclick="editExam('${exam.id}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button title="More"
                            onclick="toggleExamStatus('${exam.id}')">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                </div>
            </div>
        `).join("");

}


function renderTeacherUpcoming() {

    const container =
        document.getElementById("teacherUpcomingList");

    if (!container) return;

    const upcoming =
        teacherExams
            .filter(exam =>
                exam.status === "published" &&
                exam.scheduledAt &&
                new Date(exam.scheduledAt).getTime() > Date.now()
            )
            .sort(
                (a, b) =>
                    new Date(a.scheduledAt) -
                    new Date(b.scheduledAt)
            )
            .slice(0, 3);

    if (!upcoming.length) {

        container.innerHTML =
            `<div class="empty-state">No scheduled upcoming exams. Published exams without a schedule are available immediately to students.</div>`;

        return;
    }

    container.innerHTML =
        upcoming.map(exam => {

            const date = new Date(exam.scheduledAt);

            return `
                <div class="upcoming-item">
                    <div class="date-box">
                        <strong>${date.getDate()}</strong>
                        <span>${date.toLocaleString(undefined, { month: "short" }).toUpperCase()}</span>
                    </div>

                    <div class="upcoming-info">
                        <strong>${escapeHtml(exam.title)}</strong>
                        <span>
                            ${date.toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                            • ${exam.questionCount} Questions • ${exam.duration} Minutes
                        </span>
                    </div>

                    <span class="upcoming-dot"></span>
                </div>
            `;

        }).join("");

}


function renderTeacherExams() {

    const container =
        document.getElementById(
            "teacherExamsList"
        );

    if (!container) {
        return;
    }

    if (!teacherExams.length) {

        container.innerHTML =
            `<div class="empty-state">
                No exams yet. Create your first scheduled exam.
            </div>`;

        return;
    }

    container.innerHTML =
        teacherExams.map(exam => {

            const start =
                exam.scheduledAt
                    ? new Date(
                        exam.scheduledAt
                    )
                    : null;

            const end =
                exam.sessionEndsAt
                    ? new Date(
                        exam.sessionEndsAt
                    )
                    : null;

            const now =
                Date.now();

            let sessionClass =
                "draft";

            let sessionText =
                "No schedule";

            if (
                exam.status ===
                "published" &&
                start &&
                end
            ) {

                if (
                    now <
                    start.getTime()
                ) {

                    sessionClass =
                        "scheduled";

                    sessionText =
                        "Scheduled";

                } else if (
                    now <=
                    end.getTime()
                ) {

                    sessionClass =
                        "live";

                    sessionText =
                        "LIVE NOW";

                } else {

                    sessionClass =
                        "completed";

                    sessionText =
                        "Completed";
                }

            } else if (
                exam.status ===
                "published"
            ) {

                sessionClass =
                    "scheduled";

                sessionText =
                    "Needs Schedule";
            }

            const monitorButton =
                exam.status ===
                    "published"
                    ? `
                    <button
                        class="secondary-action"
                        onclick="openLiveMonitor('${exam.id}')">
                        <i class="fa-solid fa-video"></i>
                        Monitor
                    </button>
                    `
                    : "";

            return `
                <div class="management-card">

                    <div>

                        <span class="card-label">
                            ${escapeHtml(
                                exam.subject
                            )}
                        </span>

                        <h3>
                            ${escapeHtml(
                                exam.title
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                exam.code
                            )} •
                            ${exam.questionCount}
                            Questions •
                            ${exam.totalMarks}
                            Marks •
                            ${exam.duration}
                            Minutes
                        </p>

                        <small>
                            <strong>
                                Exam:
                            </strong>
                            ${
                                start
                                    ? escapeHtml(
                                        start.toLocaleString()
                                    )
                                    : "-"
                            }
                        </small>

                        <small>
                            <strong>
                                Session Ends:
                            </strong>
                            ${
                                end
                                    ? escapeHtml(
                                        end.toLocaleString()
                                    )
                                    : "-"
                            }
                        </small>

                    </div>

                    <div class="management-card-actions">

                        <span class="
                            exam-status
                            ${exam.status}
                        ">
                            ${
                                exam.status ===
                                "published"
                                    ? "Published"
                                    : "Draft"
                            }
                        </span>

                        ${exam.status === "published" ? `
    <button
        class="secondary-action"
        onclick="openLiveMonitor('${exam.id}')">

        <i class="fa-solid fa-video"></i>
        Monitor

    </button>
` : ""}


                        <span class="
                            session-status
                            ${sessionClass}
                        ">
                            ${sessionText}
                        </span>

                        ${monitorButton}

                        <button
                            class="secondary-action"
                            onclick="editExam('${exam.id}')">

                            <i class="fa-solid fa-pen"></i>
                            Edit

                        </button>

                        <button
                            class="secondary-action"
                            onclick="toggleExamStatus('${exam.id}')">

                            <i class="fa-solid fa-power-off"></i>

                            ${
                                exam.status ===
                                "published"
                                    ? "Unpublish"
                                    : "Publish"
                            }

                        </button>

                        <button
                            class="danger-action"
                            onclick="deleteExam('${exam.id}')">

                            <i class="fa-solid fa-trash"></i>
                            Delete

                        </button>

                    </div>

                </div>
            `;

        }).join("");
}

function openLiveMonitor(id) {

    window.location.href =
        `/live-monitor.html?examId=${encodeURIComponent(id)}`;

}



function editExam(id) {

    const exam =
        teacherExams.find(item => String(item.id) === String(id));

    if (exam) {
        loadExamIntoForm(exam);
    }

}


async function toggleExamStatus(id) {

    const exam =
        teacherExams.find(item => String(item.id) === String(id));

    if (!exam) return;

    try {

        const response =
            await fetch(`/api/exams/${id}`, {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status:
                        exam.status === "published"
                            ? "draft"
                            : "published"
                })
            });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not change exam status.");
        }

        await loadTeacherExams();

    } catch (error) {

        alert(error.message);

    }

}


async function deleteExam(id) {

    const confirmSetting =
        document.getElementById("confirmDeleteSetting");

    const shouldConfirm =
        !confirmSetting || confirmSetting.checked;

    if (
        shouldConfirm &&
        !confirm("Delete this exam and its student results? This cannot be undone.")
    ) {
        return;
    }

    try {

        const response =
            await fetch(`/api/exams/${id}`, {
                method: "DELETE",
                credentials: "include"
            });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not delete exam.");
        }

        await loadTeacherExams();
        await loadTeacherResults();

    } catch (error) {

        alert(error.message);

    }

}


/* =========================================
   QUESTION BANK
========================================= */

async function loadQuestionBank() {

    if (!teacherExams.length) {
        await loadTeacherExams();
    }

    const container =
        document.getElementById("questionBankList");

    if (!container) return;

    const questions = [];

    teacherExams.forEach(exam => {
        (exam.questions || []).forEach((question, index) => {
            questions.push({
                ...question,
                examTitle: exam.title,
                questionNumber: index + 1
            });
        });
    });

    if (!questions.length) {
        container.innerHTML =
            `<div class="empty-state">Your saved questions will appear here after you create an exam.</div>`;
        return;
    }

    container.innerHTML =
        questions.map(question => `
            <div class="question-bank-card">
                <div>
                    <span class="card-label">
                        ${escapeHtml(question.examTitle)} • Question ${question.questionNumber}
                    </span>
                    <h3>${escapeHtml(question.text)}</h3>
                    <p>
                        A. ${escapeHtml(question.options[0])}<br>
                        B. ${escapeHtml(question.options[1])}<br>
                        C. ${escapeHtml(question.options[2])}<br>
                        D. ${escapeHtml(question.options[3])}
                    </p>
                </div>
                <span class="correct-answer">
                    Correct: ${String.fromCharCode(65 + Number(question.correctAnswer))}
                </span>
            </div>
        `).join("");

}


/* =========================================
   RESULTS
========================================= */

async function loadTeacherResults() {

    try {

        const response =
            await fetch("/api/teacher/results", {
                credentials: "include"
            });

        if (!response.ok) {
            throw new Error("Could not load student results.");
        }

        const data = await response.json();
        teacherResults = data.results || [];

        renderTeacherResults();

        const attemptsElement =
            document.getElementById("performanceAttempts");

        if (attemptsElement) {
            attemptsElement.textContent = teacherResults.length;
        }

        updateTeacherStats();

    } catch (error) {

        console.error(error);

        const body =
            document.getElementById("teacherResultsBody");

        if (body) {
            body.innerHTML =
                `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        }

    }

}


function renderTeacherResults() {

    const body =
        document.getElementById("teacherResultsBody");

    if (!body) return;

    if (!teacherResults.length) {

        body.innerHTML =
            `<tr><td colspan="7" class="empty-table">No student submissions yet.</td></tr>`;

        return;
    }

    body.innerHTML =
        teacherResults.map(result => `
            <tr>
                <td>
                    <strong>${escapeHtml(result.studentName)}</strong><br>
                    <small>${escapeHtml(result.username || result.email)}</small>
                </td>
                <td>
                    <strong>${escapeHtml(result.examTitle)}</strong><br>
                    <small>${escapeHtml(result.subject)}</small>
                </td>
                <td>${result.score}/${result.totalMarks}</td>
                <td>${result.correctAnswers}</td>
                <td>${result.incorrectAnswers}</td>
                <td>
                    <strong>${result.percentage}%</strong>
                    ${result.autoSubmitted ? "<small>Auto-submitted</small>" : ""}
                </td>
                <td>${formatDate(result.submittedAt)}</td>
            </tr>
        `).join("");

}


/* =========================================
   PERFORMANCE
========================================= */

async function loadTeacherPerformance() {

    try {

        const response =
            await fetch("/api/teacher/performance", {
                credentials: "include"
            });

        if (!response.ok) {
            throw new Error("Could not load performance.");
        }

        teacherPerformance = await response.json();

        const average =
            document.getElementById("performanceAverage");

        const students =
            document.getElementById("performanceStudents");

        const attempts =
            document.getElementById("performanceAttempts");

        if (average) average.textContent = `${teacherPerformance.average}%`;
        if (students) students.textContent = teacherPerformance.totalStudents;

        const dashboardAverage =
            document.querySelector(".performance-number strong");

        if (dashboardAverage) {
            dashboardAverage.textContent =
                `${teacherPerformance.average}%`;
        }

        if (attempts && !teacherResults.length) {
            const resultResponse =
                await fetch("/api/teacher/results", {
                    credentials: "include"
                });

            if (resultResponse.ok) {
                const resultData = await resultResponse.json();
                teacherResults = resultData.results || [];
            }
        }

        if (attempts) attempts.textContent = teacherResults.length;

        const list =
            document.getElementById("teacherPerformanceList");

        if (!list) return;

        const rows =
            teacherPerformance.byExam || [];

        list.innerHTML = rows.length
            ? rows.map(item => `
                <div class="performance-row">
                    <div>
                        <strong>${escapeHtml(item.exam)}</strong>
                        <small>${item.attempts} submission(s)</small>
                    </div>
                    <strong>${item.average}%</strong>
                </div>
            `).join("")
            : `<div class="empty-state">Complete student submissions will appear in performance analytics.</div>`;

        updateExistingTeacherChart();

    } catch (error) {

        console.error(error);

    }

}


function updateExistingTeacherChart() {

    if (!teacherPerformance?.byExam?.length) return;

    const values =
        teacherPerformance.byExam
            .map(item => Number(item.average) || 0)
            .slice(-6);

    if (!values.length) return;

    const path =
        document.querySelector(".performance-line .chart-path");

    const fill =
        document.querySelector(".performance-line .chart-fill");

    if (!path) return;

    const width = 500;
    const height = 180;
    const step =
        values.length === 1
            ? width
            : width / (values.length - 1);

    const points =
        values.map((value, index) => ({
            x: index * step,
            y: height - (value / 100) * 145 - 10
        }));

    let d = `M${points[0].x},${points[0].y}`;

    for (let index = 1; index < points.length; index++) {
        d += ` L${points[index].x},${points[index].y}`;
    }

    path.setAttribute("d", d);

    if (fill) {
        fill.setAttribute(
            "d",
            `${d} L${points[points.length - 1].x},180 L0,180 Z`
        );
    }
}


/* =========================================
   DASHBOARD STATS
========================================= */

function updateTeacherStats() {

    const total =
        document.getElementById("totalExams");

    const published =
        document.getElementById("publishedExams");

    const students =
        document.getElementById("totalStudents");

    const average =
        document.getElementById("averageScore");

    if (total) total.textContent = teacherExams.length;

    if (published) {
        published.textContent =
            teacherExams.filter(exam => exam.status === "published").length;
    }

    if (students) {
        if (teacherDashboardStats) {
            students.textContent = teacherDashboardStats.totalStudents || 0;
        } else {
            const uniqueStudents = new Set(teacherResults.map(result => result.username || result.email));
            students.textContent = uniqueStudents.size;
        }
    }

    if (average && teacherDashboardStats) {
        average.textContent = `${Number(teacherDashboardStats.averageScore || 0).toFixed(1)}%`;
    } else if (average && teacherResults.length) {

        const avg =
            teacherResults.reduce(
                (sum, result) => sum + Number(result.percentage || 0),
                0
            ) / teacherResults.length;

        average.textContent =
            `${avg.toFixed(1)}%`;

    } else if (average) {
        average.textContent = "0%";
    }

}


/* =========================================
   NOTIFICATIONS
========================================= */

async function loadTeacherNotifications() {
    const list = document.getElementById("teacherNotificationsList");
    if (!list) return;
    try {
        const response = await fetch("/api/teacher/notifications", { credentials: "include" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load notifications.");
        const badge = document.querySelector('.nav-item[data-section="notifications"] .notification-count');
        if (badge) badge.textContent = data.unreadCount || 0;
        const notifications = data.notifications || [];
        list.innerHTML = notifications.length ? notifications.map(item => `
            <div class="notification-card">
                <div class="notification-icon"><i class="fa-solid ${escapeHtml(item.icon || "fa-bell")}"></i></div>
                <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message || "")}</p><small>${formatDate(item.createdAt)}</small></div>
            </div>`).join("") : `<div class="empty-state">No new notifications.</div>`;
    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

    try {

        await fetch("/api/logout", {
            method: "POST",
            credentials: "include"
        });

    } catch (error) {

        console.error("Logout error:", error);

    }

    localStorage.removeItem("loggedInUser");
    sessionStorage.removeItem("loggedInUser");
    sessionStorage.removeItem("selectedRole");

    window.location.href = "/loginPrem.html";
}


/* =========================================
   HELPERS + STARTUP
========================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function formatDate(value) {

    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString();
}


document.addEventListener("DOMContentLoaded", async () => {

    const navItems =
        document.querySelectorAll(".nav-item");

    navItems.forEach(item => {

        item.addEventListener("click", event => {

            const href = item.getAttribute("href");
            const section = item.dataset.section;

            if (href && href !== "#") {
                return;
            }

            event.preventDefault();

            if (section) {
                openSection(section);
            }

        });

    });

    const examForm =
        document.getElementById("examForm");

    if (examForm) {
        examForm.addEventListener("submit", saveExam);
    }

    const confirmDelete =
        document.getElementById("confirmDeleteSetting");

    const toastSetting =
        document.getElementById("toastSetting");

    if (confirmDelete) {
        confirmDelete.checked =
            localStorage.getItem("teacherConfirmDelete") !== "false";

        confirmDelete.addEventListener("change", () => {
            localStorage.setItem(
                "teacherConfirmDelete",
                String(confirmDelete.checked)
            );
        });
    }

    if (toastSetting) {
        toastSetting.checked =
            localStorage.getItem("teacherToast") !== "false";

        toastSetting.addEventListener("change", () => {
            localStorage.setItem(
                "teacherToast",
                String(toastSetting.checked)
            );
        });
    }

    await loadTeacher();
    await loadTeacherDashboardStats();

    const questionContainer =
        document.getElementById("questionsContainer");

    if (questionContainer && !questionContainer.children.length) {
        addQuestion();
    }

    await loadTeacherExams();
    await loadTeacherResults();
    await loadTeacherPerformance();

    window.clearInterval(window.teacherRealtimeTimer);
    window.teacherRealtimeTimer = window.setInterval(async () => {
        await Promise.all([
            loadTeacherDashboardStats(),
            loadTeacherExams(),
            loadTeacherResults(),
            loadTeacherPerformance()
        ]);
    }, 5000);

});
