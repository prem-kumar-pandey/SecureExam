let exam = null;
let startedAt = null;
let remainingSeconds = 0;
let timerHandle = null;
let submitting = false;

let currentUser = null;

let attemptId = null;

let proctoringSocket = null;

let teacherSocketId = null;

let studentPeerConnection = null;

let pendingIceCandidates = [];

let teacherVoicePeerConnection = null;

let teacherVoicePendingIceCandidates = [];

let teacherVoiceAudioContext = null;

let teacherVoiceAudioSource = null;

let heartbeatHandle = null;


/* =========================================================
   SECURE EXAM STATE
   ========================================================= */

let secureModeStarted = false;
let cameraStream = null;

let securityViolations = 0;
const MAX_SECURITY_VIOLATIONS = 3;

let securityWarningOpen = false;
let fullscreenRequestInProgress = false;
let allowSecurityEvent = false;


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   GET EXAM ID
   ========================================================= */

function getExamId() {

    return new URLSearchParams(
        window.location.search
    ).get("id");

}


/* =========================================================
   LOAD EXAM
   ========================================================= */

async function loadExam() {

    const examId = getExamId();

    if (!examId) {

        showMessage("No exam was selected.");

        return;
    }


    try {

        const meResponse =
            await fetch("/api/me", {
                credentials: "include"
            });


        if (!meResponse.ok) {

            window.location.href =
                "/loginPrem.html";

            return;
        }


        const me =
            await meResponse.json();


        currentUser =
    me.user;


        if (!me.loggedIn || !me.user) {

            window.location.href =
                "/loginPrem.html";

            return;
        }


        if (
            me.user.role &&
            me.user.role !== "student"
        ) {

            window.location.href =
                "/teacher-dashboard.html";

            return;
        }


        document.getElementById(
            "studentExamName"
        ).textContent =
            me.user.fullname || "Student";


        const response =
            await fetch(
                `/api/exams/${encodeURIComponent(examId)}`,
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Could not load exam."
            );

        }


        if (data.alreadySubmitted) {

            showMessage(
                "You have already submitted this exam."
            );

            return;
        }


        exam = data.exam;


        document.getElementById(
            "examTitle"
        ).textContent =
            exam.title;


        document.getElementById(
            "examMeta"
        ).textContent =
            `${exam.subject} • ${exam.code} • ` +
            `${exam.questions.length} Questions • ` +
            `${exam.totalMarks} Marks • ` +
            `${exam.duration} Minutes`;


        renderQuestions();


        let attempt = data.attempt;


        if (!attempt) {

            const startResponse =
                await fetch(
                    `/api/exams/${encodeURIComponent(exam.id)}/start`,
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );


            const startData =
                await startResponse.json();


            if (!startResponse.ok) {

                throw new Error(
                    startData.message ||
                    "Could not start exam."
                );

            }


            attempt = startData;

        }


        attemptId =
    attempt.id ||
    attempt.attemptId ||
    attempt._id ||
    null;

startedAt =
    attempt.startedAt;


        const expiresAt =
            new Date(
                attempt.expiresAt
            ).getTime();


        remainingSeconds =
            Math.max(
                0,
                Math.ceil(
                    (expiresAt - Date.now()) / 1000
                )
            );


        if (remainingSeconds <= 0) {

            await submitExam(true);

            return;
        }


        startTimer(expiresAt);

        startProctoringConnection();


    } catch (error) {

    console.error(error);

    showMessage(
        error.message
    );

    throw error;
}

}


/* =========================================================
   RENDER QUESTIONS
   ========================================================= */

function renderQuestions() {

    const container =
        document.getElementById(
            "questionsContainer"
        );


    container.innerHTML =
        exam.questions.map(
            (question, index) => `

            <section class="question-card">

                <div class="question-card-head">

                    <div>

                        <span class="question-number">
                            QUESTION ${index + 1}
                        </span>

                        <h2>
                            ${escapeHtml(question.text)}
                        </h2>

                    </div>


                    <span class="question-marks">

                        ${question.marks}
                        mark${question.marks === 1 ? "" : "s"}

                    </span>

                </div>


                <div class="options">

                    ${question.options.map(
                        (option, optionIndex) => `

                        <div class="option">

                            <input
                                type="radio"
                                id="q${index}_${optionIndex}"
                                name="question_${index}"
                                value="${optionIndex}">

                            <label
                                for="q${index}_${optionIndex}">

                                <strong>
                                    ${String.fromCharCode(
                                        65 + optionIndex
                                    )}.
                                </strong>

                                ${escapeHtml(option)}

                            </label>

                        </div>

                    `).join("")}

                </div>

            </section>

        `
        ).join("");


    updateProgress();


    container.addEventListener(
        "change",
        updateProgress
    );

}


/* =========================================================
   UPDATE PROGRESS
   ========================================================= */

function updateProgress() {

    if (!exam) return;


    const answered =
        exam.questions.reduce(
            (count, _, index) => {

                return count +
                    (
                        document.querySelector(
                            `input[name="question_${index}"]:checked`
                        )
                            ? 1
                            : 0
                    );

            },
            0
        );


    const percentage =
        exam.questions.length
            ? (
                answered /
                exam.questions.length
            ) * 100
            : 0;


    document.getElementById(
        "questionProgressText"
    ).textContent =
        `${answered} / ${exam.questions.length} answered`;


    document.getElementById(
        "questionProgress"
    ).style.width =
        `${percentage}%`;

}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer(expiresAt) {

    clearInterval(timerHandle);


    updateTimer(expiresAt);


    timerHandle =
        setInterval(
            () => {

                remainingSeconds =
                    Math.max(
                        0,
                        Math.ceil(
                            (expiresAt - Date.now()) / 1000
                        )
                    );


                updateTimer(expiresAt);


                if (
                    remainingSeconds <= 0
                ) {

                    clearInterval(
                        timerHandle
                    );


                    submitExam(true);

                }

            },
            250
        );

}


function updateTimer() {

    const minutes =
        Math.floor(
            remainingSeconds / 60
        );


    const seconds =
        remainingSeconds % 60;


    document.getElementById(
        "examTimer"
    ).textContent =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;


    const timerBox =
        document.getElementById(
            "timerBox"
        );


    timerBox.classList.toggle(
        "warning",
        remainingSeconds <= 300 &&
        remainingSeconds > 60
    );


    timerBox.classList.toggle(
        "danger",
        remainingSeconds <= 60
    );

}


/* =========================================================
   COLLECT ANSWERS
   ========================================================= */

function collectAnswers() {

    return exam.questions.map(
        (_, index) => {

            const selected =
                document.querySelector(
                    `input[name="question_${index}"]:checked`
                );


            return selected
                ? Number(selected.value)
                : -1;

        }
    );

}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

async function submitExam(
    autoSubmitted = false
) {

    if (
        submitting ||
        !exam
    ) {
        return;
    }


    const answers =
        collectAnswers();


    if (!autoSubmitted) {

        const confirmSetting =
            localStorage.getItem(
                "studentConfirmSubmit"
            ) !== "false";


        if (
            confirmSetting &&
            !confirm(
                `Submit "${exam.title}" now?\n\n` +
                `${answers.filter(
                    answer => answer >= 0
                ).length} of ` +
                `${exam.questions.length} questions answered.`
            )
        ) {

            return;
        }

    }


    submitting = true;


    clearInterval(
    timerHandle
);

stopHeartbeat();

closeStudentPeer();

closeTeacherVoicePeer();

if (
    proctoringSocket
) {

    proctoringSocket.disconnect();

    proctoringSocket =
        null;
}

stopCamera();


    try {

        const response =
            await fetch(
                `/api/exams/${encodeURIComponent(exam.id)}/submit`,
                {
                    method: "POST",
                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        answers,
                        startedAt,
                        autoSubmitted
                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Could not submit exam."
            );

        }


        window.location.href =
            `/result.html?id=${encodeURIComponent(
                data.result.id
            )}`;


    } catch (error) {

        submitting = false;

        showMessage(
            error.message
        );

    }

}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(message) {

    const element =
        document.getElementById(
            "examMessage"
        );


    if (element) {

        element.textContent =
            message;

    }

}


/* =========================================================
   START CAMERA + MICROPHONE
   ========================================================= */

async function startCamera() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "Camera and microphone access is not supported by this browser."
        );

    }


    cameraStream =
        await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user"
            },
            audio: true
        });


    const video =
        document.getElementById(
            "studentCamera"
        );


    video.srcObject =
        cameraStream;


    await video.play();


    updateCameraStatus(
        true
    );


    cameraStream
    .getTracks()
    .forEach(track => {

        track.addEventListener(
            "ended",
            () => {

                handleMediaEnded(
                    track
                );

            }
        );

    });


updateMicrophoneStatus(
    true
);

}


/* =========================================================
   STOP CAMERA
   ========================================================= */

function stopCamera() {

    if (!cameraStream) {
        return;
    }


    cameraStream
        .getTracks()
        .forEach(track => {

            track.stop();

        });


    cameraStream = null;


    const video =
        document.getElementById(
            "studentCamera"
        );


    if (video) {

        video.srcObject =
            null;

    }


    updateCameraStatus(
        false
    );

}


/* =========================================================
   CAMERA STATUS
   ========================================================= */

function updateCameraStatus(active) {

    const status =
        document.getElementById(
            "cameraStatus"
        );


    if (!status) {
        return;
    }


    if (active) {

        status.innerHTML =
            `<i class="fa-solid fa-video"></i>
             Camera Active`;

        status.classList.remove(
            "inactive"
        );

    } else {

        status.innerHTML =
            `<i class="fa-solid fa-video-slash"></i>
             Camera Inactive`;

        status.classList.add(
            "inactive"
        );

    }

}


/* =========================================================
   CAMERA / MICROPHONE DISCONNECTED
   ========================================================= */

function handleMediaEnded(
    track
) {

    if (
        !secureModeStarted ||
        submitting
    ) {
        return;
    }


    if (
        track &&
        track.kind === "video"
    ) {

        updateCameraStatus(
            false
        );

        registerSecurityViolation(
            "Camera was disconnected."
        );

        reportProctoringEvent(
            "CAMERA_DISCONNECTED",
            "Student camera disconnected.",
            "high"
        );

        return;
    }


    if (
        track &&
        track.kind === "audio"
    ) {

        updateMicrophoneStatus(
            false
        );

        registerSecurityViolation(
            "Microphone was disconnected."
        );

        reportProctoringEvent(
            "MICROPHONE_DISCONNECTED",
            "Student microphone disconnected.",
            "high"
        );

    }

}


/* =========================================================
   FULLSCREEN
   ========================================================= */

async function enterFullscreen() {

    if (
        document.fullscreenElement
    ) {

        return true;
    }


    if (
        fullscreenRequestInProgress
    ) {

        return false;
    }


    fullscreenRequestInProgress =
        true;


    try {

        await document.documentElement.requestFullscreen();

        return true;

    } catch (error) {

        console.error(
            "Fullscreen error:",
            error
        );

        return false;

    } finally {

        fullscreenRequestInProgress =
            false;

    }

}


/* =========================================================
   EXIT FULLSCREEN DETECTION
   ========================================================= */

function handleFullscreenChange() {

    if (
        !secureModeStarted ||
        submitting
    ) {
        return;
    }


    if (
        !document.fullscreenElement &&
        !allowSecurityEvent
    ) {

        reportProctoringEvent(
    "FULLSCREEN_EXIT",
    "Student exited fullscreen.",
    "medium"
);

        registerSecurityViolation(
            "You exited fullscreen mode."
        );

    }

}



reportProctoringEvent(
    "TAB_SWITCH",
    "Student switched away from the examination.",
    "high"
);



/* =========================================================
   TAB SWITCH DETECTION
   ========================================================= */

function handleVisibilityChange() {

    if (
        !secureModeStarted ||
        submitting
    ) {
        return;
    }


    if (
        document.hidden &&
        !allowSecurityEvent
    ) {

        registerSecurityViolation(
            "You switched away from the examination."
        );

    }

}


/* =========================================================
   WINDOW FOCUS DETECTION
   ========================================================= */
   function handleWindowBlur() {

    if (
        !secureModeStarted ||
        submitting ||
        document.hidden ||
        securityWarningOpen ||
        allowSecurityEvent
    ) {
        return;
    }


    registerSecurityViolation(
        "The examination window lost focus."
    );

}


/* =========================================================
   REGISTER SECURITY VIOLATION
   ========================================================= */

function registerSecurityViolation(
    reason
) {

    if (
        !secureModeStarted ||
        submitting ||
        securityWarningOpen
    ) {
        return;
    }


    securityViolations++;
    reportProctoringEvent(
    getProctoringType(
        reason
    ),
    reason,
    "medium"
);


    updateViolationDisplay();


    if (
        securityViolations >=
        MAX_SECURITY_VIOLATIONS
    ) {

        autoSubmitForSecurity(
            reason
        );

        return;
    }


    showSecurityWarning(
        reason
    );

}


/* =========================================================
   UPDATE VIOLATION DISPLAY
   ========================================================= */

function updateViolationDisplay() {

    const element =
        document.getElementById(
            "violationCount"
        );


    if (element) {

        element.textContent =
            `${securityViolations} / ${MAX_SECURITY_VIOLATIONS}`;

    }

}


/* =========================================================
   SHOW SECURITY WARNING
   ========================================================= */

function showSecurityWarning(
    reason
) {

    securityWarningOpen =
        true;


    const overlay =
        document.getElementById(
            "securityWarning"
        );


    const text =
        document.getElementById(
            "securityWarningText"
        );


    const count =
        document.getElementById(
            "securityWarningCount"
        );


    if (text) {

        text.textContent =
            reason;

    }


    if (count) {

        count.textContent =
            `Violation ${securityViolations} / ${MAX_SECURITY_VIOLATIONS}`;

    }


    if (overlay) {

        overlay.classList.add(
            "show"
        );

    }

}


/* =========================================================
   RETURN TO EXAM
   ========================================================= */

async function returnToExam() {

    securityWarningOpen =
        false;


    const overlay =
        document.getElementById(
            "securityWarning"
        );


    if (overlay) {

        overlay.classList.remove(
            "show"
        );

    }


    allowSecurityEvent =
        true;


    try {

        await enterFullscreen();

    } finally {

        setTimeout(
            () => {

                allowSecurityEvent =
                    false;

            },
            500
        );

    }

}


/* =========================================================
   SECURITY AUTO SUBMIT
   ========================================================= */

async function autoSubmitForSecurity(
    reason
) {

    if (submitting) {
        return;
    }


    const message =
        document.getElementById(
            "securityWarningText"
        );


    if (message) {

        message.textContent =
            `${reason} Maximum security violations reached. ` +
            `Your exam will be submitted automatically.`;

    }


    const overlay =
        document.getElementById(
            "securityWarning"
        );


    if (overlay) {

        overlay.classList.add(
            "show"
        );

    }


    securityWarningOpen =
        true;


    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                1500
            )
    );


    await submitExam(
        true
    );

}


/* =========================================================
   DISABLE COPY / PASTE / RIGHT CLICK
   ========================================================= */

function setupRestrictions() {

    document.addEventListener(
        "contextmenu",
        event => {

            if (
                secureModeStarted
            ) {

                event.preventDefault();

            }

        }
    );


    document.addEventListener(
        "copy",
        event => {

            if (
                secureModeStarted
            ) {

                event.preventDefault();

            }

        }
    );


    document.addEventListener(
        "cut",
        event => {

            if (
                secureModeStarted
            ) {

                event.preventDefault();

            }

        }
    );


    document.addEventListener(
        "paste",
        event => {

            if (
                secureModeStarted
            ) {

                event.preventDefault();

            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                !secureModeStarted
            ) {
                return;
            }


            const key =
                event.key.toLowerCase();


            const blocked =
                (
                    event.ctrlKey &&
                    [
                        "c",
                        "v",
                        "x",
                        "u",
                        "s",
                        "p"
                    ].includes(key)
                ) ||

                (
                    event.ctrlKey &&
                    event.shiftKey &&
                    [
                        "i",
                        "j",
                        "c"
                    ].includes(key)
                ) ||

                key === "f12";


            if (blocked) {

                event.preventDefault();

                event.stopPropagation();

            }

        },
        true
    );

}


async function prepareTeacherVoiceAudio() {

    try {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        if (!teacherVoiceAudioContext) {

            teacherVoiceAudioContext =
                new AudioContextClass();

        }

        if (
            teacherVoiceAudioContext.state ===
            "suspended"
        ) {

            await teacherVoiceAudioContext.resume();

        }

    } catch (error) {

        console.warn(
            "Teacher voice audio setup:",
            error
        );

    }

}


/* =========================================================
   START SECURE EXAM
   ========================================================= */

