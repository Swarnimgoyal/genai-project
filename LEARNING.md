# Learning guide

This file explains the technologies in this project: what each one is, what it does here, and which part of the app uses it. The last section is how to explain the same work in an interview, in your own words.

The product is an interview-prep app. A person registers, uploads a resume PDF, adds a short note and a job description, and the API asks Gemini for an interview report. The report has a match score, technical questions, behavioral questions, skill gaps, and a day-by-day plan. From that report they can practice an answer and get a score, or download a tailored resume PDF.

The project is two programs that talk over HTTP.

| Part | Folder | Runs on | Job |
|---|---|---|---|
| Frontend | `frontend` | `http://localhost:5173` | Pages the person sees and clicks |
| Backend | `backend` | `http://localhost:3000` | Accounts, database, AI, and PDFs |

The browser never holds the Gemini key. The React app sends the resume and the job text to the API. The API calls Gemini.

## How one feature travels through the code

Generating a report is the clearest path.

1. `frontend/src/features/interview/pages/Home.jsx` reads the PDF in the browser and turns it into base64 text.
2. Axios sends `POST /api/interview` with the cookie that proves who is logged in.
3. `backend/src/routes/interview.routes.js` sends that request through the auth middleware, then into the controller.
4. `pdf.service.js` reads the text out of the PDF.
5. `ai.service.js` asks Gemini for a JSON report that matches a Zod schema.
6. Mongoose saves that report on the `InterviewReport` collection, tied to the user.
7. React moves to `/interview/:interviewId` and renders the saved report.

Practice is the same shape: `Prep.jsx` posts the written answer to `POST /api/interview/:id/practice`, Gemini scores it, and the score is stored on that same report.

## Frontend

### React

React builds the pages out of components and keeps the screen in sync with state. When `resumeFile` or `answer` changes, React redraws only the parts that depend on that state.

Used in every file under `frontend/src`. `main.jsx` mounts the tree into the `<div id="root">` in `index.html`. `StrictMode` renders components twice in development so unsafe side effects show up early.

### React DOM

React DOM is the piece that turns React components into real browser elements. `createRoot` in `main.jsx` is the only place the app touches the page root.

### Vite

Vite is the development server and the production bundler. `npm run dev` in `frontend` starts it, serves the source files, and hot-reloads when a file changes. `npm run build` produces a static `dist` folder for deployment.

Config is `frontend/vite.config.js`. The React plugin compiles JSX.

### React Router

React Router chooses which page component to show for a URL. The map lives in `frontend/src/app.routes.jsx`.

| URL | Page | Who can open it |
|---|---|---|
| `/login` | Login | Anyone |
| `/register` | Register | Anyone |
| `/` | Home, the report form | Logged-in users |
| `/interview/:interviewId` | One saved report | Logged-in users |
| `/interview/:interviewId/prep` | Practice | Logged-in users |

`:interviewId` is a URL parameter. `useParams()` reads it. `Link` changes the page without a full reload. `Navigate` redirects. `Protected.jsx` sends a logged-out visitor to `/login`.

`App.jsx` wraps the router in `AuthProvider` and `InterviewProvider`, so every page can read the logged-in user and the interview helpers.

### Axios

Axios is the HTTP client. `frontend/src/features/auth/auth.api.js` creates one instance:

- `baseURL` is `http://localhost:3000`
- `withCredentials: true` sends the login cookie on every request

Auth calls (`/api/auth/register`, `/login`, `/logout`, `/get-me`) and interview calls (`interview.api.js`) all go through that instance. Failed responses throw, and the pages read `err.response.data.message` to show the error on the form.

### Sass

Sass is the stylesheet language. Files end in `.scss`. Nesting lets a rule live inside its parent, which is how `auth.form.scss` styles inputs only inside `main`.

| File | What it styles |
|---|---|
| `frontend/src/style.scss` | Page background, text color, font |
| `frontend/src/style/button.scss` | Shared buttons, pulled in with `@use` |
| `frontend/src/features/auth/auth.form.scss` | Login and register |
| `frontend/src/features/interview/interview.scss` | Home, report, and practice |

Vite compiles Sass while the dev server runs. No separate CSS build step.

### ESLint

ESLint flags risky JavaScript and broken React hook usage. It is a dev tool. `npm run lint` in `frontend` runs it. It does not run in the browser.

