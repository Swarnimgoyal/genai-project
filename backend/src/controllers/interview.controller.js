const mongoose = require("mongoose")
const interviewReportModel = require("../models/interviewReport.model")
const { generateInterviewReport, generateResumePdf, scorePracticeAnswer } = require("../services/ai.service")
const { extractResumeText } = require("../services/pdf.service")

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id)
}

async function createInterviewController(req, res) {
    const { resumePdf, selfDescription, jobDescription } = req.body

    if (!resumePdf || !selfDescription?.trim() || !jobDescription?.trim()) {
        return res.status(400).json({
            message: "Please upload a resume PDF, a self description, and a job description"
        })
    }

    try {
        const resume = await extractResumeText(resumePdf)
        const generated = await generateInterviewReport({
            resume,
            selfDescription,
            jobDescription
        })

        const report = await interviewReportModel.create({
            ...generated,
            resume,
            selfDescription,
            jobDescription,
            user: req.user.id
        })

        return res.status(201).json({
            message: "Interview report generated",
            report
        })
    } catch (err) {
        console.error(err)
        return res.status(err.status || 500).json({
            message: err.status ? err.message : "Failed to generate the interview report"
        })
    }
}

async function getMyInterviewsController(req, res) {
    const reports = await interviewReportModel
        .find({ user: req.user.id })
        .select("title matchScore createdAt")
        .sort({ createdAt: -1 })

    return res.status(200).json({
        message: "Interview reports fetched",
        reports
    })
}

async function getInterviewByIdController(req, res) {
    if (!isValidId(req.params.id)) {
        return res.status(404).json({
            message: "Report not found"
        })
    }

    const report = await interviewReportModel.findOne({
        _id: req.params.id,
        user: req.user.id
    })

    if (!report) {
        return res.status(404).json({
            message: "Report not found"
        })
    }

    return res.status(200).json({
        message: "Interview report fetched",
        report
    })
}

async function downloadResumeController(req, res) {
    if (!isValidId(req.params.id)) {
        return res.status(404).json({
            message: "Report not found"
        })
    }

    const report = await interviewReportModel.findOne({
        _id: req.params.id,
        user: req.user.id
    })

    if (!report) {
        return res.status(404).json({
            message: "Report not found"
        })
    }

    try {
        const pdfBuffer = await generateResumePdf({
            resume: report.resume,
            selfDescription: report.selfDescription,
            jobDescription: report.jobDescription
        })

        const safeName = (report.title || "resume")
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "") || "resume"

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`)
        return res.send(Buffer.from(pdfBuffer))
    } catch (err) {
        console.error(err)

        if (err.code === "PUPPETEER_MISSING" || err.status === 503) {
            return res.status(503).json({
                message: err.message
            })
        }

        return res.status(500).json({
            message: "Failed to generate the resume PDF"
        })
    }
}

async function scorePracticeController(req, res) {
    const { kind, questionIndex, answer } = req.body

    if (![ "technical", "behavioral" ].includes(kind) || !Number.isInteger(questionIndex)) {
        return res.status(400).json({
            message: "Choose a question from this report"
        })
    }

    if (!answer?.trim() || answer.trim().length < 20) {
        return res.status(400).json({
            message: "Write a fuller answer before scoring it. A sentence or two is enough to start."
        })
    }

    if (!isValidId(req.params.id)) {
        return res.status(404).json({
            message: "Report not found"
        })
    }

    const report = await interviewReportModel.findOne({
        _id: req.params.id,
        user: req.user.id
    })

    if (!report) {
        return res.status(404).json({
            message: "Report not found"
        })
    }

    const questions = kind === "technical" ? report.technicalQuestions : report.behavioralQuestions
    const question = questions[questionIndex]

    if (!question) {
        return res.status(404).json({
            message: "That question is not on this report"
        })
    }

    try {
        const result = await scorePracticeAnswer({
            question: question.question,
            intention: question.intention,
            modelAnswer: question.answer,
            userAnswer: answer.trim()
        })

        report.practiceAttempts.push({
            kind,
            questionIndex,
            answer: answer.trim(),
            score: result.score,
            feedback: result.feedback,
            covered: result.covered,
            missed: result.missed
        })
        await report.save()

        const attempt = report.practiceAttempts[report.practiceAttempts.length - 1]

        return res.status(201).json({
            message: "Answer scored",
            attempt
        })
    } catch (err) {
        console.error(err)
        return res.status(err.status || 500).json({
            message: err.status ? err.message : "Could not score this answer"
        })
    }
}

module.exports = {
    createInterviewController,
    getMyInterviewsController,
    getInterviewByIdController,
    downloadResumeController,
    scorePracticeController
}
