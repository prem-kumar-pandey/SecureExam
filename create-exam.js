let questionNumber = 0;


/* =========================================================
   TEACHER AUTHENTICATION
========================================================= */

async function checkTeacher() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.loggedIn ||
            !data.user ||
            data.user.role !== "teacher"
        ) {

            window.location.href =
                "/loginPrem.html";

            return false;
        }

        return true;

    } catch (error) {

        console.error(
            "Teacher authentication error:",
            error
        );

        window.location.href =
            "/loginPrem.html";

        return false;
    }
}


/* =========================================================
   SHOW SCHOOL / COLLEGE FIELDS
========================================================= */

function updateTargetFields() {

    const type =
        document.getElementById(
            "examInstitutionType"
        )?.value || "";


    const schoolClassLabel =
        document.getElementById(
            "examSchoolClassLabel"
        );

    const schoolSectionLabel =
        document.getElementById(
            "examSchoolSectionLabel"
        );

    const semesterLabel =
        document.getElementById(
            "examSemesterLabel"
        );

    const courseLabel =
        document.getElementById(
            "examCourseLabel"
        );

    const collegeSectionLabel =
        document.getElementById(
            "examCollegeSectionLabel"
        );

        const examCodeLabel =
    document.getElementById(
        "examCodeLabel"
    );

const examCode =
    document.getElementById(
        "code"
    );


    const schoolClass =
        document.getElementById(
            "examSchoolClass"
        );

    const schoolSection =
        document.getElementById(
            "examSchoolSection"
        );

    const semester =
        document.getElementById(
            "examSemester"
        );

    const course =
        document.getElementById(
            "examCourse"
        );

    const collegeSection =
        document.getElementById(
            "examCollegeSection"
        );


    const isSchool =
        type === "school";

    const isCollege =
        type === "college";


    if (schoolClassLabel) {
        schoolClassLabel.hidden =
            !isSchool;
    }

    if (schoolSectionLabel) {
        schoolSectionLabel.hidden =
            !isSchool;
    }

    if (semesterLabel) {
        semesterLabel.hidden =
            !isCollege;
    }

    if (courseLabel) {
        courseLabel.hidden =
            !isCollege;
    }

    if (collegeSectionLabel) {
        collegeSectionLabel.hidden =
            !isCollege;
    }

    if (examCodeLabel) {
    examCodeLabel.hidden =
        !isCollege;
}

if (examCode) {
    examCode.required =
        isCollege;

    if (!isCollege) {
        examCode.value = "";
    }
}


    if (schoolClass) {
        schoolClass.required =
            isSchool;
    }

    if (schoolSection) {
        schoolSection.required =
            isSchool;
    }

    if (semester) {
        semester.required =
            isCollege;
    }

    if (course) {
        course.required =
            isCollege;
    }

    if (collegeSection) {
        collegeSection.required =
            isCollege;
    }
}


/* =========================================================
   ADD QUESTION
========================================================= */

function addQuestion() {

    questionNumber++;

    const container =
        document.getElementById(
            "questions"
        );

    if (!container) {
        return;
    }


    const card =
        document.createElement(
            "div"
        );

    card.className =
        "portal-card";

    card.style.marginTop =
        "14px";

    card.dataset.question =
        String(questionNumber);


    card.innerHTML = `

        <label>

            Question ${questionNumber}

            <input
                class="question-text"
                type="text"
                required
            >

        </label>


        <div
            class="portal-grid"
            style="margin-top:12px"
        >

            <label>

                Option A

                <input
                    class="question-option"
                    type="text"
                    required
                >

            </label>


            <label>

                Option B

                <input
                    class="question-option"
                    type="text"
                    required
                >

            </label>


            <label>

                Option C

                <input
                    class="question-option"
                    type="text"
                    required
                >

            </label>


            <label>

                Option D

                <input
                    class="question-option"
                    type="text"
                    required
                >

            </label>

        </div>


        <label
            style="margin-top:12px"
        >

            Correct Answer

            <select
                class="question-correct"
            >

                <option value="0">
                    A
                </option>

                <option value="1">
                    B
                </option>

                <option value="2">
                    C
                </option>

                <option value="3">
                    D
                </option>

            </select>

        </label>

        <label style="margin-top:12px">
    Marks
    <input
        class="question-marks"
        type="number"
        min="1"
        value="1"
        required
    >
</label>


        <div
            class="portal-row"
            style="margin-top:12px"
        >

            <button
                type="button"
                class="portal-action"
                onclick="this.closest('[data-question]').remove()"
            >
                Remove
            </button>

        </div>

    `;

    container.appendChild(card);
}


