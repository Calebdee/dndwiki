import { useEffect, useState } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import TopBar from "./components/TopBar"
import HomePage from "./pages/HomePage"
import WikiPage from "./pages/WikiPage"
import ViewPage from "./pages/ViewPage"
import EditPage from "./pages/EditPage"
import SearchPage from "./pages/SearchPage"
import LoginPage from "./pages/LoginPage"
import ProfilePage from "./pages/ProfilePage"
import SettingsPage from "./pages/SettingsPage"

export default function App() {
  const [theme, setTheme] = useState("light")

  useEffect(() => {
    async function loadTheme() {
      // Try user settings first if logged in
      const token = localStorage.getItem("access_token")
      let appliedTheme = "light"

      if (token) {
        try {
          const res = await fetch("/api/user/settings", {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.theme) {
              appliedTheme = data.theme
              setTheme(data.theme)
            }
          }
        } catch (err) {
          console.warn("Failed to load user settings theme:", err)
        }
      }

      // Fallback to localStorage if user not logged in or API failed
      if (!token) {
        const storedTheme = localStorage.getItem("theme")
        if (storedTheme) appliedTheme = storedTheme
      }

      // Apply to body
      document.body.classList.toggle("dark", appliedTheme === "dark")
    }

    loadTheme()
  }, [])

  // Optional: dynamically update if state changes later
  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <Router>
      <div className="bg-gray-100 text-gray-900 dark:bg-[#0d1117] dark:text-gray-100 min-h-screen transition-colors duration-300">
        <TopBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/new-page" element={<WikiPage />} />
          <Route path="/:slug" element={<ViewPage />} />
          <Route path="/edit/:slug" element={<EditPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </Router>
  )
}
