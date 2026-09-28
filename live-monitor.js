const examId =
    new URLSearchParams(
        window.location.search
    ).get("examId");


let teacherUser = null;

let monitorSocket = null;

const students =
    new Map();

const peerConnections =
    new Map();

const pendingCandidates =
    new Map();


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
        "expectedCount"
    ).textContent =
        data.stats.registered || 0;


    document.getElementById(
        "joinedCount"
    ).textContent =
        data.stats.joined || 0;


    document.getElementById(
        "activeCount"
    ).textContent =
        data.stats.active || 0;


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

            students.set(
                String(
                    attempt.attemptId
                ),
                attempt
            );

            renderStudentCard(
                attempt
            );

        }
    );


    renderAlerts(
        data.events || []
    );


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


/* =========================================================
   STUDENT CARD
========================================================= */

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

                <div
                    class="student-offline"
                    style="display:flex"
                >
                    Waiting for camera...
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

                </div>

            </div>

            <audio
                class="monitor-audio"
                autoplay
            ></audio>
        `;


        grid.appendChild(
            card
        );


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
                ...(
                    students.get(key) ||
                    {}
                ),

                ...attempt,

                video,

                audio
            }
        );


        card.querySelector(
            "[data-view]"
        )
            .addEventListener(
                "click",
                () => {

                    selectStudent(
                        attempt
                    );

                }
            );


        card.querySelector(
            "[data-listen]"
        )
            .addEventListener(
                "click",
                () => {

                    listenToStudent(
                        key
                    );

                }
            );

    }


    const current =
        students.get(
            key
        );


    if (current) {

        current.status =
            attempt.status;

        current.cameraConnected =
            attempt.cameraConnected;

        current.microphoneConnected =
            attempt.microphoneConnected;

        current.fullscreenActive =
            attempt.fullscreenActive;

        current.violationCount =
            attempt.violationCount;

    }


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


    const isDisconnected =
        attempt.status ===
            "disconnected";


    const hasAlerts =
        Number(
            attempt.violationCount ||
            0
        ) > 0;


    if (status) {

        status.textContent =
            isDisconnected
                ? "Disconnected"
                : hasAlerts
                    ? "Warning"
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
                attempt.violationCount ||
                0
            }`;

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

function listenToStudent(
    attemptId
) {

    document
        .querySelectorAll(
            ".monitor-audio"
        )
        .forEach(
            audio => {

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


    if (audio) {

        audio.muted =
            false;

        audio.volume =
            1;

        audio.play()
            .catch(
                error => {

                    console.warn(
                        "Audio playback:",
                        error
                    );

                }
            );

    }


    if (button) {

        button.classList.add(
            "listen-active"
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

    }


    if (audio) {

        audio.srcObject =
            stream;

        audio.muted =
            true;

    }


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


    peerConnections.set(
        fromSocketId,
        {

            pc,

            attemptId:
                attempt?.attemptId

        }
    );


    pendingCandidates.set(
        fromSocketId,
        []
    );


    pc.ontrack =
        event => {

            let stream =
                event.streams &&
                event.streams[0];

            if (!stream) {

                stream =
                    new MediaStream();

                stream.addTrack(
                    event.track
                );

            }

            attachMedia(
                fromSocketId,
                stream
            );

        };


    pc.onicecandidate =
        event => {

            if (
                event.candidate
            ) {

                monitorSocket.emit(
                    "webrtc:ice-candidate",
                    {

                        targetSocketId:
                            fromSocketId,

                        candidate:
                            event.candidate

                    }
                );

            }

        };


    pc.onconnectionstatechange =
        () => {

            const state =
                pc.connectionState;

            console.log(
                "Teacher WebRTC state:",
                state
            );

            if (
                state ===
                    "failed" ||
                state ===
                    "closed"
            ) {

                const card =
                    document.querySelector(
                        `[data-attempt-id="${attempt?.attemptId}"]`
                    );

                const offline =
                    card?.querySelector(
                        ".student-offline"
                    );

                if (offline) {

                    offline.style.display =
                        "flex";

                }

            }

        };


    await pc.setRemoteDescription(
        offer
    );


    const candidateQueue =
        pendingCandidates.get(
            fromSocketId
        ) || [];


    for (
        const candidate
        of candidateQueue
    ) {

        try {

            await pc.addIceCandidate(
                candidate
            );

        } catch (error) {

            console.warn(
                "Queued ICE:",
                error
            );

        }

    }


    pendingCandidates.set(
        fromSocketId,
        []
    );


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
        attempt => {

            students.set(
                String(
                    attempt.attemptId
                ),
                attempt
            );

            renderStudentCard(
                attempt
            );

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

        }
    );


    monitorSocket.on(
        "webrtc:offer",
        async ({
            fromSocketId,
            offer,
            studentId
        }) => {

            const matching =
                Array.from(
                    students.values()
                ).find(
                    student =>
                        String(
                            student.studentId
                        ) ===
                        String(
                            studentId
                        )
                );


            await handleOffer(
                fromSocketId,
                offer,
                matching
            );

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


            if (current) {

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

            if (
                !await authenticate()
            ) {
                return;
            }


            await loadLiveData();


            connectMonitorSocket();


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