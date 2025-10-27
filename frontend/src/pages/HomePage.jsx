import { useState, useEffect } from "react"

export default function HomePage() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [journals, setJournals] = useState([])
  const [intro, setIntro] = useState(
    "Welcome to the self-hosted wiki for a Dungeons & Dragons world. Explore the pages below to learn about its history, characters, and adventures."
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const perPage = 10

  const isLoggedIn = !!localStorage.getItem("access_token")

  useEffect(() => {
  const token = localStorage.getItem("access_token")
  fetch("/api/pages/summary", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(res => res.json())
    .then(setPages)
    .catch(console.error)
    .finally(() => setLoading(false))
}, [])
useEffect(() => {
  fetch("/api/journals")
    .then(res => res.json())
    .then(setJournals)
    .catch(console.error)
}, [])



  const totalPages = Math.ceil(pages.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const currentPages = pages.slice(startIndex, startIndex + perPage)

  const handleNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1)
  const handlePrev = () => currentPage > 1 && setCurrentPage(currentPage - 1)

  const handleCreatePage = (e) => {
    e.preventDefault()
    if (!isLoggedIn) return setShowLoginDialog(true)
    window.location.href = "/new-page"
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      <h1 className="text-3xl font-bold text-center md:text-left">
        Dungeons & Dragons World Wiki
      </h1>

      <p className="leading-relaxed text-lg bg-gray-50 dark:bg-gray-800 p-4 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        {intro}
      </p>


      {/* --- Pages + Journals Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">

      {/* --- Existing Pages --- */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Existing Pages</h2>
          <button
            onClick={handleCreatePage}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition"
          >
            ➕ Create Page
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading pages...</p>
        ) : pages.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No pages yet. Create one!</p>
        ) : (
          <>
            <ul className="list-disc pl-6 space-y-1">
              {currentPages.map(p => (
                <li key={p.id}>
                  <a
                    href={`/${p.slug}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-4">
                <button
                  onClick={handlePrev}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-md border transition-colors duration-200 ${
                    currentPage === 1
                      ? "text-gray-400 border-gray-600 cursor-not-allowed"
                      : "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-gray-700"
                  }`}
                >
                  ← Previous
                </button>

                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-md border transition-colors duration-200 ${
                    currentPage === totalPages
                      ? "text-gray-400 border-gray-600 cursor-not-allowed"
                      : "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-gray-700"
                  }`}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- Journals Section --- */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Notes</h2>
          <button
            onClick={async () => {
              if (!isLoggedIn) return setShowLoginDialog(true)
              const title = prompt("Enter a title for the new journal:")
              if (!title) return
              const res = await fetch("/api/journals", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                },
                body: JSON.stringify({ title }),
              })
              if (res.ok) {
                const data = await res.json()
                window.location.href = `/journals/${data.id}`
              } else {
                alert("Failed to create journal.")
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition"
          >
            ➕ Create Journal
          </button>
        </div>

        {journals.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            No journals yet. Create one!
          </p>
        ) : (
          <ul className="list-disc pl-6 space-y-1">
            {journals.map(j => (
              <li key={j.id}>
                <a
                  href={`/journals/${j.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {j.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>

      {/* Login Required Dialog */}
      {showLoginDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-lg p-6 w-80 text-center border border-gray-200 dark:border-gray-700 transition-colors duration-300">
            <h2 className="text-xl font-semibold mb-3">Login Required</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You must be logged in to create a new page.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => (window.location.href = "/login")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Go to Login
              </button>
              <button
                onClick={() => setShowLoginDialog(false)}
                className="bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
