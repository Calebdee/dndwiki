import { useState, useEffect, useMemo, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import ReactQuill, { Quill } from "react-quill"
import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown, FiLink, FiX } from "react-icons/fi"
import "react-quill/dist/quill.snow.css"

// --- Custom collapse icon for Quill toolbar ---
const collapseIcon = `
  <svg viewBox="0 0 18 18">
    <rect class="ql-stroke" height="1" width="10" x="4" y="8"></rect>
    <rect class="ql-fill" height="1" width="10" x="4" y="8"></rect>
    <polygon class="ql-fill" points="8 4 10 4 9 3"></polygon>
    <polygon class="ql-fill" points="8 14 10 14 9 15"></polygon>
  </svg>
`
const icons = Quill.import("ui/icons")
icons["collapse"] = collapseIcon

function createQuillModules() {
  return {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"],
        ["link", "image", "video", "collapse"],
        ["clean"],
      ],
    },
  }
}

export default function EditPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [mainImage, setMainImage] = useState("")
  const [info, setInfo] = useState([])
  const [visibility, setVisibility] = useState("public")
  const [accessType, setAccessType] = useState("private")
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(null)

  const [allSlugs, setAllSlugs] = useState([])
  const [pageMap, setPageMap] = useState({})
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkQuery, setLinkQuery] = useState("")
  const [filteredSlugs, setFilteredSlugs] = useState([])
  const [activeIndex, setActiveIndex] = useState(null)
  const [activeQuill, setActiveQuill] = useState(null)

  const fieldRefs = useRef([])
  const quillRef = useRef(null)
  const modules = useMemo(() => createQuillModules(slug), [slug])

  // --- Fetch slugs ---
useEffect(() => {
  const token = localStorage.getItem("access_token")
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  fetch("/api/pages/all", { headers })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch all pages")
      return res.json()
    })
    .then(pages => {
      const map = {}
      for (const p of pages) map[p.slug] = p.title
      setPageMap(map)
      setAllSlugs(pages.map(p => p.slug))
    })
    .catch(console.error)
}, [])



 // --- Load page data ---
