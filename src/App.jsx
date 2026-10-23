import React, { useEffect, useState } from "react";

const API_BASE = "";
const API_URL = `${API_BASE}/api/users`;
const NGROK_HEADERS = {};
 
const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  age: "",
  city: "",
  message: "",
};

export default function App() {
  const [formData, setFormData] = useState(initialForm);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const maxTotalSize = 200 * 1024 * 1024; 

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > maxTotalSize) {
      setError("All selected files combined must be 200 MB or less.");
      e.target.value = "";
      setSelectedFiles([]);
      return;
    }

    setError("");
    setSelectedFiles(files);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(API_URL, { headers: NGROK_HEADERS });
      if (!response.ok) throw new Error("Failed to fetch users");

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const body = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        body.append(key, value);
      });

      selectedFiles.forEach((file) => {
        body.append("files", file);
      });

      const response = await fetch(API_URL, {
        method: "POST",
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save user");
      }

      setSuccess(data.message);
      setFormData(initialForm);
      setSelectedFiles([]);
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  function SecureImage({ path, alt }) {
    const [src, setSrc] = useState("");

    useEffect(() => {
      let url;
      let cancelled = false;

      fetch(`${API_BASE}/${path}`, { headers: NGROK_HEADERS })
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((blob) => {
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          setSrc(url);
        })
        .catch(() => {});

      return () => {
        cancelled = true;
        if (url) URL.revokeObjectURL(url);
      };
    }, [path]);

    if (!src)
      return (
        <div className="mb-3 h-40 w-full animate-pulse rounded-lg bg-gray-100" />
      );

    return (
      <img
        src={src}
        alt={alt}
        className="mb-3 h-40 w-full rounded-lg border bg-gray-50 object-contain"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-800">
          Registration Form
        </h1>

        <p className="mb-6 text-gray-500">Submit your details to PostgreSQL.</p>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-100 p-3 text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <p className="mb-4 rounded-lg bg-green-100 p-3 text-green-700">
            {success}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[
              { name: "name", label: "Full Name", type: "text" },
              { name: "email", label: "Email Address", type: "email" },
              { name: "phone", label: "Phone Number", type: "tel" },
              { name: "password", label: "Password", type: "password" },
              { name: "age", label: "Age", type: "number" },
              { name: "city", label: "City", type: "text" },
            ].map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="mb-2 block font-medium text-gray-700"
                >
                  {field.label}
                </label>

                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  value={formData[field.name]}
                  onChange={handleChange}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  required
                  min={field.name === "age" ? 1 : undefined}
                  max={field.name === "age" ? 120 : undefined}
                  minLength={field.name === "password" ? 8 : undefined}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ))}
          </div>

          <div>
            <label
              htmlFor="message"
              className="mb-2 block font-medium text-gray-700"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              placeholder="Write your message..."
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="files"
              className="mb-2 block font-medium text-gray-700"
            >
              Upload Files (up to 200 MB total)
            </label>

            <input
              id="files"
              name="files"
              type="file"
              multiple
              onChange={handleFileChange}
              className="block w-full rounded-lg border border-gray-300 p-3"
            />

            <p className="mt-2 text-sm text-gray-500">
              Select multiple files at once. Combined size limit: 200 MB.
            </p>

            {selectedFiles.length > 0 && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <p className="mb-2 font-medium">
                  Selected files: {selectedFiles.length}
                </p>

                <ul className="space-y-1">
                  {selectedFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="break-all text-sm text-gray-600"
                    >
                      {file.name} — {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Submit Form"}
          </button>
        </form>
      </div>

      <div className="mx-auto mt-8 max-w-5xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-gray-800">
            Saved Users ({users.length})
          </h2>

          <button
            onClick={fetchUsers}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">City</th>
                <th className="p-3">Message</th>
                 <th className="p-3">Files</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b align-top">
                  <td className="p-3">{user.name}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.phone}</td>
                  <td className="p-3">{user.city}</td>
                   <td className="p-3">{user.message}</td>
                  <td className="min-w-64 p-3">
                    {user.files?.length > 0 ? (
                      <div className="space-y-3">
                        {user.files.map((file) => (
                          <div
                            key={file.id}
                            className="rounded-lg border border-gray-200 bg-white p-3"
                          >
                            {file.mimeType?.startsWith("image/") && (
                              <SecureImage
                                path={file.relativePath}
                                alt={file.originalName}
                              />
                            )}
                            <p className="break-all font-medium text-gray-800">
                              {file.originalName}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              {(Number(file.sizeBytes) / (1024 * 1024)).toFixed(
                                2,
                              )}{" "}
                              MB · {file.mimeType}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        No files uploaded
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