/* =========================================================
   COLLECT QUESTIONS
========================================================= */


function collectQuestions() {

    return [
        ...document.querySelectorAll(
            "#questions [data-question]"
        )
    ].map(card => ({

        text:
            card
                .querySelector(
                    ".question-text"
                )
                ?.value
                .trim() || "",

        options:
            [
                ...card.querySelectorAll(
                    ".question-option"
                )
            ].map(
                input =>
                    input.value.trim()
            ),

        correctAnswer:
            Number(
                card
                    .querySelector(
                        ".question-correct"
                    )
                    ?.value
            ),

        marks:
            Math.max(
                1,
                Number(
                    card
                        .querySelector(
                            ".question-marks"
                        )
                        ?.value
                ) || 1
            )

    }));
}


/* =========================================================
   AUTOMATIC EXAM END TIME
========================================================= */

function updateCalculatedEndTime() {

    const scheduledAt =
        document.getElementById(
            "scheduledAt"
        )?.value;

    const duration =
        Number(
            document.getElementById(
                "duration"
            )?.value
        );

    const endInput =
        document.getElementById(
            "calculatedEndTime"
        );

    if (!endInput) {
        return;
    }

    if (
        !scheduledAt ||
        !duration ||
        duration < 1
    ) {
        endInput.value = "";
        return;
    }

    const start =
        new Date(scheduledAt);

    if (
        Number.isNaN(
            start.getTime()
        )
    ) {
        endInput.value = "";
        return;
    }

    const end =
        new Date(
            start.getTime() +
            duration * 60 * 1000
        );

    endInput.value =
        end.toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );
}

/* =========================================================
   STARTUP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const authenticated =
            await checkTeacher();

        if (!authenticated) {
            return;
        }


        const institutionType =
            document.getElementById(
                "examInstitutionType"
            );


        if (institutionType) {

            institutionType.addEventListener(
                "change",
                updateTargetFields
            );

        }


        updateTargetFields();

const scheduledAtInput =
    document.getElementById(
        "scheduledAt"
    );

const durationInput =
    document.getElementById(
        "duration"
    );

if (scheduledAtInput) {
    scheduledAtInput.addEventListener(
        "input",
        updateCalculatedEndTime
    );

    scheduledAtInput.addEventListener(
        "change",
        updateCalculatedEndTime
    );
}

if (durationInput) {
    durationInput.addEventListener(
        "input",
        updateCalculatedEndTime
    );

    durationInput.addEventListener(
        "change",
        updateCalculatedEndTime
    );
}

updateCalculatedEndTime();

addQuestion();

    }
);


/* =========================================================
   CREATE EXAM
========================================================= */

