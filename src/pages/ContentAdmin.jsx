import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginTop: "4px",
  borderRadius: "4px",
  border: "1px solid #555",
  background: "#222",
  color: "#fff",
  boxSizing: "border-box"
};

function ContentAdmin() {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("movie");
  const [description, setDescription] = useState("");
  const [poster, setPoster] = useState("");
  const [year, setYear] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [seriesStatus, setSeriesStatus] = useState("finished");
  const [episodes, setEpisodes] = useState([{ number: 1, title: "", link: "" }]);

  const loadContents = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "content"));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setContents(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadContents();
  }, []);

  const resetForm = () => {
    setTitle("");
    setType("movie");
    setDescription("");
    setPoster("");
    setYear("");
    setDriveLink("");
    setSeriesStatus("finished");
    setEpisodes([{ number: 1, title: "", link: "" }]);
    setEditingId(null);
  };

  const addEpisodeField = () => {
    setEpisodes([...episodes, { number: episodes.length + 1, title: "", link: "" }]);
  };

  const updateEpisode = (index, field, value) => {
    const updated = [...episodes];
    updated[index][field] = value;
    setEpisodes(updated);
  };

  const removeEpisode = (index) => {
    if (episodes.length === 1) return;
    const updated = episodes.filter((_, i) => i !== index);
    updated.forEach((ep, i) => (ep.number = i + 1));
    setEpisodes(updated);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setTitle(item.title || "");
    setType(item.type || "movie");
    setDescription(item.description || "");
    setPoster(item.poster || "");
    setYear(item.year || "");
    setDriveLink(item.driveLink || "");
    setSeriesStatus(item.seriesStatus || "finished");

    if (item.type === "series" && item.episodes?.length > 0) {
      setEpisodes(
        item.episodes.map((ep, i) => ({
          number: ep.number || i + 1,
          title: ep.title || "",
          link: ep.link || ""
        }))
      );
    } else {
      setEpisodes([{ number: 1, title: "", link: "" }]);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      const data = {
        title,
        type,
        description,
        poster,
        year: Number(year) || null,
        status: "published",
        seriesStatus: type === "series" ? seriesStatus : null,
        updatedAt: serverTimestamp()
      };

      if (type === "movie") {
        data.driveLink = driveLink;
        data.episodes = [];
      } else {
        data.driveLink = "";
        data.episodes = episodes
          .filter((ep) => ep.link.trim() !== "")
          .map((ep, i) => ({
            number: i + 1,
            title: ep.title || "",
            link: ep.link
          }));
      }

      if (editingId) {
        await updateDoc(doc(db, "content", editingId), data);
        setMessage("Contenido actualizado correctamente");
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, "content"), data);
        setMessage("Contenido agregado correctamente");
      }

      resetForm();
      loadContents();
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      console.error(e);
      setMessage("Error al guardar el contenido");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Seguro que quieres eliminar este contenido?")) return;
    try {
      await deleteDoc(doc(db, "content", id));
      setMessage("Contenido eliminado");
      if (editingId === id) resetForm();
      loadContents();
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      console.error(e);
      setMessage("Error al eliminar");
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "30px auto", padding: "20px", color: "#fff" }}>
      <h1>{editingId ? "Editar contenido" : "Administrar Películas y Series"}</h1>

      {message && (
        <p
          style={{
            padding: "12px",
            backgroundColor: message.includes("Error") ? "#5c1a1a" : "#1a3a1a",
            color: message.includes("Error") ? "#ff8a80" : "#a5d6a7",
            borderRadius: "6px",
            marginBottom: "20px"
          }}
        >
          {message}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: "40px",
          padding: "24px",
          border: "1px solid #444",
          borderRadius: "10px",
          backgroundColor: "#1a1a1a"
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {editingId ? "Editando contenido" : "Agregar nuevo contenido"}
        </h3>

        <div style={{ marginBottom: "14px" }}>
          <label>Título</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            <option value="movie">Película</option>
            <option value="series">Serie</option>
          </select>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" style={inputStyle} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>URL de la portada (opcional)</label>
          <input type="url" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://..." style={inputStyle} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Año</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle} />
        </div>

        {type === "movie" && (
          <div style={{ marginBottom: "14px" }}>
            <label>Enlace (Archive / Drive / YouTube / Mega)</label>
            <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} required placeholder="https://..." style={inputStyle} />
          </div>
        )}

        {type === "series" && (
          <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#111", borderRadius: "8px" }}>
            <div style={{ marginBottom: "14px" }}>
              <label>Estado de la serie</label>
              <select value={seriesStatus} onChange={(e) => setSeriesStatus(e.target.value)} style={inputStyle}>
                <option value="airing">En emisión</option>
                <option value="finished">Finalizada</option>
              </select>
            </div>

            <h4 style={{ marginTop: 0 }}>Episodios</h4>

            {episodes.map((ep, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "14px",
                  padding: "14px",
                  backgroundColor: "#1e1e1e",
                  borderRadius: "8px",
                  border: "1px solid #333"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong>Episodio {ep.number}</strong>
                  {episodes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEpisode(index)}
                      style={{
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: "13px"
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Título del episodio (opcional)"
                  value={ep.title}
                  onChange={(e) => updateEpisode(index, "title", e.target.value)}
                  style={{ ...inputStyle, marginBottom: "8px" }}
                />
                <input
                  type="url"
                  placeholder="Enlace del episodio (Archive / Drive / YouTube / Mega)"
                  value={ep.link}
                  onChange={(e) => updateEpisode(index, "link", e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={addEpisodeField}
              style={{
                padding: "9px 18px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              + Agregar otro episodio
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="submit"
            style={{
              padding: "12px 24px",
              backgroundColor: editingId ? "#ff9800" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            {editingId ? "Guardar cambios" : "Agregar contenido"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: "12px 24px",
                backgroundColor: "#555",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <h3>Contenido actual ({contents.length})</h3>

      {loading ? (
        <p>Cargando...</p>
      ) : contents.length === 0 ? (
        <p style={{ color: "#888" }}>No hay contenido todavía.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "18px" }}>
          {contents.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #444",
                borderRadius: "10px",
                overflow: "hidden",
                backgroundColor: "#1a1a1a"
              }}
            >
              {item.poster ? (
                <img src={item.poster} alt={item.title} style={{ width: "100%", height: "140px", objectFit: "cover" }} />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "140px",
                    backgroundColor: "#333",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#777"
                  }}
                >
                  Sin portada
                </div>
              )}
              <div style={{ padding: "12px" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "15px" }}>{item.title}</h4>
                <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#aaa" }}>
                  {item.type === "movie" ? "Película" : `Serie • ${item.episodes?.length || 0} eps`}
                  {item.year && ` • ${item.year}`}
                  {item.type === "series" && item.seriesStatus === "airing" && " • En emisión"}
                  {item.type === "series" && item.seriesStatus === "finished" && " • Finalizada"}
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleEdit(item)}
                    style={{
                      flex: 1,
                      padding: "7px",
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "13px"
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      flex: 1,
                      padding: "7px",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "13px"
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContentAdmin;