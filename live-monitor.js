
const examId =
    new URLSearchParams(
        window.location.search
    ).get("examId");


    console.log(
    "LIVE MONITOR URL:",
    window.location.href
);

console.log(
    "LIVE MONITOR EXAM ID:",
    examId
);


let teacherUser = null;

let monitorSocket = null;

const students =
    new Map();

const peerConnections =
    new Map();

const pendingCandidates =
    new Map();

const pendingOffers =
    new Map();    

    const SECURITY_ALERT_TYPES =
    new Set([
        "TAB_SWITCH",
        "FULLSCREEN_EXIT",
        "CAMERA_DISCONNECTED",
        "MICROPHONE_DISCONNECTED",
        "FACE_MISSING",
        "MULTIPLE_PERSONS",
        "PHONE_DETECTED",
        "AUDIO_ACTIVITY",
        "WINDOW_BLUR"
    ]);


function updateMonitorCounts() {

    let joined = 0;
    let submitted = 0;

    const alertStudents =
        new Set();

    students.forEach(
        attempt => {

            if (
                !attempt ||
                !attempt.attemptId
            ) {
                return;
            }

            joined++;

            if (
                attempt.status ===
                    "submitted" ||
                attempt.status ===
                    "auto-submitted"
            ) {
                submitted++;
            }

            if (
                Number(
                    attempt.violationCount ||
                    0
                ) > 0
            ) {

                alertStudents.add(
                    String(
                        attempt.studentId ||
                        attempt.attemptId
                    )
                );

            }

        }
    );


    const joinedElement =
        document.getElementById(
            "joinedCount"
        );

    if (joinedElement) {

        joinedElement.textContent =
            joined;

    }


    const submittedElement =
        document.getElementById(
            "submittedCount"
        );

    if (submittedElement) {

        submittedElement.textContent =
            submitted;

    }


    const alertElement =
        document.getElementById(
            "alertCount"
        );

    if (alertElement) {

        alertElement.textContent =
            alertStudents.size;

    }

}

let teacherVoiceStream = null;

let teacherVoicePeerConnection = null;

let teacherVoicePendingCandidates = [];

let speakingAttemptId = null;

let speakingTargetSocketId = null;

let liveAudioUnlocked = false;




const WEBRTC_CONFIG = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        }

    ]

};


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


function formatDate(
    value
) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "-";
    }

    return date.toLocaleString();

}


/* =========================================================
   API
========================================================= */

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials:
                    "include",

                ...options
            }
        );

    const data =
        await response
            .json()
            .catch(
                () => ({})
            );

    if (
        !response.ok
    ) {

        throw new Error(
            data.message ||
            "Request failed."
        );

    }

    return data;
}


/* =========================================================
   AUTH
========================================================= */

async function authenticate() {

    const data =
        await api(
            "/api/me"
        );

    if (
        !data.loggedIn ||
        !data.user
    ) {

        window.location.href =
            "/loginPrem.html";

        return false;
    }

    if (
        data.user.role !==
        "teacher"
    ) {

        window.location.href =
            "/student-dashboard.html";

        return false;
    }

    teacherUser =
        data.user;

    return true;
}


/* =========================================================
   LOAD LIVE DATA
========================================================= */

async function loadLiveData() {

    if (!examId) {

        throw new Error(
            "No exam selected."
        );

    }


    const data =
        await api(
            `/api/teacher/exams/${encodeURIComponent(examId)}/live`
        );


    document.getElementById(
        "examName"
    ).textContent =
        data.exam.title;


    document.getElementById(
        "examSchedule"
    ).textContent =
        `${formatDate(
            data.exam.scheduledAt
        )} → ${formatDate(
            data.exam.sessionEndsAt
        )}`;


    document.getElementById(
        "joinedCount"
    ).textContent =
        data.stats.joined || 0;


    document.getElementById(
        "submittedCount"
    ).textContent =
        data.stats.submitted || 0;


    document.getElementById(
        "alertCount"
    ).textContent =
        data.stats.alerts || 0;


    (
        data.attempts || []
    ).forEach(
        attempt => {

            const key =
                String(
                    attempt.attemptId
                );


            const current =
                students.get(
                    key
                ) || {};


            const merged = {
                ...current,
                ...attempt
            };


            students.set(
                key,
                merged
            );


            renderStudentCard(
                merged
            );

        }
    );


    renderAlerts(
        data.events || []
    );

    updateMonitorCounts();


    updateLiveIndicator(
        data.exam.sessionState
    );

}


/* =========================================================
   LIVE INDICATOR
========================================================= */

function updateLiveIndicator(
    state
) {

    const element =
        document.getElementById(
            "liveIndicator"
        );

    if (!element) {
        return;
    }

    if (
        state === "live"
    ) {

        element.innerHTML =
            `<span></span> LIVE`;

    } else if (
        state === "upcoming"
    ) {

        element.innerHTML =
            `<span style="background:#ffd26d"></span> UPCOMING`;

    } else {

        element.innerHTML =
            `<span style="background:#8792a7"></span> ENDED`;
    }

}


function renderStudentCard(
    attempt
) {

    const grid =
        document.getElementById(
            "studentsGrid"
        );

    if (!grid) {
        return;
    }


    const emptyState =
        document.getElementById(
            "studentsEmptyState"
        );

    if (emptyState) {
        emptyState.remove();
    }


    const key =
        String(
            attempt.attemptId
        );


    let card =
        document.querySelector(
            `[data-attempt-id="${key}"]`
        );


    if (!card) {

        card =
            document.createElement(
                "article"
            );

        card.className =
            "student-card";

        card.dataset.attemptId =
            key;


        card.innerHTML = `

            <div class="student-video-wrap">

                <video
                    class="student-video"
                    autoplay
                    playsinline
                    muted
                ></video>

                <div class="student-media-status">
    <span>
        📹 Camera: Waiting...
    </span>

    <span>
        🎤 Mic: Waiting...
    </span>
</div>


               <div
    class="student-offline"
    style="display:flex"
>
    Waiting for camera and microphone...
</div>


                <div class="student-overlay">

                    <span
                        class="student-status"
                        data-status
                    >
                        Connecting
                    </span>

                </div>

            </div>


            <div class="student-card-body">

                <div class="student-card-title">

                    <strong data-name>
                        Student
                    </strong>

                    <small data-username>
                        -
                    </small>

                </div>


                <div class="student-meta">

                    <div data-camera>
                        Camera: -
                    </div>

                    <div data-mic>
                        Mic: -
                    </div>

                    <div data-fullscreen>
                        Fullscreen: -
                    </div>

                    <div data-alerts>
                        Alerts: 0
                    </div>

                </div>


                <div class="student-controls">

                    <button
                        type="button"
                        data-view
                    >
                        <i class="fa-solid fa-eye"></i>
                        Select
                    </button>


                    <button
                        type="button"
                        data-listen
                    >
                        <i class="fa-solid fa-volume-high"></i>
                        Listen
                    </button>


                    <button
                        type="button"
                        data-speak
                    >
                        <i class="fa-solid fa-microphone"></i>
                        Speak
                    </button>

                </div>

            </div>


            <audio
                class="monitor-audio"
                playsinline
            ></audio>

        `;


        grid.appendChild(card);


        const video =
            card.querySelector(
                ".student-video"
            );


        const audio =
            card.querySelector(
                ".monitor-audio"
            );


        students.set(
            key,
            {
                ...(students.get(key) || {}),
                ...attempt,
                video,
                audio
            }
        );


        const viewButton =
            card.querySelector(
                "[data-view]"
            );


        const listenButton =
            card.querySelector(
                "[data-listen]"
            );


        const speakButton =
            card.querySelector(
                "[data-speak]"
            );


        if (viewButton) {

            viewButton.addEventListener(
                "click",
                () => {

                    const current =
                        students.get(key);

                    if (current) {
                        selectStudent(current);
                    }

                }
            );

        }


        if (listenButton) {

            listenButton.addEventListener(
                "click",
                () => {

                    listenToStudent(key);

                }
            );

        }


        if (speakButton) {

            speakButton.addEventListener(
                "click",
                async event => {

                    const button =
                        event.currentTarget;


                    if (
                        String(
                            speakingAttemptId
                        ) ===
                        String(key)
                    ) {

                        stopTeacherVoice();

                        return;

                    }


                    try {

                        await startTeacherVoice(
                            key,
                            button
                        );

                    } catch (error) {

                        console.error(
                            "Teacher voice:",
                            error
                        );

                        stopTeacherVoice();

                        alert(
                            error.message ||
                            "Could not start the teacher microphone."
                        );

                    }

                }
            );

        }

    }


    const current =
        students.get(key) || {};


    const merged =
        {
            ...current,
            ...attempt
        };


    students.set(
        key,
        merged
    );


    const status =
        card.querySelector(
            "[data-status]"
        );


    const camera =
        card.querySelector(
            "[data-camera]"
        );


    const mic =
        card.querySelector(
            "[data-mic]"
        );


    const fullscreen =
        card.querySelector(
            "[data-fullscreen]"
        );


    const alerts =
        card.querySelector(
            "[data-alerts]"
        );


    const name =
        card.querySelector(
            "[data-name]"
        );


    const username =
        card.querySelector(
            "[data-username]"
        );


    const isDisconnected =
        attempt.status ===
        "disconnected";


    const hasAlerts =
        Number(
            attempt.violationCount || 0
        ) > 0;


    if (status) {

        status.textContent =
            isDisconnected
                ? "Disconnected"
                : hasAlerts
                    ? "Warning"
                    : (
                        attempt.status ===
                        "submitted" ||
                        attempt.status ===
                        "auto-submitted"
                    )
                        ? "Submitted"
                        : "Normal";


        status.className =
            `student-status ${
                isDisconnected
                    ? "danger"
                    : hasAlerts
                        ? "warning"
                        : ""
            }`;

    }


    if (name) {

        name.textContent =
            attempt.studentName ||
            "Student";

    }


    if (username) {

        username.textContent =
            attempt.username ||
            "";

    }


    if (camera) {

        camera.textContent =
            `Camera: ${
                attempt.cameraConnected
                    ? "Connected"
                    : "Off"
            }`;

    }


    if (mic) {

        mic.textContent =
            `Mic: ${
                attempt.microphoneConnected
                    ? "Connected"
                    : "Off"
            }`;

    }


    if (fullscreen) {

        fullscreen.textContent =
            `Fullscreen: ${
                attempt.fullscreenActive
                    ? "Active"
                    : "Not active"
            }`;

    }


    if (alerts) {

        alerts.textContent =
            `Alerts: ${
                attempt.violationCount || 0
            }`;

    }


    const offline =
        card.querySelector(
            ".student-offline"
        );


    if (
        offline &&
        attempt.status !==
        "disconnected"
    ) {

        offline.style.display =
            "flex";

    }


    if (
        attempt.status ===
        "submitted" ||
        attempt.status ===
        "auto-submitted"
    ) {

        if (offline) {
            offline.style.display =
                "none";
        }

    }

}

