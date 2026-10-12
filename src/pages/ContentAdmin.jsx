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

  // Lista: pestaña + búsqueda
  const [listTab, setListTab] = useState("series");
  const [listSearch, setListSearch] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState("movie");
  const [description, setDescription] = useState("");
  const [poster, setPoster] = useState("");
  const [year, setYear] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [trailer, setTrailer] = useState("");
  const [artists, setArtists] = useState("");
  const [seriesStatus, setSeriesStatus] = useState("adding");
  const [episodes, setEpisodes] = useState([
    { season: 1, number: 1, title: "", link: "" }
  ]);

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
    setTrailer("");
    setArtists("");
    setSeriesStatus("adding");
    setEpisodes([{ season: 1, number: 1, title: "", link: "" }]);
    setEditingId(null);
  };

  const addEpisodeField = () => {
    const last = episodes[episodes.length - 1];
    setEpisodes([
      ...episodes,
      {
        season: last?.season || 1,
        number: (last?.number || 0) + 1,
        title: "",
        link: ""
      }
    ]);
  };

  const updateEpisode = (index, field, value) => {
    const updated = [...episodes];
    if (field === "season" || field === "number") {
      updated[index][field] = Number(value) || 1;
    } else {
      updated[index][field] = value;
    }
    setEpisodes(updated);
  };

  const removeEpisode = (index) => {
    if (episodes.length === 1) return;
    setEpisodes(episodes.filter((_, i) => i !== index));
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setTitle(item.title || "");
    setType(item.type || "movie");
    setDescription(item.description || "");
    setPoster(item.poster || "");
    setYear(item.year || "");
    setDriveLink(item.driveLink || "");
    setTrailer(item.trailer || "");
    setArtists(
      Array.isArray(item.artists) ? item.artists.join(", ") : item.artists || ""
    );

    if (item.seriesStatus === "finished" || item.seriesStatus === "finalizada") {
      setSeriesStatus("finished");
    } else {
      setSeriesStatus("adding");
    }

    if (item.type === "series" && item.episodes?.length > 0) {
      setEpisodes(
        item.episodes.map((ep, i) => ({
          season: ep.season || 1,
          number: ep.number || i + 1,
          title: ep.title || "",
          link: ep.link || ep.driveLink || ""
        }))
      );
    } else {
      setEpisodes([{ season: 1, number: 1, title: "", link: "" }]);
    }

    setListTab(item.type === "series" ? "series" : "movie");
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
        trailer: trailer.trim() || null,
        artists: artists
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
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
          .map((ep) => ({
            season: Number(ep.season) || 1,
            number: Number(ep.number) || 1,
            title: ep.title || "",
            link: ep.link,
            driveLink: ep.link
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

  const statusLabel = (s) => {
    if (s === "finished" || s === "finalizada") return "Finalizada";
    return "Añadiéndose";
  };

  const filteredList = contents.filter((item) => {
    if (listTab === "series" && item.type !== "series") return false;
    if (listTab === "movie" && item.type !== "movie") return false;
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase().trim();
      if (!item.title?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const seriesCount = contents.filter((c) => c.type === "series").length;
  const movieCount = contents.filter((c) => c.type === "movie").length;

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
          {editingId ? `Editando: ${title}` : "Agregar nuevo contenido"}
        </h3>

        <div style={{ marginBottom: "14px" }}>
          <label>Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={inputStyle}
          >
            <option value="movie">Película</option>
            <option value="series">Serie</option>
          </select>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>URL de la portada (opcional)</label>
          <input
            type="url"
            value={poster}
            onChange={(e) => setPoster(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Año</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Artistas / Estrellas (separados por coma)</label>
          <input
            type="text"
            value={artists}
            onChange={(e) => setArtists(e.target.value)}
            placeholder="Vicente Fernández, Antonio Aguilar"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label>Tráiler YouTube (opcional)</label>
          <input
            type="url"
            value={trailer}
            onChange={(e) => setTrailer(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={inputStyle}
          />
        </div>

        {type === "movie" && (
          <div style={{ marginBottom: "14px" }}>
            <label>Enlace (Archive / Drive / YouTube / Mega / Dailymotion)</label>
            <input
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              required
              placeholder="https://..."
              style={inputStyle}
            />
          </div>
        )}

        {type === "series" && (
          <div
            style={{
              marginBottom: "20px",
              padding: "16px",
              backgroundColor: "#111",
              borderRadius: "8px"
            }}
          >
            <div style={{ marginBottom: "14px" }}>
              <label>Estado de la serie</label>
              <select
                value={seriesStatus}
                onChange={(e) => setSeriesStatus(e.target.value)}
                style={inputStyle}
              >
                <option value="adding">Añadiéndose</option>
                <option value="finished">Finalizada</option>
              </select>
            </div>

            <h4 style={{ marginTop: 0 }}>
              Episodios ({episodes.filter((e) => e.link.trim()).length})
            </h4>

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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px"
                  }}
                >
                  <strong>
                    T{ep.season || 1} · Ep {ep.number || index + 1}
                  </strong>
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    marginBottom: "8px"
                  }}
                >
                  <div>
                    <label style={{ fontSize: "13px", color: "#aaa" }}>Temporada</label>
                    <input
                      type="number"
                      min="1"
                      value={ep.season || 1}
                      onChange={(e) => updateEpisode(index, "season", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "13px", color: "#aaa" }}>Número</label>
                    <input
                      type="number"
                      min="1"
                      value={ep.number || index + 1}
                      onChange={(e) => updateEpisode(index, "number", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
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
                  placeholder="Enlace (Archive / Drive / YouTube / Mega / Dailymotion)"
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

      {/* LISTA CON PESTAÑAS + BUSCADOR */}
      <div
        style={{
          border: "1px solid #444",
          borderRadius: "10px",
          padding: "20px",
          backgroundColor: "#1a1a1a"
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Contenido guardado</h3>

        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setListTab("series")}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              background: listTab === "series" ? "#ff6b00" : "#333",
              color: "#fff"
            }}
          >
            Series ({seriesCount})
          </button>
          <button
            type="button"
            onClick={() => setListTab("movie")}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              background: listTab === "movie" ? "#ff6b00" : "#333",
              color: "#fff"
            }}
          >
            Películas ({movieCount})
          </button>
        </div>

        <input
          type="text"
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder={
            listTab === "series"
              ? "Buscar serie por título para agregar episodios..."
              : "Buscar película por título..."
          }
          style={{
            ...inputStyle,
            marginBottom: "18px",
            fontSize: "15px",
            border: "1px solid #ff6b00"
          }}
        />

        {loading ? (
          <p>Cargando...</p>
        ) : filteredList.length === 0 ? (
          <p style={{ color: "#888" }}>
            {listSearch
              ? `No hay resultados para "${listSearch}"`
              : listTab === "series"
              ? "No hay series todavía."
              : "No hay películas todavía."}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "18px"
            }}
          >
            {filteredList.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #444",
                  borderRadius: "10px",
                  overflow: "hidden",
                  backgroundColor: "#111"
                }}
              >
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    style={{ width: "100%", height: "140px", objectFit: "cover" }}
                  />
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
                    {item.type === "movie"
                      ? "Película"
                      : `Serie • ${item.episodes?.length || 0} eps`}
                    {item.year && ` • ${item.year}`}
                    {item.type === "series" && ` • ${statusLabel(item.seriesStatus)}`}
                  </p>
                  {item.artists?.length > 0 && (
                    <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#ffb74d" }}>
                      {Array.isArray(item.artists)
                        ? item.artists.slice(0, 3).join(", ")
                        : item.artists}
                      {Array.isArray(item.artists) && item.artists.length > 3 ? "…" : ""}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleEdit(item)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600
                      }}
                    >
                      {item.type === "series" ? "Editar / + Eps" : "Editar"}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{
                        flex: 1,
                        padding: "8px",
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
    </div>
  );
}

export default ContentAdmin;