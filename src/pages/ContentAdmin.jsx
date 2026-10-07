import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

function ContentAdmin() {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Formulario principal
  const [title, setTitle] = useState("");
  const [type, setType] = useState("movie");
  const [description, setDescription] = useState("");
  const [poster, setPoster] = useState("");
  const [year, setYear] = useState("");
  const [driveLink, setDriveLink] = useState(""); // solo para películas

  // Episodios (solo para series)
  const [episodes, setEpisodes] = useState([
    { number: 1, title: "", link: "" }
  ]);

  const loadContents = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "content"));
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setContents(list);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadContents();
  }, []);

  // Agregar un episodio más
  const addEpisodeField = () => {
    setEpisodes([...episodes, { number: episodes.length + 1, title: "", link: "" }]);
  };

  // Actualizar un episodio
  const updateEpisode = (index, field, value) => {
    const updated = [...episodes];
    updated[index][field] = value;
    setEpisodes(updated);
  };

  // Eliminar un episodio del formulario
  const removeEpisode = (index) => {
    if (episodes.length === 1) return;
    const updated = episodes.filter((_, i) => i !== index);
    // renumerar
    updated.forEach((ep, i) => ep.number = i + 1);
    setEpisodes(updated);
  };

  const handleAdd = async (e) => {
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
        createdAt: serverTimestamp()
      };

      if (type === "movie") {
        data.driveLink = driveLink;
      } else {
        // Serie: guardar episodios
        data.episodes = episodes.filter(ep => ep.link.trim() !== "");
      }

      await addDoc(collection(db, "content"), data);

      setMessage("Contenido agregado correctamente");
      setTitle("");
      setDescription("");
      setPoster("");
      setYear("");
      setDriveLink("");
      setEpisodes([{ number: 1, title: "", link: "" }]);
      loadContents();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage("Error al agregar contenido");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Seguro que quieres eliminar este contenido?")) return;
    try {
      await deleteDoc(doc(db, "content", id));
      setMessage("Contenido eliminado");
      loadContents();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage("Error al eliminar");
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "30px auto", padding: "20px" }}>
      <h1>Administrar Películas y Series</h1>

      {message && (
        <p style={{ padding: "10px", backgroundColor: "#d4edda", color: "#155724", borderRadius: "4px" }}>
          {message}
        </p>
      )}

      <form onSubmit={handleAdd} style={{ marginBottom: "40px", padding: "20px", border: "1px solid #444", borderRadius: "8px" }}>
        <h3>Agregar nuevo contenido</h3>

        <div style={{ marginBottom: "12px" }}>
          <label>Título</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: "100%", padding: "8px" }} />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", padding: "8px" }}>
            <option value="movie">Película</option>
            <option value="series">Serie</option>
          </select>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" style={{ width: "100%", padding: "8px" }} />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>URL de la portada (opcional)</label>
          <input type="url" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px" }} />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>Año</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: "100%", padding: "8px" }} />
        </div>

        {/* ===== PELÍCULA ===== */}
        {type === "movie" && (
          <div style={{ marginBottom: "12px" }}>
            <label>Enlace de YouTube o Google Drive</label>
            <input
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              required
              placeholder="https://www.youtube.com/watch?v=..."
              style={{ width: "100%", padding: "8px" }}
            />
          </div>
        )}

        {/* ===== SERIE (episodios) ===== */}
        {type === "series" && (
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#1a1a1a", borderRadius: "8px" }}>
            <h4 style={{ marginTop: 0 }}>Episodios</h4>

            {episodes.map((ep, index) => (
              <div key={index} style={{ marginBottom: "15px", padding: "12px", backgroundColor: "#222", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong>Episodio {ep.number}</strong>
                  {episodes.length > 1 && (
                    <button type="button" onClick={() => removeEpisode(index)} style={{ background: "#dc3545", color: "white", border: "none", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}>
                      Eliminar
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Título del episodio (opcional)"
                  value={ep.title}
                  onChange={(e) => updateEpisode(index, "title", e.target.value)}
                  style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
                />

                <input
                  type="url"
                  placeholder="Enlace de YouTube o Google Drive"
                  value={ep.link}
                  onChange={(e) => updateEpisode(index, "link", e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>
            ))}

            <button type="button" onClick={addEpisodeField} style={{ padding: "8px 16px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              + Agregar otro episodio
            </button>
          </div>
        )}

        <button type="submit" style={{ padding: "10px 20px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Agregar contenido
        </button>
      </form>

      {/* Lista de contenidos */}
      <h3>Contenido actual ({contents.length})</h3>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
          {contents.map((item) => (
            <div key={item.id} style={{ border: "1px solid #444", borderRadius: "8px", overflow: "hidden" }}>
              {item.poster && (
                <img src={item.poster} alt={item.title} style={{ width: "100%", height: "150px", objectFit: "cover" }} />
              )}
              <div style={{ padding: "12px" }}>
                <h4 style={{ margin: "0 0 8px 0" }}>{item.title}</h4>
                <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#aaa" }}>
                  {item.type === "movie" ? "Película" : `Serie • ${item.episodes?.length || 0} episodios`}
                  {item.year && ` • ${item.year}`}
                </p>
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{ padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContentAdmin;