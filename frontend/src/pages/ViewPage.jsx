import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { FiEdit3, FiLock, FiUnlock, FiX, FiPlus } from "react-icons/fi"

export default function ViewPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [page, setPage] = useState(null)
  const [error, setError] = useState(null)
  const [zoomImage, setZoomImage] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [showWhitelistModal, setShowWhitelistModal] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [allowedUsers, setAllowedUsers] = useState([])
  const [isLoadingAllowed, setIsLoadingAllowed] = useState(false)

  // --- Load page data ---
  useEffect(() => {
    setPage(null)
    setError(null)
    const token = localStorage.getItem("access_token")

    fetch(`/api/pages/${slug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async res => {
        if (!res.ok) {
          if (res.status === 403) throw new Error("403")
          if (res.status === 404) throw new Error("404")
          throw new Error(`Error ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        try {
          if (data.info && typeof data.info === "string") data.info = JSON.parse(data.info)
        } catch {}
        setPage(data)
      })
      .catch(err => {
        if (err.message === "403") {
          setError({ type: "restricted", message: "Private page — you must be whitelisted to view this." })
        } else if (err.message === "404") {
          setError({ type: "fatal", message: "Page not found" })
        } else {
          setError({ type: "fatal", message: err.message })
        }
      })
  }, [slug])

  // --- Load current user ---
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) return
    fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setCurrentUser(data?.username || null))
      .catch(() => setCurrentUser(null))
  }, [])

  // --- Load allowed users if private ---
  useEffect(() => {
    if (!page || page.visibility !== "private") return
    const token = localStorage.getItem("access_token")
    if (!token) return
    setIsLoadingAllowed(true)
    fetch(`/api/pages/${slug}/allowed`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(setAllowedUsers)
      .catch(() => setAllowedUsers([]))
      .finally(() => setIsLoadingAllowed(false))
  }, [page, slug])

  // --- Load whitelist modal data ---
  useEffect(() => {
    if (!showWhitelistModal) return
    const token = localStorage.getItem("access_token")
    if (!token) return
    Promise.all([
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
      fetch(`/api/pages/${slug}/allowed`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
    ])
      .then(([users, allowed]) => {
        setAllUsers(users)
        setAllowedUsers(allowed)
      })
      .catch(console.error)
  }, [showWhitelistModal, slug])

  // --- Allow a user to view page ---
  const handleAllowUser = async (username) => {
    const token = localStorage.getItem("access_token")
    if (!token) return alert("You must be logged in.")
    try {
      const res = await fetch(`/api/pages/${slug}/allow/${username}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Failed to allow user")
      setAllowedUsers(prev => [...prev, { username }])
      alert(`User ${username} allowed and notified via email.`)
    } catch (err) {
      alert(err.message)
    }
  }

  // --- Format date helper ---
  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown"
    const utcDate = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z")
    return utcDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  }

  // --- Loading guard to prevent flicker ---
  const isPageLoading = !page
  const hasToken = !!localStorage.getItem("access_token")
  const isUserLoading = hasToken && currentUser === null
  const needsAllowedCheck = page && page.visibility === "private"
  const isStillLoading = isPageLoading || isUserLoading || (needsAllowedCheck && isLoadingAllowed)

  if (isStillLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mr-3"></div>
        <span>Loading page...</span>
      </div>
    )
  }

  // --- Handle fatal/restricted errors ---
  if (error) {
    if (error.type === "restricted") {
      return (
        <div className="p-8 text-center border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 rounded-md mt-10 max-w-xl mx-auto">
          <FiLock size={40} className="mx-auto text-yellow-500 mb-3" />
          <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">
            This page is <span className="font-semibold">private</span> and owned by someone else.
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            You don’t currently have access. Ask the page owner to share it with you.
          </p>
        </div>
      )
    }
    return <p className="text-center text-red-500 mt-10">{error.message}</p>
  }

  // --- Derived permission states ---
  const isOwner = currentUser === page.created_by_username
  const isAllowed = allowedUsers.some(u => u.username === currentUser)
  const canView = page.visibility === "public" || isOwner || isAllowed
  const canEdit = isOwner || (currentUser && page.access_type === "all_users" && canView)
  const isPrivateAndRestricted = page.visibility === "private" && !canView

  // --- Handlers ---
  const handleEdit = () => navigate(`/edit/${slug}`)
  const handleToggleVisibility = async () => {
    if (!isOwner) return
    const newVisibility = page.visibility === "private" ? "public" : "private"
    if (!window.confirm(`Are you sure you want to make this page ${newVisibility}?`)) return
    const token = localStorage.getItem("access_token")
    if (!token) return alert("You must be logged in.")
    try {
      const res = await fetch(`/api/pages/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visibility: newVisibility }),
      })
      if (!res.ok) throw new Error("Failed to update visibility")
      const updated = await res.json()
      setPage(prev => ({ ...prev, visibility: updated.visibility }))
      alert(`Page visibility changed to ${updated.visibility}`)
    } catch (err) {
      alert(err.message)
    }
  }

  // --- Restricted view ---
  if (isPrivateAndRestricted) {
    return (
      <div className="p-8 text-center border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 rounded-md mt-10 max-w-xl mx-auto">
        <FiLock size={40} className="mx-auto text-yellow-500 mb-3" />
        <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">
          This page is <span className="font-semibold">private</span> and owned by{" "}
          <span className="font-semibold">{page.created_by_username}</span>.
        </p>
        <p className="text-gray-600 dark:text-gray-400 mt-1">It is not available for public viewing.</p>
      </div>
    )
  }

  // --- Main content ---
  return (
    <div className="relative max-w-5xl mx-auto px-4 py-8 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-md rounded-md border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">{page.title}</h1>

        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          {/* Edit button for owner or all_users */}
          {canEdit && (
            <button
              onClick={handleEdit}
              className="hover:text-blue-600 dark:hover:text-blue-400"
              title="Edit page"
            >
              <FiEdit3 size={22} />
            </button>
          )}

          {/* Lock/Unlock & Add User only for owner */}
          {isOwner && (
            <>
              <button
                onClick={handleToggleVisibility}
                title={`Click to change visibility (currently ${page.visibility || "public"})`}
                className={`hover:text-blue-600 dark:hover:text-blue-400 ${
                  page.visibility === "private"
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {page.visibility === "private" ? <FiLock size={20} /> : <FiUnlock size={20} />}
              </button>

              {page.visibility === "private" && (
                <button
                  onClick={() => setShowWhitelistModal(true)}
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                  title="Manage allowed users"
                >
                  <FiPlus size={18} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sidebar + Content */}
      <div className="flex flex-col md:flex-row md:gap-6">
        <aside className="md:w-1/3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 text-sm mb-6 md:mb-0 transition-colors duration-300">
          {page.main_image && (
            <img
              src={page.main_image}
              alt={page.title}
              className="w-full rounded-md mb-3 object-cover cursor-pointer"
              onClick={() => setZoomImage(page.main_image)}
            />
          )}
          {page.info && Object.keys(page.info).length > 0 ? (
            <table className="w-full text-left border-collapse">
              <tbody>
                {Object.entries(page.info).map(([key, value]) => (
                  <tr key={key} className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-1 pr-2 font-semibold capitalize text-gray-700 dark:text-gray-300">{key}</th>
                    <td
                      className="py-1 text-gray-800 dark:text-gray-200"
                      dangerouslySetInnerHTML={{ __html: value }}
                      onClick={e => {
                        const a = e.target.closest("a")
                        if (a && a.getAttribute("href")?.startsWith("/")) {
                          e.preventDefault()
                          navigate(a.getAttribute("href"))
                        }
                      }}
                    ></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 italic text-center">No sidebar info yet</p>
          )}
        </aside>

        <article
          className="prose dark:prose-invert max-w-none flex-1 transition-colors duration-300"
          dangerouslySetInnerHTML={{ __html: page.content }}
          onClick={e => {
            const a = e.target.closest("a")
            if (a && a.getAttribute("href")?.startsWith("/")) {
              e.preventDefault()
              navigate(a.getAttribute("href"))
              return
            }
            const img = e.target.closest("img")
            if (img) setZoomImage(img.src)
          }}
        />
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
        <p>
          This page was created by <span className="font-medium">{page.created_by_username}</span>
        </p>
        <p>Last modified {formatDate(page.updated_at)}</p>
      </div>

      {/* Whitelist Modal */}
      {showWhitelistModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full mx-4 p-6 border border-gray-200 dark:border-gray-700 relative">
            <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
              Manage Allowed Users
              <button
                onClick={() => setShowWhitelistModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <FiX size={22} />
              </button>
            </h2>

            {allUsers.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-300 text-center">Loading users...</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
                {allUsers.map(u => {
                  const isOwner = u.username === page.created_by_username
                  const isAllowed = allowedUsers.some(a => a.username === u.username)
                  return (
                    <li key={u.id} className="flex items-center justify-between py-2">
                      <span className={isOwner ? "font-semibold text-gray-700 dark:text-gray-300" : ""}>
                        {u.username}
                      </span>
                      {isOwner ? (
                        <span className="text-sm text-gray-500">Owner</span>
                      ) : isAllowed ? (
                        <span className="text-sm text-green-600 dark:text-green-400">Allowed</span>
                      ) : (
                        <button
                          onClick={() => handleAllowUser(u.username)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Allow
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Zoomed Image Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Zoomed"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-lg border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
            onClick={() => setZoomImage(null)}
          >
            <FiX size={28} />
          </button>
        </div>
      )}

    </div>
  )
}

