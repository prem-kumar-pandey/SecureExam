const express = require("express");

const mongoose = require("mongoose");

const cors = require("cors");

const dotenv = require("dotenv");

const bcrypt = require("bcrypt");

const session = require("express-session");

const passport = require("passport");

const http = require("http");
const { Server } = require("socket.io");


const GoogleStrategy =
    require("passport-google-oauth20").Strategy;

const FacebookStrategy =
    require("passport-facebook").Strategy;


dotenv.config();
console.log("Google Client ID loaded:", !!process.env.GOOGLE_CLIENT_ID);
console.log("Google Client Secret loaded:", !!process.env.GOOGLE_CLIENT_SECRET);



const app = express();


// ===============================
// MIDDLEWARE
// ===============================

app.use(express.json());


app.use(cors({

    origin: true,

    credentials: true

}));


// ===============================
// SESSION
// ===============================

const sessionMiddleware = session({
    secret:
        process.env.SESSION_SECRET ||
        "secret_key",

    resave: false,

    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false
    }
});

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

// ===============================
// HTTP SERVER + SOCKET.IO
// ===============================

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true
    }
});

// Share Express session + Passport with Socket.IO
io.engine.use(sessionMiddleware);
io.engine.use(passport.initialize());
io.engine.use(passport.session());

io.use((socket, next) => {
    try {
        if (
            !socket.request.isAuthenticated ||
            !socket.request.isAuthenticated()
        ) {
            return next(
                new Error("Authentication required.")
            );
        }

        next();

    } catch (error) {
        next(error);
    }
});


// ===============================
// MONGODB CONNECTION
// ===============================

const MONGO_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error("❌ MONGO_URI / MONGODB_URI is not configured.");
    process.exit(1);
}

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log("✅ Connected to MongoDB successfully!");
    })
    .catch((error) => {
        console.error("❌ MongoDB connection error:", error);
    });




    // ===============================
// CLASS GROUP SCHEMA
// ===============================

const classGroupSchema =
    new mongoose.Schema(
        {

            institutionType: {
                type: String,
                enum: ["school", "college"],
                required: true
            },

            institutionName: {
                type: String,
                required: true,
                trim: true
            },

            schoolClass: {
                type: String,
                default: ""
            },

            year: {
                type: String,
                default: ""
            },

            course: {
                type: String,
                default: ""
            },

            section: {
                type: String,
                required: true,
                trim: true
            },

            groupKey: {
                type: String,
                required: true,
                unique: true,
                index: true
            },

            label: {
                type: String,
                required: true
            }

        },
        {
            timestamps: true
        }
    );


const ClassGroup =
    mongoose.model(
        "ClassGroup",
        classGroupSchema
    );



// ===============================
// USER SCHEMA
// ===============================

const userSchema =
    new mongoose.Schema({
        

        fullname: {

            type: String,

            required: true

        },


        email: {

            type: String,

            required: true,

            unique: true

        },


        username: {

            type: String,

            unique: true,

            sparse: true

        },


        password: {

            type: String

        },


        googleId: {

            type: String,

            unique: true,

            sparse: true

        },


        facebookId: {

            type: String,

            unique: true,

            sparse: true

        },

        photo: {
    type: String,
    default: ""
},


        provider: {

            type: String,

            default: "local"

        },

        role: {

            type: String,

            enum: ["student", "teacher"],

            default: undefined

        },
        classGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassGroup",
    default: null
}

    });


const User =
    mongoose.model(
        "User",
        userSchema
    );


// ===============================
// PASSPORT SERIALIZATION
// ===============================

passport.serializeUser(

    (user, done) => {

        done(
            null,
            user.id
        );

    }

);


passport.deserializeUser(

    async (id, done) => {

        try {

            const user =
                await User.findById(id);

            done(
                null,
                user
            );

        } catch (error) {

            done(error);

        }

    }

);


// ===============================
// GOOGLE STRATEGY
// ===============================

passport.use(

    new GoogleStrategy(

        {

            clientID:
                process.env.GOOGLE_CLIENT_ID,

            clientSecret:
                process.env.GOOGLE_CLIENT_SECRET,

            callbackURL:
                "http://127.0.0.1:5000/auth/google/callback"

        },


       async (accessToken, refreshToken, profile, done) => {

    try {

        // =========================================
        // GET GOOGLE PROFILE INFORMATION
        // =========================================

        const googlePhoto =
            profile.photos &&
            profile.photos.length > 0
                ? profile.photos[0].value
                : (
                    profile._json &&
                    profile._json.picture
                        ? profile._json.picture
                        : ""
                );

        console.log(
            "GOOGLE NAME:",
            profile.displayName
        );

        console.log(
            "GOOGLE EMAIL:",
            profile.emails &&
            profile.emails[0]
                ? profile.emails[0].value
                : ""
        );

        console.log(
            "GOOGLE PHOTO:",
            googlePhoto
        );


        // =========================================
        // FIND USER BY GOOGLE ID
        // =========================================

        let user = await User.findOne({
            googleId: profile.id
        });


        // =========================================
        // IF USER DOES NOT EXIST
        // =========================================

        if (!user) {

            const googleEmail =
                profile.emails &&
                profile.emails[0]
                    ? profile.emails[0].value
                    : `google_${profile.id}@google.com`;


            // Check existing account by email

            user = await User.findOne({
                email: googleEmail
            });


            // =========================================
            // EXISTING EMAIL USER
            // =========================================

            if (user) {

                user.googleId =
                    profile.id;

                user.photo =
                    googlePhoto;

                user.fullname =
                    profile.displayName;

                await user.save();

            }


            // =========================================
            // COMPLETELY NEW GOOGLE USER
            // =========================================

            else {

                user = await User.create({

                    fullname:
                        profile.displayName,

                    email:
                        googleEmail,

                    googleId:
                        profile.id,

                    photo:
                        googlePhoto,

                    provider:
                        "google"

                });

            }

        }


        // =========================================
        // EXISTING GOOGLE USER
        // =========================================

        else {

            user.googleId =
                profile.id;

            user.fullname =
                profile.displayName;

            // Update profile picture
            // whenever Google provides one

            if (googlePhoto) {

                user.photo =
                    googlePhoto;

            }

            await user.save();

        }


        console.log(
            "USER PHOTO SAVED:",
            user.photo
        );


        return done(null, user);


    } catch (error) {

        console.error(
            "Google authentication error:",
            error
        );

        return done(error, null);

    }

}

    )

);


// ===============================
// FACEBOOK STRATEGY
// ===============================

passport.use(

    new FacebookStrategy(

        {

            clientID:
                process.env.FACEBOOK_APP_ID,

            clientSecret:
                process.env.FACEBOOK_APP_SECRET,

            callbackURL:
                "http://127.0.0.1:5000/auth/facebook/callback",

            profileFields: [

                "id",

                "displayName",

                "emails"

            ]

        },


        async (
            accessToken,
            refreshToken,
            profile,
            done
        ) => {

            console.log("GOOGLE PROFILE PHOTO:", profile.photos);

            try {

                let user =
                    await User.findOne({

                        facebookId:
                            profile.id

                    });


                if (!user) {

                    const email =
                        profile.emails &&
                        profile.emails[0]
                            ? profile.emails[0].value
                            : `facebook_${profile.id}@facebook.com`;


                    user =
                        await User.create({

                            fullname:
                                profile.displayName,

                            email: email,

                            facebookId:
                                profile.id,

                            provider:
                                "facebook"

                        });

                }


                return done(
                    null,
                    user
                );

            } catch (error) {

                return done(error);

            }

        }

    )

);


// ===============================
// REGISTER
// ===============================

app.post("/api/register", async (req, res) => {

    try {

        const {
            fullname,
            email,
            username,
            password,
            confirmPassword,
            role,

            institutionType,
            institutionName,

            schoolClass,
            year,
            course,
            section
        } = req.body;


        const selectedRole =
    role === "teacher"
        ? "teacher"
        : "student";

        // =========================================
        // BASIC VALIDATION
        // =========================================

        if (
            !fullname ||
            !email ||
            !username ||
            !password ||
            !confirmPassword
        ) {

            return res.status(400).json({
                message:
                    "Please fill in all account fields."
            });

        }


        // =========================================
        // INSTITUTION VALIDATION
        // =========================================

        if (
            !["school", "college"]
                .includes(institutionType)
        ) {

            return res.status(400).json({
                message:
                    "Please select a valid institution type."
            });

        }


        if (!String(institutionName || "").trim()) {

            return res.status(400).json({
                message:
                    "Institution name is required."
            });

        }


        if (!String(section || "").trim()) {

            return res.status(400).json({
                message:
                    "Section is required."
            });

        }


        if (
            institutionType === "school" &&
            !String(schoolClass || "").trim()
        ) {

            return res.status(400).json({
                message:
                    "School class is required."
            });

        }


        if (
            institutionType === "college" &&
            (
                !String(year || "").trim() ||
                !String(course || "").trim()
            )
        ) {

            return res.status(400).json({
                message:
                    "College year and course are required."
            });

        }


        // =========================================
        // EMAIL
        // =========================================

        const gmailPattern =
            /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

        if (
            !gmailPattern.test(
                email.trim()
            )
        ) {

            return res.status(400).json({
                message:
                    "Please enter a valid Gmail address ending with @gmail.com."
            });

        }


        // =========================================
        // PASSWORD
        // =========================================

        if (
            password !==
            confirmPassword
        ) {

            return res.status(400).json({
                message:
                    "Passwords do not match."
            });

        }


        if (password.length < 6) {

            return res.status(400).json({
                message:
                    "Password must be at least 6 characters."
            });

        }


        // =========================================
        // DUPLICATE ACCOUNT
        // =========================================

        const existingUsername =
            await User.findOne({
                username:
                    username.trim()
            });

        if (existingUsername) {

            return res.status(400).json({
                message:
                    "Username already exists."
            });

        }


        const existingEmail =
            await User.findOne({
                email:
                    email
                        .trim()
                        .toLowerCase()
            });

        if (existingEmail) {

            return res.status(400).json({
                message:
                    "An account with this Gmail already exists."
            });

        }


        // =========================================
        // NORMALIZE GROUP VALUES
        // =========================================

        const normalizedInstitution =
            institutionName
                .trim()
                .replace(/\s+/g, " ");

        const normalizedClass =
            institutionType === "school"
                ? String(schoolClass || "").trim()
                : "";

        const normalizedYear =
            institutionType === "college"
                ? String(year || "").trim()
                : "";

        const normalizedCourse =
            institutionType === "college"
                ? String(course || "")
                    .trim()
                    .replace(/\s+/g, " ")
                    .toUpperCase()
                : "";

        const normalizedSection =
            String(section)
                .trim()
                .toUpperCase();


        // =========================================
        // UNIQUE CLASS GROUP KEY
        // =========================================

        const groupKey = [

            institutionType,

            normalizedInstitution
                .toLowerCase(),

            normalizedClass,

            normalizedYear,

            normalizedCourse
                .toLowerCase(),

            normalizedSection

        ].join("|");


        // =========================================
        // GROUP LABEL
        // =========================================

        let groupLabel = "";

        if (institutionType === "school") {

            groupLabel =
                `${normalizedInstitution} — Class ${normalizedClass} — Section ${normalizedSection}`;

        } else {

            const semesterLabels = {
    "1": "1st Semester",
    "2": "2nd Semester",
    "3": "3rd Semester",
    "4": "4th Semester",
    "5": "5th Semester",
    "6": "6th Semester",
    "7": "7th Semester",
    "8": "8th Semester"
};

const semesterLabel =
    semesterLabels[normalizedYear] ||
    `${normalizedYear} Semester`;

    groupLabel =
    `${normalizedInstitution} — ${semesterLabel} — ${normalizedCourse} — Section ${normalizedSection}`;

}

        // =========================================
        // FIND / CREATE CLASS GROUP
        // =========================================

        let classGroup =
            await ClassGroup.findOne({
                groupKey
            });


        if (!classGroup) {

            try {

                classGroup =
                    await ClassGroup.create({

                        institutionType,

                        institutionName:
                            normalizedInstitution,

                        schoolClass:
                            normalizedClass,

                        year:
                            normalizedYear,

                        course:
                            normalizedCourse,

                        section:
                            normalizedSection,

                        groupKey,

                        label:
                            groupLabel

                    });

            } catch (error) {

                // Another registration may have
                // created the same group first.

                if (
                    error &&
                    error.code === 11000
                ) {

                    classGroup =
                        await ClassGroup.findOne({
                            groupKey
                        });

                } else {

                    throw error;

                }

            }

        }


        if (!classGroup) {

            return res.status(500).json({
                message:
                    "Could not create class group."
            });

        }


        // =========================================
        // HASH PASSWORD
        // =========================================

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        // =========================================
        // CREATE USER
        // =========================================

        const newUser =
            await User.create({

                fullname:
                    fullname.trim(),

                email:
                    email
                        .trim()
                        .toLowerCase(),

                username:
                    username.trim(),

                password:
                    hashedPassword,

                provider:
                    "local",

                    role:
            role === "teacher"
                ? "teacher"
                : "student",

        classGroupId:
            classGroup._id

    });

        // =========================================
        // SUCCESS
        // =========================================

        res.status(201).json({

            message:
                "Account created successfully.",

            user: {

                fullname:
                    newUser.fullname,

                email:
                    newUser.email,

                username:
                    newUser.username,

                role:
                    newUser.role,

                classGroupId:
                    newUser.classGroupId,

                classGroup:
                    classGroup.label

            }

        });


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        res.status(500).json({

            message:
                "Server error during registration."

        });

    }

});

