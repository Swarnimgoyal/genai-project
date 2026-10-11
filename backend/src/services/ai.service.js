const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY
})


const interviewReportSchema = z.object({
    matchScore: z.number().min(0).max(100).describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

function toGeminiSchema(schema) {
    const jsonSchema = z.toJSONSchema(schema)
    delete jsonSchema.$schema
    return jsonSchema
}

const models = [ "gemini-3.8-flash", "gemini-3-flash-preview" ]

function isBusyError(err) {
    const message = String(err?.message || "")
    return err?.status === 503 || err?.status === 429 || /UNAVAILABLE|high demand|RESOURCE_EXHAUSTED/.test(message)
}

function isMissingModel(err) {
    const message = String(err?.message || "")
    return err?.status === 404 || /NOT_FOUND|no longer available|is not found/.test(message)
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateStructured(prompt, schema) {
    let lastError

    for (const model of models) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseJsonSchema: toGeminiSchema(schema),
                    }
                })

                if (!response.text) {
                    const error = new Error("The model returned an empty response")
                    error.code = "INVALID_AI_RESPONSE"
                    throw error
                }

                const parsed = schema.safeParse(JSON.parse(response.text))

                if (!parsed.success) {
                    const error = new Error("The model returned an unexpected response shape")
                    error.code = "INVALID_AI_RESPONSE"
                    throw error
                }

                return parsed.data
            } catch (err) {
                lastError = err
                if (isMissingModel(err)) {
                    break
                }
                if (err.code === "INVALID_AI_RESPONSE" || isBusyError(err)) {
                    await wait(700 * attempt)
                    continue
                }
                throw err
            }
        }
    }

    const error = new Error("The AI service is busy right now. Wait a moment and try again.")
    error.status = 503
    error.cause = lastError
    throw error
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`

    return generateStructured(prompt, interviewReportSchema)


}



function browserExecutablePath() {
    const fs = require("fs")
    const candidates = [
        process.env.CHROME_PATH,
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium"
    ].filter(Boolean)

    return candidates.find((candidate) => fs.existsSync(candidate))
}

async function generatePdfFromHtml(htmlContent) {
    let puppeteer

    try {
        puppeteer = require("puppeteer")
    } catch {
        const error = new Error("PDF generation needs the puppeteer package, and it is not installed yet.")
        error.code = "PUPPETEER_MISSING"
        throw error
    }

    const executablePath = browserExecutablePath()
    const browser = await puppeteer.launch({
        headless: true,
        args: [ "--no-sandbox", "--disable-dev-shm-usage" ],
        ...(executablePath ? { executablePath } : {})
    })
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    const jsonContent = await generateStructured(prompt, resumePdfSchema)

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}

const practiceScoreSchema = z.object({
    score: z.number().min(0).max(100).describe("How completely the candidate's answer covers what a strong interview answer should cover, from 0 to 100"),
    feedback: z.string().describe("Two or three sentences of direct coaching on this specific answer"),
    covered: z.array(z.string()).describe("Points the candidate already covered, at most four short lines"),
    missed: z.array(z.string()).describe("Important points the candidate missed, at most four short lines")
})

async function scorePracticeAnswer({ question, intention, modelAnswer, userAnswer }) {
    const prompt = `Score this interview practice answer.
Question: ${question}
What the interviewer is testing: ${intention}
A strong answer covers: ${modelAnswer}
Candidate answer: ${userAnswer}

Judge the candidate's own wording. Do not require them to copy the strong answer. Reward the right ideas, a clear structure, and specifics. Penalize missing the point, vagueness, and incorrect claims.`

    return generateStructured(prompt, practiceScoreSchema)
}

module.exports = { generateInterviewReport, generateResumePdf, scorePracticeAnswer }
