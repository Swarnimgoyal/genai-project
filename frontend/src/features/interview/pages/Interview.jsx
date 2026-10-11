import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { useInterview } from "../interview.context"
import AppHeader from "../components/AppHeader"
import "../interview.scss"

const Interview = () => {
    const { interviewId } = useParams()
    const { getReport, downloadReportResume } = useInterview()
    const [ report, setReport ] = useState(null)
    const [ error, setError ] = useState("")
    const [ loadingReport, setLoadingReport ] = useState(true)
    const [ downloading, setDownloading ] = useState(false)
    const [ downloadError, setDownloadError ] = useState("")

    useEffect(() => {
        let active = true

        const load = async () => {
            setLoadingReport(true)
            setError("")
            try {
                const data = await getReport(interviewId)
                if (active) {
                    setReport(data)
                }
            } catch (err) {
                if (active) {
                    setError(err.response?.data?.message || "Could not load this report")
                }
            } finally {
                if (active) {
                    setLoadingReport(false)
                }
            }
        }

        load()

        return () => {
            active = false
        }
    }, [ getReport, interviewId ])

    const onDownload = async () => {
        setDownloadError("")
        setDownloading(true)
        try {
            await downloadReportResume(interviewId, report?.title)
        } catch (err) {
            setDownloadError(err.response?.data?.message || "Could not download the resume")
        } finally {
            setDownloading(false)
        }
    }

    return (
        <main className="interview-page">
            <AppHeader title={report?.title || "Interview report"} />
            <p className="back-link"><Link to="/">Back to reports</Link></p>

            {loadingReport ? <p className="muted">Loading report...</p> : null}
            {error ? <p className="form-error">{error}</p> : null}

            {report ? (
                <div className="report">
                    <section className="score-row">
                        <div>
                            <p className="eyebrow">Match score</p>
                            <p className="score">{report.matchScore}<span>/100</span></p>
                        </div>
                        <div className="score-actions">
                            <Link className="button primary-button" to={`/interview/${interviewId}/prep`}>Practice these questions</Link>
                            <button className="button ghost-button" type="button" onClick={onDownload} disabled={downloading}>
                                {downloading ? "Building PDF..." : "Download tailored resume"}
                            </button>
                            {downloadError ? <p className="form-error">{downloadError}</p> : null}
                        </div>
                    </section>

                    <section className="panel">
                        <h2>Skill gaps</h2>
                        {report.skillGaps?.length ? (
                            <ul className="gap-list">
                                {report.skillGaps.map((gap) => (
                                    <li key={`${gap.skill}-${gap.severity}`}>
                                        <span>{gap.skill}</span>
                                        <em className={`severity ${gap.severity}`}>{gap.severity}</em>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No skill gaps were listed.</p>}
                    </section>

                    <QuestionSection title="Technical questions" questions={report.technicalQuestions} />
                    <QuestionSection title="Behavioral questions" questions={report.behavioralQuestions} />

                    <section className="panel">
                        <h2>Preparation plan</h2>
                        {report.preparationPlan?.length ? (
                            <ol className="plan-list">
                                {report.preparationPlan.map((day) => (
                                    <li key={day.day}>
                                        <h3>Day {day.day}: {day.focus}</h3>
                                        <ul>
                                            {day.tasks?.map((task) => <li key={task}>{task}</li>)}
                                        </ul>
                                    </li>
                                ))}
                            </ol>
                        ) : <p className="muted">No preparation plan was listed.</p>}
                    </section>
                </div>
            ) : null}
        </main>
    )
}

const QuestionSection = ({ title, questions }) => {
    return (
        <section className="panel">
            <h2>{title}</h2>
            {questions?.length ? (
                <div className="question-list">
                    {questions.map((item) => (
                        <article key={item.question}>
                            <h3>{item.question}</h3>
                            <p><strong>Why they ask.</strong> {item.intention}</p>
                            <p><strong>How to answer.</strong> {item.answer}</p>
                        </article>
                    ))}
                </div>
            ) : <p className="muted">No questions were listed.</p>}
        </section>
    )
}

export default Interview