// ===============================
// LOGIN
// ===============================

app.post(
    "/api/login",

    async (req, res) => {

        try {

            const {
                username,
                password,
                role
            } = req.body;


            // FIND USER
            const user =
                await User.findOne({
                    username: username
                });


            // USER NOT FOUND
            if (!user) {

                return res.status(400).json({

                    message:
                        "Invalid username or password!"

                });

            }


            // CHECK PASSWORD
            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            // WRONG PASSWORD
            if (!passwordMatch) {

                return res.status(400).json({

                    message:
                        "Invalid username or password!"

                });

            }



// ===============================
// LOGOUT
// ===============================

app.post(
    "/api/logout",
    (req, res) => {

        req.logout(
            err => {

                if (err) {

                    console.error(
                        "Logout error:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Logout failed."
                    });

                }

                req.session.destroy(
                    sessionError => {

                        if (
                            sessionError
                        ) {

                            console.error(
                                "Session destroy error:",
                                sessionError
                            );

                        }

                        res.json({
                            message:
                                "Logout successful."
                        });

                    }
                );

            }
        );

    }
);


            // =================================
            // CREATE LOGIN SESSION
            // =================================

            req.login(user, (err) => {

                if (err) {

                    console.error(
                        "Session login error:",
                        err
                    );

                    return res.status(500).json({

                        message:
                            "Could not create login session."

                    });

                }


                // =================================
                // LOGIN SUCCESSFUL
                // =================================

                res.status(200).json({

                    message:
                        "Login successful!",

                    user: {

                        fullname:
                            user.fullname,

                        username:
                            user.username,

                        email:
                            user.email,

                        role:
                            user.role || "student"

                    }

                });

            });


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error during login."

            });

        }

    }

);


/// =================================
// GET CURRENT LOGGED-IN USER
// =================================

app.get(
    "/api/me",
    async (req, res) => {

        try {

            if (!req.isAuthenticated()) {

                return res.status(401).json({

                    loggedIn:
                        false,

                    message:
                        "User is not logged in."

                });

            }


            // =================================
            // LOAD CLASS GROUP
            // =================================

            const group =
                req.user.classGroupId

                    ? await ClassGroup.findById(
                        req.user.classGroupId
                    ).lean()

                    : null;


            // =================================
            // SEND USER
            // =================================

            res.json({

                loggedIn:
                    true,

                user: {

                    id:
                        req.user._id,

                    fullname:
                        req.user.fullname,

                    email:
                        req.user.email,

                    username:
                        req.user.username || "",

                    photo:
                        req.user.photo || "",

                    provider:
                        req.user.provider || "local",

                    role:
                        req.user.role || "student",

                    classGroupId:
                        req.user.classGroupId || null,

                    classGroup:
                        group
                            ? {

                                id:
                                    group._id,

                                label:
                                    group.label,

                                institutionType:
                                    group.institutionType,

                                institutionName:
                                    group.institutionName,

                                schoolClass:
                                    group.schoolClass,

                                year:
                                    group.year,

                                course:
                                    group.course,

                                section:
                                    group.section

                            }
                            : null

                }

            });


        } catch (error) {

            console.error(
                "Get current user error:",
                error
            );

            res.status(500).json({

                loggedIn:
                    false,

                message:
                    "Could not load current user."

            });

        }

    }
);


// ===============================
 // SOCIAL LOGIN ROLE
 // ===============================

app.post("/api/auth/role", (req, res) => {

    const role =
        req.body && req.body.role === "teacher"
            ? "teacher"
            : "student";

    req.session.pendingRole = role;

    res.json({
        success: true,
        role
    });

});


// ===============================
 // GOOGLE LOGIN ROUTE
// ===============================

app.get(

    "/auth/google",

    passport.authenticate(

        "google",

        {

            scope: [

                "profile",

                "email"

            ]

        }

    )

);


// ===============================
// GOOGLE CALLBACK
// ===============================

// =================================
// GOOGLE CALLBACK
// =================================
// ===============================
// GOOGLE CALLBACK
// ===============================

app.get(
    "/auth/google/callback",

    passport.authenticate("google", {
        failureRedirect: "/loginPrem.html?google=failed"
    }),

    async (req, res) => {

        console.log("GOOGLE LOGIN SUCCESS");

        try {

            const pendingRole =
                req.session.pendingRole === "teacher"
                    ? "teacher"
                    : "student";

            if (req.user && !req.user.role) {
                req.user.role = pendingRole;
                await req.user.save();
            }

            delete req.session.pendingRole;

        } catch (error) {
            console.error("Google role assignment error:", error);
        }

        res.redirect("/loginPrem.html?google=success");

    }
);

// ===============================
// FACEBOOK LOGIN ROUTE
// ===============================

app.get(

    "/auth/facebook",

    passport.authenticate(

        "facebook",

        {

            scope: [

                "email"

            ]

        }

    )

);


// ===============================
// FACEBOOK CALLBACK
// ===============================

app.get(

    "/auth/facebook/callback",

    passport.authenticate(

        "facebook",

        {

            failureRedirect:
                "http://127.0.0.1:5500/loginPrem.html"

        }

    ),

    async (req, res) => {

        try {

            const pendingRole =
                req.session.pendingRole === "teacher"
                    ? "teacher"
                    : "student";

            if (req.user && !req.user.role) {
                req.user.role = pendingRole;
                await req.user.save();
            }

            delete req.session.pendingRole;

        } catch (error) {
            console.error("Facebook role assignment error:", error);
        }

        res.redirect("/loginPrem.html?facebook=success");

    }

);


// =========================================================
// EXAM + RESULT MODELS
// =========================================================

const questionSchema = new mongoose.Schema(
    {
        text: { type: String, required: true, trim: true },
        options: {
            type: [String],
            required: true,
            validate: {
                validator: value =>
                    Array.isArray(value) &&
                    value.length === 4 &&
                    value.every(option => String(option).trim().length > 0),
                message: "Each question must have exactly four non-empty options."
            }
        },
        correctAnswer: { type: Number, min: 0, max: 3, required: true },
        marks: { type: Number, min: 1, required: true, default: 1 }
    },
    { _id: true }
);


const examSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        subject: {
            type: String,
            required: true,
            trim: true
        },

        code: {
            type: String,
            required: true,
            trim: true
        },

        duration: {
            type: Number,
            required: true,
            min: 1
        },

        totalMarks: {
            type: Number,
            required: true,
            min: 1
        },

        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft"
        },

        scheduledAt: {
            type: Date,
            default: null
        },

        sessionEndsAt: {
            type: Date,
            default: null
        },

        // Legacy fields kept for compatibility
        availabilityDays: {
            type: Number,
            required: true,
            min: 1,
            default: 7
        },

        availableUntil: {
            type: Date,
            default: null
        },

        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        classGroupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassGroup",
            required: true
        },

        questions: {
            type: [questionSchema],
            required: true,

            validate: {
                validator: value =>
                    Array.isArray(value) &&
                    value.length > 0,

                message:
                    "An exam must contain at least one question."
            }
        }
    },

    {
        timestamps: true
    }
);



const resultSchema = new mongoose.Schema(
    {
        examId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam",
            required: true
        },
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        answers: { type: [Number], default: [] },
        score: { type: Number, required: true, min: 0 },
        totalMarks: { type: Number, required: true, min: 0 },
        correctAnswers: { type: Number, required: true, min: 0 },
        incorrectAnswers: { type: Number, required: true, min: 0 },
        percentage: { type: Number, required: true, min: 0, max: 100 },
        startedAt: { type: Date, default: null },
        submittedAt: { type: Date, default: Date.now },
        autoSubmitted: { type: Boolean, default: false }
    },
    { timestamps: true }
);

resultSchema.index({ examId: 1, studentId: 1 }, { unique: true });

const Exam = mongoose.model("Exam", examSchema);
const Result = mongoose.model("Result", resultSchema);











const attemptSchema = new mongoose.Schema(
    {
        examId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam",
            required: true
        },

        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        startedAt: {
            type: Date,
            required: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        submittedAt: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: [
                "waiting",
                "active",
                "submitted",
                "auto-submitted",
                "disconnected",
                "expired"
            ],
            default: "waiting"
        },

        cameraConnected: {
            type: Boolean,
            default: false
        },

        microphoneConnected: {
            type: Boolean,
            default: false
        },

        fullscreenActive: {
            type: Boolean,
            default: false
        },

        lastHeartbeat: {
            type: Date,
            default: null
        },

        violationCount: {
            type: Number,
            default: 0,
            min: 0
        }
    },

    {
        timestamps: true
    }
);

attemptSchema.index(
    {
        examId: 1,
        studentId: 1
    },

    {
        unique: true
    }
);