async function startSecureExam() {

    const button =
        document.getElementById(
            "enterSecureExamButton"
        );

    const message =
        document.getElementById(
            "secureEntryMessage"
        );


    if (button) {

        button.disabled = true;

        button.innerHTML =
            `<i class="fa-solid fa-spinner fa-spin"></i>
             Preparing Secure Exam...`;

    }


    /*
     * IMPORTANT:
     * Request fullscreen immediately from the
     * user's button click.
     */
    let fullscreenPromise = null;

    try {

        if (!document.fullscreenElement) {

            fullscreenPromise =
                document.documentElement.requestFullscreen();

        }

    } catch (error) {

        console.error(
            "Fullscreen request error:",
            error
        );

    }


    try {

        if (message) {

            message.textContent =
                "Entering fullscreen mode...";

        }


        /*
         * Wait for fullscreen request.
         */
        if (fullscreenPromise) {

            await fullscreenPromise;

        }


        /*
         * Now request camera + microphone.
         */
        if (message) {

            message.textContent =
                "Requesting camera and microphone access...";

        }


        await prepareTeacherVoiceAudio();

await startCamera();


        /*
         * Protected mode starts here.
         */
        secureModeStarted = true;

        allowSecurityEvent = true;


        const overlay =
            document.getElementById(
                "secureEntryOverlay"
            );


        if (overlay) {

            overlay.classList.add(
                "hidden"
            );

        }


        const camera =
            document.getElementById(
                "cameraContainer"
            );


        if (camera) {

            camera.classList.add(
                "show"
            );

        }


        const securityStatus =
            document.getElementById(
                "securityStatus"
            );


        if (securityStatus) {

            securityStatus.classList.add(
                "show"
            );

        }


        updateViolationDisplay();


        setTimeout(() => {

            allowSecurityEvent = false;

        }, 1000);


        if (message) {

            message.textContent = "";

        }


        /*
         * Start your existing exam.
         */
        await loadExam();


    } catch (error) {

        console.error(
            "Secure exam startup error:",
            error
        );


        stopCamera();

        secureModeStarted = false;

        allowSecurityEvent = false;


        /*
         * Exit fullscreen if startup failed.
         */
        if (document.fullscreenElement) {

            try {

                await document.exitFullscreen();

            } catch (fullscreenError) {

                console.error(
                    fullscreenError
                );

            }

        }


        if (message) {

            message.textContent =
                error.message ||
                "Unable to start secure exam.";

        }


        if (button) {

            button.disabled = false;

            button.innerHTML =
                `<i class="fa-solid fa-shield-halved"></i>
                 Enter Secure Exam
                 <i class="fa-solid fa-arrow-right"></i>`;

        }

    }

}

/* =========================================================
   CAMERA MINIMIZE
   ========================================================= */

function setupCameraControls() {

    const button =
        document.getElementById(
            "cameraMinimizeButton"
        );


    const camera =
        document.getElementById(
            "cameraContainer"
        );


    if (
        !button ||
        !camera
    ) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            camera.classList.toggle(
                "minimized"
            );


            button.innerHTML =
                camera.classList.contains(
                    "minimized"
                )
                    ? `<i class="fa-solid fa-video"></i>`
                    : `<i class="fa-solid fa-minus"></i>`;

        }
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const form =
            document.getElementById(
                "examForm"
            );


        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    submitExam(false);

                }
            );

        }


        const enterButton =
            document.getElementById(
                "enterSecureExamButton"
            );


        if (enterButton) {

            enterButton.addEventListener(
                "click",
                startSecureExam
            );

        }


        const returnButton =
            document.getElementById(
                "returnToExamButton"
            );


        if (returnButton) {

            returnButton.addEventListener(
                "click",
                returnToExam
            );

        }


        document.addEventListener(
            "fullscreenchange",
            handleFullscreenChange
        );


        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );


        window.addEventListener(
            "blur",
            handleWindowBlur
        );


        setupRestrictions();

        setupCameraControls();

    }
);



/* =========================================================
   LIVE PROCTORING / WEBRTC
========================================================= */

const WEBRTC_CONFIG = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        }

    ]

};


/* =========================================================
   START PROCTORING SOCKET
========================================================= */

function startProctoringConnection() {

    if (!window.io) {

        console.error(
            "Socket.IO client is not available."
        );

        return;
    }

    if (!attemptId) {

        console.error(
            "No attempt ID available."
        );

        return;
    }

    if (
        proctoringSocket &&
        proctoringSocket.connected
    ) {
        return;
    }

    proctoringSocket =
        io({
            withCredentials: true
        });


    proctoringSocket.on(
        "connect",
        () => {

            console.log(
                "✅ Proctoring socket connected."
            );

            proctoringSocket.emit(
                "joinExam",
                {

                    examId:
                        exam.id,

                    attemptId:
                        attemptId

                }
            );

            startHeartbeat();

        }
    );


    proctoringSocket.on(
        "teacher:available",
        async ({
            socketId
        }) => {

            try {

                teacherSocketId =
                    socketId;

                await createStudentPeer(
                    socketId
                );

            } catch (error) {

                console.error(
                    "Could not create student peer:",
                    error
                );

            }

        }
    );


    proctoringSocket.on(
        "webrtc:answer",
        async ({
            answer
        }) => {

            try {

                if (
                    !studentPeerConnection
                ) {
                    return;
                }

                await studentPeerConnection
                    .setRemoteDescription(
                        answer
                    );

                await flushPendingIce();

            } catch (error) {

                console.error(
                    "WebRTC answer error:",
                    error
                );

            }

        }
    );


    proctoringSocket.on(
        "webrtc:ice-candidate",
        async ({
            candidate
        }) => {

            if (!candidate) {
                return;
            }

            try {

                if (
                    studentPeerConnection &&
                    studentPeerConnection
                        .remoteDescription
                ) {

                    await studentPeerConnection
                        .addIceCandidate(
                            candidate
                        );

                } else {

                    pendingIceCandidates.push(
                        candidate
                    );

                }

            } catch (error) {

                console.error(
                    "Student ICE error:",
                    error
                );

            }

        }
    );


    proctoringSocket.on(
    "teacher:left",
    () => {

        teacherSocketId = null;

        closeStudentPeer();

        closeTeacherVoicePeer();

    }
);


proctoringSocket.on(
    "teacher:voice-offer",
    async ({
        fromSocketId,
        offer
    }) => {

        try {

            await handleTeacherVoiceOffer(
                fromSocketId,
                offer
            );

        } catch (error) {

            console.error(
                "Teacher voice offer error:",
                error
            );

        }

    }
);


proctoringSocket.on(
    "teacher:voice-ice",
    async ({
        candidate
    }) => {

        if (!candidate) {
            return;
        }

        try {

            if (
                teacherVoicePeerConnection &&
                teacherVoicePeerConnection
                    .remoteDescription
            ) {

                await teacherVoicePeerConnection
                    .addIceCandidate(
                        candidate
                    );

            } else {

                teacherVoicePendingIceCandidates
                    .push(candidate);

            }

        } catch (error) {

            console.error(
                "Teacher voice ICE error:",
                error
            );

        }

    }
);


proctoringSocket.on(
    "teacher:voice-stop",
    () => {

        closeTeacherVoicePeer();

    }
);


    proctoringSocket.on(
        "socket:error",
        data => {

            console.warn(
                "Proctoring socket:",
                data?.message
            );

        }
    );


    proctoringSocket.on(
        "disconnect",
        () => {

            console.warn(
                "Proctoring socket disconnected."
            );

            stopHeartbeat();

        }
    );

}



/* =========================================================
   TEACHER VOICE PEER
========================================================= */

function closeTeacherVoicePeer() {

    if (teacherVoicePeerConnection) {

        try {

            teacherVoicePeerConnection.close();

        } catch (error) {

            console.error(
                error
            );

        }

    }

    teacherVoicePeerConnection =
        null;

    teacherVoicePendingIceCandidates =
        [];

    if (teacherVoiceAudioSource) {

        try {

            teacherVoiceAudioSource.disconnect();

        } catch (error) {}

    }

    teacherVoiceAudioSource =
        null;

    const audio =
        document.getElementById(
            "teacherVoiceAudio"
        );

    if (audio) {

        try {

            audio.pause();

        } catch (error) {}

        audio.srcObject =
            null;

    }

}


function getTeacherVoiceAudioElement() {

    let audio =
        document.getElementById(
            "teacherVoiceAudio"
        );

    if (!audio) {

        audio =
            document.createElement(
                "audio"
            );

        audio.id =
            "teacherVoiceAudio";

        audio.autoplay =
            true;

        audio.playsInline =
            true;

        audio.style.display =
            "none";

        document.body.appendChild(
            audio
        );

    }

    return audio;

}


async function handleTeacherVoiceOffer(
    fromSocketId,
    offer
) {

    if (
        !secureModeStarted ||
        !proctoringSocket ||
        !offer
    ) {
        return;
    }

    closeTeacherVoicePeer();

    teacherVoicePendingIceCandidates =
        [];

    teacherVoicePeerConnection =
        new RTCPeerConnection(
            WEBRTC_CONFIG
        );


    teacherVoicePeerConnection.ontrack =
        event => {

            const stream =
                event.streams &&
                event.streams[0]
                    ? event.streams[0]
                    : new MediaStream([
                        event.track
                    ]);


            if (
                teacherVoiceAudioContext
            ) {

                if (
                    teacherVoiceAudioContext
                        .state ===
                    "suspended"
                ) {

                    teacherVoiceAudioContext
                        .resume()
                        .catch(
                            console.warn
                        );

                }

                if (
                    teacherVoiceAudioSource
                ) {

                    try {

                        teacherVoiceAudioSource
                            .disconnect();

                    } catch (error) {}

                }

                teacherVoiceAudioSource =
                    teacherVoiceAudioContext
                        .createMediaStreamSource(
                            stream
                        );

                teacherVoiceAudioSource
                    .connect(
                        teacherVoiceAudioContext
                            .destination
                    );

            } else {

                const audio =
                    getTeacherVoiceAudioElement();

                audio.srcObject =
                    stream;

                audio.play().catch(
                    error => {

                        console.warn(
                            "Teacher voice playback:",
                            error
                        );

                    }
                );

            }

        };


    teacherVoicePeerConnection.onicecandidate =
        event => {

            if (
                event.candidate &&
                proctoringSocket
            ) {

                proctoringSocket.emit(
                    "teacher:voice-ice",
                    {
                        targetSocketId:
                            fromSocketId,

                        candidate:
                            event.candidate
                    }
                );

            }

        };


    teacherVoicePeerConnection
        .onconnectionstatechange =
        () => {

            const state =
                teacherVoicePeerConnection
                    ?.connectionState;

            if (
                state === "failed" ||
                state === "closed"
            ) {

                closeTeacherVoicePeer();

            }

        };


    await teacherVoicePeerConnection
        .setRemoteDescription(
            offer
        );


    const queued =
        teacherVoicePendingIceCandidates
            .splice(0);


    for (
        const candidate
        of queued
    ) {

        try {

            await teacherVoicePeerConnection
                .addIceCandidate(
                    candidate
                );

        } catch (error) {

            console.warn(
                "Teacher voice queued ICE:",
                error
            );

        }

    }


    const answer =
        await teacherVoicePeerConnection
            .createAnswer();


    await teacherVoicePeerConnection
        .setLocalDescription(
            answer
        );


    proctoringSocket.emit(
        "teacher:voice-answer",
        {
            targetSocketId:
                fromSocketId,

            answer
        }
    );

}


/* =========================================================
   CREATE STUDENT PEER
========================================================= */

async function createStudentPeer(
    targetSocketId
) {

    if (
        !cameraStream ||
        !proctoringSocket
    ) {
        return;
    }


    closeStudentPeer();


    pendingIceCandidates =
        [];


    studentPeerConnection =
        new RTCPeerConnection(
            WEBRTC_CONFIG
        );


    cameraStream
        .getTracks()
        .forEach(track => {

            studentPeerConnection.addTrack(
                track,
                cameraStream
            );

        });


    studentPeerConnection.onicecandidate =
        event => {

            if (
                event.candidate &&
                proctoringSocket &&
                targetSocketId
            ) {

                proctoringSocket.emit(
                    "webrtc:ice-candidate",
                    {

                        targetSocketId,

                        candidate:
                            event.candidate

                    }
                );

            }

        };


    studentPeerConnection.onconnectionstatechange =
        () => {

            const state =
                studentPeerConnection
                    .connectionState;

            console.log(
                "Student WebRTC state:",
                state
            );

        };


    const offer =
        await studentPeerConnection
            .createOffer();

    await studentPeerConnection
        .setLocalDescription(
            offer
        );


    proctoringSocket.emit(
        "webrtc:offer",
        {

            targetSocketId,

            offer

        }
    );

}


