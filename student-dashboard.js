
/* =========================================
   EXAMSECURE STUDENT DASHBOARD
   Existing dashboard design preserved.
========================================= */

let studentUser = null;
let studentExams = {
    available: [],
    upcoming: []
};
let studentResults = [];
let studentDashboard = {
    totalAttempts: 0,
    completedExams: 0,
    averageScore: 0,
    bestScore: 0,
    performance: []
};


/* =========================================
   AUTHENTICATED STUDENT
========================================= */

async function loadLoggedInStudent() {

    try {

        const response =
            await fetch("/api/me", {
                credentials: "include"
            });

        if (!response.ok) {
            window.location.href = "/loginPrem.html";
            return false;
        }

        const data = await response.json();

        if (!data.loggedIn || !data.user) {
            window.location.href = "/loginPrem.html";
            return false;
        }

        if (data.user.role && data.user.role !== "student") {
            alert("This account is registered as a teacher.");
            window.location.href = "/teacher-dashboard.html";
            return false;
        }

        studentUser = data.user;

        const name =
            studentUser.fullname || "Student";

        const email =
            studentUser.email || "";

        [
            ["studentName", name],
            ["studentFullName", name],
            ["studentEmail", email],
            ["studentSidebarName", name],
            ["studentSidebarEmail", email],
            ["studentProfileFullName", name],
            ["studentProfileEmail", email]
        ].forEach(([id, value]) => {

            const element = document.getElementById(id);

            if (element) {
                element.textContent = value;
            }

        });

        const initial =
            name.trim().charAt(0).toUpperCase() || "S";

        [
            "studentInitial",
            "studentSidebarInitial",
            "studentProfileLargeInitial"
        ].forEach(id => {

            const element = document.getElementById(id);

            if (element && !studentUser.photo) {
                element.textContent = initial;
            }

        });

        if (studentUser.photo) {

            const topPhoto =
                document.getElementById("studentProfilePhoto");

            const sidebarPhoto =
                document.getElementById("studentSidebarPhoto");

            if (topPhoto) {
                topPhoto.src = studentUser.photo;
                topPhoto.style.display = "block";
            }

            if (sidebarPhoto) {
                sidebarPhoto.src = studentUser.photo;
                sidebarPhoto.style.display = "block";
            }

            ["studentInitial", "studentSidebarInitial"]
                .forEach(id => {

                    const element = document.getElementById(id);

                    if (element) {
                        element.style.display = "none";
                    }

                });

        }

        return true;

    } catch (error) {

        console.error("Error loading logged-in student:", error);

        window.location.href = "/loginPrem.html";
        return false;

    }

}


/* =========================================
   STUDENT SECTION NAVIGATION
========================================= */

