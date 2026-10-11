import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useInterview } from "../interview.context"
import AppHeader from "../components/AppHeader"
import "../interview.scss"

const Home = () => {
    const navigate = useNavigate()
    const { reports, loading, loadReports, createReport } = useInterview()
    const [ resumeFile, setResumeFile ] = useState(null)
    const [ selfDescription, setSelfDescription ] = useState("")
    const [ jobDescription, setJobDescription ] = useState("")
    const [ error, setError ] = useState("")
    const [ creating, setCreating ] = useState(false)

    useEffect(() => {
        loadReports().catch((err) => {
            setError(err.response?.data?.message || "Could not load your reports")
        })
    }, [ loadReports ])

    const onResumeFile = (e) => {
        const file = e.target.files?.[0]
        setError("")

        if (!file) {
            setResumeFile(null)
            return
        }

        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

        if (!isPdf) {
            setResumeFile(null)
            e.target.value = ""
            setError("Please choose a .pdf file")
            return
        }

        if (file.size > 8 * 1024 * 1024) {
            setResumeFile(null)
            e.target.value = ""
            setError("Please choose a PDF smaller than 8 MB")
            return
        }

        setResumeFile(file)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        if (!resumeFile) {
            setError("Please choose your resume PDF")
            return
        }

        setCreating(true)
        try {
            const resumePdf = await fileToBase64(resumeFile)
            const report = await createReport({ resumePdf, selfDescription, jobDescription })
            navigate(`/interview/${report._id}`)
        } catch (err) {
            setError(err.response?.data?.message || "Could not generate the report")
        } finally {
            setCreating(false)
        }
    }

    return (
        <main className="interview-page">
            <AppHeader
                title="Build a report"
                subtitle="Upload your resume PDF, add a short note about yourself, and paste the job you are preparing for."
            />

            <div className="interview-layout">
                <form className="panel" onSubmit={handleSubmit}>
                    <label className="file-field">
                        <span>Resume PDF</span>
                        <small>Choose the .pdf file of your resume.</small>
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={onResumeFile}
                            required
                        />
                        <strong>{resumeFile ? resumeFile.name : "No PDF chosen yet"}</strong>
                    </label>
                    <label>
                        <span>About you</span>
                        <textarea
                            className="paste-box"
                            value={selfDescription}
                            onChange={(e) => setSelfDescription(e.target.value)}
                            placeholder="What you want this role for, and anything the resume leaves out"
                            data-gramm="false"
                            data-gramm_editor="false"
                            data-enable-grammarly="false"
                            required
                        />
                    </label>
                    <label>
                        <span>Job description</span>
                        <textarea
                            className="paste-box"
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder="Click here, then paste the job description"
                            data-gramm="false"
                            data-gramm_editor="false"
                            data-enable-grammarly="false"
                            required
                        />
                    </label>
                    {error ? <p className="form-error">{error}</p> : null}
                    <button className="button primary-button" disabled={creating}>
                        {creating ? "Generating report..." : "Generate report"}
                    </button>
                </form>

                <section className="panel">
                    <h2>Your reports</h2>
                    {loading ? <p className="muted">Loading reports...</p> : null}
                    {!loading && reports.length === 0 ? <p className="muted">No reports yet. The first one will show up here.</p> : null}
                    <ul className="report-list">
                        {reports.map((report) => (
                            <li key={report._id}>
                                <Link to={`/interview/${report._id}`}>
                                    <strong>{report.title || "Untitled role"}</strong>
                                    <span>{report.matchScore ?? "—"} match</span>
                                    <time>{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ""}</time>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </main>
    )
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = String(reader.result || "")
            resolve(result.split(",")[1] || "")
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })
}

export default Home