/* =========================================================
   SELECT STUDENT
========================================================= */

function selectStudent(
    attempt
) {

    const selected =
        document.getElementById(
            "selectedStudent"
        );

    if (!selected) {
        return;
    }

    selected.innerHTML = `

        <span>
            SELECTED STUDENT
        </span>

        <h3>
            ${escapeHtml(
                attempt.studentName ||
                "Student"
            )}
        </h3>

        <p>
            Started:
            ${formatDate(
                attempt.startedAt
            )}
        </p>

        <p>
            Camera:
            ${
                attempt.cameraConnected
                    ? "Connected"
                    : "Not connected"
            }
        </p>

        <p>
            Microphone:
            ${
                attempt.microphoneConnected
                    ? "Connected"
                    : "Not connected"
            }
        </p>

        <p>
            Fullscreen:
            ${
                attempt.fullscreenActive
                    ? "Active"
                    : "Not active"
            }
        </p>

        <p>
            Proctoring Alerts:
            ${
                attempt.violationCount ||
                0
            }
        </p>
    `;

}


/* =========================================================
   LISTEN TO STUDENT
========================================================= */

async function listenToStudent(
    attemptId
) {

    document
        .querySelectorAll(
            ".monitor-audio"
        )
        .forEach(
            audio => {

                audio.pause();

                audio.muted =
                    true;

            }
        );


    document
        .querySelectorAll(
            "[data-listen]"
        )
        .forEach(
            button => {

                button.classList.remove(
                    "listen-active"
                );

            }
        );


    const card =
        document.querySelector(
            `[data-attempt-id="${attemptId}"]`
        );


    if (!card) {
        return;
    }


    const audio =
        card.querySelector(
            ".monitor-audio"
        );


    const button =
        card.querySelector(
            "[data-listen]"
        );


    if (!audio) {
    return;
}


const current =
    students.get(
        String(
            attemptId
        )
    );

if (
    current?.mediaStream &&
    !audio.srcObject
) {

    audio.srcObject =
        current.mediaStream;

}

audio.muted =
    false;

audio.volume =
    1;


    try {

        await audio.play();

        if (button) {

            button.classList.add(
                "listen-active"
            );

        }

    } catch (error) {

        console.error(
            "Student audio playback error:",
            error
        );


        alert(
            "The student's microphone stream is not ready yet. Please wait a moment and click Listen again."
        );

    }

}


