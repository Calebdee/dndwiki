import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { FiChevronDown } from "react-icons/fi"

export default function TopBar() {
  const [search, setSearch] = useState("")
  const [showLogin, setShowLogin] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("") // ✅ NEW FIELD
  const [password, setPassword] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("access_token"))
  const [currentUser, setCurrentUser] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // --- Periodic token check (session expiry detection) ---
  useEffect(() => {
    async function fetchUser() {
      const token = localStorage.getItem("access_token")
      if (!token) return

      try {
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401) {
          alert("Your session has expired. Please log in again.")
          localStorage.removeItem("access_token")
          setIsLoggedIn(false)
          setCurrentUser("")
          return
        }

        if (res.ok) {
          const data = await res.json()
          setCurrentUser(data.username)
        }
      } catch (err) {
        console.error("Error fetching user info:", err)
      }
    }

    if (isLoggedIn) {
      fetchUser()
      const interval = setInterval(fetchUser, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isLoggedIn])

  // --- Close dropdown on outside click ---
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // --- Search ---
  function handleSearch(e) {
    e.preventDefault()
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`)
  }

  // --- Login ---
  async function handleLogin(e) {
    e.preventDefault()
    try {
      const formData = new FormData()
      formData.append("username", username)
      formData.append("password", password)

      const res = await fetch("/api/token", { method: "POST", body: formData })
      if (!res.ok) {
        const msg = await res.text()
        alert(msg || "Login failed.")
        return
      }

      const data = await res.json()
      localStorage.setItem("access_token", data.access_token)
      setIsLoggedIn(true)
      setShowLogin(false)
      setUsername("")
      setPassword("")
      alert("Logged in successfully!")
      window.location.reload()
    } catch (err) {
      console.error("Login error:", err)
      alert("Login failed.")
    }
  }

  // --- Register (with email + auto-login + redirect) ---
  async function handleRegister(e) {
    e.preventDefault()
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }), // ✅ include email
      })

      if (!res.ok) {
        const msg = await res.text()
        alert(msg || "Registration failed.")
        return
      }

      // ✅ Automatically log in the user after successful registration
      const formData = new FormData()
      formData.append("username", username)
      formData.append("password", password)
      const loginRes = await fetch("/api/token", { method: "POST", body: formData })
      if (loginRes.ok) {
        const data = await loginRes.json()
        localStorage.setItem("access_token", data.access_token)
        setIsLoggedIn(true)
        setShowLogin(false)
        setUsername("")
        setEmail("")
        setPassword("")
        alert("Registered and logged in successfully!")
        navigate("/") // ✅ Redirect to home
        window.location.reload()
      } else {
        alert("Registered but login failed, please log in manually.")
      }
    } catch (err) {
      console.error("Registration error:", err)
      alert("Registration failed.")
    }
  }

  // --- Logout ---
  function handleLogout() {
    localStorage.removeItem("access_token")
    setIsLoggedIn(false)
    setCurrentUser("")
    setShowDropdown(false)
  }

  return (
    <header className="bg-gray-900 text-white px-4 py-2 shadow-md relative">
      <div className="flex flex-row items-center justify-between w-full max-w-7xl mx-auto space-x-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3">
          <img src="/top.png" alt="DNDWiki logo" className="h-10 w-auto object-contain max-w-[180px]" />
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex flex-1 justify-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages..."
            className="w-full max-w-md px-3 py-2 rounded-md text-gray-800 focus:outline-none"
          />
        </form>

        {/* User Dropdown / Auth */}
        <div className="flex items-center space-x-2 relative" ref={dropdownRef}>
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown((prev) => !prev)}
                className="flex items-center bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md"
              >
                <span className="mr-2">{currentUser || "User"}</span>
                <FiChevronDown />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-44 bg-white text-gray-900 rounded-md shadow-lg py-1 z-10">
                  <button
                    onClick={() => {
                      navigate(`/profile/${currentUser}`)
                      setShowDropdown(false)
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      navigate("/settings")
                      setShowDropdown(false)
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setShowLogin(true)
                setIsRegistering(false)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Log In
            </button>
          )}
        </div>
      </div>

      {/* Login/Register Modal */}
      {showLogin && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-80 text-gray-900 relative">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
            <h2 className="text-xl font-semibold mb-4 text-center">
              {isRegistering ? "Create Account" : "Login"}
            </h2>

            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="flex flex-col gap-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
                className="border border-gray-300 rounded-md p-2 w-full"
              />
              {isRegistering && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="border border-gray-300 rounded-md p-2 w-full"
                />
              )}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="border border-gray-300 rounded-md p-2 w-full"
              />
              <button
                type="submit"
                className={`${
                  isRegistering
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white rounded-md py-2 font-medium`}
              >
                {isRegistering ? "Register" : "Log In"}
              </button>
            </form>

            <p className="text-sm text-center mt-3 text-gray-600">
              {isRegistering ? (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => setIsRegistering(false)}
                    className="text-blue-600 hover:underline"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Don’t have an account?{" "}
                  <button
                    onClick={() => setIsRegistering(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Register
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </header>
  )
}