/* =========================================================
   FLUSH ICE
========================================================= */

async function flushPendingIce() {

    if (
        !studentPeerConnection ||
        !studentPeerConnection
            .remoteDescription
    ) {
        return;
    }


    const candidates =
        pendingIceCandidates
            .splice(0);


    for (
        const candidate
        of candidates
    ) {

        try {

            await studentPeerConnection
                .addIceCandidate(
                    candidate
                );

        } catch (error) {

            console.error(
                "Pending ICE error:",
                error
            );

        }

    }

}


/* =========================================================
   CLOSE STUDENT PEER
========================================================= */

function closeStudentPeer() {

    if (
        studentPeerConnection
    ) {

        try {

            studentPeerConnection.close();

        } catch (error) {

            console.error(error);

        }

    }

    studentPeerConnection =
        null;

    pendingIceCandidates =
        [];

}


/* =========================================================
   HEARTBEAT
========================================================= */

function startHeartbeat() {

    stopHeartbeat();


    const send =
        () => {

            if (
                !proctoringSocket ||
                !proctoringSocket.connected
            ) {
                return;
            }


            const videoTrack =
                cameraStream
                    ?.getVideoTracks()[0];

            const audioTrack =
                cameraStream
                    ?.getAudioTracks()[0];


            proctoringSocket.emit(
                "student:heartbeat",
                {

                    attemptId,

                    cameraConnected:
                        Boolean(
                            videoTrack &&
                            videoTrack.readyState ===
                                "live"
                        ),

                    microphoneConnected:
                        Boolean(
                            audioTrack &&
                            audioTrack.readyState ===
                                "live"
                        ),

                    fullscreenActive:
                        Boolean(
                            document.fullscreenElement
                        )

                }
            );

        };


    send();


    heartbeatHandle =
        setInterval(
            send,
            5000
        );

}


/* =========================================================
   STOP HEARTBEAT
========================================================= */

function stopHeartbeat() {

    if (
        heartbeatHandle
    ) {

        clearInterval(
            heartbeatHandle
        );

        heartbeatHandle =
            null;

    }

}


/* =========================================================
   REPORT PROCTORING EVENT
========================================================= */

async function reportProctoringEvent(
    type,
    details,
    severity = "medium"
) {

    if (
        !attemptId ||
        !exam
    ) {
        return;
    }


    const payload = {

        attemptId,

        type,

        severity,

        details

    };


    if (
        proctoringSocket &&
        proctoringSocket.connected
    ) {

        proctoringSocket.emit(
            "proctoring:event",
            payload
        );

    }


    // REST fallback
    try {

        await fetch(
            `/api/exams/${encodeURIComponent(
                exam.id
            )}/proctoring-event`,
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
                    ),

                keepalive:
                    true

            }
        );

    } catch (error) {

        console.warn(
            "Proctoring event fallback failed:",
            error
        );

    }

}


/* =========================================================
   REPORT SECURITY REASON
========================================================= */

function getProctoringType(
    reason
) {

    const value =
        String(
            reason || ""
        ).toLowerCase();


    if (
        value.includes(
            "switch"
        )
    ) {
        return "TAB_SWITCH";
    }

    if (
        value.includes(
            "fullscreen"
        )
    ) {
        return "FULLSCREEN_EXIT";
    }

    if (
        value.includes(
            "focus"
        )
    ) {
        return "WINDOW_BLUR";
    }

    if (
        value.includes(
            "camera"
        )
    ) {
        return "CAMERA_DISCONNECTED";
    }

    if (
        value.includes(
            "microphone"
        )
    ) {
        return "MICROPHONE_DISCONNECTED";
    }

    return "SECURITY_WARNING";
}


/* =========================================================
   MICROPHONE STATUS
========================================================= */

function updateMicrophoneStatus(
    active
) {

    const status =
        document.getElementById(
            "microphoneStatus"
        );

    if (!status) {
        return;
    }


    if (active) {

        status.innerHTML =
            `
            <i class="fa-solid fa-microphone"></i>
            Microphone Active
            `;

        status.classList.remove(
            "inactive"
        );

    } else {

        status.innerHTML =
            `
            <i class="fa-solid fa-microphone-slash"></i>
            Microphone Inactive
            `;

        status.classList.add(
            "inactive"
        );

    }

}