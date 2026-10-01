/* Shared behavior for dedicated Student/Teacher pages. */
(function () {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    const pageMap = {
        "student-dashboard.html": "dashboard",
        "available-exams.html": "available-exams",
        "upcoming-exams.html": "upcoming",
        "completed-exams.html": "completed",
        "performance.html": "performance",
        "leaderboard.html": "leaderboard",
        "notifications.html": "notifications",
        "student-profile.html": "profile",
        "student-settings.html": "settings",
        "teacher-dashboard.html": "dashboard",
        "create-exam.html": "create-exam",
        "manage-exams.html": "manage-exams",
        "teacher-results.html": "teacher-results",
        "analytics.html": "analytics",
        "teacher-notifications.html": "teacher-notifications",
        "teacher-profile.html": "teacher-profile",
        "teacher-settings.html": "teacher-settings"
    };

    function markActivePage() {
        const key = pageMap[currentPage];
        if (!key) return;

        document.querySelectorAll(".sidebar .nav-item[data-section]").forEach(function (item) {
            item.classList.toggle("active", item.dataset.section === key);
        });
    }

    async function refreshSidebarUser() {
        try {
            const response = await fetch("/api/me", { credentials: "include" });
            const data = await response.json();

            if (!data.loggedIn || !data.user) return;

            const user = data.user;
            const fallback = currentPage.startsWith("teacher-") || currentPage === "create-exam.html" || currentPage === "manage-exams.html" || currentPage === "analytics.html"
                ? "Teacher"
                : "Student";

            const name = user.fullname || fallback;
            const email = user.email || "";

            document.querySelectorAll(".sidebar .profile-details strong").forEach(function (element) {
                element.textContent = name;
            });

            document.querySelectorAll(".sidebar .profile-details small").forEach(function (element) {
                element.textContent = email;
            });
        } catch (error) {
            console.debug("Sidebar profile refresh skipped.", error);
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        markActivePage();
        refreshSidebarUser();
    });
})();
