# ExamSecure - Real-Time Upgrade

This package preserves the existing ExamSecure dashboard/login visual design and adds database-driven dedicated pages, automatic dashboard polling, real-time-style teacher/student synchronization, and persistent MongoDB notifications.

## Important
- `.env` is intentionally not included.
- `node_modules` is not included.
- Keep your credentials private.
- The supplied Google secret should be rotated if it was exposed outside your private environment.

## Run
1. Install and run MongoDB.
2. Create `.env` beside `server.js` using `.env.example`.
3. Put your own OAuth credentials in `.env` if Google/Facebook login is used.
4. Open a terminal in this folder.
5. Run `npm install`.
6. Run `npm start`.
7. Open `http://127.0.0.1:5000/`.

## Real-time behavior
The project uses lightweight 5-second polling because the original dependency set did not include Socket.IO. The database remains the source of truth. Teacher exam creation/update/delete and student submission events create MongoDB notifications, while both dashboards refresh their exam/result/statistics data automatically.

## Student pages
- student-dashboard.html
- available-exams.html
- upcoming-exams.html
- completed-exams.html
- performance.html
- leaderboard.html
- notifications.html
- student-profile.html
- student-settings.html

## Teacher pages
- teacher-dashboard.html
- create-exam.html
- manage-exams.html
- question-bank.html
- teacher-results.html
- analytics.html
- teacher-notifications.html
- teacher-profile.html
- teacher-settings.html

## Existing exam flow
Teacher creates/publishes -> MongoDB -> student upcoming/available lists -> student starts exam -> timer -> submit/auto-submit -> result -> teacher results/performance + student completed/performance + notifications.

## Security
Never commit `.env`, MongoDB credentials, OAuth secrets, passwords, or tokens.
