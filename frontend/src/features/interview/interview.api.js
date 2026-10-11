import { api } from "../auth/auth.api"

export async function createInterview(payload) {
    const response = await api.post("/api/interview", payload)
    return response.data
}

export async function listInterviews() {
    const response = await api.get("/api/interview")
    return response.data
}

export async function getInterview(id) {
    const response = await api.get(`/api/interview/${id}`)
    return response.data
}

export async function scorePractice(id, payload) {
    const response = await api.post(`/api/interview/${id}/practice`, payload)
    return response.data
}

export async function downloadResume(id) {
    try {
        const response = await api.post(`/api/interview/${id}/resume`, {}, {
            responseType: "blob"
        })
        return response.data
    } catch (err) {
        if (err.response?.data instanceof Blob) {
            const text = await err.response.data.text()
            try {
                err.response.data = JSON.parse(text)
            } catch {
                err.response.data = { message: text }
            }
        }
        throw err
    }
}