The related packages are `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, and `globals`.

## Backend

### Node.js

Node runs the API outside the browser. The backend is CommonJS (`require`), while the frontend is ES modules (`import`). That split is normal: each package chooses its own module system.

`backend/server.js` loads environment variables, connects to MongoDB, and listens on port 3000.

### Express

Express is the HTTP framework. `backend/src/app.js` builds the app:

- `express.json({ limit: "15mb" })` parses JSON bodies. The limit is high because a resume PDF is sent as base64.
- `cookieParser()` reads the `token` cookie.
- `cors(...)` allows the Vite site to call the API with cookies.
- A small middleware returns 503 when MongoDB is not connected.
- `/api/auth` and `/api/interview` are mounted from route files.

A route file only names the URL and the function. The function lives in a controller. Example: `POST /api/interview/:id/practice` is declared in `interview.routes.js` and implemented by `scorePracticeController`.

Express 5 is what this API uses. Async errors in controllers are caught with `try/catch` and sent back as JSON.

### Nodemon

Nodemon restarts the API when a backend file is saved. `npm run dev` in `backend` runs `nodemon server.js`. It is a development dependency, not something the deployed server needs.

### dotenv

dotenv reads `backend/.env` into `process.env` when the server starts. The file holds `MONGO_URI`, `JWT_SECRET`, and `GOOGLE_API_KEY`. Code asks for those names. The values stay out of the source files that get committed.

### MongoDB and Mongoose

MongoDB stores documents (JSON-like records). This app uses a database named `genai-project` on a MongoDB server at `127.0.0.1:27017`.

Mongoose is the library that talks to MongoDB from Node. `backend/src/config/database.js` calls `mongoose.connect(process.env.MONGO_URI)`.

Three models define the collections:

| Model | File | Stores |
|---|---|---|
| `users` | `models/user.model.js` | Username, email, password hash |
| `blacklistTokens` | `models/blacklist.model.js` | JWTs that were logged out |
| `InterviewReport` | `models/interviewReport.model.js` | The job, resume text, AI report, and practice scores |

A schema is the shape and the rules. `matchScore` must be 0–100. `severity` must be `low`, `medium`, or `high`. `practiceAttempts` is an array of scores saved on the report, so a refresh does not wipe practice history.

`user` on a report is an ObjectId pointing at a user. Queries always include `user: req.user.id`, so one account cannot open another account’s report.

### bcryptjs

bcryptjs hashes passwords. Register hashes with `bcrypt.hash(password, 10)` before saving. Login uses `bcrypt.compare`. The database never stores the original password. The `10` is the cost factor: higher is slower and harder to brute-force.

The package `bcrypt` is also listed in `package.json`, but the controllers use `bcryptjs`. `bcryptjs` is pure JavaScript, so it does not need a native build.

### JSON Web Token (jsonwebtoken)

A JWT is a signed string that means “this person logged in.” Register and login sign `{ id, username }` with `JWT_SECRET` and a 1-day expiry.

The token is stored in an `httpOnly` cookie named `token`. JavaScript in the browser cannot read it. `sameSite: "lax"` lets the Vite app on port 5173 send it to the API on port 3000, because both are `localhost`.

`auth.middleware.js` runs on private routes. It rejects the request when the cookie is missing, listed in `blacklistTokens`, or the signature does not match `JWT_SECRET`. A valid token is placed on `req.user`.

Logout writes the current token into `blacklistTokens` and clears the cookie. The signature would still be valid until expiry, so the blacklist is what makes logout real.

### cookie-parser

cookie-parser turns the `Cookie` header into `req.cookies`. Without it, `req.cookies.token` would be undefined. It is registered once in `app.js`.

### CORS

Browsers block a page on port 5173 from calling an API on port 3000 unless the API allows it. The `cors` package sends the headers that allow `http://localhost:5173` and allow cookies (`credentials: true`). The origin has to be exact. A different deployed URL will not work until this origin is updated.

### Zod

Zod describes the JSON shape Gemini must return, then checks the text Gemini actually returned.

`interviewReportSchema` in `ai.service.js` requires a match score, question arrays, skill gaps, a preparation plan, and a title. `practiceScoreSchema` requires a score, feedback, covered points, and missed points. `z.toJSONSchema` turns that description into JSON Schema, which is passed to Gemini as `responseJsonSchema`. After the call, `schema.safeParse` rejects a reply that does not match.

`zod-to-json-schema` is installed but unused. Zod 4 already has `z.toJSONSchema`, and the older converter produced an empty schema with Zod 4.

### Google Gen AI (`@google/genai`)

This SDK calls Gemini. `ai.service.js` creates one client with `GOOGLE_API_KEY`.

`generateStructured` tries models in this order, and retries when a model is overloaded:

1. `gemini-flash-latest`
2. `gemini-2.5-flash`
3. `gemini-3-flash-preview`

Three features use it:

| Function | What Gemini writes |
|---|---|
| `generateInterviewReport` | The full interview report |
| `generateResumePdf` | HTML for a tailored resume, which Puppeteer then prints |
| `scorePracticeAnswer` | A score and coaching for one practice answer |

