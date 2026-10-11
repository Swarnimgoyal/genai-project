import { createContext, useEffect, useState } from "react";
import { getMe, login, logout, register } from "./auth.api";


export const AuthContext = createContext(null)


export const AuthProvider = ({ children }) => {

    const [ user, setUser ] = useState(null)
    const [ loading, setLoading ] = useState(true)

    useEffect(() => {
        let active = true

        const loadUser = async () => {
            try {
                const data = await getMe()
                if (active) {
                    setUser(data.user)
                }
            } catch {
                if (active) {
                    setUser(null)
                }
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        loadUser()

        return () => {
            active = false
        }
    }, [])

    const handleLogin = async ({ email, password }) => {
        const data = await login({ email, password })
        setUser(data.user)
    }

    const handleRegister = async ({ username, email, password }) => {
        const data = await register({ username, email, password })
        setUser(data.user)
    }

    const handleLogout = async () => {
        await logout()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, setUser, loading, setLoading, handleLogin, handleRegister, handleLogout }} >
            {children}
        </AuthContext.Provider>
    )
}