document
    .getElementById(
        "createForm"
    )
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const message =
                document.getElementById(
                    "message"
                );


            const institutionType =
                document.getElementById(
                    "examInstitutionType"
                )?.value || "";


            const institutionName =
                document.getElementById(
                    "examInstitutionName"
                )?.value
                .trim() || "";


            if (!institutionType) {

                message.textContent =
                    "Please select School or College / University.";

                return;
            }


            if (!institutionName) {

                message.textContent =
                    "Please enter the institution name.";

                return;
            }


            let targetGroup;


            /* =========================================
               SCHOOL
            ========================================= */

            if (
                institutionType ===
                "school"
            ) {

                const schoolClass =
                    document.getElementById(
                        "examSchoolClass"
                    )?.value || "";


                const schoolSection =
                    document.getElementById(
                        "examSchoolSection"
                    )?.value || "";


                if (
                    !schoolClass ||
                    !schoolSection
                ) {

                    message.textContent =
                        "Please select the school class and section.";

                    return;
                }


                targetGroup = {

                    institutionType:
                        "school",

                    institutionName,

                    schoolClass,

                    year:
                        "",

                    course:
                        "",

                    section:
                        schoolSection

                };


            }


            /* =========================================
               COLLEGE / UNIVERSITY
            ========================================= */

            else {

                const semester =
                    document.getElementById(
                        "examSemester"
                    )?.value || "";


                const course =
                    document.getElementById(
                        "examCourse"
                    )?.value
                    .trim() || "";


                const section =
                    document.getElementById(
                        "examCollegeSection"
                    )?.value || "";


                if (
                    !semester ||
                    !course ||
                    !section
                ) {

                    message.textContent =
                        "Please select the semester, enter the course and select the section.";

                    return;
                }


                targetGroup = {

                    institutionType:
                        "college",

                    institutionName,

                    schoolClass:
                        "",

                    year:
                        semester,

                    course,

                    section

                };

            }


            const questions =
                collectQuestions();


            if (!questions.length) {

                message.textContent =
                    "Add at least one question.";

                return;
            }


            const invalidQuestion =
                questions.some(
                    question =>

                        !question.text ||

                        question.options.length !== 4 ||

                        question.options.some(
                            option =>
                                !option
                        ) ||

                        !Number.isInteger(
                            question.correctAnswer
                        ) ||

                        question.correctAnswer < 0 ||

                        question.correctAnswer > 3
                );


            if (invalidQuestion) {

                message.textContent =
                    "Please complete every question and all four options.";

                return;
            }


            const totalMarks =
                questions.reduce(
                    (sum, question) =>
                        sum +
                        question.marks,
                    0
                );


            const totalMarksInput =
                document.getElementById(
                    "totalMarks"
                );


            if (totalMarksInput) {

                totalMarksInput.value =
                    totalMarks;

            }


            const scheduledAt =
                document.getElementById(
                    "scheduledAt"
                )?.value || null;


            const payload = {

                title:
                    document
                        .getElementById(
                            "title"
                        )
                        ?.value
                        .trim() || "",

                subject:
                    document
                        .getElementById(
                            "subject"
                        )
                        ?.value
                        .trim() || "",

                code:
    institutionType === "college"
        ? (
            document
                .getElementById(
                    "code"
                )
                ?.value
                .trim() || ""
        )
        : "",

                duration:
                    Number(
                        document
                            .getElementById(
                                "duration"
                            )
                            ?.value
                    ),

                totalMarks,

                status:
                    document
                        .getElementById(
                            "status"
                        )
                        ?.value ||
                    "draft",

                scheduledAt,

                targetGroup,

                questions

            };


            if (
    !payload.title ||
    !payload.subject ||
    !payload.duration ||
    (
        institutionType === "college" &&
        !payload.code
    )
) {

                message.textContent =
                    "Complete all exam details.";

                return;
            }


            try {

                const response =
                    await fetch(
                        "/api/exams",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Could not create exam."
                    );

                }


                message.textContent =
                    "Exam created successfully.";


                event.target.reset();


                questionNumber =
                    0;


                document.getElementById(
                    "questions"
                ).innerHTML =
                    "";


                updateTargetFields();

                addQuestion();


            } catch (error) {

                console.error(
                    "Create exam error:",
                    error
                );

                message.textContent =
                    error.message;

            }

        }
    );