/* =========================================================
   TEACHER VOICE
========================================================= */

function findStudentSocketId(
    attemptId
) {

    const student =
        students.get(
            String(attemptId)
        );

    if (
        student?.socketId
    ) {

        return student.socketId;

    }


    for (
        const [
            socketId,
            peer
        ]
        of peerConnections.entries()
    ) {

        if (
            String(
                peer.attemptId
            ) ===
            String(
                attemptId
            )
        ) {

            return socketId;

        }

    }

    return null;

}


function resetSpeakButtons() {

    document
        .querySelectorAll(
            "[data-speak]"
        )
        .forEach(
            button => {

                button.innerHTML =
                    `
                    <i class="fa-solid fa-microphone"></i>
                    Speak
                    `;

                button.classList.remove(
                    "listen-active"
                );

            }
        );

}


async function startTeacherVoice(
    attemptId,
    button
) {

    const targetSocketId =
        findStudentSocketId(
            attemptId
        );

    if (!targetSocketId) {

        throw new Error(
            "Student connection is not ready. Wait a moment and try again."
        );

    }


    stopTeacherVoice();


    teacherVoiceStream =
        await navigator.mediaDevices
            .getUserMedia({
                audio: true,
                video: false
            });


    teacherVoicePendingCandidates =
        [];


    teacherVoicePeerConnection =
        new RTCPeerConnection(
            WEBRTC_CONFIG
        );


    teacherVoiceStream
        .getAudioTracks()
        .forEach(
            track => {

                teacherVoicePeerConnection
                    .addTrack(
                        track,
                        teacherVoiceStream
                    );

            }
        );


    speakingAttemptId =
        String(attemptId);

    speakingTargetSocketId =
        targetSocketId;


    teacherVoicePeerConnection
        .onicecandidate =
        event => {

            if (
                event.candidate &&
                monitorSocket
            ) {

                monitorSocket.emit(
                    "teacher:voice-ice",
                    {
                        targetSocketId,

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

                stopTeacherVoice();

            }

        };


    const offer =
        await teacherVoicePeerConnection
            .createOffer();


    await teacherVoicePeerConnection
        .setLocalDescription(
            offer
        );


    monitorSocket.emit(
        "teacher:voice-offer",
        {
            targetSocketId,

            offer
        }
    );


    resetSpeakButtons();

    if (button) {

        button.innerHTML =
            `
            <i class="fa-solid fa-microphone-slash"></i>
            Stop Speaking
            `;

        button.classList.add(
            "listen-active"
        );

    }

}


async function flushTeacherVoiceCandidates() {

    if (
        !teacherVoicePeerConnection ||
        !teacherVoicePeerConnection
            .remoteDescription
    ) {
        return;
    }


    const candidates =
        teacherVoicePendingCandidates
            .splice(0);


    for (
        const candidate
        of candidates
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

}


function stopTeacherVoice() {

    if (
        monitorSocket &&
        speakingTargetSocketId
    ) {

        monitorSocket.emit(
            "teacher:voice-stop",
            {
                targetSocketId:
                    speakingTargetSocketId
            }
        );

    }


    if (teacherVoiceStream) {

        teacherVoiceStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

    }

    teacherVoiceStream =
        null;


    if (
        teacherVoicePeerConnection
    ) {

        try {

            teacherVoicePeerConnection
                .close();

        } catch (error) {}

    }

    teacherVoicePeerConnection =
        null;

    teacherVoicePendingCandidates =
        [];

    speakingAttemptId =
        null;

    speakingTargetSocketId =
        null;

    resetSpeakButtons();

}


/* =========================================================
   UNLOCK LIVE STUDENT AUDIO
========================================================= */

async function unlockLiveAudio() {

    const audios =
        document.querySelectorAll(
            ".monitor-audio"
        );

    let success = false;

    for (
        const audio of audios
    ) {

        try {

            audio.muted = false;

            audio.volume = 1;

            await audio.play();

            success = true;

        } catch (error) {

            console.warn(
                "Audio still blocked:",
                error
            );

        }

    }

    if (success) {

        liveAudioUnlocked = true;

        console.log(
            "🔊 Live student audio enabled."
        );

    }

}




/* =========================================================
   ATTACH MEDIA
========================================================= */

function attachMedia(
    studentSocketId,
    stream
) {

    const peer =
        peerConnections.get(
            studentSocketId
        );


    if (!peer) {
        return;
    }


    const attemptId =
        String(
            peer.attemptId
        );


    const card =
        document.querySelector(
            `[data-attempt-id="${attemptId}"]`
        );


    if (!card) {
        return;
    }


    const video =
        card.querySelector(
            ".student-video"
        );


    const audio =
        card.querySelector(
            ".monitor-audio"
        );


    const offline =
        card.querySelector(
            ".student-offline"
        );


    if (video) {

        video.srcObject =
            stream;

        video.muted =
            true;

        video.autoplay =
            true;

        video.playsInline =
            true;

        video.play().catch(
            error => {

                console.warn(
                    "Student video playback:",
                    error
                );

            }
        );

    }


    if (audio) {

    audio.srcObject =
        stream;

    audio.muted =
        false;

    audio.autoplay =
        true;

    audio.playsInline =
        true;

    audio.volume =
        1;

    audio.setAttribute(
        "playsinline",
        ""
    );

    audio.play().catch(error => {

        console.warn(
            "Student microphone autoplay was blocked:",
            error
        );

    });

}


const mediaStatus =
    card.querySelector(
        ".student-media-status"
    );

if (mediaStatus) {

    const videoTrack =
        stream.getVideoTracks()[0];

    const audioTrack =
        stream.getAudioTracks()[0];

    mediaStatus.innerHTML = `
        <span>
            📹 Camera:
            ${
                videoTrack &&
                videoTrack.readyState === "live"
                    ? "LIVE"
                    : "OFF"
            }
        </span>

        <span>
            🎤 Mic:
            ${
                audioTrack &&
                audioTrack.readyState === "live"
                    ? "LIVE"
                    : "OFF"
            }
        </span>
    `;
}

    const current =
        students.get(
            attemptId
        ) || {};


    students.set(
        attemptId,
        {
            ...current,
            mediaStream:
                stream,
            video,
            audio
        }
    );


    if (offline) {

        offline.style.display =
            "none";

    }

}

/* =========================================================
   CREATE TEACHER PEER
========================================================= */

async function handleOffer(
    fromSocketId,
    offer,
    attempt
) {

    if (
        !fromSocketId ||
        !offer ||
        !attempt
    ) {
        console.error(
            "❌ Invalid WebRTC offer."
        );

        return;
    }


    /*
     * Close an old connection
     * from this student if present.
     */
    const oldPeer =
        peerConnections.get(
            fromSocketId
        );


    if (oldPeer) {

        try {
            oldPeer.pc.close();
        } catch (error) {}

        peerConnections.delete(
            fromSocketId
        );

    }


    const pc =
        new RTCPeerConnection(
            WEBRTC_CONFIG
        );


    const mediaStream =
        new MediaStream();


    peerConnections.set(
        fromSocketId,
        {
            pc,
            attemptId:
                String(
                    attempt.attemptId
                ),
            mediaStream
        }
    );


    if (
        !pendingCandidates.has(
            fromSocketId
        )
    ) {

        pendingCandidates.set(
            fromSocketId,
            []
        );

    }


    /*
     * RECEIVE STUDENT CAMERA + MICROPHONE
     */
    pc.ontrack =
        event => {

            console.log(
                "🎥 Teacher received student track:",
                event.track.kind,
                "student:",
                attempt.studentName
            );


            const peer =
                peerConnections.get(
                    fromSocketId
                );


            if (!peer) {
                return;
            }


            if (
                !peer.mediaStream
            ) {

                peer.mediaStream =
                    new MediaStream();

            }


            const exists =
                peer.mediaStream
                    .getTracks()
                    .some(
                        track =>
                            track.id ===
                            event.track.id
                    );


            if (!exists) {

                peer.mediaStream.addTrack(
                    event.track
                );

            }


            /*
             * Attach both:
             * video track
             * audio track
             */
            attachMedia(
                fromSocketId,
                peer.mediaStream
            );

        };


    /*
     * Teacher → student ICE
     */
    pc.onicecandidate =
        event => {

            if (
                !event.candidate ||
                !monitorSocket
            ) {
                return;
            }


            monitorSocket.emit(
                "webrtc:ice-candidate",
                {
                    targetSocketId:
                        fromSocketId,

                    candidate:
                        event.candidate
                }
            );

        };


    pc.onconnectionstatechange =
        () => {

            const state =
                pc.connectionState;


            console.log(
                "👨‍🏫 Teacher WebRTC:",
                state,
                "student:",
                attempt.studentName
            );


            const card =
                document.querySelector(
                    `[data-attempt-id="${attempt.attemptId}"]`
                );


            const offline =
                card?.querySelector(
                    ".student-offline"
                );


            if (
                state === "connected"
            ) {

                if (offline) {
                    offline.style.display =
                        "none";
                }


                console.log(
                    "✅ LIVE CAMERA + MICROPHONE CONNECTED:",
                    attempt.studentName
                );

            }


            if (
                state === "failed" ||
                state === "disconnected" ||
                state === "closed"
            ) {

                if (offline) {

                    offline.style.display =
                        "flex";

                    offline.textContent =
                        "Camera or microphone connection lost.";

                }

            }

        };


    /*
     * Set student's offer.
     */
    await pc.setRemoteDescription(
        offer
    );


    /*
     * Add ICE candidates that
     * arrived before the offer.
     */
    const queued =
        pendingCandidates
            .get(fromSocketId) || [];


    for (
        const candidate
        of queued
    ) {

        try {

            await pc.addIceCandidate(
                candidate
            );

        } catch (error) {

            console.warn(
                "Queued ICE error:",
                error
            );

        }

    }


    pendingCandidates.set(
        fromSocketId,
        []
    );


    /*
     * Send answer back to student.
     */
    const answer =
        await pc.createAnswer();


    await pc.setLocalDescription(
        answer
    );


    monitorSocket.emit(
        "webrtc:answer",
        {
            targetSocketId:
                fromSocketId,

            answer
        }
    );


    console.log(
        "📤 Teacher sent WebRTC answer:",
        attempt.studentName
    );

}

/* =========================================================
   SOCKET
========================================================= */

function connectMonitorSocket() {

    monitorSocket =
        io({
            withCredentials:
                true
        });


    monitorSocket.on(
        "connect",
        () => {

            monitorSocket.emit(
                "joinExam",
                {
                    examId
                }
            );

        }
    );


    monitorSocket.on(
    "student:joined",
    async attempt => {

        const key =
            String(
                attempt.attemptId
            );

        const current =
    students.get(
        key
    ) || {};

const updated = {
    ...current,
    ...attempt
};

students.set(
    key,
    updated
);

renderStudentCard(
    updated
);

updateMonitorCounts();

const pending =
    pendingOffers.get(
        key
    );

if (!pending) {
    return;
}

pendingOffers.delete(
    key
);

const joinedStudent =
    students.get(
        key
    );

if (joinedStudent) {

    joinedStudent.socketId =
        pending.fromSocketId;

    students.set(
        key,
        joinedStudent
    );

}

try {

    await handleOffer(
        pending.fromSocketId,
        pending.offer,
        joinedStudent
    );

} catch (error) {

    console.error(
        "Pending WebRTC offer error:",
        error
    );

}

    }
);

    monitorSocket.on(
        "student:status",
        status => {

            const key =
                String(
                    status.attemptId
                );


            const current =
                students.get(
                    key
                ) || {};


            const updated = {

                ...current,

                ...status

            };


            students.set(
                key,
                updated
            );


            renderStudentCard(
                updated
            );

        }
    );


    monitorSocket.on(
        "student:left",
        data => {

            const key =
                String(
                    data.attemptId
                );

                pendingOffers.delete(
    key
);


                if (
    String(
        speakingAttemptId
    ) ===
    String(key)
) {

    stopTeacherVoice();

}
            const current =
                students.get(
                    key
                );

            if (!current) {
                return;
            }


            const updated = {

                ...current,

                status:
                    "disconnected"

            };


            students.set(
    key,
    updated
);

renderStudentCard(
    updated
);

updateMonitorCounts();

        }
    );

        // =========================================
        // TEACHER VOICE ANSWER
        // =========================================

        monitorSocket.on(
            "teacher:voice-answer",
            async ({
                answer
            }) => {

                if (
                    !teacherVoicePeerConnection ||
                    !answer
                ) {
                    return;
                }

                try {

                    await teacherVoicePeerConnection
                        .setRemoteDescription(
                            answer
                        );

                    await flushTeacherVoiceCandidates();

                } catch (error) {

                    console.error(
                        "Teacher voice answer:",
                        error
                    );

                }

            }
        );


        // =========================================
        // TEACHER VOICE ICE
        // =========================================

        monitorSocket.on(
            "teacher:voice-ice",
            async ({
                candidate
            }) => {

                if (!candidate) {
                    return;
                }

                if (
                    teacherVoicePeerConnection &&
                    teacherVoicePeerConnection
                        .remoteDescription
                ) {

                    try {

                        await teacherVoicePeerConnection
                            .addIceCandidate(
                                candidate
                            );

                    } catch (error) {

                        console.warn(
                            "Teacher voice ICE:",
                            error
                        );

                    }

                } else {

                    teacherVoicePendingCandidates
                        .push(candidate);

                }

            }
        );


    monitorSocket.on(
    "webrtc:offer",
    async ({
        fromSocketId,
        offer,
        studentId,
        attemptId
    }) => {

        console.log(
            "📥 Teacher received WebRTC offer:",
            fromSocketId
        );

        if (
            !fromSocketId ||
            !offer ||
            !attemptId
        ) {
            return;
        }

        const key =
            String(
                attemptId
            );

        const matching =
            students.get(
                key
            );

        if (!matching) {

            pendingOffers.set(
                key,
                {
                    fromSocketId,
                    offer,
                    studentId
                }
            );

            console.log(
                "WebRTC offer queued until student card exists:",
                key
            );

            return;
        }

        matching.socketId =
            fromSocketId;

        students.set(
            key,
            matching
        );

        try {

            await handleOffer(
                fromSocketId,
                offer,
                matching
            );

        } catch (error) {

            console.error(
                "Teacher WebRTC offer error:",
                error
            );

        }

    }
);

    monitorSocket.on(
        "webrtc:ice-candidate",
        async ({
            fromSocketId,
            candidate
        }) => {

            const peer =
                peerConnections.get(
                    fromSocketId
                );


            if (
                !peer
            ) {

                if (
                    !pendingCandidates.has(
                        fromSocketId
                    )
                ) {

                    pendingCandidates.set(
                        fromSocketId,
                        []
                    );

                }

                pendingCandidates
                    .get(
                        fromSocketId
                    )
                    .push(
                        candidate
                    );

                return;
            }


            if (
                peer.pc.remoteDescription
            ) {

                try {

                    await peer.pc
                        .addIceCandidate(
                            candidate
                        );

                } catch (error) {

                    console.warn(
                        "ICE error:",
                        error
                    );

                }

            } else {

                pendingCandidates
                    .get(
                        fromSocketId
                    )
                    .push(
                        candidate
                    );

            }

        }
    );


    monitorSocket.on(
        "proctoring:event",
        event => {

            const key =
                String(
                    event.attemptId
                );


            const current =
                students.get(
                    key
                );


            if (
    current &&
    SECURITY_ALERT_TYPES.has(
        String(
            event.type
        )
    )
) {

    current.violationCount =
        Number(
            current.violationCount ||
            0
        ) + 1;

    students.set(
        key,
        current
    );

    renderStudentCard(
        current
    );

}

updateMonitorCounts();


            prependAlert(
                event
            );

        }
    );


    monitorSocket.on(
    "disconnect",
    () => {

        console.warn(
            "Teacher monitor socket disconnected."
        );

        stopTeacherVoice();

    }
);
}


/* =========================================================
   ALERTS
========================================================= */

function prependAlert(
    event
) {

    const list =
        document.getElementById(
            "alertsList"
        );

    if (!list) {
        return;
    }


    const empty =
        list.querySelector(
            ".empty-monitor"
        );

    if (empty) {
        empty.remove();
    }


    const item =
        document.createElement(
            "div"
        );

    item.className =
        `alert-item ${
            event.severity ||
            "medium"
        }`;


    item.innerHTML = `

        <strong>
            ${escapeHtml(
                event.studentName ||
                "Student"
            )}
        </strong>

        <span>
            ${escapeHtml(
                event.type ||
                "PROCTORING"
            )}
            ${
                event.details
                    ? ` — ${escapeHtml(
                        event.details
                    )}`
                    : ""
            }
        </span>

        <small>
            ${formatDate(
                event.timestamp
            )}
        </small>
    `;


    list.prepend(
        item
    );


    while (
        list.children.length >
        30
    ) {

        list.lastElementChild
            .remove();

    }

}


/* =========================================================
   RENDER ALERTS
========================================================= */

function renderAlerts(
    events
) {

    const list =
        document.getElementById(
            "alertsList"
        );

    if (!list) {
        return;
    }


    if (
        !events.length
    ) {

        list.innerHTML =
            `<div class="empty-monitor">
                No proctoring alerts yet.
            </div>`;

        return;

    }


    list.innerHTML =
        events.map(
            event => `

            <div class="
                alert-item
                ${
                    event.severity ||
                    "medium"
                }
            ">

                <strong>
                    ${escapeHtml(
                        event.studentName ||
                        "Student"
                    )}
                </strong>

                <span>
                    ${escapeHtml(
                        event.type
                    )}
                    ${
                        event.details
                            ? ` — ${escapeHtml(
                                event.details
                            )}`
                            : ""
                    }
                </span>

                <small>
                    ${formatDate(
                        event.timestamp
                    )}
                </small>

            </div>

        `
        ).join("");

}


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

    if (!examId) {

    return;
}

    if (
        !await authenticate()
    ) {
        return;
    }

    await loadLiveData();

    connectMonitorSocket();

                const audioButton =
                document.getElementById(
                    "enableLiveAudio"
                );

            if (audioButton) {

                audioButton.addEventListener(
                    "click",
                    async () => {

                        await unlockLiveAudio();

                        audioButton.textContent =
                            "🔊 Live Audio Enabled";

                        audioButton.disabled =
                            true;

                    }
                );

            }

            document.getElementById(
                "refreshMonitor"
            )
                .addEventListener(
                    "click",
                    () => {

                        loadLiveData()
                            .catch(
                                console.error
                            );

                    }
                );


            setInterval(
                () => {

                    loadLiveData()
                        .catch(
                            console.error
                        );

                },
                5000
            );

        } catch (error) {

            console.error(
                error
            );

            document.getElementById(
                "studentsGrid"
            ).innerHTML =
                `
                <div class="empty-monitor">
                    ${escapeHtml(
                        error.message
                    )}
                </div>
                `;

        }

    }
);