const ExamAttempt =
    mongoose.model(
        "ExamAttempt",
        attemptSchema
    );











    const proctoringEventSchema = new mongoose.Schema(
    {
        examId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam",
            required: true
        },

        attemptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExamAttempt",
            required: true
        },

        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        type: {
            type: String,
            required: true
        },

        severity: {
            type: String,
            enum: [
                "info",
                "low",
                "medium",
                "high"
            ],
            default: "medium"
        },

        details: {
            type: String,
            default: ""
        },

        timestamp: {
            type: Date,
            default: Date.now
        }
    },

    {
        timestamps: true
    }
);

const ProctoringEvent =
    mongoose.model(
        "ProctoringEvent",
        proctoringEventSchema
    );



// =========================================================
// AUTHORIZATION HELPERS
// =========================================================

function requireLogin(req, res, next) {

    if (!req.isAuthenticated()) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    next();
}

function requireRole(role) {

    return (req, res, next) => {

        if (!req.isAuthenticated()) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        if ((req.user.role || "student") !== role) {
            return res.status(403).json({
                message: `Only ${role}s can access this resource.`
            });
        }

        next();
    };
}


// =========================================================
// CLASS GROUPS: TEACHER
// =========================================================

app.get(
    "/api/class-groups",
    requireRole("teacher"),
    async (req, res) => {

        try {

            // =========================================
            // TEACHER MUST HAVE A CLASS GROUP
            // =========================================

            if (!req.user.classGroupId) {

                return res.json({
                    groups: []
                });

            }


            // =========================================
            // FIND TEACHER'S OWN GROUP
            // =========================================

            const teacherGroup =
                await ClassGroup.findById(
                    req.user.classGroupId
                );


            if (!teacherGroup) {

                return res.json({
                    groups: []
                });

            }


            // =========================================
            // LOAD GROUPS FROM SAME INSTITUTION
            // =========================================

            const groups =
                await ClassGroup.find({

                    institutionType:
                        teacherGroup.institutionType,

                    institutionName:
                        teacherGroup.institutionName

                })
                .sort({
                    label: 1
                })
                .lean();


            // =========================================
            // SEND GROUPS TO TEACHER
            // =========================================

            res.json({

                groups:
                    groups.map(group => ({

                        id:
                            group._id,

                        label:
                            group.label,

                        institutionType:
                            group.institutionType,

                        institutionName:
                            group.institutionName,

                        schoolClass:
                            group.schoolClass,

                        year:
                            group.year,

                        course:
                            group.course,

                        section:
                            group.section

                    }))

            });


        } catch (error) {

            console.error(
                "Class groups error:",
                error
            );

            res.status(500).json({

                message:
                    "Could not load class groups."

            });

        }

    }
);



async function createNotification({ recipientId, role, type, title, message, icon, relatedId }) {
    try {
        await Notification.create({ recipientId, role, type, title, message, icon: icon || "fa-bell", relatedId: relatedId || null });
    } catch (error) {
        console.error("Notification create error:", error);
    }
}

async function notifyAllStudents(notification) {
    const students = await User.find({ role: "student" }).select("_id");
    if (!students.length) return;
    await Notification.insertMany(students.map(student => ({ ...notification, recipientId: student._id, role: "student" })));
}

function sanitizeExamForStudent(exam) {

    return {
        id: exam._id,
        title: exam.title,
        subject: exam.subject,
        code: exam.code,
        duration: exam.duration,
        totalMarks: exam.totalMarks,
        status: exam.status,
        scheduledAt: exam.scheduledAt,
        availabilityDays: exam.availabilityDays,
        availableUntil: exam.availableUntil,
        questionCount: exam.questions.length,
        createdAt: exam.createdAt
    };
}








function getExamSessionWindow(exam) {

    const startTime = exam.scheduledAt
        ? new Date(exam.scheduledAt).getTime()
        : new Date(exam.createdAt).getTime();

    let endTime = null;

    if (exam.sessionEndsAt) {

        endTime =
            new Date(
                exam.sessionEndsAt
            ).getTime();

    } else if (exam.availableUntil) {

        // Legacy exam support
        endTime =
            new Date(
                exam.availableUntil
            ).getTime();

    } else if (exam.availabilityDays) {

        // Legacy exam support
        endTime =
            startTime +
            Number(exam.availabilityDays) *
            24 *
            60 *
            60 *
            1000;

    } else {

        endTime =
            startTime +
            Number(exam.duration) *
            60 *
            1000;
    }

    return {
        startTime,
        endTime
    };
}


function getExamSessionState(exam) {

    const {
        startTime,
        endTime
    } = getExamSessionWindow(exam);

    const now = Date.now();

    if (now < startTime) {
        return "upcoming";
    }

    if (now > endTime) {
        return "ended";
    }

    return "live";
}


function examIsCurrentlyAvailable(exam) {

    if (exam.status !== "published") {
        return false;
    }

    return (
        getExamSessionState(exam) === "live"
    );
}


// =========================================================
// TEACHER: CREATE EXAM
// =========================================================

app.post(
    "/api/exams",
    requireRole("teacher"),
    async (req, res) => {

        try {

            const {
    title,
    subject,
    code,
    duration,
    totalMarks,
    status,
    scheduledAt,
    sessionEndsAt,
    classGroupId,
    targetGroup: targetGroupInput,
    questions
} = req.body;
            // =====================================
            // BASIC VALIDATION
            // =====================================

            if (
                !String(title || "").trim() ||
                !String(subject || "").trim() ||
                !String(code || "").trim() ||
                !Number(duration) ||
                !Array.isArray(questions) ||
                questions.length === 0
            ) {

                return res.status(400).json({
                    message:
                        "Title, subject, code, duration and questions are required."
                });

            }


// =====================================
// TARGET CLASS GROUP
// =====================================

const teacherGroup =
    req.user.classGroupId
        ? await ClassGroup.findById(
            req.user.classGroupId
        )
        : null;

if (!teacherGroup) {

    return res.status(403).json({
        message:
            "Your teacher account has no class group assigned."
    });

}

let targetGroup = null;


// =====================================
// OLD classGroupId SUPPORT
// =====================================

if (classGroupId) {

    targetGroup =
        await ClassGroup.findById(
            classGroupId
        );

    if (!targetGroup) {

        return res.status(404).json({
            message:
                "Selected class / group was not found."
        });

    }

}


// =====================================
// MANUAL TARGET GROUP
// =====================================

else if (
    targetGroupInput &&
    typeof targetGroupInput === "object"
) {

    const institutionType =
        String(
            targetGroupInput.institutionType ||
            ""
        )
        .trim()
        .toLowerCase();


    const normalizedInstitution =
        String(
            targetGroupInput.institutionName ||
            ""
        )
        .trim()
        .replace(/\s+/g, " ");


    const normalizedClass =
        institutionType === "school"
            ? String(
                targetGroupInput.schoolClass ||
                ""
            ).trim()
            : "";


    const normalizedYear =
        institutionType === "college"
            ? String(
                targetGroupInput.year ||
                ""
            ).trim()
            : "";


    const normalizedCourse =
        institutionType === "college"
            ? String(
                targetGroupInput.course ||
                ""
            )
            .trim()
            .replace(/\s+/g, " ")
            .toUpperCase()
            : "";


    const normalizedSection =
        String(
            targetGroupInput.section ||
            ""
        )
        .trim()
        .toUpperCase();


    if (
        !["school", "college"]
            .includes(institutionType)
    ) {

        return res.status(400).json({
            message:
                "Please select School or College / University."
        });

    }


    if (!normalizedInstitution) {

        return res.status(400).json({
            message:
                "Institution name is required."
        });

    }


    if (!normalizedSection) {

        return res.status(400).json({
            message:
                "Section is required."
        });

    }


    if (
        institutionType === "school" &&
        !normalizedClass
    ) {

        return res.status(400).json({
            message:
                "School class is required."
        });

    }


    if (
        institutionType === "college" &&
        (
            !/^([1-8])$/.test(
                normalizedYear
            ) ||
            !normalizedCourse
        )
    ) {

        return res.status(400).json({
            message:
                "College semester 1-8 and course are required."
        });

    }


    // =====================================
    // TEACHER INSTITUTION CHECK
    // =====================================

    const teacherInstitution =
        String(
            teacherGroup.institutionName ||
            ""
        )
        .trim()
        .replace(/\s+/g, " ");


    if (
        teacherGroup.institutionType !==
            institutionType ||
        teacherInstitution.toLowerCase() !==
            normalizedInstitution.toLowerCase()
    ) {

        return res.status(403).json({
            message:
                "The target institution must match your teacher account institution."
        });

    }


    // =====================================
    // SAME KEY AS STUDENT SIGNUP
    // =====================================

    const groupKey = [

        institutionType,

        normalizedInstitution
            .toLowerCase(),

        normalizedClass,

        normalizedYear,

        normalizedCourse
            .toLowerCase(),

        normalizedSection

    ].join("|");


    let groupLabel = "";


    if (
        institutionType ===
        "school"
    ) {

        groupLabel =
            `${normalizedInstitution} — Class ${normalizedClass} — Section ${normalizedSection}`;

    } else {

        const semesterLabels = {

            "1": "1st Semester",
            "2": "2nd Semester",
            "3": "3rd Semester",
            "4": "4th Semester",
            "5": "5th Semester",
            "6": "6th Semester",
            "7": "7th Semester",
            "8": "8th Semester"

        };


        const semesterLabel =
            semesterLabels[
                normalizedYear
            ] ||
            `${normalizedYear} Semester`;


        groupLabel =
            `${normalizedInstitution} — ${semesterLabel} — ${normalizedCourse} — Section ${normalizedSection}`;

    }


    // =====================================
    // FIND OR CREATE GROUP
    // =====================================

    targetGroup =
        await ClassGroup.findOne({
            groupKey
        });


    if (!targetGroup) {

        try {

            targetGroup =
                await ClassGroup.create({

                    institutionType,

                    institutionName:
                        normalizedInstitution,

                    schoolClass:
                        normalizedClass,

                    year:
                        normalizedYear,

                    course:
                        normalizedCourse,

                    section:
                        normalizedSection,

                    groupKey,

                    label:
                        groupLabel

                });

        } catch (error) {

            if (
                error &&
                error.code === 11000
            ) {

                targetGroup =
                    await ClassGroup.findOne({
                        groupKey
                    });

            } else {

                throw error;

            }

        }

    }

}


else {

    return res.status(400).json({
        message:
            "Target class / semester / section is required."
    });

}


if (!targetGroup) {

    return res.status(500).json({
        message:
            "Could not resolve the target class group."
    });

}


// =====================================
// FINAL INSTITUTION SECURITY
// =====================================

if (
    targetGroup.institutionType !==
        teacherGroup.institutionType ||

    String(
        targetGroup.institutionName
    )
    .trim()
    .toLowerCase() !==
        String(
            teacherGroup.institutionName
        )
        .trim()
        .toLowerCase()
) {

    return res.status(403).json({
        message:
            "The target institution must match your teacher account institution."
    });

}






            // =====================================
            // SESSION VALIDATION
            // =====================================

            const startDate =
    scheduledAt
        ? new Date(scheduledAt)
        : new Date();

const endDate =
    sessionEndsAt
        ? new Date(sessionEndsAt)
        : new Date(
            startDate.getTime() +
            Number(duration) * 60 * 1000
        );

            if (
                Number.isNaN(startDate.getTime()) ||
                Number.isNaN(endDate.getTime())
            ) {

                return res.status(400).json({
                    message:
                        "Invalid exam date or time."
                });

            }

            if (
                endDate.getTime() <=
                startDate.getTime()
            ) {

                return res.status(400).json({
                    message:
                        "Session end time must be after start time."
                });

            }

            const sessionMinutes =
                (
                    endDate.getTime() -
                    startDate.getTime()
                ) / 60000;

            if (
                Number(duration) >
                sessionMinutes
            ) {

                return res.status(400).json({
                    message:
                        "Exam duration cannot exceed the exam session window."
                });

            }

            // =====================================
            // QUESTIONS
            // =====================================

            const normalizedQuestions =
                questions.map(
                    (question, index) => {

                        const options =
                            Array.isArray(
                                question.options
                            )
                                ? question.options.map(
                                    option =>
                                        String(
                                            option || ""
                                        ).trim()
                                )
                                : [];

                        const correctAnswer =
                            Number(
                                question.correctAnswer
                            );

                        if (
                            !String(
                                question.text || ""
                            ).trim() ||

                            options.length !== 4 ||

                            options.some(
                                option => !option
                            ) ||

                            !Number.isInteger(
                                correctAnswer
                            ) ||

                            correctAnswer < 0 ||

                            correctAnswer > 3
                        ) {

                            throw new Error(
                                `Question ${index + 1} must contain text, four options and a valid correct answer.`
                            );

                        }

                        return {
                            text:
                                String(
                                    question.text
                                ).trim(),

                            options,

                            correctAnswer,

                            marks:
                                Math.max(
                                    1,
                                    Number(
                                        question.marks
                                    ) || 1
                                )
                        };

                    }
                );

            const calculatedMarks =
                normalizedQuestions.reduce(
                    (sum, question) =>
                        sum +
                        Number(
                            question.marks
                        ),

                    0
                );

            // =====================================
            // CREATE
            // =====================================

            const exam =
                await Exam.create({

                    title:
                        String(title).trim(),

                    subject:
                        String(subject).trim(),

                    code:
                        String(code).trim(),

                    duration:
                        Number(duration),

                    totalMarks:
                        calculatedMarks,

                    status:
                        status === "published"
                            ? "published"
                            : "draft",

                    scheduledAt:
                        startDate,

                    sessionEndsAt:
                        endDate,

                    // Keep for old records
                    availableUntil:
                        endDate,

                    availabilityDays:
                        1,

                    teacherId:
    req.user._id,

classGroupId:
    targetGroup._id,

questions:
    normalizedQuestions
                });

            if (
                exam.status ===
                "published"
            ) {

                await notifyAllStudents({

                    type:
                        "examCreated",

                    title:
                        "New exam scheduled",

                    message:
                        `${exam.title} is scheduled for ${exam.scheduledAt.toLocaleString()}.`,

                    icon:
                        "fa-calendar-check",

                    relatedId:
                        exam._id
                });

            }

            res.status(201).json({

                message:
                    "Exam created successfully.",

                exam: {
                    ...sanitizeExamForStudent(
                        exam
                    ),

                    teacherId:
                        exam.teacherId,

                    questions:
                        exam.questions
                }

            });

        } catch (error) {

            console.error(
                "Create exam error:",
                error
            );

            res.status(400).json({
                message:
                    error.message ||
                    "Could not create exam."
            });

        }

    }
);

