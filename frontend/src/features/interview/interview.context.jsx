import { createContext, useCallback, useContext, useState } from "react"
import { createInterview, downloadResume, getInterview, listInterviews } from "./interview.api"


export const InterviewContext = createContext(null)

export const InterviewProvider = ({ children }) => {
    const [ reports, setReports ] = useState([])
    const [ loading, setLoading ] = useState(false)

    const loadReports = useCallback(async () => {
        setLoading(true)
        try {
            const data = await listInterviews()
            setReports(data.reports)
            return data.reports
        } finally {
            setLoading(false)
        }
    }, [])

    const createReport = useCallback(async (payload) => {
        const data = await createInterview(payload)
        setReports((current) => [ data.report, ...current ])
        return data.report
    }, [])

    const getReport = useCallback(async (id) => {
        const data = await getInterview(id)
        return data.report
    }, [])

    const downloadReportResume = useCallback(async (id, title) => {
        const blob = await downloadResume(id)
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        const safeName = (title || "resume").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"
        link.href = url
        link.download = `${safeName}.pdf`
        link.click()
        URL.revokeObjectURL(url)
    }, [])

    return (
        <InterviewContext.Provider value={{ reports, loading, loadReports, createReport, getReport, downloadReportResume }}>
            {children}
        </InterviewContext.Provider>
    )
}

export const useInterview = () => {
    const context = useContext(InterviewContext)

    if (!context) {
        throw new Error("useInterview must be used within InterviewProvider")
    }

    return context
}
