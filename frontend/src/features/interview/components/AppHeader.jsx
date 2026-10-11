import { useNavigate } from "react-router"
import { useAuth } from "../../auth/hooks/useAuth"

const AppHeader = ({ title, subtitle }) => {
    const { user, handleLogout } = useAuth()
    const navigate = useNavigate()

    const onLogout = async () => {
        await handleLogout()
        navigate("/login")
    }

    return (
        <header className="app-header">
            <div>
                <p className="eyebrow">Interview prep</p>
                <h1>{title}</h1>
                {subtitle ? <p className="subtitle">{subtitle}</p> : null}
            </div>
            <div className="header-actions">
                <span>{user?.username}</span>
                <button className="button ghost-button" type="button" onClick={onLogout}>Log out</button>
            </div>
        </header>
    )
}

export default AppHeader