// =========================================================
// TEACHER: LIST OWN EXAMS
// =========================================================

app.get("/api/teacher/exams", requireRole("teacher"), async (req, res) => {

    try {

        const exams = await Exam.find({
            teacherId: req.user._id
        }).sort({ createdAt: -1 });

        res.json({
            exams: exams.map(exam => ({
                ...sanitizeExamForStudent(exam),
                questions: exam.questions
            }))
        });

    } catch (error) {

        console.error("Teacher exams error:", error);

        res.status(500).json({
            message: "Could not load teacher exams."
        });

    }

});


// =========================================================
// TEACHER: UPDATE EXAM
// =========================================================


app.put(
    "/api/exams/:id",
    requireRole("teacher"),
    async (req, res) => {

        try {

            const exam =
                await Exam.findOne({
                    _id: req.params.id,
                    teacherId: req.user._id
                });

            if (!exam) {

                return res.status(404).json({
                    message:
                        "Exam not found."
                });

            }

            if (
                req.body.title !== undefined
            ) {
                exam.title =
                    String(
                        req.body.title
                    ).trim();
            }

            if (
                req.body.subject !== undefined
            ) {
                exam.subject =
                    String(
                        req.body.subject
                    ).trim();
            }

            if (
                req.body.code !== undefined
            ) {
                exam.code =
                    String(
                        req.body.code
                    ).trim();
            }

            if (
                req.body.duration !== undefined
            ) {
                exam.duration =
                    Number(
                        req.body.duration
                    );
            }

            if (
                req.body.status !== undefined
            ) {
                exam.status =
                    req.body.status === "published"
                        ? "published"
                        : "draft";
            }

            if (
                req.body.scheduledAt !== undefined
            ) {

                exam.scheduledAt =
                    req.body.scheduledAt
                        ? new Date(
                            req.body.scheduledAt
                        )
                        : null;
            }

            if (
                req.body.sessionEndsAt !== undefined
            ) {

                exam.sessionEndsAt =
                    req.body.sessionEndsAt
                        ? new Date(
                            req.body.sessionEndsAt
                        )
                        : null;
            }

            // =====================================
            // NEW SCHEDULE VALIDATION
            // =====================================

            if (
                !exam.scheduledAt ||
                !exam.sessionEndsAt
            ) {

                return res.status(400).json({
                    message:
                        "Exam start and session end time are required."
                });

            }

            if (
                Number.isNaN(
                    exam.scheduledAt.getTime()
                ) ||

                Number.isNaN(
                    exam.sessionEndsAt.getTime()
                )
            ) {

                return res.status(400).json({
                    message:
                        "Invalid exam schedule."
                });

            }

            if (
                exam.sessionEndsAt.getTime() <=
                exam.scheduledAt.getTime()
            ) {

                return res.status(400).json({
                    message:
                        "Session end time must be after start time."
                });

            }

            const sessionMinutes =
                (
                    exam.sessionEndsAt.getTime() -
                    exam.scheduledAt.getTime()
                ) / 60000;

            if (
                Number(exam.duration) >
                sessionMinutes
            ) {

                return res.status(400).json({
                    message:
                        "Exam duration cannot exceed the session window."
                });

            }

            // Legacy field kept in sync
            exam.availableUntil =
                exam.sessionEndsAt;

            exam.availabilityDays =
                null;

            // =====================================
            // QUESTIONS
            // =====================================

            if (
                Array.isArray(
                    req.body.questions
                )
            ) {

                exam.questions =
                    req.body.questions;

            }

            const calculatedMarks =
                exam.questions.reduce(
                    (sum, question) =>
                        sum +
                        Number(
                            question.marks
                        ) || 0,

                    0
                );

            if (
                Number(exam.totalMarks) !==
                calculatedMarks
            ) {

                exam.totalMarks =
                    calculatedMarks;
            }

            await exam.save();

            if (
                exam.status ===
                "published"
            ) {

                await notifyAllStudents({

                    type:
                        "examUpdated",

                    title:
                        "Exam updated",

                    message:
                        `${exam.title} has been updated.`,

                    icon:
                        "fa-pen-to-square",

                    relatedId:
                        exam._id
                });

            }

            res.json({

                message:
                    "Exam updated successfully.",

                exam: {
                    ...sanitizeExamForStudent(
                        exam
                    ),

                    questions:
                        exam.questions
                }

            });

        } catch (error) {

            console.error(
                "Update exam error:",
                error
            );

            res.status(400).json({
                message:
                    error.message ||
                    "Could not update exam."
            });

        }

    }
);


// =========================================================
// TEACHER: DELETE EXAM
// =========================================================

app.delete("/api/exams/:id", requireRole("teacher"), async (req, res) => {

    try {

        const exam = await Exam.findOne({
            _id: req.params.id,
            teacherId: req.user._id
        });

        if (!exam) {
            return res.status(404).json({
                message: "Exam not found."
            });
        }

        await notifyAllStudents({
            type: "examDeleted",
            title: "Exam removed",
            message: `${exam.title} is no longer available.`,
            icon: "fa-trash",
            relatedId: exam._id
        });

        await Result.deleteMany({ examId: exam._id });
        await ExamAttempt.deleteMany({ examId: exam._id });
        await Exam.deleteOne({ _id: exam._id });

        res.json({
            message: "Exam deleted successfully."
        });

    } catch (error) {

        console.error("Delete exam error:", error);

        res.status(500).json({
            message: "Could not delete exam."
        });

    }

});


// =========================================================
// STUDENT: AVAILABLE + UPCOMING EXAMS
// =========================================================

app.get("/api/student/exams", requireRole("student"), async (req, res) => {

    try {

        if (!req.user.classGroupId) {

    return res.json({

        available: [],

        upcoming: [],

        expired: []

    });

}


const exams =
    await Exam.find({

        status:
            "published",

        classGroupId:
            req.user.classGroupId

    })
    .sort({

        scheduledAt:
            1,

        createdAt:
            -1

    });

        const results = await Result.find({
            studentId: req.user._id
        }).select("examId");

        const attempted = new Set(
            results.map(result => String(result.examId))
        );


        const available = [];
const upcoming = [];
const expired = [];

exams.forEach(exam => {

    const data = {
        ...sanitizeExamForStudent(exam),
        attempted: attempted.has(
            String(exam._id)
        )
    };

    const sessionState =
        getExamSessionState(exam);

    if (
        sessionState === "upcoming"
    ) {

        upcoming.push(data);

    } else if (
        sessionState === "live"
    ) {

        available.push(data);

    } else {

        expired.push(data);

    }

});


res.json({

    available,

    upcoming,

    expired

});


} catch (error) {

    console.error(
        "Student exams error:",
        error
    );

    res.status(500).json({

        message:
            "Could not load exams."

    });

}

});

       


// =========================================================
// STUDENT: START / RESUME AN EXAM ATTEMPT
// =========================================================

app.post(
    "/api/exams/:id/start",
    requireRole("student"),
    async (req, res) => {

        try {

            const exam =
                await Exam.findById(
                    req.params.id
                );

            if (!exam) {

                return res.status(404).json({
                    message:
                        "Exam not found."
                });



// =====================================
// CLASS GROUP SECURITY CHECK
// =====================================

if (
    !req.user.classGroupId ||
    !exam.classGroupId ||
    String(exam.classGroupId) !==
        String(req.user.classGroupId)
) {

    return res.status(403).json({

        message:
            "This exam is not assigned to your class / group."

    });

}

            }

            if (
                exam.status !==
                "published"
            ) {

                return res.status(403).json({
                    message:
                        "This exam has not been published."
                });

            }

            const {
                startTime,
                endTime
            } = getExamSessionWindow(
                exam
            );

            const now =
                Date.now();

            // =====================================
            // TOO EARLY
            // =====================================

            if (
                now < startTime
            ) {

                return res.status(403).json({
                    message:
                        `Exam starts at ${new Date(startTime).toLocaleString()}.`,
                    startsAt:
                        new Date(startTime)
                });

            }

            // =====================================
            // TOO LATE
            // =====================================

            if (
                now > endTime
            ) {

                return res.status(403).json({
                    message:
                        "This exam session has ended."
                });

            }

            // =====================================
            // ALREADY SUBMITTED
            // =====================================

            const existingResult =
                await Result.findOne({
                    examId:
                        exam._id,

                    studentId:
                        req.user._id
                });

            if (existingResult) {

                return res.status(409).json({
                    message:
                        "You have already submitted this exam."
                });

            }

            // =====================================
            // EXISTING ATTEMPT
            // =====================================

            let attempt =
                await ExamAttempt.findOne({
                    examId:
                        exam._id,

                    studentId:
                        req.user._id
                });

            if (attempt) {

                if (
                    attempt.status ===
                        "submitted" ||

                    attempt.status ===
                        "auto-submitted"
                ) {

                    return res.status(409).json({
                        message:
                            "This exam has already been submitted."
                    });

                }

                if (
                    attempt.expiresAt.getTime() <=
                    now
                ) {

                    attempt.status =
                        "expired";

                    await attempt.save();

                    return res.status(410).json({
                        message:
                            "Your exam attempt has expired."
                    });

                }

                attempt.status =
                    "active";

                attempt.lastHeartbeat =
                    new Date();

                await attempt.save();

            } else {

                // =====================================
                // INDIVIDUAL ATTEMPT EXPIRY
                // The exam session end is the hard limit.
                // =====================================

                const durationEnd =
                    now +
                    Number(exam.duration) *
                    60 *
                    1000;

                const expiresAt =
                    new Date(
                        Math.min(
                            durationEnd,
                            endTime
                        )
                    );

                attempt =
                    await ExamAttempt.create({

                        examId:
                            exam._id,

                        studentId:
                            req.user._id,

                        startedAt:
                            new Date(),

                        expiresAt,

                        status:
                            "active",

                        lastHeartbeat:
                            new Date()
                    });

            }

            res.json({

                message:
                    "Exam attempt started.",

                id:
                    attempt._id,

                attemptId:
                    attempt._id,

                startedAt:
                    attempt.startedAt,

                expiresAt:
                    attempt.expiresAt,

                sessionEndsAt:
                    exam.sessionEndsAt,

                serverNow:
                    new Date()

            });

        } catch (error) {

            console.error(
                "Start exam error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not start exam."
            });

        }

    }
);

// =========================================================
// GET ONE EXAM
// =========================================================

app.get("/api/exams/:id", requireLogin, async (req, res) => {

    try {

        const exam = await Exam.findById(req.params.id);

        if (!exam) {
            return res.status(404).json({
                message: "Exam not found."
            });
        }

        const currentRole =
            req.user.role || "student";

        if (currentRole === "student") {

    // =====================================
    // CLASS GROUP SECURITY CHECK
    // =====================================

    if (
        !req.user.classGroupId ||
        !exam.classGroupId ||
        String(exam.classGroupId) !==
            String(req.user.classGroupId)
    ) {

        return res.status(403).json({

            message:
                "This exam is not assigned to your class / group."

        });

    }


    // =====================================
    // EXAM SESSION CHECK
    // =====================================

    if (!examIsCurrentlyAvailable(exam)) {

        return res.status(403).json({

            message:
                "This exam is not currently available."

        });

    }

}

        if (
            currentRole === "teacher" &&
            String(exam.teacherId) !== String(req.user._id)
        ) {
            return res.status(403).json({
                message: "You do not own this exam."
            });
        }

        const existing = await Result.findOne({
            examId: exam._id,
            studentId: req.user._id
        });

        if (currentRole === "student") {

            const attempt =
                await ExamAttempt.findOne({
                    examId: exam._id,
                    studentId: req.user._id
                });

            return res.json({
                exam: {
                    ...sanitizeExamForStudent(exam),
                    questions: exam.questions.map(question => ({
                        id: question._id,
                        text: question.text,
                        options: question.options,
                        marks: question.marks
                    }))
                },
                alreadySubmitted: !!existing,
                attempt: attempt
    ? {
        id: attempt._id,
        attemptId: attempt._id,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        status: attempt.status
    }
    : null
            });

        }

        res.json({
            exam: {
                ...sanitizeExamForStudent(exam),
                questions: exam.questions
            }
        });

    } catch (error) {

        console.error("Get exam error:", error);

        res.status(400).json({
            message: "Could not load exam."
        });

    }

});


// =========================================================
// STUDENT: SUBMIT EXAM
// =========================================================

app.post("/api/exams/:id/submit", requireRole("student"), async (req, res) => {

    try {

    const exam =
        await Exam.findById(
            req.params.id
        );

    if (!exam) {
        return res.status(404).json({
            message: "Exam not found."
        });
    }

// =====================================
// CLASS GROUP SECURITY CHECK
// =====================================

if (
    !req.user.classGroupId ||
    !exam.classGroupId ||
    String(exam.classGroupId) !==
        String(req.user.classGroupId)
) {

    return res.status(403).json({
        message:
            "This exam is not assigned to your class / group."
    });

}


const existing = await Result.findOne({
            examId: exam._id,
            studentId: req.user._id
        });

        if (existing) {
            return res.status(409).json({
                message: "You have already submitted this exam.",
                result: existing
            });
        }

        const attempt =
            await ExamAttempt.findOne({
                examId: exam._id,
                studentId: req.user._id
            });

        if (!attempt) {
            return res.status(400).json({
                message: "Exam attempt was not started. Please reopen the exam."
            });
        }

        const serverNow = new Date();
        const serverExpired =
            serverNow.getTime() >= attempt.expiresAt.getTime();

        const answers = Array.isArray(req.body.answers)
            ? req.body.answers.map(answer => {
                const value = Number(answer);
                return Number.isInteger(value) ? value : -1;
            })
            : [];

        let score = 0;
        let correctAnswers = 0;

        exam.questions.forEach((question, index) => {

            const answer = answers[index];

            if (
                answer >= 0 &&
                answer <= 3 &&
                answer === question.correctAnswer
            ) {
                correctAnswers++;
                score += Number(question.marks) || 0;
            }

        });

        const totalMarks =
            exam.totalMarks ||
            exam.questions.reduce(
                (sum, question) => sum + (Number(question.marks) || 0),
                0
            );

        const percentage =
            totalMarks > 0
                ? Number(((score / totalMarks) * 100).toFixed(2))
                : 0;

        const incorrectAnswers =
            Math.max(0, exam.questions.length - correctAnswers);

        const result = await Result.create({
            examId: exam._id,
            studentId: req.user._id,
            answers,
            score,
            totalMarks,
            correctAnswers,
            incorrectAnswers,
            percentage,
            startedAt: attempt.startedAt,
            submittedAt: serverNow,
            autoSubmitted:
                Boolean(req.body.autoSubmitted) || serverExpired
        }); 

            attempt.status =
    result.autoSubmitted
        ? "auto-submitted"
        : "submitted";

attempt.submittedAt =
    result.submittedAt;

attempt.lastHeartbeat =
    new Date();

await attempt.save();

        await createNotification({
            recipientId: exam.teacherId,
            role: "teacher",
            type: "examCompleted",
            title: "Student submitted an exam",
            message: `${req.user.fullname || "A student"} submitted ${exam.title} with ${result.percentage}%.`,
            icon: "fa-check-circle",
            relatedId: result._id
        });

        await createNotification({
            recipientId: req.user._id,
            role: "student",
            type: "resultUpdated",
            title: "Result generated",
            message: `Your result for ${exam.title} is ${result.percentage}%.`,
            icon: "fa-chart-line",
            relatedId: result._id
        });

        res.status(201).json({
            message: "Exam submitted successfully.",
            result: {
                id: result._id,
                examId: exam._id,
                examTitle: exam.title,
                score: result.score,
                totalMarks: result.totalMarks,
                correctAnswers: result.correctAnswers,
                incorrectAnswers: result.incorrectAnswers,
                percentage: result.percentage,
                submittedAt: result.submittedAt,
                autoSubmitted: result.autoSubmitted
            }
        });

    } catch (error) {

        console.error("Submit exam error:", error);

        if (error && error.code === 11000) {
            return res.status(409).json({
                message: "This exam has already been submitted."
            });
        }

        res.status(500).json({
            message: "Could not submit exam."
        });

    }

});


// =========================================================
// STUDENT: RESULTS
// =========================================================

app.get("/api/student/results", requireRole("student"), async (req, res) => {

    try {

        const results = await Result.find({
            studentId: req.user._id
        })
.populate(
    "examId",
    "title subject code duration scheduledAt sessionEndsAt teacherId"
)           
.sort({ submittedAt: -1 });

        res.json({
            results: results.map(result => ({
                id: result._id,
                examId: result.examId?._id,
                examTitle: result.examId?.title || "Exam",
                subject: result.examId?.subject || "",
                code: result.examId?.code || "",
                questionCount: result.examId?.questions?.length || 0,
                duration: result.examId?.duration || 0,
                score: result.score,
                totalMarks: result.totalMarks,
                correctAnswers: result.correctAnswers,
                incorrectAnswers: result.incorrectAnswers,
                percentage: result.percentage,
                submittedAt: result.submittedAt,
                autoSubmitted: result.autoSubmitted
            }))
        });

    } catch (error) {

        console.error("Student results error:", error);

        res.status(500).json({
            message: "Could not load results."
        });

    }

});


// =========================================================
// STUDENT: DASHBOARD STATS
// =========================================================

app.get("/api/student/dashboard", requireRole("student"), async (req, res) => {

    try {

        const results = await Result.find({
            studentId: req.user._id
        })
            .populate("examId", "title subject code questions")
            .sort({ submittedAt: 1 });

        const scores = results.map(result => result.percentage);

        const averageScore =
            scores.length
                ? Number(
                    (
                        scores.reduce((sum, score) => sum + score, 0) /
                        scores.length
                    ).toFixed(2)
                )
                : 0;

        const bestScore =
            scores.length ? Math.max(...scores) : 0;

        res.json({
            totalAttempts: results.length,
            completedExams: results.length,
            averageScore,
            bestScore,
            performance: results.map(result => ({
                exam: result.examId?.title || "Exam",
                subject: result.examId?.subject || "",
                percentage: result.percentage,
                score: result.score,
                totalMarks: result.totalMarks,
                submittedAt: result.submittedAt
            }))
        });

    } catch (error) {

        console.error("Student dashboard error:", error);

        res.status(500).json({
            message: "Could not load dashboard."
        });

    }

});


app.get("/api/teacher/dashboard", requireRole("teacher"), async (req, res) => {
    try {
        const exams = await Exam.find({ teacherId: req.user._id }).select("_id status");
        const examIds = exams.map(exam => exam._id);
        const results = await Result.find({ examId: { $in: examIds } }).select("percentage studentId");
        const totalStudents = await User.countDocuments({ role: "student" });
        const averageScore = results.length ? Number((results.reduce((sum, r) => sum + Number(r.percentage || 0), 0) / results.length).toFixed(2)) : 0;
        res.json({
            totalExams: exams.length,
            publishedExams: exams.filter(e => e.status === "published").length,
            draftExams: exams.filter(e => e.status === "draft").length,
            totalStudents,
            attempts: results.length,
            completedAttempts: results.length,
            averageScore,
            uniqueStudentsWithAttempts: new Set(results.map(r => String(r.studentId))).size
        });
    } catch (error) {
        console.error("Teacher dashboard error:", error);
        res.status(500).json({ message: "Could not load teacher dashboard." });
    }
});


// =========================================================
// TEACHER: RESULTS + PERFORMANCE
// =========================================================

app.get("/api/teacher/results", requireRole("teacher"), async (req, res) => {

    try {

        const exams = await Exam.find({
            teacherId: req.user._id
        }).select("_id title subject code questions");

        const results = await Result.find({
            examId: { $in: exams.map(exam => exam._id) }
        })
            .populate("studentId", "fullname username email")
            .populate("examId", "title subject code questions")
            .sort({ submittedAt: -1 });

        res.json({
            results: results.map(result => ({
                id: result._id,
                studentName: result.studentId?.fullname || "Student",
                username: result.studentId?.username || "",
                email: result.studentId?.email || "",
                examId: result.examId?._id,
                examTitle: result.examId?.title || "Exam",
                subject: result.examId?.subject || "",
                questionCount: result.examId?.questions?.length || 0,
                score: result.score,
                totalMarks: result.totalMarks,
                correctAnswers: result.correctAnswers,
                incorrectAnswers: result.incorrectAnswers,
                percentage: result.percentage,
                submittedAt: result.submittedAt,
                autoSubmitted: result.autoSubmitted
            }))
        });

    } catch (error) {

        console.error("Teacher results error:", error);

        res.status(500).json({
            message: "Could not load teacher results."
        });

    }

});


app.get("/api/teacher/performance", requireRole("teacher"), async (req, res) => {

    try {

        const exams = await Exam.find({
            teacherId: req.user._id
        }).select("_id title");

        const results = await Result.find({
            examId: { $in: exams.map(exam => exam._id) }
        });

        const average =
            results.length
                ? Number(
                    (
                        results.reduce(
                            (sum, result) => sum + result.percentage,
                            0
                        ) / results.length
                    ).toFixed(2)
                )
                : 0;

        const byExam = exams.map(exam => {

            const examResults = results.filter(
                result => String(result.examId) === String(exam._id)
            );

            const avg =
                examResults.length
                    ? Number(
                        (
                            examResults.reduce(
                                (sum, result) => sum + result.percentage,
                                0
                            ) / examResults.length
                        ).toFixed(2)
                    )
                    : 0;

            return {
                exam: exam.title,
                average: avg,
                attempts: examResults.length
            };

        });

        res.json({
            average,
            totalStudents:
                new Set(results.map(result => String(result.studentId))).size,
            byExam
        });

    } catch (error) {

        console.error("Teacher performance error:", error);

        res.status(500).json({
            message: "Could not load performance."
        });

    }

});


app.get("/api/student/notifications", requireRole("student"), async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user._id, role: "student" }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification.countDocuments({ recipientId: req.user._id, role: "student", read: false });
        res.json({ unreadCount, notifications });
    } catch (error) {
        res.status(500).json({ message: "Could not load notifications." });
    }
});

app.post("/api/student/notifications/read", requireRole("student"), async (req, res) => {
    await Notification.updateMany({ recipientId: req.user._id, role: "student", read: false }, { $set: { read: true } });
    res.json({ message: "Notifications marked as read." });
});

app.get("/api/teacher/notifications", requireRole("teacher"), async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user._id, role: "teacher" }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification.countDocuments({ recipientId: req.user._id, role: "teacher", read: false });
        res.json({ unreadCount, notifications });
    } catch (error) {
        res.status(500).json({ message: "Could not load notifications." });
    }
});

app.post("/api/teacher/notifications/read", requireRole("teacher"), async (req, res) => {
    await Notification.updateMany({ recipientId: req.user._id, role: "teacher", read: false }, { $set: { read: true } });
    res.json({ message: "Notifications marked as read." });
});



























// =========================================================
// STUDENT: HEARTBEAT
// =========================================================

app.post(
    "/api/exams/:id/heartbeat",
    requireRole("student"),
    async (req, res) => {

        try {

            const {
                attemptId,
                cameraConnected,
                microphoneConnected,
                fullscreenActive
            } = req.body;

            const attempt =
                await ExamAttempt.findOne({
                    _id: attemptId,
                    examId: req.params.id,
                    studentId: req.user._id
                });

            if (!attempt) {

                return res.status(404).json({
                    message:
                        "Attempt not found."
                });

            }

            if (
                attempt.status ===
                    "submitted" ||
                attempt.status ===
                    "auto-submitted"
            ) {

                return res.status(409).json({
                    message:
                        "Exam attempt is already finished."
                });

            }

            attempt.lastHeartbeat =
                new Date();

            attempt.cameraConnected =
                Boolean(cameraConnected);

            attempt.microphoneConnected =
                Boolean(microphoneConnected);

            attempt.fullscreenActive =
                Boolean(fullscreenActive);

            if (
                attempt.status !==
                "disconnected"
            ) {
                attempt.status =
                    "active";
            }

            await attempt.save();

            res.json({
                success: true,
                serverNow: new Date()
            });

        } catch (error) {

            console.error(
                "Heartbeat error:",
                error
            );

            res.status(500).json({
                message:
                    "Heartbeat failed."
            });

        }

    }
);







// =========================================================
// STUDENT: PROCTORING EVENT
// =========================================================

app.post(
    "/api/exams/:id/proctoring-event",
    requireRole("student"),
    async (req, res) => {

        try {

            const {
                attemptId,
                type,
                severity,
                details
            } = req.body;

            const attempt =
                await ExamAttempt.findOne({
                    _id: attemptId,
                    examId: req.params.id,
                    studentId: req.user._id
                });

            if (!attempt) {

                return res.status(404).json({
                    message:
                        "Attempt not found."
                });

            }

            const allowedTypes = [
                "TAB_SWITCH",
                "FULLSCREEN_EXIT",
                "CAMERA_DISCONNECTED",
                "MICROPHONE_DISCONNECTED",
                "FACE_MISSING",
                "MULTIPLE_PERSONS",
                "PHONE_DETECTED",
                "AUDIO_ACTIVITY",
                "WINDOW_BLUR",
                "SECURITY_WARNING"
            ];

            const safeType =
                allowedTypes.includes(type)
                    ? type
                    : "SECURITY_WARNING";

            const event =
                await ProctoringEvent.create({

                    examId:
                        req.params.id,

                    attemptId:
                        attempt._id,

                    studentId:
                        req.user._id,

                    type:
                        safeType,

                    severity:
                        severity || "medium",

                    details:
                        String(
                            details || ""
                        ).slice(0, 1000),

                    timestamp:
                        new Date()
                });

            const violationTypes = [
                "TAB_SWITCH",
                "FULLSCREEN_EXIT",
                "CAMERA_DISCONNECTED",
                "MICROPHONE_DISCONNECTED",
                "MULTIPLE_PERSONS",
                "PHONE_DETECTED",
                "FACE_MISSING",
                "AUDIO_ACTIVITY"
            ];

            if (
                violationTypes.includes(
                    safeType
                )
            ) {

                attempt.violationCount += 1;

                await attempt.save();

            }

            io
                .to(
                    `exam:${req.params.id}:teacher`
                )
                .emit(
                    "proctoring:event",
                    {
                        id: event._id,
                        examId: event.examId,
                        attemptId: event.attemptId,
                        studentId: event.studentId,
                        studentName:
                            req.user.fullname ||
                            "Student",
                        type:
                            event.type,
                        severity:
                            event.severity,
                        details:
                            event.details,
                        timestamp:
                            event.timestamp
                    }
                );

            res.status(201).json({
                success: true,
                eventId: event._id
            });

        } catch (error) {

            console.error(
                "Proctoring event error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not save proctoring event."
            });

        }

    }
);











// =========================================================
// TEACHER: LIVE EXAM MONITOR
// =========================================================

app.get(
    "/api/teacher/exams/:id/live",
    requireRole("teacher"),
    async (req, res) => {

        try {

            const exam =
                await Exam.findOne({
                    _id: req.params.id,
                    teacherId: req.user._id
                });

            if (!exam) {

                return res.status(404).json({
                    message:
                        "Exam not found."
                });

            }

            const attempts =
                await ExamAttempt.find({
                    examId:
                        exam._id
                })
                    .populate(
                        "studentId",
                        "fullname username email photo"
                    )
                    .sort({
                        startedAt: 1
                    });

            const events =
                await ProctoringEvent.find({
                    examId:
                        exam._id
                })
                    .populate(
                        "studentId",
                        "fullname username"
                    )
                    .sort({
                        timestamp: -1
                    })
                    .limit(200);

            const active =
                attempts.filter(
                    item =>
                        item.status ===
                        "active"
                ).length;

            const disconnected =
                attempts.filter(
                    item =>
                        item.status ===
                        "disconnected"
                ).length;

            const submitted =
                attempts.filter(
                    item =>
                        item.status ===
                            "submitted" ||
                        item.status ===
                            "auto-submitted"
                ).length;

            res.json({

                exam: {
                    id:
                        exam._id,

                    title:
                        exam.title,

                    subject:
                        exam.subject,

                    code:
                        exam.code,

                    duration:
                        exam.duration,

                    scheduledAt:
                        exam.scheduledAt,

                    sessionEndsAt:
                        exam.sessionEndsAt,

                    sessionState:
                        getExamSessionState(
                            exam
                        )
                },

                stats: {

                    registered:
                        await User.countDocuments({
                            role:
                                "student"
                        }),

                    joined:
                        attempts.length,

                    active,

                    disconnected,

                    submitted,

                    alerts:
                        events.length
                },

                attempts:
                    attempts.map(
                        attempt => ({

                            attemptId:
                                attempt._id,

                            studentId:
                                attempt.studentId?._id,

                            studentName:
                                attempt.studentId?.fullname ||
                                "Student",

                            username:
                                attempt.studentId?.username ||
                                "",

                            email:
                                attempt.studentId?.email ||
                                "",

                            photo:
                                attempt.studentId?.photo ||
                                "",

                            startedAt:
                                attempt.startedAt,

                            expiresAt:
                                attempt.expiresAt,

                            submittedAt:
                                attempt.submittedAt,

                            status:
                                attempt.status,

                            cameraConnected:
                                attempt.cameraConnected,

                            microphoneConnected:
                                attempt.microphoneConnected,

                            fullscreenActive:
                                attempt.fullscreenActive,

                            lastHeartbeat:
                                attempt.lastHeartbeat,

                            violationCount:
                                attempt.violationCount

                        })
                    ),

                events:
                    events.map(
                        event => ({

                            id:
                                event._id,

                            attemptId:
                                event.attemptId,

                            studentId:
                                event.studentId?._id,

                            studentName:
                                event.studentId?.fullname ||
                                "Student",

                            type:
                                event.type,

                            severity:
                                event.severity,

                            details:
                                event.details,

                            timestamp:
                                event.timestamp

                        })
                    )

            });

        } catch (error) {

            console.error(
                "Teacher live error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not load live exam."
            });

        }

    }
);


