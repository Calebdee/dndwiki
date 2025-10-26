import { useParams } from "react-router-dom"
import { useEffect, useState } from "react"

export default function ProfilePage() {
  const { username } = useParams()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPages() {
      setLoading(true)
      setError(null)

      try {
        const token = localStorage.getItem("access_token")
        const headers = token ? { Authorization: `Bearer ${token}` } : {}

        const res = await fetch(`/api/user-pages/${username}`, { headers })

        if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
        const data = await res.json()
        setPages(data)
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Could not load profile.")
      } finally {
        setLoading(false)
      }
    }

    fetchPages()
  }, [username])

  if (loading)
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
        Loading profile...
      </p>
    )

  if (error)
    return (
      <div className="text-center mt-10 text-red-600 dark:text-red-400">
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p>{error}</p>
      </div>
    )

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-colors duration-300">
      <h1 className="text-3xl font-bold mb-4">Pages by {username}</h1>

      {pages.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No pages created yet.</p>
      ) : (
        <ul className="space-y-2 list-disc pl-5">
          {pages.map((p) => (
            <li key={p.id}>
              <a
                href={`/${p.slug}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {p.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
