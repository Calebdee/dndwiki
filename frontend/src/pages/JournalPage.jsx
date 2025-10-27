import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { FiEdit3, FiSave, FiPlus } from "react-icons/fi"

export default function JournalPage() {
  const { journalId } = useParams()
  const [journal, setJournal] = useState(null)
  const [entries, setEntries] = useState([])
  const [newEntry, setNewEntry] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState("")

  useEffect(() => {
    fetch(`/api/journals/${journalId}`)
      .then(res => res.json())
      .then(data => {
        setJournal(data.journal)
        setEntries(data.entries)
      })
  }, [journalId])

  const handleAdd = async () => {
    if (!newEntry.trim()) return
    const res = await fetch(`/api/journals/${journalId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newEntry }),
    })
    const data = await res.json()
    setEntries(prev => [...prev, data])
    setNewEntry("")
  }

  const handleEdit = async (entryId) => {
    if (!editingText.trim()) return
    const res = await fetch(`/api/journal-entries/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingText }),
    })
    const data = await res.json()
    setEntries(prev => prev.map(e => (e.id === entryId ? data : e)))
    setEditingId(null)
  }

  if (!journal) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
        Loading journal...
      </p>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">{journal.title}</h1>

      {/* Entries list */}
      <div className="space-y-4 mb-6">
        {entries.map(entry => (
          <div
            key={entry.id}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 relative"
          >
            {editingId === entry.id ? (
              <>
                <textarea
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 min-h-[80px]"
                />
                <button
                  onClick={() => handleEdit(entry.id)}
                  className="absolute top-2 right-2 text-blue-500 hover:text-blue-700"
                >
                  <FiSave size={20} />
                </button>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap">{entry.content}</p>
                <button
                  onClick={() => {
                    setEditingId(entry.id)
                    setEditingText(entry.content)
                  }}
                  className="absolute top-2 right-2 text-gray-500 hover:text-blue-500"
                >
                  <FiEdit3 size={20} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new entry */}
      <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
        <textarea
          value={newEntry}
          onChange={e => setNewEntry(e.target.value)}
          placeholder="Write a new note..."
          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 min-h-[100px]"
        />
        <div className="flex justify-end mt-2">
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