// =========================================================
// TEACHER: ATTEMPT PROCTORING REPORT
// =========================================================

app.get(
    "/api/teacher/attempts/:attemptId/proctoring",
    requireRole("teacher"),
    async (req, res) => {

        try {

            const attempt =
                await ExamAttempt
                    .findById(
                        req.params.attemptId
                    )
                    .populate(
                        "studentId",
                        "fullname username email photo"
                    )
                    .populate(
                        "examId",
                        "title subject code duration scheduledAt sessionEndsAt"
                    );

            if (!attempt) {

                return res.status(404).json({
                    message:
                        "Attempt not found."
                });

            }

            if (
                String(
                    attempt.examId.teacherId
                ) !==
                String(
                    req.user._id
                )
            ) {

                return res.status(403).json({
                    message:
                        "You do not own this exam."
                });

            }

            const events =
                await ProctoringEvent.find({
                    attemptId:
                        attempt._id
                })
                    .sort({
                        timestamp: 1
                    });

            res.json({

                attempt: {
                    id:
                        attempt._id,

                    status:
                        attempt.status,

                    startedAt:
                        attempt.startedAt,

                    expiresAt:
                        attempt.expiresAt,

                    submittedAt:
                        attempt.submittedAt,

                    cameraConnected:
                        attempt.cameraConnected,

                    microphoneConnected:
                        attempt.microphoneConnected,

                    fullscreenActive:
                        attempt.fullscreenActive,

                    violationCount:
                        attempt.violationCount
                },

                student: {
                    id:
                        attempt.studentId?._id,

                    fullname:
                        attempt.studentId?.fullname ||
                        "Student",

                    username:
                        attempt.studentId?.username ||
                        "",

                    email:
                        attempt.studentId?.email ||
                        ""
                },

                exam: attempt.examId,

                events

            });

        } catch (error) {

            console.error(
                "Attempt proctoring error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not load proctoring report."
            });

        }

    }
);



// =========================================================
// OVERALL LEADERBOARD - TOP 10 STUDENTS
// =========================================================

app.get("/api/leaderboard", requireRole("student"), async (req, res) => {

    try {

        const leaderboard = await Result.aggregate([

            {
                $group: {
                    _id: "$studentId",

                    totalScore: {
                        $sum: "$score"
                    },

                    totalMarks: {
                        $sum: "$totalMarks"
                    },

                    correctAnswers: {
                        $sum: "$correctAnswers"
                    },

                    totalIncorrectAnswers: {
                        $sum: "$incorrectAnswers"
                    },

                    examsCompleted: {
                        $sum: 1
                    }
                }
            },

            {
                $sort: {
                    totalScore: -1,
                    correctAnswers: -1,
                    examsCompleted: -1
                }
            },

            {
                $limit: 10
            },

            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "student"
                }
            },

            {
                $unwind: {
                    path: "$student",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $project: {
                    _id: 0,

                    studentName: {
                        $ifNull: [
                            "$student.fullname",
                            "Student"
                        ]
                    },

                    username: {
                        $ifNull: [
                            "$student.username",
                            ""
                        ]
                    },

                    totalScore: 1,
                    totalMarks: 1,
                    correctAnswers: 1,
                    totalIncorrectAnswers: 1,
                    examsCompleted: 1
                }
            }

        ]);

        res.json({

            leaderboard: leaderboard.map((student, index) => ({

                rank: index + 1,

                studentName:
                    student.studentName,

                username:
                    student.username,

                totalScore:
                    student.totalScore,

                totalMarks:
                    student.totalMarks,

                correctAnswers:
                    student.correctAnswers,

                incorrectAnswers:
                    student.totalIncorrectAnswers,

                examsCompleted:
                    student.examsCompleted,

                percentage:
                    student.totalMarks > 0
                        ? Number(
                            (
                                (
                                    student.totalScore /
                                    student.totalMarks
                                ) * 100
                            ).toFixed(2)
                        )
                        : 0

            }))

        });

    } catch (error) {

        console.error(
            "Overall leaderboard error:",
            error
        );

        res.status(500).json({
            message:
                "Could not load overall leaderboard."
        });

    }

});



// ===============================
// SERVE LOGIN PAGE
// ===============================

const path = require("path");

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "loginPrem.html")
    );
});

app.use(express.static(__dirname));























// =========================================================
// SOCKET.IO + WEBRTC SIGNALING
// =========================================================

