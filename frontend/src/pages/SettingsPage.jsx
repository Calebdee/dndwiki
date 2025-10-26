import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export default function SettingsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [theme, setTheme] = useState("light")
  const [defaultVisibility, setDefaultVisibility] = useState("public")
  const [defaultEdit, setDefaultEdit] = useState("private")
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // --- Load saved settings ---
  useEffect(() => {
    async function loadSettings() {
      const token = localStorage.getItem("access_token")
      if (!token) {
        setIsLoggedIn(false)
        setLoading(false)
        return
      }

      try {
        const res = await fetch("/api/user/settings", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          setDisplayName(data.display_name || "")
          setTheme(data.theme || "light")
          setDefaultVisibility(data.default_visibility || "public")
          setDefaultEdit(data.default_edit || "private")
          setIsLoggedIn(true)

          // Apply theme instantly
          if (data.theme === "dark") {
            document.documentElement.classList.add("dark")
          } else {
            document.documentElement.classList.remove("dark")
          }
        } else if (res.status === 401) {
          setIsLoggedIn(false)
        }
      } catch (err) {
        console.error("Error loading settings:", err)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  // --- Save handler ---
  async function handleSave() {
    const token = localStorage.getItem("access_token")
    if (!token) {
      alert("You must be logged in to save settings.")
      return
    }

    const payload = {
      display_name: displayName,
      theme,
      default_visibility: defaultVisibility,
      default_edit: defaultEdit,
    }

    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to save settings")

      // Update theme immediately in UI
      if (theme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }

      alert("✅ Settings saved successfully!")

      // Redirect + reload to apply theme globally
      navigate("/")
      setTimeout(() => window.location.reload(), 100)
    } catch (err) {
      console.error(err)
      alert("Failed to save settings. Check console for details.")
    }
  }

  if (loading) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
        Loading settings...
      </p>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="text-center mt-10 text-gray-700 dark:text-gray-200">
        <h2 className="text-2xl font-semibold mb-2">Login Required</h2>
        <p className="text-gray-600 dark:text-gray-400">
          You must be logged in to view or update settings.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <h1 className="text-3xl font-bold mb-4">Settings</h1>

      {/* --- Display Name --- */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Display Name</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Change how your name appears on your profile and pages.
        </p>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter new display name"
          className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors duration-300"
        />
      </section>

      {/* --- Password --- */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Change Password</h2>
        <div className="space-y-2">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2"
          />
        </div>
      </section>

      {/* --- Theme --- */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Theme</h2>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 w-full md:w-1/2 transition-colors duration-300"
        >
          <option value="light">Light Mode</option>
          <option value="dark">Dark Mode</option>
        </select>
      </section>

      {/* --- Default Visibility --- */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Default Page Visibility</h2>
        <select
          value={defaultVisibility}
          onChange={(e) => setDefaultVisibility(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 w-full md:w-1/2"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </section>

      {/* --- Default Edit Permissions --- */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Default Edit Permissions</h2>
        <select
          value={defaultEdit}
          onChange={(e) => setDefaultEdit(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 w-full md:w-1/2"
        >
          <option value="private">Only You</option>
          <option value="all_users">All Logged-In Users</option>
        </select>
      </section>

      {/* --- Save Button --- */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-5 py-2 transition"
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}

