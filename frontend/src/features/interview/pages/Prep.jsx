import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { useInterview } from "../interview.context"
import { scorePractice } from "../interview.api"
import AppHeader from "../components/AppHeader"
import "../interview.scss"

const Prep = () => {
    const { interviewId } = useParams()
    const { getReport } = useInterview()
    const [ report, setReport ] = useState(null)
    const [ error, setError ] = useState("")
    const [ loadingReport, setLoadingReport ] = useState(true)
    const [ position, setPosition ] = useState(0)
    const [ answer, setAnswer ] = useState("")
    const [ scoring, setScoring ] = useState(false)
    const [ attempts, setAttempts ] = useState([])

    useEffect(() => {
        let active = true

        const load = async () => {
            try {
                const data = await getReport(interviewId)
                if (!active) return
                setReport(data)
                setAttempts(data.practiceAttempts || [])
                const firstKind = data.technicalQuestions?.length ? "technical" : "behavioral"
                const previous = [ ...(data.practiceAttempts || []) ].reverse().find((item) => item.kind === firstKind && item.questionIndex === 0)
                if (previous) {
                    setAnswer(previous.answer)
                }
            } catch (err) {
                if (active) {
                    setError(err.response?.data?.message || "Could not load this practice set")
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

    const questions = useMemo(() => {
        if (!report) return []
        return [
            ...(report.technicalQuestions || []).map((item, index) => ({ ...item, kind: "technical", index })),
            ...(report.behavioralQuestions || []).map((item, index) => ({ ...item, kind: "behavioral", index }))
        ]
    }, [ report ])

    const current = questions[position]
    const currentAttempt = current
        ? [ ...attempts ].reverse().find((item) => item.kind === current.kind && item.questionIndex === current.index)
        : null
    const latestScores = questions
        .map((item) => [ ...attempts ].reverse().find((attempt) => attempt.kind === item.kind && attempt.questionIndex === item.index))
        .filter(Boolean)
    const scoredCount = latestScores.length
    const average = latestScores.length
        ? Math.round(latestScores.reduce((sum, item) => sum + item.score, 0) / latestScores.length)
        : null

    const openQuestion = (nextPosition) => {
        const next = questions[nextPosition]
        const previous = [ ...attempts ].reverse().find((item) => item.kind === next.kind && item.questionIndex === next.index)
        setPosition(nextPosition)
        setAnswer(previous?.answer || "")
        setError("")
    }

    const onScore = async (e) => {
        e.preventDefault()
        if (!current) return
        setError("")
        setScoring(true)
        try {
            const data = await scorePractice(interviewId, {
                kind: current.kind,
                questionIndex: current.index,
                answer
            })
            setAttempts((currentAttempts) => [ ...currentAttempts, data.attempt ])
        } catch (err) {
            setError(err.response?.data?.message || "Could not score this answer")
        } finally {
            setScoring(false)
        }
    }

    return (
        <main className="interview-page">
            <AppHeader
                title="Practice"
                subtitle={report?.title || "Answer one question at a time. You get a score and the points you missed."}
            />
            <p className="back-link"><Link to={`/interview/${interviewId}`}>Back to the report</Link></p>

            {loadingReport ? <p className="muted">Loading questions...</p> : null}
            {error && !current ? <p className="form-error">{error}</p> : null}

            {current ? (
                <div className="prep-layout">
                    <aside className="panel question-nav">
                        <p className="muted">{scoredCount} of {questions.length} practiced{average !== null ? ` · latest average ${average}` : ""}</p>
                        <ol>
                            {questions.map((item, itemPosition) => {
                                const attempt = [ ...attempts ].reverse().find((entry) => entry.kind === item.kind && entry.questionIndex === item.index)
                                return (
                                    <li key={`${item.kind}-${item.index}`}>
                                        <button
                                            type="button"
                                            className={itemPosition === position ? "active" : ""}
                                            onClick={() => openQuestion(itemPosition)}
                                        >
                                            <span>{item.kind === "technical" ? "Technical" : "Behavioral"} {item.index + 1}</span>
                                            <strong>{attempt ? attempt.score : "—"}</strong>
                                        </button>
                                    </li>
                                )
                            })}
                        </ol>
                    </aside>

                    <form className="panel" onSubmit={onScore}>
                        <p className="eyebrow">{current.kind === "technical" ? "Technical" : "Behavioral"} · {position + 1} of {questions.length}</p>
                        <h2>{current.question}</h2>
                        <p className="muted">What they are testing: {current.intention}</p>
                        <label>
                            <span>Your answer</span>
                            <textarea
                                className="paste-box"
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Answer it the way you would in the interview"
                                data-gramm="false"
                                data-gramm_editor="false"
                                data-enable-grammarly="false"
                                required
                            />
                        </label>
                        {error ? <p className="form-error">{error}</p> : null}
                        <div className="prep-actions">
                            <button className="button primary-button" disabled={scoring}>
                                {scoring ? "Scoring..." : currentAttempt ? "Score again" : "Score answer"}
                            </button>
                            {position < questions.length - 1 ? (
                                <button className="button ghost-button" type="button" onClick={() => openQuestion(position + 1)}>
                                    Next question
                                </button>
                            ) : null}
                        </div>

                        {currentAttempt ? (
                            <section className="feedback">
                                <p className="score">{currentAttempt.score}<span>/100</span></p>
                                <p>{currentAttempt.feedback}</p>
                                {currentAttempt.covered?.length ? (
                                    <div>
                                        <h3>You covered</h3>
                                        <ul>{currentAttempt.covered.map((item) => <li key={item}>{item}</li>)}</ul>
                                    </div>
                                ) : null}
                                {currentAttempt.missed?.length ? (
                                    <div>
                                        <h3>Still missing</h3>
                                        <ul>{currentAttempt.missed.map((item) => <li key={item}>{item}</li>)}</ul>
                                    </div>
                                ) : null}
                                <details>
                                    <summary>A strong answer</summary>
                                    <p>{current.answer}</p>
                                </details>
                            </section>
                        ) : null}
                    </form>
                </div>
            ) : null}

            {!loadingReport && report && questions.length === 0 ? (
                <p className="muted">This report has no questions to practice yet.</p>
            ) : null}
        </main>
    )
}

export default Prep