io.on(
    "connection",
    socket => {

        const user =
            socket.request.user;

            if (user?._id) {
    socket.data.userId = String(user._id);
}

if (user?.role) {
    socket.data.role = user.role;
}


            socket.on(
    "proctoring:event",
    async data => {

        try {

            if (
                socket.data.role !==
                "student"
            ) {
                return;
            }

            const attempt =
                await ExamAttempt.findOne({
                    _id:
                        socket.data.attemptId,

                    examId:
                        socket.data.examId,

                    studentId:
                        socket.data.studentId
                });

            if (!attempt) {
                return;
            }

            const event =
                await ProctoringEvent.create({

                    examId:
                        socket.data.examId,

                    attemptId:
                        attempt._id,

                    studentId:
                        socket.data.studentId,

                    type:
                        String(
                            data?.type ||
                            "SECURITY_WARNING"
                        ),

                    severity:
                        data?.severity ||
                        "medium",

                    details:
                        String(
                            data?.details ||
                            ""
                        ).slice(
                            0,
                            1000
                        ),

                    timestamp:
                        new Date()
                });

            const violationTypes = [
                "TAB_SWITCH",
                "FULLSCREEN_EXIT",
                "CAMERA_DISCONNECTED",
                "MICROPHONE_DISCONNECTED",
                "FACE_MISSING",
                "MULTIPLE_PERSONS",
                "PHONE_DETECTED",
                "AUDIO_ACTIVITY",
                "WINDOW_BLUR"
            ];

            if (
                violationTypes.includes(
                    event.type
                )
            ) {

                attempt.violationCount += 1;

                await attempt.save();

            }

            io
                .to(
                    `exam:${socket.data.examId}:teacher`
                )
                .emit(
                    "proctoring:event",
                    {

                        id:
                            event._id,

                        attemptId:
                            event.attemptId,

                        studentId:
                            event.studentId,

                        studentName:
                            user.fullname ||
                            "Student",

                        type:
                            event.type,

                        severity:
                            event.severity,

                        details:
                            event.details,

                        timestamp:
                            event.timestamp

                    }
                );

        } catch (error) {

            console.error(
                "Socket proctoring event error:",
                error
            );

        }

    }
);

        // =========================================
        // JOIN EXAM
        // =========================================

        socket.on(
            "joinExam",
            async payload => {

                try {

                    const {
                        examId,
                        attemptId
                    } =
                        payload || {};

                    if (!examId) {
                        return;
                    }

                    const exam =
                        await Exam.findById(
                            examId
                        );

                    if (!exam) {
                        return;
                    }

                    // =====================================
                    // TEACHER
                    // =====================================

                    if (
                        user.role ===
                        "teacher"
                    ) {

                        if (
                            String(
                                exam.teacherId
                            ) !==
                            String(
                                user._id
                            )
                        ) {

                            socket.emit(
                                "socket:error",
                                {
                                    message:
                                        "You do not own this exam."
                                }
                            );

                            return;
                        }

                        socket.data.role =
                            "teacher";

                        socket.data.examId =
                            String(examId);

                        socket.join(
                            `exam:${examId}:teacher`
                        );

                        // Tell current students
                        const studentRoom =
                            io.sockets.adapter.rooms.get(
                                `exam:${examId}:students`
                            );

                        if (studentRoom) {

                            for (
                                const studentSocketId
                                of studentRoom
                            ) {

                                io
                                    .to(
                                        studentSocketId
                                    )
                                    .emit(
                                        "teacher:available",
                                        {
                                            socketId:
                                                socket.id
                                        }
                                    );

                            }

                        }

                        // Send current attempts
                        const attempts =
                            await ExamAttempt
                                .find({
                                    examId:
                                        exam._id,

                                    status: {
                                        $in: [
                                            "active",
                                            "disconnected"
                                        ]
                                    }
                                })
                                .populate(
                                    "studentId",
                                    "fullname username email photo"
                                );

                        for (
                            const attempt
                            of attempts
                        ) {

                            socket.emit(
                                "student:joined",
                                {

                                    attemptId:
                                        attempt._id,

                                    studentId:
                                        attempt.studentId?._id,

                                    studentName:
                                        attempt.studentId?.fullname ||
                                        "Student",

                                    username:
                                        attempt.studentId?.username ||
                                        "",

                                    email:
                                        attempt.studentId?.email ||
                                        "",

                                    photo:
                                        attempt.studentId?.photo ||
                                        "",

                                    startedAt:
                                        attempt.startedAt,

                                    status:
                                        attempt.status,

                                    cameraConnected:
                                        attempt.cameraConnected,

                                    microphoneConnected:
                                        attempt.microphoneConnected,

                                    fullscreenActive:
                                        attempt.fullscreenActive,

                                    violationCount:
                                        attempt.violationCount
                                }
                            );

                        }

                        return;
                    }

                    // =====================================
                    // STUDENT
                    // =====================================

                    if (
                        user.role ===
                        "student"
                    ) {

                        const attempt =
                            await ExamAttempt
                                .findOne({
                                    _id:
                                        attemptId,

                                    examId:
                                        exam._id,

                                    studentId:
                                        user._id
                                });

                        if (!attempt) {

                            socket.emit(
                                "socket:error",
                                {
                                    message:
                                        "Exam attempt not found."
                                }
                            );

                            return;
                        }

                        if (
                            attempt.status ===
                                "submitted" ||
                            attempt.status ===
                                "auto-submitted"
                        ) {

                            socket.emit(
                                "socket:error",
                                {
                                    message:
                                        "Exam attempt is finished."
                                }
                            );

                            return;
                        }

                        socket.data.role =
                            "student";

                        socket.data.examId =
                            String(examId);

                        socket.data.attemptId =
                            String(attemptId);

                        socket.data.studentId =
                            String(user._id);

                        socket.join(
                            `exam:${examId}:students`
                        );

                        attempt.status =
                            "active";

                        attempt.lastHeartbeat =
                            new Date();

                        await attempt.save();

                        const teacherRoom =
                            io.sockets.adapter.rooms.get(
                                `exam:${examId}:teacher`
                            );

                        if (teacherRoom) {

                            for (
                                const teacherSocketId
                                of teacherRoom
                            ) {

                                socket.emit(
                                    "teacher:available",
                                    {
                                        socketId:
                                            teacherSocketId
                                    }
                                );

                            }

                        }

                        io
                            .to(
                                `exam:${examId}:teacher`
                            )
                            .emit(
                                "student:joined",
                                {

                                    attemptId:
                                        attempt._id,

                                    studentId:
                                        user._id,

                                    studentName:
                                        user.fullname ||
                                        "Student",

                                    username:
                                        user.username ||
                                        "",

                                    email:
                                        user.email ||
                                        "",

                                    photo:
                                        user.photo ||
                                        "",

                                    startedAt:
                                        attempt.startedAt,

                                    status:
                                        "active",

                                    cameraConnected:
                                        attempt.cameraConnected,

                                    microphoneConnected:
                                        attempt.microphoneConnected,

                                    fullscreenActive:
                                        attempt.fullscreenActive,

                                    violationCount:
                                        attempt.violationCount,

                                    socketId:
                                        socket.id
                                }
                            );

                    }

                } catch (error) {

                    console.error(
                        "joinExam socket error:",
                        error
                    );

                }

            }
        );


        // =========================================
        // HEARTBEAT
        // =========================================

        socket.on(
            "student:heartbeat",
            async data => {

                try {

                    if (
                        socket.data.role !==
                        "student"
                    ) {
                        return;
                    }

                    const attempt =
                        await ExamAttempt.findOne({
                            _id:
                                socket.data.attemptId,

                            examId:
                                socket.data.examId,

                            studentId:
                                socket.data.studentId
                        });

                    if (!attempt) {
                        return;
                    }

                    attempt.lastHeartbeat =
                        new Date();

                    attempt.cameraConnected =
                        Boolean(
                            data?.cameraConnected
                        );

                    attempt.microphoneConnected =
                        Boolean(
                            data?.microphoneConnected
                        );

                    attempt.fullscreenActive =
                        Boolean(
                            data?.fullscreenActive
                        );

                    if (
                        attempt.status !==
                            "submitted" &&
                        attempt.status !==
                            "auto-submitted"
                    ) {

                        attempt.status =
                            "active";

                    }

                    await attempt.save();

                    io
                        .to(
                            `exam:${socket.data.examId}:teacher`
                        )
                        .emit(
                            "student:status",
                            {

                                attemptId:
                                    attempt._id,

                                studentId:
                                    socket.data.studentId,

                                cameraConnected:
                                    attempt.cameraConnected,

                                microphoneConnected:
                                    attempt.microphoneConnected,

                                fullscreenActive:
                                    attempt.fullscreenActive,

                                lastHeartbeat:
                                    attempt.lastHeartbeat,

                                status:
                                    attempt.status
                            }
                        );

                } catch (error) {

                    console.error(
                        "Socket heartbeat error:",
                        error
                    );

                }

            }
        );


        // =========================================
        // WEBRTC OFFER
        // =========================================

        socket.on(
            "webrtc:offer",
            ({
                targetSocketId,
                offer
            }) => {

                if (!targetSocketId || !offer) {
                    return;
                }

                const target =
                    io.sockets.sockets.get(
                        targetSocketId
                    );

                if (!target) {
                    return;
                }

                if (
                    target.data.examId !==
                    socket.data.examId
                ) {
                    return;
                }

                target.emit(
                    "webrtc:offer",
                    {
                        fromSocketId:
                            socket.id,

                        offer,

                        studentId:
                            socket.data.studentId
                    }
                );

            }
        );


        // =========================================
        // WEBRTC ANSWER
        // =========================================

        socket.on(
            "webrtc:answer",
            ({
                targetSocketId,
                answer
            }) => {

                if (!targetSocketId || !answer) {
                    return;
                }

                const target =
                    io.sockets.sockets.get(
                        targetSocketId
                    );

                if (!target) {
                    return;
                }

                if (
                    target.data.examId !==
                    socket.data.examId
                ) {
                    return;
                }

                target.emit(
                    "webrtc:answer",
                    {
                        fromSocketId:
                            socket.id,

                        answer
                    }
                );

            }
        );


        // =========================================
        // ICE CANDIDATE
        // =========================================

        socket.on(
            "webrtc:ice-candidate",
            ({
                targetSocketId,
                candidate
            }) => {

                if (
                    !targetSocketId ||
                    !candidate
                ) {
                    return;
                }

                const target =
                    io.sockets.sockets.get(
                        targetSocketId
                    );

                if (!target) {
                    return;
                }

                if (
                    target.data.examId !==
                    socket.data.examId
                ) {
                    return;
                }

                target.emit(
                    "webrtc:ice-candidate",
                    {
                        fromSocketId:
                            socket.id,

                        candidate
                    }
                );

            }
        );





                // =========================================
        // TEACHER VOICE OFFER
        // =========================================

        socket.on(
            "teacher:voice-offer",
            async ({
                targetSocketId,
                offer
            }) => {

                try {

                    if (
                        socket.data.role !==
                        "teacher"
                    ) {
                        return;
                    }

                    if (
                        !targetSocketId ||
                        !offer
                    ) {
                        return;
                    }

                    const exam =
                        await Exam.findById(
                            socket.data.examId
                        );

                    if (
                        !exam ||
                        String(exam.teacherId) !==
                        String(socket.data.userId)
                    ) {
                        return;
                    }

                    const target =
                        io.sockets.sockets.get(
                            targetSocketId
                        );

                    if (
                        !target ||
                        target.data.role !==
                        "student" ||
                        target.data.examId !==
                        socket.data.examId
                    ) {
                        return;
                    }

                    const attempt =
                        await ExamAttempt.findOne({
                            _id:
                                target.data.attemptId,

                            examId:
                                exam._id,

                            studentId:
                                target.data.studentId
                        });

                    if (
                        !attempt ||
                        attempt.status ===
                            "submitted" ||
                        attempt.status ===
                            "auto-submitted"
                    ) {
                        return;
                    }

                    target.emit(
                        "teacher:voice-offer",
                        {
                            fromSocketId:
                                socket.id,

                            offer
                        }
                    );

                } catch (error) {

                    console.error(
                        "Teacher voice offer error:",
                        error
                    );

                }

            }
        );


        // =========================================
        // TEACHER VOICE ANSWER
        // =========================================

        socket.on(
            "teacher:voice-answer",
            async ({
                targetSocketId,
                answer
            }) => {

                try {

                    if (
                        socket.data.role !==
                        "student"
                    ) {
                        return;
                    }

                    if (
                        !targetSocketId ||
                        !answer
                    ) {
                        return;
                    }

                    const target =
                        io.sockets.sockets.get(
                            targetSocketId
                        );

                    if (
                        !target ||
                        target.data.role !==
                        "teacher" ||
                        target.data.examId !==
                        socket.data.examId
                    ) {
                        return;
                    }

                    const exam =
                        await Exam.findById(
                            socket.data.examId
                        );

                    if (
                        !exam ||
                        String(exam.teacherId) !==
                        String(target.data.userId)
                    ) {
                        return;
                    }

                    target.emit(
                        "teacher:voice-answer",
                        {
                            fromSocketId:
                                socket.id,

                            answer
                        }
                    );

                } catch (error) {

                    console.error(
                        "Teacher voice answer error:",
                        error
                    );

                }

            }
        );


        // =========================================
        // TEACHER VOICE ICE
        // =========================================

        socket.on(
            "teacher:voice-ice",
            async ({
                targetSocketId,
                candidate
            }) => {

                try {

                    if (
                        !targetSocketId ||
                        !candidate
                    ) {
                        return;
                    }

                    const target =
                        io.sockets.sockets.get(
                            targetSocketId
                        );

                    if (!target) {
                        return;
                    }

                    if (
                        target.data.examId !==
                        socket.data.examId
                    ) {
                        return;
                    }

                    const validPair =
                        (
                            socket.data.role ===
                            "teacher" &&
                            target.data.role ===
                            "student"
                        ) ||
                        (
                            socket.data.role ===
                            "student" &&
                            target.data.role ===
                            "teacher"
                        );

                    if (!validPair) {
                        return;
                    }

                    const exam =
                        await Exam.findById(
                            socket.data.examId
                        );

                    if (!exam) {
                        return;
                    }

                    if (
                        socket.data.role ===
                        "teacher"
                    ) {

                        if (
                            String(
                                exam.teacherId
                            ) !==
                            String(
                                socket.data.userId
                            )
                        ) {
                            return;
                        }

                    } else {

                        if (
                            String(
                                exam.teacherId
                            ) !==
                            String(
                                target.data.userId
                            )
                        ) {
                            return;
                        }

                    }

                    target.emit(
                        "teacher:voice-ice",
                        {
                            fromSocketId:
                                socket.id,

                            candidate
                        }
                    );

                } catch (error) {

                    console.error(
                        "Teacher voice ICE error:",
                        error
                    );

                }

            }
        );


        // =========================================
        // TEACHER VOICE STOP
        // =========================================

        socket.on(
            "teacher:voice-stop",
            async ({
                targetSocketId
            }) => {

                try {

                    if (
                        socket.data.role !==
                        "teacher" ||
                        !targetSocketId
                    ) {
                        return;
                    }

                    const exam =
                        await Exam.findById(
                            socket.data.examId
                        );

                    if (
                        !exam ||
                        String(exam.teacherId) !==
                        String(socket.data.userId)
                    ) {
                        return;
                    }

                    const target =
                        io.sockets.sockets.get(
                            targetSocketId
                        );

                    if (
                        !target ||
                        target.data.role !==
                        "student" ||
                        target.data.examId !==
                        socket.data.examId
                    ) {
                        return;
                    }

                    target.emit(
                        "teacher:voice-stop"
                    );

                } catch (error) {

                    console.error(
                        "Teacher voice stop error:",
                        error
                    );

                }

            }
        );




        // =========================================
        // DISCONNECT
        // =========================================

        socket.on(
            "disconnect",
            async () => {

                try {

                    if (
                        socket.data.role ===
                        "student"
                    ) {

                        const attempt =
                            await ExamAttempt.findOne({
                                _id:
                                    socket.data.attemptId,

                                examId:
                                    socket.data.examId,

                                studentId:
                                    socket.data.studentId
                            });

                        if (
                            attempt &&
                            attempt.status !==
                                "submitted" &&
                            attempt.status !==
                                "auto-submitted"
                        ) {

                            attempt.status =
                                "disconnected";

                            attempt.lastHeartbeat =
                                new Date();

                            await attempt.save();

                        }

                        io
                            .to(
                                `exam:${socket.data.examId}:teacher`
                            )
                            .emit(
                                "student:left",
                                {

                                    attemptId:
                                        socket.data.attemptId,

                                    studentId:
                                        socket.data.studentId
                                }
                            );

                    }

                    if (
                        socket.data.role ===
                        "teacher"
                    ) {

                        io
                            .to(
                                `exam:${socket.data.examId}:students`
                            )
                            .emit(
                                "teacher:left",
                                {
                                    socketId:
                                        socket.id
                                }
                            );

                    }

                } catch (error) {

                    console.error(
                        "Socket disconnect error:",
                        error
                    );

                }

            }
        );

    }
);







// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 5000;

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
    `🚀 ExamSecure server running on port ${PORT}`
);

console.log(
    "🌐 Open: http://127.0.0.1:5000/loginPrem.html"
);

console.log(
    "🎥 WebRTC live proctoring signaling enabled."
);
       
    }
);