function openStudentSection(sectionName) {

    document.querySelectorAll(".sidebar .nav-item")
        .forEach(item => {

            item.classList.remove("active");

            if (item.dataset.section === sectionName) {
                item.classList.add("active");
            }

        });

    const dashboardBlocks = document.querySelectorAll(
        ".main > .stats-grid, " +
        ".main > .section-block, " +
        ".main > .dashboard-grid, " +
        ".main > .completed-panel, " +
        ".main > .upcoming-banner, " +
        ".main > .footer"
    );

    const extraSections =
        document.querySelectorAll(".student-extra-section");

    extraSections.forEach(section => {
        section.classList.remove("active");
    });

    dashboardBlocks.forEach(block => {
        block.style.display = "";
    });

    if (
        ["leaderboard", "notifications", "profile", "settings"]
            .includes(sectionName)
    ) {

        dashboardBlocks.forEach(block => {
            block.style.display = "none";
        });

        const section =
            document.getElementById(`${sectionName}Section`);

        if (section) {
            section.classList.add("active");
            section.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        if (sectionName === "leaderboard") {
            loadLeaderboard();
        }

        if (sectionName === "notifications") {
            loadStudentNotifications();
        }

        return;
    }

    if (sectionName === "dashboard") {

        renderUpcomingExam();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        return;
    }

    const targets = {
        "available-exams": "availableExamsSection",
        "upcoming": "upcomingSection",
        "completed": "completedSection",
        "performance": "performanceSection"
    };

    const target =
        document.getElementById(targets[sectionName]);

    if (target) {
        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


/* =========================================
   LOAD STUDENT DASHBOARD
========================================= */

async function loadStudentDashboard() {

    try {

        const response =
            await fetch("/api/student/dashboard", {
                credentials: "include"
            });

        if (!response.ok) {
            throw new Error("Could not load dashboard statistics.");
        }

        studentDashboard =
            await response.json();

        document.getElementById("totalAttempts").textContent =
            studentDashboard.totalAttempts || 0;

        document.getElementById("completedExams").textContent =
            studentDashboard.completedExams || 0;

        document.getElementById("averageScore").textContent =
            Number(studentDashboard.averageScore || 0).toFixed(1);

        document.getElementById("bestScore").textContent =
            Number(studentDashboard.bestScore || 0).toFixed(1);

        renderPerformanceBars(
            studentDashboard.performance || []
        );

    } catch (error) {

        console.error(error);
        renderPerformanceBars([]);

    }

}


/* =========================================
   LOAD EXAMS
========================================= */

async function loadStudentExams() {

    try {

        const response =
            await fetch("/api/student/exams", {
                credentials: "include"
            });

        if (!response.ok) {
            throw new Error("Could not load available exams.");
        }

        studentExams =
            await response.json();

            studentExams.expired =
    studentExams.expired || [];

       renderAvailableExams();
       renderUpcomingExams();

        const count =
            document.getElementById("studentNotificationCount");

        if (count) {
            try {
                const notificationResponse = await fetch("/api/student/notifications", { credentials: "include" });
                const notificationData = await notificationResponse.json();
                count.textContent = notificationData.unreadCount || 0;
            } catch (notificationError) {
                count.textContent = 0;
            }
        }

    } catch (error) {

        console.error(error);

        const grid =
            document.getElementById("availableExamsGrid");

        if (grid) {
            grid.innerHTML =
                `<div class="student-empty-state">${escapeHtml(error.message)}</div>`;
        }

    }

}

function renderAvailableExams() {

    const grid =
        document.getElementById("availableExamsGrid");

    if (!grid) return;


    // =========================================
    // AVAILABLE + UPCOMING EXAMS
    // =========================================

    const availableExams =
        (studentExams.available || [])
            .filter(exam => !exam.attempted);

    const upcomingExams =
        (studentExams.upcoming || [])
            .filter(exam => !exam.attempted);


    const exams = [
        ...upcomingExams,
        ...availableExams
    ];


    // Sort by scheduled time
    exams.sort(
        (a, b) =>
            new Date(a.scheduledAt || 0) -
            new Date(b.scheduledAt || 0)
    );


    if (!exams.length) {

        grid.innerHTML =
            `<div class="student-empty-state">
                No published exams are available yet.
                <br>
                Your teacher's published exams will appear here automatically.
            </div>`;

        return;
    }


    grid.innerHTML =
        exams.map(exam => {

            const attempted =
                exam.attempted;

            const isUpcoming =
                upcomingExams.some(
                    item =>
                        String(item.id) ===
                        String(exam.id)
                );


            const canStart =
                !attempted &&
                !isUpcoming;


            let statusText;

            if (attempted) {

                statusText =
                    "Completed";

            } else if (isUpcoming) {

                statusText =
                    "Upcoming";

            } else {

                statusText =
                    "Available";
            }


            let availabilityHtml;


            if (isUpcoming) {

                availabilityHtml = `
                    <div class="exam-availability">
                        <i class="fa-regular fa-calendar"></i>
                        Starts at
                        ${exam.scheduledAt
                            ? formatDateTime(exam.scheduledAt)
                            : "Scheduled time"
                        }
                    </div>
                `;

            } else {

                availabilityHtml = `
                    <div class="exam-availability">
                        <i class="fa-regular fa-calendar-xmark"></i>
                        Available until
                        ${exam.availableUntil
                            ? formatDateTime(exam.availableUntil)
                            : exam.sessionEndsAt
                                ? formatDateTime(exam.sessionEndsAt)
                                : "Not set"
                        }
                    </div>
                `;
            }


            let buttonHtml;


            if (attempted) {

                buttonHtml = `
                    <button
                        class="start-btn disabled"
                        disabled
                    >
                        Completed
                    </button>
                `;

            } else if (isUpcoming) {

                buttonHtml = `
                    <button
                        class="start-btn disabled"
                        disabled
                    >
                        Upcoming
                    </button>
                `;

            } else {

                buttonHtml = `
                    <button
                        class="start-btn"
                        onclick="startExam('${exam.id}')"
                    >
                        Start Exam
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                `;
            }


            return `
                <div class="exam-card">

                    <div class="exam-top">

                        <div class="subject-icon">
                            <i class="fa-solid fa-file-circle-check"></i>
                        </div>

                        <span class="exam-status active-status">
                            ${statusText}
                        </span>

                    </div>


                    <h3>
                        ${escapeHtml(exam.title)}
                    </h3>


                    <p class="exam-code">
                        ${escapeHtml(exam.subject)}
                        •
                        ${escapeHtml(exam.code)}
                    </p>


                    <div class="exam-details">

                        <span>
                            <i class="fa-regular fa-clock"></i>
                            ${exam.duration} Minutes
                        </span>

                        <span>
                            <i class="fa-regular fa-circle-question"></i>
                            ${exam.questionCount} Questions
                        </span>

                    </div>


                    ${availabilityHtml}


                    <div class="exam-footer">

                        <span class="exam-marks">
                            <i class="fa-solid fa-star"></i>
                            ${exam.totalMarks} Marks
                        </span>

                        ${buttonHtml}

                    </div>

                </div>
            `;

        }).join("");
}
    grid.innerHTML =
        exams.map(exam => {

            const attempted = exam.attempted;

            return `
                <div class="exam-card">
                    <div class="exam-top">
                        <div class="subject-icon">
                            <i class="fa-solid fa-file-circle-check"></i>
                        </div>

                        <span class="exam-status active-status">
                            ${attempted ? "Completed" : "Available"}
                        </span>
                    </div>

                    <h3>${escapeHtml(exam.title)}</h3>

                    <p class="exam-code">
                        ${escapeHtml(exam.subject)} • ${escapeHtml(exam.code)}
                    </p>

                    <div class="exam-details">
                        <span>
                            <i class="fa-regular fa-clock"></i>
                            ${exam.duration} Minutes
                        </span>

                        <span>
                            <i class="fa-regular fa-circle-question"></i>
                            ${exam.questionCount} Questions
                        </span>
                    </div>

                    <div class="exam-availability">
    <i class="fa-regular fa-calendar-xmark"></i>
    Available until
    ${exam.availableUntil
        ? formatDateTime(exam.availableUntil)
        : "Not set"}
</div>

                    <div class="exam-footer">
                        <span class="exam-marks">
                            <i class="fa-solid fa-star"></i>
                            ${exam.totalMarks} Marks
                        </span>

                        <button
                            class="start-btn ${attempted ? "disabled" : ""}"
                            ${attempted ? "disabled" : ""}
                            onclick="startExam('${exam.id}')"
                        >
                            ${attempted ? "Completed" : "Start Exam"}
                            ${attempted ? "" : '<i class="fa-solid fa-arrow-right"></i>'}
                        </button>
                    </div>
                </div>
            `;

        }).join("");


function renderUpcomingExams() {

    const exams = (studentExams.upcoming || [])
        .filter(exam => !exam.attempted)
        .sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    const grid = document.getElementById("upcomingExamsGrid");

    if (grid) {
        if (!exams.length) {
            grid.innerHTML = `<div class="student-empty-state">No upcoming exams scheduled.<br>Your teacher's future exams will appear here automatically.</div>`;
        } else {
            grid.innerHTML = exams.map(exam => `
                <div class="exam-card">
                    <div class="exam-top">
                        <div class="subject-icon"><i class="fa-solid fa-clock"></i></div>
                        <span class="exam-status active-status">Scheduled</span>
                    </div>
                    <h3>${escapeHtml(exam.title)}</h3>
                    <p class="exam-code">${escapeHtml(exam.subject)} • ${escapeHtml(exam.code)}</p>
                    <div class="exam-details">
                        <span><i class="fa-regular fa-calendar"></i>${formatDateTime(exam.scheduledAt)}</span>
                        <span><i class="fa-regular fa-clock"></i>${exam.duration} Minutes</span>
                        <span><i class="fa-regular fa-circle-question"></i>${exam.questionCount} Questions</span>
                    </div>
                    <div class="exam-footer">
                        <span class="exam-marks"><i class="fa-solid fa-star"></i>${exam.totalMarks} Marks</span>
                        <button class="start-btn disabled" disabled>Upcoming</button>
                    </div>
                    <div class="upcoming-availability">Available For: ${exam.availabilityDays || 7} Days</div>
                </div>
            `).join("");
        }
    }

    const banner = document.getElementById("upcomingSection");
    const title = document.getElementById("upcomingExamTitle");
    const meta = document.getElementById("upcomingExamMeta");

    if (!banner) return;

    if (!exams.length) {
        banner.style.display = "none";
        return;
    }

    banner.style.display = "";
    const exam = exams[0];

    if (title) title.textContent = exam.title || "Upcoming Exam";
    if (meta) {
        meta.textContent = `${formatDateTime(exam.scheduledAt)} • Available for ${exam.availabilityDays || 7} Days • ${exam.duration} Minutes • ${exam.questionCount} Questions`;
    }

    startCountdown(exam.scheduledAt);
}


function startCountdown(targetDate) {

    window.clearInterval(window.studentCountdownTimer);

    const hours =
        document.getElementById("countHours");

    const minutes =
        document.getElementById("countMinutes");

    const seconds =
        document.getElementById("countSeconds");

    if (!hours || !minutes || !seconds || !targetDate) return;

    function update() {

        const difference =
            new Date(targetDate).getTime() - Date.now();

        if (difference <= 0) {

            hours.textContent = "00";
            minutes.textContent = "00";
            seconds.textContent = "00";

            window.clearInterval(window.studentCountdownTimer);

            loadStudentExams();

            return;
        }

        const totalSeconds =
            Math.floor(difference / 1000);

        hours.textContent =
            String(Math.floor(totalSeconds / 3600)).padStart(2, "0");

        minutes.textContent =
            String(
                Math.floor((totalSeconds % 3600) / 60)
            ).padStart(2, "0");

        seconds.textContent =
            String(totalSeconds % 60).padStart(2, "0");

    }

    update();

    window.studentCountdownTimer =
        window.setInterval(update, 1000);

}


/* =========================================
   START EXAM
========================================= */

function startExam(examId) {

    const exam =
        [...(studentExams.available || [])]
            .find(item => String(item.id) === String(examId));

    if (!exam) {
        showToast("This exam is no longer available.");
        return;
    }

    const confirmed =
        confirm(
            `Start "${exam.title}"?\n\n` +
            `${exam.questionCount} questions • ` +
            `${exam.totalMarks} marks • ` +
            `${exam.duration} minutes\n\n` +
            `The timer starts when the exam opens.`
        );

    if (!confirmed) return;

    window.location.href =
        `/exam.html?id=${encodeURIComponent(exam.id)}`;

}


/* =========================================
   PERFORMANCE CHART
========================================= */

function renderPerformanceBars(performance) {

    const container =
        document.getElementById("performanceBars");

    if (!container) return;

    const range =
        Number(
            document.getElementById("performanceRange")?.value || 7
        );

    const values =
        performance.slice(-range);

    if (!values.length) {

        container.innerHTML =
            `<div class="student-empty-state">Complete an exam to start your performance chart.</div>`;

        return;
    }

    container.innerHTML =
        values.map(item => {

            const percentage =
                Math.max(
                    0,
                    Math.min(100, Number(item.percentage) || 0)
                );

            const label =
                item.subject ||
                item.exam ||
                "Exam";

            return `
                <div class="bar-item">
                    <div class="bar-value">${percentage}%</div>
                    <div class="bar" style="height:${percentage}%"></div>
                    <span>${escapeHtml(shortLabel(label))}</span>
                </div>
            `;

        }).join("");

    animateBars();

}


function changePerformance() {

    renderPerformanceBars(
        studentDashboard.performance || []
    );

}


function animateBars() {

    const bars =
        document.querySelectorAll("#performanceBars .bar");

    bars.forEach((bar, index) => {

        const target =
            bar.style.height;

        bar.style.height = "0%";

        window.setTimeout(() => {
            bar.style.height = target;
        }, index * 90);

    });

}






/* =========================================
   OVERALL LEADERBOARD
========================================= */

async function loadLeaderboard() {

    const container =
        document.getElementById("leaderboardList");

    if (!container) return;

    try {

        container.innerHTML = `
            <div class="student-empty-state">
                Loading leaderboard...
            </div>
        `;

        const response =
            await fetch("/api/leaderboard", {
                credentials: "include"
            });

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Could not load leaderboard."
            );
        }

        const leaderboard =
            data.leaderboard || [];

        if (!leaderboard.length) {

            container.innerHTML = `
                <div class="student-empty-state">
                    No exam results available yet.
                    <br>
                    Complete exams to appear on the leaderboard.
                </div>
            `;

            return;
        }

        container.innerHTML =
            leaderboard.map(student => {

                let rankClass = "";

                if (student.rank === 1) {
                    rankClass = "rank-first";
                } else if (student.rank === 2) {
                    rankClass = "rank-second";
                } else if (student.rank === 3) {
                    rankClass = "rank-third";
                }

                return `
                    <div class="leaderboard-item ${rankClass}">

                        <div class="leaderboard-rank">
                            ${student.rank}
                        </div>

                        <div class="leaderboard-student">

                            <div class="leaderboard-avatar">
                                ${escapeHtml(
                                    (student.studentName || "S")
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>

                            <div>
                                <strong>
                                    ${escapeHtml(
                                        student.studentName
                                    )}
                                </strong>

                                <small>
                                    ${student.examsCompleted}
                                    Exam${student.examsCompleted === 1 ? "" : "s"}
                                    Completed
                                </small>
                            </div>

                        </div>

                        <div class="leaderboard-stat">
                            <strong>
                                ${student.correctAnswers}
                            </strong>
                            <span>
                                Correct
                            </span>
                        </div>

                        <div class="leaderboard-stat">
                            <strong>
                                ${student.totalScore}/${student.totalMarks}
                            </strong>
                            <span>
                                Total Marks
                            </span>
                        </div>

                        <div class="leaderboard-percentage">
                            ${student.percentage}%
                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "Leaderboard error:",
            error
        );

        container.innerHTML = `
            <div class="student-empty-state">
                Could not load leaderboard.
                <br>
                Please try again.
            </div>
        `;

    }

}


/* =========================================
   RESULTS
========================================= */

async function loadStudentResults() {

    try {

        const response =
            await fetch("/api/student/results", {
                credentials: "include"
            });

        if (!response.ok) {
            throw new Error("Could not load results.");
        }

        const data =
            await response.json();

        studentResults =
            data.results || [];

        renderCompletedResults();
        renderStudentActivity();

    } catch (error) {

        console.error(error);

    }

}


function renderCompletedResults() {

    const body =
        document.getElementById("completedResultsBody");

    if (!body) return;

    if (!studentResults.length) {

        body.innerHTML =
            `<tr>
                <td colspan="7" class="student-empty-table">
                    No completed exams yet.
                </td>
            </tr>`;

        return;
    }

    body.innerHTML =
        studentResults.slice(0, 10).map(result => {

            const percentage =
                Number(result.percentage || 0);

            const rating =
                percentage >= 85
                    ? "Excellent"
                    : percentage >= 60
                        ? "Good"
                        : "Needs Improvement";

            const badgeClass =
                percentage >= 85
                    ? "excellent"
                    : percentage >= 60
                        ? "good"
                        : "needs-improvement";

            return `
                <tr>
                    <td>
                        <div class="exam-name">
                            <div class="small-icon">
                                <i class="fa-solid fa-file-circle-check"></i>
                            </div>
                            <div>
                                <strong>${escapeHtml(result.examTitle)}</strong>
                                <span>${escapeHtml(result.subject)} • ${escapeHtml(result.code)}</span>
                            </div>
                        </div>
                    </td>

                    <td>${formatDate(result.submittedAt)}</td>
                    <td>${result.questionCount}</td>
                    <td><strong>${result.score}/${result.totalMarks}</strong></td>

                    <td>
                        <div class="score-progress">
                            <div style="width:${percentage}%"></div>
                        </div>
                        <span class="score-text">${percentage}%</span>
                    </td>

                    <td>
                        <span class="result-badge ${badgeClass}">
                            ${rating}
                        </span>
                    </td>

                    <td>
                        <button class="result-btn"
                                onclick="viewResult('${result.id}')">
                            View
                        </button>
                    </td>
                </tr>
            `;

        }).join("");

}


function viewResult(resultId) {

    const result =
        studentResults.find(
            item => String(item.id) === String(resultId)
        );

    if (!result) {
        showToast("Result not found.");
        return;
    }

    window.location.href =
        `/result.html?id=${encodeURIComponent(result.id)}`;

}


function viewCompleted() {
    window.location.href = "/completed-exams.html";
}


function viewAllExams() {
    window.location.href = "/available-exams.html";
}


function showUpcoming() {
    window.location.href = "/upcoming-exams.html";
}


function viewUpcomingExam() {
    window.location.href = "/upcoming-exams.html";
}


/* =========================================
   ACTIVITY
========================================= */

function renderStudentActivity() {

    const list =
        document.getElementById("studentActivityList");

    if (!list) return;

    if (!studentResults.length) {

        list.innerHTML =
            `<div class="student-empty-state">Your exam activity will appear here after you attempt an exam.</div>`;

        return;
    }

    list.innerHTML =
        studentResults.slice(0, 5).map(result => `
            <div class="activity-item">
                <div class="activity-icon completed">
                    <i class="fa-solid fa-check"></i>
                </div>
                <div class="activity-text">
                    <strong>Completed ${escapeHtml(result.examTitle)}</strong>
                    <span>Score: ${result.score}/${result.totalMarks} (${result.percentage}%)</span>
                    <small>${formatDate(result.submittedAt)}</small>
                </div>
            </div>
        `).join("");

}


function refreshActivity() {

    loadStudentResults()
        .then(() => showToast("Activity refreshed."));

}


/* =========================================
   NOTIFICATIONS
========================================= */

function showNotifications() {
    openStudentSection("notifications");
}


async function loadStudentNotifications() {

    const list = document.getElementById("studentNotificationsList");
    if (!list) return;

    try {
        const response = await fetch("/api/student/notifications", { credentials: "include" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load notifications.");

        const notifications = data.notifications || [];
        const count = document.getElementById("studentNotificationCount");
        if (count) count.textContent = data.unreadCount || 0;

        if (!notifications.length) {
            list.innerHTML = `<div class="student-extra-item"><div class="rank"><i class="fa-solid fa-circle-info"></i></div><div><strong>No new notifications</strong><small>New exam and result updates will appear here.</small></div></div>`;
            return;
        }

        list.innerHTML = notifications.map(item => `
            <div class="student-extra-item">
                <div class="rank"><i class="fa-solid ${escapeHtml(item.icon || "fa-bell")}"></i></div>
                <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message || "")}</small></div>
            </div>
        `).join("");

    } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="student-extra-item"><div class="rank"><i class="fa-solid fa-triangle-exclamation"></i></div><div><strong>Notifications unavailable</strong><small>${escapeHtml(error.message)}</small></div></div>`;
    }

}

/* =========================================
   SETTINGS
========================================= */

function loadStudentSettings() {

    const confirmSubmit =
        document.getElementById("confirmSubmitSetting");

    const rememberRange =
        document.getElementById("rememberRangeSetting");

    if (confirmSubmit) {

        confirmSubmit.checked =
            localStorage.getItem("studentConfirmSubmit") !== "false";

        confirmSubmit.addEventListener("change", () => {

            localStorage.setItem(
                "studentConfirmSubmit",
                String(confirmSubmit.checked)
            );

        });

    }

    if (rememberRange) {

        rememberRange.checked =
            localStorage.getItem("studentRememberRange") !== "false";

        rememberRange.addEventListener("change", () => {

            localStorage.setItem(
                "studentRememberRange",
                String(rememberRange.checked)
            );

        });

    }

}


/* =========================================
   SIDEBAR
========================================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById("sidebar");

    if (sidebar) {
        sidebar.classList.toggle("sidebar-open");
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

    window.location.href =
        "/loginPrem.html";

}


/* =========================================
   TOAST
========================================= */

function showToast(message) {

    const toast =
        document.getElementById("toast");

    const messageElement =
        document.getElementById("toastMessage");

    if (!toast || !messageElement) {
        alert(message);
        return;
    }

    messageElement.textContent = message;

    toast.classList.add("show");

    window.clearTimeout(window.studentToastTimer);

    window.studentToastTimer =
        window.setTimeout(() => {
            toast.classList.remove("show");
        }, 2800);

}


/* =========================================
   HELPERS
========================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function shortLabel(value) {

    const text =
        String(value || "Exam");

    if (text.length <= 8) return text;

    return text
        .split(/\s+/)
        .map(word => word.charAt(0))
        .join("")
        .slice(0, 6)
        .toUpperCase();

}


function formatDate(value) {

    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function formatDateTime(value) {

    if (!value) return "Scheduled";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Scheduled";

    return date.toLocaleString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================
   STARTUP
========================================= */

function startStudentRealtimeUpdates() {
    window.clearInterval(window.studentRealtimeTimer);
   window.studentRealtimeTimer = window.setInterval(async () => {

    await Promise.all([
        loadStudentDashboard(),
        loadStudentExams(),
        loadStudentResults(),
        loadLeaderboard()
    ]);

}, 5000);
}


document.addEventListener("DOMContentLoaded", async () => {

    const authenticated =
        await loadLoggedInStudent();

    if (!authenticated) return;

    document.querySelectorAll(".sidebar .nav-item")
        .forEach(item => {

            item.addEventListener("click", event => {

                const href = item.getAttribute("href");
                const section = item.dataset.section;

                if (href && href !== "#") {
                    return;
                }

                event.preventDefault();

                if (section) {
                    openStudentSection(section);
                }

            });

        });

    loadStudentSettings();

    await Promise.all([
    loadStudentDashboard(),
    loadStudentExams(),
    loadStudentResults(),
    loadLeaderboard()
]);

    const range =
        document.getElementById("performanceRange");

    if (range) {
        range.addEventListener("change", changePerformance);
    }

    startStudentRealtimeUpdates();

});
