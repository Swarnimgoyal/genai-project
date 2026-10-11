const { Router } = require("express")
const interviewController = require("../controllers/interview.controller")
const authMiddleware = require("../middlewares/auth.middleware")

const interviewRouter = Router()

/**
 * @route POST /api/interview
 * @description Generate and save an interview report
 * @access Private
 */
interviewRouter.post("/", authMiddleware.authUser, interviewController.createInterviewController)

/**
 * @route GET /api/interview
 * @description List the logged-in user's interview reports
 * @access Private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getMyInterviewsController)

/**
 * @route GET /api/interview/:id
 * @description Get one interview report owned by the logged-in user
 * @access Private
 */
interviewRouter.get("/:id", authMiddleware.authUser, interviewController.getInterviewByIdController)

/**
 * @route POST /api/interview/:id/resume
 * @description Generate a tailored resume PDF for a saved report
 * @access Private
 */
interviewRouter.post("/:id/resume", authMiddleware.authUser, interviewController.downloadResumeController)

/**
 * @route POST /api/interview/:id/practice
 * @description Score one practice answer for a question on this report
 * @access Private
 */
interviewRouter.post("/:id/practice", authMiddleware.authUser, interviewController.scorePracticeController)

module.exports = interviewRouter
