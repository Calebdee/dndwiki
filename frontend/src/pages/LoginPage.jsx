import { useState } from "react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [regUsername, setRegUsername] = useState("")
  const [regEmail, setRegEmail] = useState("") // ✅ new
  const [regPassword, setRegPassword] = useState("")
  const [regError, setRegError] = useState(null)
  const [regSuccess, setRegSuccess] = useState(false)

  // ---- LOGIN HANDLER ----
  async function handleLogin(e) {
    e.preventDefault()
    setError(null)

    const formData = new URLSearchParams()
    formData.append("username", username)
    formData.append("password", password)

    const res = await fetch("/api/token", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })

    if (res.ok) {
      const data = await res.json()
      localStorage.setItem("access_token", data.access_token)
      window.location.href = "/" // ✅ redirect to home
    } else {
      setError("Invalid credentials")
    }
  }

  // ---- REGISTER HANDLER ----
  async function handleRegister(e) {
    e.preventDefault()
    setRegError(null)
    setRegSuccess(false)

    const payload = {
      username: regUsername,
      email: regEmail, // ✅ include email
      password: regPassword,
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const msg = await res.text()
        setRegError(msg || "Registration failed.")
        return
      }

      // ✅ Auto-login after successful registration
      const loginData = new URLSearchParams()
      loginData.append("username", regUsername)
      loginData.append("password", regPassword)

      const loginRes = await fetch("/api/token", {
        method: "POST",
        body: loginData,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })

      if (loginRes.ok) {
        const data = await loginRes.json()
        localStorage.setItem("access_token", data.access_token)
        setRegSuccess(true)
        setTimeout(() => {
          window.location.href = "/" // ✅ redirect to home
        }, 1000)
      } else {
        setRegError("Registered successfully, but login failed.")
      }
    } catch (err) {
      console.error("Registration error:", err)
      setRegError("Registration failed due to a network error.")
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-md shadow-md w-80 space-y-4"
      >
        <h1 className="text-xl font-bold text-center">Log In</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="border w-full p-2 rounded-md"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border w-full p-2 rounded-md"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded-md"
        >
          Log In
        </button>

        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="text-blue-600 hover:underline w-full text-center block"
        >
          Create an Account
        </button>
      </form>

      {/* REGISTER MODAL */}
      {showRegister && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-md shadow-md w-96 relative">
            <button
              onClick={() => setShowRegister(false)}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-4 text-center">
              Create Account
            </h2>

            {regError && <p className="text-red-500 text-sm mb-2">{regError}</p>}
            {regSuccess && (
              <p className="text-green-600 text-sm mb-2 text-center">
                ✅ Registration successful! Logging you in...
              </p>
            )}

            <form onSubmit={handleRegister} className="space-y-3">
              <input
                type="text"
                placeholder="Username"
                value={regUsername}
                onChange={e => setRegUsername(e.target.value)}
                required
                className="border w-full p-2 rounded-md"
              />
              <input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                required
                className="border w-full p-2 rounded-md"
              />
              <input
                type="password"
                placeholder="Password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                required
                className="border w-full p-2 rounded-md"
              />
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white w-full py-2 rounded-md"
              >
                Register
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