The model is told to answer with JSON only (`responseMimeType: "application/json"`).

### pdf-parse

pdf-parse reads text out of a PDF. `pdf.service.js` checks that the upload starts with `%PDF-`, then calls `PDFParse` and `getText()`. The extracted text is what Gemini sees as the resume. A scanned PDF that is only a picture has no text, and the API returns an error asking for a text PDF.

The browser does not parse the PDF. It only base64-encodes the file. Parsing happens on the server.

### Puppeteer and Chrome

Puppeteer drives a real Chrome browser. For the tailored resume, Gemini returns HTML, and `generatePdfFromHtml` opens that HTML in Chrome and calls `page.pdf()`.

The Chrome looked up first is the one installed on this PC (`C:\Program Files\Google\Chrome\Application\chrome.exe`), then Edge, then Brave. Puppeteer’s own downloaded Chrome is not required on this machine.

`waitUntil: "domcontentloaded"` means printing starts when the HTML is parsed, without waiting for external images.

## Ideas that are not a single package

### Context

React context shares state without passing props through every component. `AuthProvider` loads the current user once with `/api/auth/get-me`, and stores `user`, `loading`, and the login, register, and logout functions. `useAuth()` reads that context. `InterviewProvider` does the same for the report list and for creating, fetching, and downloading a report.

### Protected pages

`Protected` is a component, not a library. While `getMe` is in flight it shows “Loading...”. If there is no user, it redirects to `/login`. Otherwise it renders the page.

## Installed but not used by the app code

These are in a `package.json` and are not imported by the project source:

| Package | Where listed | Note |
|---|---|---|
| `bcrypt` | backend | Hashing uses `bcryptjs` |
| `cores` | backend | CORS uses the `cors` package |
| `zod-to-json-schema` | backend | Zod 4’s `z.toJSONSchema` is used instead |
| `router` | frontend | Routing uses `react-router` |

## How to run it locally

MongoDB must already be running on `127.0.0.1:27017`. The copy used here lives under `%LOCALAPPDATA%\MongoDB`.

```text
cd backend
npm run dev

cd frontend
npm run dev
```

Open `http://localhost:5173`.

## How to explain this in an interview

Open with one sentence, then go deeper only if they ask.

> I built an interview-prep app. The user uploads a resume PDF and a job description. My API extracts the resume text, asks Gemini for a structured report, and saves it per user. From that report they can practice answers and download a tailored resume PDF.

If they say “walk me through the architecture,” use this:

> I split it into a React frontend and an Express API. The browser never sees the Gemini key. React talks to Express with Axios, and the login session is an httpOnly cookie. Express checks that cookie, reads MongoDB through Mongoose, and calls Gemini only after the user is authenticated. Reports are stored against the user’s id, so one account cannot open another account’s report.

### What I would say about each technology

**React.** I used function components and `useState` for form fields, loading flags, and the current practice question. When the user picks a PDF or types an answer, state changes and React redraws that part of the page. I did not put the Gemini call inside the component. The component only calls a function in my API file.

**React Router.** I defined the URLs myself in `app.routes.jsx`. Login and register are public. Home, the report, and practice are wrapped in a `Protected` component. That component calls `getMe`. If the cookie is missing or invalid, I redirect to `/login`. The report id is a route param, `:interviewId`, and I read it with `useParams`.

**Context.** I did not want to pass the user through every page, so I put login state in `AuthProvider`. On load it calls `/api/auth/get-me` once. `useAuth` is a small hook around that context. Interview list and create/download helpers live in a second provider. Pages stay thin.

**Axios.** I made one Axios instance with `baseURL` pointing at my API and `withCredentials: true`, because the session is a cookie. I let failed requests throw, and the page shows `err.response.data.message` instead of always navigating away. That was a bug I fixed: earlier a failed login still sent the user home.

**Sass.** I kept one dark theme: background, pink accent, shared button styles. Auth forms, the report, and practice each have their own stylesheet. Sass nesting kept selectors tied to the page they belong to.

**Vite.** I used it as the dev server and the bundler. `npm run dev` gives hot reload on port 5173. A production build is `npm run build`.

**Express.** I organized the API as routes, controllers, services, and models. Routes only name the URL and whether it is public or private. Controllers read `req.body` and send status codes. Services talk to Gemini, parse PDFs, and print PDFs. Models talk to MongoDB. `server.js` only connects to the database and calls `listen`.

**MongoDB and Mongoose.** I needed users, logged-out tokens, and reports. A report document holds the job description, the extracted resume text, the match score, questions, skill gaps, the prep plan, and later the practice attempts. I embedded practice attempts on the report because they only make sense for that report. I always query with both the report id and `req.user.id`.

