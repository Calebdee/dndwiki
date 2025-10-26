import { useEffect, useState } from "react"
import { useLocation, Link } from "react-router-dom"

export default function SearchPage() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = params.get("q")?.toLowerCase() || ""
    setQuery(q)

    if (!q) return

    fetch("/api/pages")
      .then(res => res.json())
      .then(data => {
        const filtered = data
          .map(p => {
            let score = 0
            const slugMatch = p.slug?.toLowerCase().includes(q)
            const titleMatch = p.title?.toLowerCase().includes(q)
            const contentMatch = p.content?.toLowerCase().includes(q)

            // Safely parse info JSON if it exists
            let infoMatch = false
            if (p.info) {
              try {
                const infoObj = typeof p.info === "string" ? JSON.parse(p.info) : p.info
                infoMatch = Object.entries(infoObj || {}).some(
                  ([key, value]) =>
                    key.toLowerCase().includes(q) ||
                    String(value).toLowerCase().includes(q)
                )
              } catch {
                infoMatch = false
              }
            }

            // Assign scores
            if (slugMatch) score += 3
            if (infoMatch) score += 2
            if (titleMatch) score += 2
            if (contentMatch) score += 1

            return { ...p, score }
          })
          .filter(p => p.score > 0)
          .sort((a, b) => b.score - a.score)

        setResults(filtered)
        setLoading(false)
      })
  }, [location.search])

  if (!query)
    return (
      <div className="p-6 max-w-5xl mx-auto text-gray-800 dark:text-gray-100">
        <p className="text-gray-600 dark:text-gray-400 text-center mt-10">
          Please enter a search term.
        </p>
      </div>
    )

  return (
    <div className="p-6 max-w-5xl mx-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-colors duration-300">
      <h1 className="text-2xl font-bold mb-4">
        Search Results for:{" "}
        <span className="text-blue-600 dark:text-blue-400">{query}</span>
      </h1>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 italic">
          No results found.
        </p>
      ) : (
        <ul className="list-disc pl-6 space-y-3">
          {results.map(r => (
            <li key={r.id} className="border-b border-gray-200 dark:border-gray-700 pb-2">
              <Link
                to={`/${r.slug}`}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {r.title}
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {r.content
                  .replace(/<[^>]+>/g, "")
                  .slice(0, 150)
                  .trim()}
                ...
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
