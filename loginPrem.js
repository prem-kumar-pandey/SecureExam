const API_URL = "";


// =========================================
// LOGIN / SIGNUP TOGGLE
// =========================================

function toggleForm(formType) {

    const loginBox =
        document.getElementById("login-box");

    const signupBox =
        document.getElementById("signup-box");

    clearMessages();

    if (formType === "signup") {

        loginBox.classList.add("hidden");

        signupBox.classList.remove("hidden");

    } else {

        signupBox.classList.add("hidden");

        loginBox.classList.remove("hidden");
    }
}


// =========================================
// CLEAR MESSAGES
// =========================================

function clearMessages() {

    document.getElementById(
        "login-message"
    ).innerText = "";

    document.getElementById(
        "signup-message"
    ).innerText = "";
}


// =========================================
// SHOW MESSAGE
// =========================================

function showMessage(id, message, type) {

    const element =
        document.getElementById(id);

    element.innerText = message;

    if (type === "success") {

        element.style.color = "#16a36f";

    } else {

        element.style.color = "#e05268";
    }
}


// =========================================
// ROLE SELECTION
// =========================================

function setLoginRole(role) {

    sessionStorage.setItem(
        "selectedRole",
        role
    );

    const studentButton =
        document.getElementById(
            "studentRoleBtn"
        );

    const teacherButton =
        document.getElementById(
            "teacherRoleBtn"
        );

    studentButton.classList.remove(
        "active"
    );

    teacherButton.classList.remove(
        "active"
    );

    if (role === "teacher") {

        teacherButton.classList.add(
            "active"
        );

    } else {

        studentButton.classList.add(
            "active"
        );
    }
}


// =========================================
// PASSWORD TOGGLE
// =========================================

function togglePassword(inputId, icon) {

    const passwordInput =
        document.getElementById(
            inputId
        );

    if (
        passwordInput.type ===
        "password"
    ) {

        passwordInput.type = "text";

        icon.classList.remove(
            "fa-eye"
        );

        icon.classList.add(
            "fa-eye-slash"
        );

    } else {

        passwordInput.type = "password";

        icon.classList.remove(
            "fa-eye-slash"
        );

        icon.classList.add(
            "fa-eye"
        );
    }
}


// =========================================
// LOGIN
// =========================================

async function login() {

    const username =
        document
            .getElementById("username")
            .value
            .trim();

    const password =
        document
            .getElementById("password")
            .value
            .trim();


    // USERNAME VALIDATION

    if (username.length < 3) {

        showMessage(
            "login-message",
            "Username must contain at least 3 characters!",
            "error"
        );

        return;
    }


    // PASSWORD VALIDATION

    if (password.length < 6) {

        showMessage(
            "login-message",
            "Password must contain at least 6 characters!",
            "error"
        );

        return;
    }


    const selectedRole =
        sessionStorage.getItem(
            "selectedRole"
        ) || "student";


    try {

        const response =
            await fetch(
                `${API_URL}/api/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            username:
                                username,

                            password:
                                password,

                            role:
                                selectedRole
                        })
                }
            );


        const data =
            await response.json();


        if (response.ok) {

            showMessage(
                "login-message",
                "Login successful! Redirecting...",
                "success"
            );


            // REMEMBER USER

            if (
                document
                    .getElementById(
                        "remember"
                    )
                    .checked
            ) {

                localStorage.setItem(
                    "loggedInUser",
                    JSON.stringify(
                        data.user
                    )
                );

            } else {

                sessionStorage.setItem(
                    "loggedInUser",
                    JSON.stringify(
                        data.user
                    )
                );
            }


            // DASHBOARD REDIRECT

            if (
                selectedRole ===
                "teacher"
            ) {

                window.location.href =
                    "/teacher-dashboard.html";

            } else {

                window.location.href =
                    "/student-dashboard.html";
            }

        } else {

            showMessage(
                "login-message",
                data.message ||
                    "Invalid username or password!",
                "error"
            );
        }

    } catch (error) {

        console.error(error);

        showMessage(
            "login-message",
            "Cannot connect to backend server!",
            "error"
        );
    }
}


// =========================================
// REGISTER
// =========================================

async function register() {

    const fullname =
        document
            .getElementById("fullname")
            .value
            .trim();


    const email =
        document
            .getElementById("email")
            .value
            .trim();


    const username =
        document
            .getElementById("new-username")
            .value
            .trim();


    const password =
        document
            .getElementById("new-password")
            .value
            .trim();


    const confirmPassword =
        document
            .getElementById(
                "confirm-password"
            )
            .value
            .trim();


    // FULL NAME

    if (fullname.length < 3) {

        showMessage(
            "signup-message",
            "Full name must contain at least 3 characters!",
            "error"
        );

        return;
    }


    // GMAIL VALIDATION

    const gmailPattern =
        /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

    if (!gmailPattern.test(email)) {

        showMessage(
            "signup-message",
            "Please enter a valid Gmail address ending with @gmail.com.",
            "error"
        );

        return;
    }


    // USERNAME

    if (username.length < 3) {

        showMessage(
            "signup-message",
            "Username must contain at least 3 characters!",
            "error"
        );

        return;
    }


    // PASSWORD

    if (password.length < 6) {

        showMessage(
            "signup-message",
            "Password must contain at least 6 characters!",
            "error"
        );

        return;
    }


    // CONFIRM PASSWORD

    if (
        password !==
        confirmPassword
    ) {

        showMessage(
            "signup-message",
            "Passwords do not match!",
            "error"
        );

        return;
    }


    const selectedRole =
        sessionStorage.getItem(
            "selectedRole"
        ) || "student";


    try {

        const response =
            await fetch(
                `${API_URL}/api/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            fullname:
                                fullname,

                            email:
                                email,

                            username:
                                username,

                            password:
                                password,

                            confirmPassword:
                                confirmPassword,

                            role:
                                selectedRole
                        })
                }
            );


        const data =
            await response.json();


        if (response.ok) {

            showMessage(
                "signup-message",
                "Account created successfully!",
                "success"
            );


            setTimeout(
                function () {

                    toggleForm(
                        "login"
                    );

                    document
                        .getElementById(
                            "username"
                        )
                        .value =
                        username;

                },
                1200
            );


        } else {

            showMessage(
                "signup-message",
                data.message ||
                    "Registration failed!",
                "error"
            );
        }

    } catch (error) {

        console.error(error);

        showMessage(
            "signup-message",
            "Cannot connect to backend server!",
            "error"
        );
    }
}