**Passwords.** I hash with bcryptjs before `User.create`, cost factor 10. On login I `compare` the typed password with the hash. I never store or log the plain password. I check username and email together so a duplicate account returns 400.

**JWT and cookies.** After login I sign `{ id, username }` with `JWT_SECRET`, expiry one day, and set it as a cookie. `httpOnly` stops page JavaScript from reading the token. `sameSite: "lax"` still sends it from `localhost:5173` to `localhost:3000`. I did not put the token in `localStorage`, because any script on the page could steal it.

**Logout.** A JWT stays valid until it expires, so clearing the cookie is not enough if someone copied it. On logout I insert that token into a blacklist collection and clear the cookie. The auth middleware checks the blacklist before `jwt.verify`.

**CORS.** The UI and API are different ports, so the browser treats them as different origins. I allowed only `http://localhost:5173` and turned credentials on. If the origin does not match, the browser hides the response.

**Zod.** I did not trust the model to always return the fields Mongoose expects. I described the report with Zod, converted it with `z.toJSONSchema`, and passed that as Gemini’s response schema. After the call I `safeParse` the JSON. If the shape is wrong, I do not save it.

**Gemini.** I hid the SDK behind `generateStructured`. It tries `gemini-flash-latest`, then `gemini-2.5-flash`, then `gemini-3-flash-preview`. If Google returns “high demand,” I retry, then move to the next model. I used that for three jobs: the interview report, the resume HTML, and scoring a practice answer. The key stays in `.env` on the server.

**PDF upload.** I accept a `.pdf` on the client, reject anything over 8 MB, and send it as base64. On the server I check the file starts with `%PDF-`, then pdf-parse extracts the text. Gemini sees text, not the file. If the PDF is a scan with no text layer, I return 400 and tell the user. I did not parse the PDF in the browser.

**Tailored resume.** I ask Gemini for resume HTML, then Puppeteer opens that HTML in the Chrome already installed on the machine and prints an A4 PDF. I set `Content-Disposition` so the browser downloads it. This step is slow, often a minute or two, so the button stays on “Building PDF...” until the buffer comes back.

**Practice page.** I built a separate route, `/interview/:id/prep`. The questions come from the saved report. The user writes an answer. I send the question, what the interviewer is testing, a strong answer, and their answer to Gemini. I store score, feedback, covered points, and missed points on the report. The model answer stays hidden until after they submit, so the practice is real. They can score the same question again.

### Questions they often ask, and a direct answer

**Why a separate frontend and backend?**
The API holds the key, the password hashes, and the database. The UI only renders and calls HTTP. I can deploy them separately later.

**Why MongoDB instead of SQL?**
A report is one nested document: questions, gaps, a plan, and practice attempts. I did not want a table per nested list for this project. Mongoose still enforces required fields and enums.

**How does authentication work, end to end?**
Register hashes the password and sets a JWT cookie. The next request to a private route runs `authUser`. That middleware reads the cookie, rejects blacklisted tokens, verifies the signature, and sets `req.user`. `getMe` uses that id to return the profile. The React app calls `getMe` on load and keeps the user in context.

**How do you stop one user from reading another user’s report?**
Every find is `{ _id, user: req.user.id }`. A random id from someone else returns 404.

**What happens if Gemini is down or returns junk?**
Busy errors are retried across three model names. A response that fails Zod is not written to MongoDB. The client gets a 500 or 503 and shows the message on the page.

**Why was the resume download failing at first?**
Two different failures. Puppeteer was looking for its own Chrome download, and that browser was not on the machine, so I pointed it at the installed Chrome. After that, `gemini-3-flash-preview` returned 503 under load, so I added fallback models. I verified by generating a PDF from the API, not only by clicking the button.

**Why base64 instead of multipart?**
The API already accepted JSON. A resume is small enough that base64 in a 15 MB JSON limit was simpler than adding another upload library. I would switch to multipart if resumes got large.

**What would you improve next?**
Move the Chrome path and the API URL into environment variables before deployment. Put the frontend and API on HTTPS. Use `sameSite: "none"` and `secure` cookies once they are on different domains. Add a real navigation shell. The practice scores are saved, but I have not yet turned those scores into an updated match score.

**How do you run it?**
MongoDB on port 27017, `npm run dev` in `backend`, `npm run dev` in `frontend`, then open port 5173. Nodemon restarts the API when I save a server file.

Say the short version first. If they ask “how?”, then name the file and the function. You should be able to point at `auth.middleware.js` for the cookie check, `ai.service.js` for Gemini, `pdf.service.js` for the resume text, and `Prep.jsx` for the practice screen.
