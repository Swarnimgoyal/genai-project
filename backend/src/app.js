const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const mongoose = require("mongoose")

const app = express()

app.set("trust proxy", 1)
app.use(express.json({ limit: "15mb" }))
app.use(cookieParser())
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true
}))

app.get("/health", (req, res) => {
    res.status(200).json({
        ok: true,
        database: mongoose.connection.readyState === 1
    })
})

app.use((req, res, next) => {
    if (mongoose.connection.readyState === 1) {
        return next()
    }

    return res.status(503).json({
        message: "Database is unavailable. MongoDB is not connected."
    })
})

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)



module.exports = app