// =========================================
// SOCIAL LOGIN
// =========================================

async function startSocialLogin(
    provider
) {

    const role =
        sessionStorage.getItem(
            "selectedRole"
        ) || "student";


    try {

        await fetch(
            "/api/auth/role",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                credentials:
                    "include",

                body:
                    JSON.stringify({
                        role: role
                    })
            }
        );

    } catch (error) {

        console.error(
            "Could not save social login role:",
            error
        );
    }


    window.location.href =
        `${API_URL}/auth/${provider}`;
}


// =========================================
// GOOGLE LOGIN
// =========================================

function googleLogin() {

    startSocialLogin(
        "google"
    );
}


// =========================================
// FACEBOOK LOGIN
// =========================================

function facebookLogin() {

    startSocialLogin(
        "facebook"
    );
}


// =========================================
// FORGOT PASSWORD
// =========================================

function forgotPassword() {

    const username =
        document
            .getElementById(
                "username"
            )
            .value
            .trim();


    if (username === "") {

        showMessage(
            "login-message",
            "Please enter your username first.",
            "error"
        );

        return;
    }


    alert(
        "Password reset functionality can be added next."
    );
}


// =========================================
// REMEMBERED USER
// =========================================

window.addEventListener(
    "DOMContentLoaded",
    function () {

        const rememberedUser =
            localStorage.getItem(
                "loggedInUser"
            );


        if (rememberedUser) {

            try {

                const user =
                    JSON.parse(
                        rememberedUser
                    );


                if (user.username) {

                    document
                        .getElementById(
                            "username"
                        )
                        .value =
                        user.username;
                }


                document
                    .getElementById(
                        "remember"
                    )
                    .checked = true;

            } catch (error) {

                console.error(
                    "Unable to load remembered user"
                );
            }
        }


        // ROLE

        let selectedRole =
            sessionStorage.getItem(
                "selectedRole"
            );


        if (
            selectedRole !== "student" &&
            selectedRole !== "teacher"
        ) {

            selectedRole =
                "student";

            sessionStorage.setItem(
                "selectedRole",
                "student"
            );
        }


        setLoginRole(
            selectedRole
        );
    }
);


// =========================================
// GOOGLE / FACEBOOK CALLBACK
// =========================================

window.addEventListener(
    "DOMContentLoaded",
    function () {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const googleStatus =
            params.get("google");


        // GOOGLE SUCCESS

        if (
            googleStatus ===
            "success"
        ) {

            const selectedRole =
                sessionStorage.getItem(
                    "selectedRole"
                );


            console.log(
                "GOOGLE LOGIN SUCCESS"
            );

            console.log(
                "SELECTED ROLE:",
                selectedRole
            );


            if (
                selectedRole ===
                "teacher"
            ) {

                window.location.href =
                    "/teacher-dashboard.html";

            } else {

                window.location.href =
                    "/student-dashboard.html";
            }
        }


        // FACEBOOK SUCCESS

        const facebookStatus =
            params.get(
                "facebook"
            );


        if (
            facebookStatus ===
            "success"
        ) {

            const selectedRole =
                sessionStorage.getItem(
                    "selectedRole"
                ) || "student";


            if (
                selectedRole ===
                "teacher"
            ) {

                window.location.href =
                    "/teacher-dashboard.html";

            } else {

                window.location.href =
                    "/student-dashboard.html";
            }
        }


        // GOOGLE FAILED

        if (
            googleStatus ===
            "failed"
        ) {

            console.error(
                "Google Login Failed"
            );

            window.history.replaceState(
                {},
                document.title,
                "/loginPrem.html"
            );
        }

    }
);