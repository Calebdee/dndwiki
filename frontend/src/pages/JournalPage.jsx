import { useEffect, useState, useRef } from "react"
import { useParams } from "react-router-dom"
import { FiEdit3, FiSave, FiPlus, FiTrash2, FiX } from "react-icons/fi"
import { motion, AnimatePresence } from "framer-motion"

export default function JournalPage() {
  const { journalId } = useParams()
  const [journal, setJournal] = useState(null)
  const [entries, setEntries] = useState([])
  const [newEntry, setNewEntry] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState("")
  const [currentUser, setCurrentUser] = useState("")
  const [showOnlyMine, setShowOnlyMine] = useState(false) // 👈 NEW TOGGLE
  const wsRef = useRef(null)

  const formatDate = (isoString) => {
    if (!isoString) return ""
    const utc = isoString.endsWith("Z") ? isoString : isoString + "Z"
    const date = new Date(utc)
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }
  

  // --- Fetch current user ---
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) return
    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.username && setCurrentUser(data.username))
      .catch(() => setCurrentUser(null))
  }, [])

  // --- Load journal entries ---
  useEffect(() => {
    fetch(`/api/journals/${journalId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setJournal(data.journal)
        setEntries(data.entries)
      })
  }, [journalId])
  

  // --- WebSocket setup ---
  useEffect(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws"
    const ws = new WebSocket(
      `${wsProtocol}://${window.location.hostname}:8085/ws/journals/${journalId}`
    )
    wsRef.current = ws

    ws.onopen = () => console.log("✅ WS connected:", journalId)
    ws.onclose = () => console.log("❌ WS disconnected:", journalId)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.event === "new_entry") {
          const entry = msg.data
          setEntries((prev) => {
            if (prev.some((e) => e.id === entry.id)) return prev
            return [...prev, entry]
          })
        } else if (msg.event === "delete_entry") {
          const { id } = msg.data
          setEntries((prev) => prev.filter((e) => e.id !== id))
        }
      } catch (err) {
        console.error("WS parse error:", err)
      }
    }

    return () => ws.close()
  }, [journalId])

  const [isPrivate, setIsPrivate] = useState(false)

  const handleAdd = async () => {
    if (!newEntry.trim()) return
    const res = await fetch(`/api/journals/${journalId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify({ content: newEntry, is_private: isPrivate }),
    })
    if (res.ok) {
      const data = await res.json()
      setEntries((prev) => [...prev, data]) // 👈 add locally, even if private
      setNewEntry("")
      setIsPrivate(false)
    }
  }
  


  const handleEdit = async (entryId) => {
    if (!editingText.trim()) return
    const res = await fetch(`/api/journal-entries/${entryId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify({ content: editingText }),
    })
    if (res.ok) {
      const data = await res.json()
      setEntries((prev) => prev.map((e) => (e.id === entryId ? data : e)))
      setEditingId(null)
    }
  }

  const handleTogglePrivacy = async (entryId, currentStatus) => {
    const res = await fetch(`/api/journal-entries/${entryId}/privacy`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    })
    if (res.ok) {
      const data = await res.json()
      setEntries(prev => prev.map(e => (e.id === entryId ? data : e)))
    }
  }
  

  const handleDelete = async (entryId) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return
    const res = await fetch(`/api/journal-entries/${entryId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    })
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    }
  }

  if (!journal)
    return (
      <p className="text-center mt-10 text-gray-500 dark:text-gray-400">
        Loading journal...
      </p>
    )

  // --- Filtered list ---
  const visibleEntries = showOnlyMine
    ? entries.filter(
        (e) =>
          e.created_by_username?.trim().toLowerCase() ===
          currentUser?.trim().toLowerCase()
      )
    : entries

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{journal.title}</h1>

        {/* 👇 Filter Toggle */}
        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={showOnlyMine}
            onChange={(e) => setShowOnlyMine(e.target.checked)}
            className="accent-blue-600"
          />
          <span>Show only my entries</span>
        </label>
      </div>

      {/* Entries */}
      <div className="space-y-4 mb-6">
        <AnimatePresence>
          {visibleEntries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`rounded-md p-4 relative border ${
                entry.is_private
                  ? "bg-red-50 dark:bg-red-900/40 border-red-300 dark:border-red-700"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              }`}
              
            >
              {editingId === entry.id ? (
                <>
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 min-h-[80px]"
                  />
                  <div className="flex justify-end gap-2 mt-3">
  <button
    onClick={() => handleEdit(entry.id)}
    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md"
  >
    <FiSave /> Save
  </button>
  <button
    onClick={() => handleDelete(entry.id)}
    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md"
  >
    <FiTrash2 /> Delete
  </button>
  <button
    onClick={() => handleTogglePrivacy(entry.id, entry.is_private)}
    className={`flex items-center gap-1 px-3 py-1 rounded-md text-white ${
      entry.is_private
        ? "bg-green-600 hover:bg-green-700"
        : "bg-yellow-600 hover:bg-yellow-700"
    }`}
  >
    {entry.is_private ? "Set Public" : "Set Private"}
  </button>
  <button
    onClick={() => setEditingId(null)}
    className="flex items-center gap-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md"
  >
    <FiX /> Cancel
  </button>
</div>

                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{entry.content}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-right mt-2">
                    {entry.created_by_username} • {formatDate(entry.created_at)}
                  </p>

                  {entry.created_by_username?.trim().toLowerCase() ===
                    currentUser?.trim().toLowerCase() && (
                    <button
                      onClick={() => {
                        setEditingId(entry.id)
                        setEditingText(entry.content)
                      }}
                      className="absolute top-2 right-2 text-gray-500 hover:text-blue-500"
                    >
                      <FiEdit3 size={20} />
                    </button>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* New entry */}
        <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
        <textarea
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            placeholder="Write a new note..."
            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 min-h-[100px]"
        />

        {/* 👇 Privacy toggle */}
        <div className="flex items-center justify-between mt-2">
            <label className="flex items-center space-x-2 text-sm">
            <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="accent-blue-600"
            />
            <span>Private (visible only to me)</span>
            </label>

            <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
            <FiPlus /> Add Entry
            </button>
        </div>
        </div>

    </div>
  )
}
