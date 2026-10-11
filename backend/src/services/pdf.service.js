const { PDFParse } = require("pdf-parse")

async function extractResumeText(pdfBase64) {
    let buffer

    try {
        buffer = Buffer.from(pdfBase64, "base64")
    } catch {
        const error = new Error("The resume file could not be read")
        error.status = 400
        throw error
    }

    if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
        const error = new Error("Please upload a .pdf file")
        error.status = 400
        throw error
    }

    const parser = new PDFParse({ data: buffer })

    try {
        const result = await parser.getText({ pageJoiner: "\n" })
        const text = (result.text || "").replace(/\s+\n/g, "\n").trim()

        if (!text) {
            const error = new Error("This PDF has no selectable text. If it is a scan or a photo, export a text PDF instead.")
            error.status = 400
            throw error
        }

        return text
    } catch (err) {
        if (err.status) {
            throw err
        }

        const message = /password/i.test(err.message || "")
            ? "This PDF is password protected. Remove the password and upload it again."
            : "Could not read this PDF. Upload a normal text resume PDF."

        const error = new Error(message)
        error.status = 400
        throw error
    } finally {
        await parser.destroy().catch(() => {})
    }
}

module.exports = { extractResumeText }