useEffect(() => {
  const token = localStorage.getItem("access_token")
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  fetch(`/api/pages/${slug}`, { headers })
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load page (${res.status})`)
      return res.json()
    })
    .then(data => {
      setTitle(data.title || "")
      setContent(data.content || "")
      setMainImage(data.main_image || "")
      setVisibility(data.visibility || "public")
      setAccessType(data.access_type || "private")
      try {
        let parsed = data.info
        if (typeof parsed === "string") parsed = JSON.parse(parsed)
        if (typeof parsed === "object" && parsed !== null)
          setInfo(Object.entries(parsed))
        else setInfo([])
      } catch {
        setInfo([])
      }
      setLoading(false)
    })
    .catch(err => {
      console.error("Error loading page:", err)
      setError(err.message)
      setLoading(false)
    })
}, [slug])


  // --- Detect // in sidebar fields ---
  const handleInput = (e, i) => {
    const text = e.currentTarget.innerText
    const match = text.match(/\/\/([\w-]*)$/)
    if (match) {
      const partial = match[1] || ""
      setActiveIndex(i)
      setActiveQuill(null)
      setShowLinkModal(true)
      setLinkQuery(partial)
      setFilteredSlugs(
        allSlugs.filter(s => s.toLowerCase().includes(partial.toLowerCase())).slice(0, 10)
      )
    }
  }

  // --- Detect // inside Quill editor (two-keystroke buffer) ---
  useEffect(() => {
    let checkInterval
    const attachListener = () => {
      const quill = quillRef.current?.getEditor?.()
      if (!quill || quill.__linkListenerAttached) return
      quill.__linkListenerAttached = true

      let lastTwo = ""

      const handleKeyDown = (e) => {
        lastTwo = (lastTwo + e.key).slice(-2)
        if (lastTwo === "//") {
          e.preventDefault()
          const range = quill.getSelection(true)
          if (!range) return

          setActiveQuill(quill)
          setActiveIndex(null)
          setShowLinkModal(true)
          setLinkQuery("")
          setFilteredSlugs(allSlugs.slice(0, 10))
        }
      }

      quill.root.addEventListener("keydown", handleKeyDown)
      clearInterval(checkInterval)
    }

    checkInterval = setInterval(attachListener, 300)
    return () => clearInterval(checkInterval)
  }, [allSlugs])

  // --- Insert link ---
  const insertLink = (slugChoice) => {
    if (!slugChoice) return
    const title = pageMap[slugChoice] || slugChoice
    const html = `<a href="/${slugChoice}" class="internal-link">${title}</a>`

    if (activeIndex != null) {
      const el = fieldRefs.current[activeIndex]
      const value = el.innerHTML
      el.innerHTML = value.replace(/\/\/[\w-]*$/, html)
    } else if (activeQuill) {
      const quill = activeQuill
      const range = quill.getSelection(true)
      if (!range) return
      const insertPos = range.index > 0 ? range.index - 1 : 0
      quill.deleteText(insertPos, 1)
      quill.insertText(insertPos, title, "link", `/${slugChoice}`)
      quill.setSelection(insertPos + title.length)
    }

    setShowLinkModal(false)
    if (activeQuill) setTimeout(() => activeQuill.focus(), 0)
  }

  // --- Info helpers ---
  const updateKey = (i, newKey) => {
    const arr = [...info]
    arr[i] = [newKey, arr[i][1]]
    setInfo(arr)
  }
  const addField = () => setInfo([...info, ["New Key", ""]])
  const removeField = (i) => setInfo(info.filter((_, idx) => idx !== i))
  const moveField = (i, dir) => {
    const arr = [...info]
    const ni = i + dir
    if (ni < 0 || ni >= arr.length) return
    const [moved] = arr.splice(i, 1)
    arr.splice(ni, 0, moved)
    setInfo(arr)
  }

  const handleSearchChange = (val) => {
    setLinkQuery(val)
    setFilteredSlugs(
      allSlugs.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 10)
    )
  }

  // --- Save ---
  async function handleUpdate() {
    const token = localStorage.getItem("access_token")
    if (!token) return alert("You must be logged in.")
  
    setIsUpdating(true) // 🔹 Start loading
  
    const updatedInfo = info.map(([k], i) => [k, fieldRefs.current[i]?.innerHTML || ""])
    const infoObj = Object.fromEntries(updatedInfo)
  
    try {
      const res = await fetch(`/api/pages/${slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content,
          main_image: mainImage,
          info: JSON.stringify(infoObj),
          visibility,
          access_type: accessType,
        }),
      })
  
      if (res.ok) {
        alert("✅ Page updated successfully!")
        navigate(`/${slug}`)
      } else {
        const msg = await res.text()
        alert(`Failed to update page: ${msg}`)
      }
    } catch (err) {
      alert("Network error: " + err.message)
    } finally {
      setIsUpdating(false) // 🔹 End loading
    }
  }
  

  if (loading) return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">Loading...</p>
  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>

  return (
    <div className="page-container max-w-5xl mx-auto p-4 space-y-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold">Edit Page: {title}</h1>

      {/* Title */}
      <input
        className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md p-3 w-full text-lg"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Page title"
      />

      {/* Main Image Upload */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-4">
        <h2 className="text-xl font-semibold mb-3">Main Image</h2>

        <div className="mb-4 flex flex-col md:flex-row items-center gap-3">
          <div className="flex-grow w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Main Image URL
            </label>
            <input
              type="text"
              value={mainImage}
              onChange={e => setMainImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
            />
          </div>

          <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md cursor-pointer">
            <FiPlus /> Upload
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const formData = new FormData()
                formData.append("file", file)
                formData.append("filename", `${slug}${file.name.substring(file.name.lastIndexOf("."))}`)
                const res = await fetch("/api/upload-image", { method: "POST", body: formData })
                if (res.ok) {
                  const data = await res.json()
                  setMainImage(data.url)
                } else {
                  alert("Image upload failed.")
                }
              }}
              className="hidden"
            />
          </label>
        </div>

        {mainImage && (
          <img
            src={mainImage}
            alt="Main Preview"
            className="mt-3 w-full rounded-md border border-gray-200 dark:border-gray-700 object-cover max-h-64"
          />
        )}
      </div>

      {/* Sidebar Info */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 relative">
        <h2 className="text-xl font-semibold mb-3">Sidebar Info</h2>
        {info.map(([key, value], i) => (
          <div key={i} className="flex flex-col md:flex-row items-start gap-2 mb-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded-md">
            <input
              className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 rounded w-full md:w-1/3"
              value={key}
              onChange={e => updateKey(i, e.target.value)}
            />
            <div
              ref={el => (fieldRefs.current[i] = el)}
              contentEditable
              suppressContentEditableWarning
              className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 rounded w-full md:w-2/3 min-h-[2.5rem]"
              onInput={e => handleInput(e, i)}
              dangerouslySetInnerHTML={{ __html: value }}
            />
            <div className="flex gap-2 mt-1 md:mt-0">
              <button onClick={() => moveField(i, -1)}><FiArrowUp /></button>
              <button onClick={() => moveField(i, 1)}><FiArrowDown /></button>
              <button onClick={() => removeField(i)} className="text-red-500"><FiTrash2 /></button>
            </div>
          </div>
        ))}
        <button
          onClick={addField}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md mt-2"
        >
          <FiPlus /> Add Field
        </button>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FiLink /> Insert Link
              </h3>
              <button
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                onClick={() => setShowLinkModal(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Search slug or type manually"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-md px-3 py-2 mb-3"
              value={linkQuery}
              onChange={e => handleSearchChange(e.target.value)}
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md mb-3">
              {filteredSlugs.map(sl => (
                <div
                  key={sl}
                  className="px-3 py-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900"
                  onClick={() => insertLink(sl)}
                >
                  /{sl} — {pageMap[sl]}
                </div>
              ))}
              {filteredSlugs.length === 0 && (
                <p className="px-3 py-2 text-gray-500 dark:text-gray-400">No matches found</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => insertLink(linkQuery.trim())}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Insert
              </button>
              <button
                onClick={() => setShowLinkModal(false)}
                className="bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Editor */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
        <ReactQuill
          ref={quillRef}
          value={content}
          onChange={setContent}
          modules={modules}
          className="dark:text-gray-100"
        />
      </div>

      {/* Settings */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 space-y-4">
        <h2 className="text-xl font-semibold">Page Settings</h2>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Page Visibility
          </label>
          <select
            value={visibility}
            onChange={e => setVisibility(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 w-full md:w-1/2"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Who Can Edit This Page
          </label>
          <select
            value={accessType}
            onChange={e => setAccessType(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 w-full md:w-1/2"
          >
            <option value="private">Only me</option>
            <option value="all_users">All logged in users</option>
          </select>
        </div>
      </div>

      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-5 py-2"
        onClick={handleUpdate}
      >
        Update Page
      </button>
      {isUpdating && (
      <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
        <p className="text-lg font-medium">Updating page...</p>
      </div>
    )}

    </div>
  )
}
