import { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase";

function Admin() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Formulario
  const [editingId, setEditingId] = useState(null); // null = crear nuevo
  const [title, setTitle] = useState("");
  const [type, setType] = useState("movie");
  const [description, setDescription] = useState("");
  const [poster, setPoster] = useState("");
  const [year, setYear] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [genres, setGenres] = useState("");
  const [episodesText, setEpisodesText] = useState("");

  const loadUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const usersList = [];
    querySnapshot.forEach((doc) => {
      usersList.push({ id: doc.id, ...doc.data() });
    });
    setUsers(usersList);
  };

  const loadContent = async () => {
    const querySnapshot = await getDocs(collection(db, "content"));
    const contentList = [];
    querySnapshot.forEach((doc) => {
      contentList.push({ id: doc.id, ...doc.data() });
    });
    setContent(contentList);
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await loadUsers();
      await loadContent();
      setLoading(false);
    };
    loadAll();
  }, []);

  const changeStatus = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), { status: newStatus });
      setMessage(`Usuario ${newStatus === "active" ? "activado" : "desactivado"}`);
      loadUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Error al cambiar estado");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setType("movie");
    setDescription("");
    setPoster("");
    setYear("");
    setDriveLink("");
    setGenres("");
    setEpisodesText("");
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setTitle(item.title || "");
    setType(item.type || "movie");
    setDescription(item.description || "");
    setPoster(item.poster || "");
    setYear(item.year || "");
    setDriveLink(item.driveLink || "");
    setGenres((item.genres || []).join(", "));
    
    if (item.type === "series" && item.episodes) {
      const text = item.episodes.map(ep => `${ep.title} | ${ep.driveLink}`).join("\n");
      setEpisodesText(text);
    } else {
      setEpisodesText("");
    }

    // Scroll al formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddContent = async (e) => {
    e.preventDefault();
    try {
      const data = {
        title,
        type,
        description,
        poster,
        year: Number(year) || null,
        genres: genres.split(",").map(g => g.trim()).filter(g => g),
        status: "published",
        updatedAt: serverTimestamp()
      };

      if (type === "movie") {
        data.driveLink = driveLink;
        data.episodes = [];
      } else {
        const lines = episodesText.split("\n").filter(l => l.trim());
        data.episodes = lines.map((line, i) => {
          const parts = line.split("|").map(p => p.trim());
          return {
            title: parts[0] || `Episodio ${i + 1}`,
            driveLink: parts[1] || parts[0]
          };
        });
        data.driveLink = "";
      }

      if (editingId) {
        // Actualizar existente
        await updateDoc(doc(db, "content", editingId), data);
        setMessage("Contenido actualizado correctamente");
      } else {
        // Crear nuevo
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, "content"), data);
        setMessage("Contenido agregado correctamente");
      }

      resetForm();
      loadContent();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage("Error al guardar contenido");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que quieres eliminar este título?")) {
      await deleteDoc(doc(db, "content", id));
      setMessage("Eliminado correctamente");
      if (editingId === id) resetForm();
      loadContent();
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "50px" }}>Cargando...</p>;
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "30px auto", padding: "20px", color: "#eee" }}>
      <h1>Panel de Administración</h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => setTab("users")}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: tab === "users" ? "#2196F3" : "#444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Usuarios
        </button>
        <button
          onClick={() => setTab("content")}
          style={{
            padding: "10px 20px",
            backgroundColor: tab === "content" ? "#2196F3" : "#444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Películas y Series
        </button>
      </div>

      {message && (
        <p style={{ padding: "10px", backgroundColor: "#1b5e20", color: "#fff", borderRadius: "4px" }}>
          {message}
        </p>
      )}

      {tab === "users" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#333" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>Nombre</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Correo</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Estado</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Rol</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid #444" }}>
                <td style={{ padding: "12px" }}>{user.displayName}</td>
                <td style={{ padding: "12px" }}>{user.email}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    backgroundColor: user.status === "active" ? "#28a745" : user.status === "pending" ? "#ffc107" : "#dc3545",
                    color: user.status === "pending" ? "#000" : "#fff",
                    fontSize: "13px"
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: "12px" }}>{user.role}</td>
                <td style={{ padding: "12px" }}>
                  {user.status !== "active" && (
                    <button onClick={() => changeStatus(user.id, "active")} style={{ marginRight: "8px", padding: "6px 12px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                      Activar
                    </button>
                  )}
                  {user.status !== "disabled" && (
                    <button onClick={() => changeStatus(user.id, "disabled")} style={{ padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "content" && (
        <div>
          <h2>{editingId ? "Editar contenido" : "Agregar Película o Serie"}</h2>
          
          {editingId && (
            <button 
              onClick={resetForm}
              style={{ marginBottom: "15px", padding: "6px 12px", backgroundColor: "#666", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Cancelar edición
            </button>
          )}

          <form onSubmit={handleAddContent} style={{ backgroundColor: "#1e1e1e", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
            <div style={{ marginBottom: "12px" }}>
              <label>Título *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }}>
                <option value="movie">Película</option>
                <option value="series">Serie</option>
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>URL de la portada</label>
              <input type="url" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Año</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Géneros (separados por coma)</label>
              <input type="text" value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Acción, Drama" style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }} />
            </div>

            {type === "movie" ? (
              <div style={{ marginBottom: "12px" }}>
                <label>Enlace del video (Google Drive o Archive.org) *</label>
                <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} required placeholder="https://drive.google.com/... o https://archive.org/details/..." style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }} />
              </div>
            ) : (
              <div style={{ marginBottom: "12px" }}>
                <label>Episodios (uno por línea)</label>
                <p style={{ fontSize: "13px", color: "#aaa", margin: "4px 0" }}>
                  Formato: Título del episodio | enlace<br/>
                  Ejemplo:<br/>
                  Episodio 1 | https://archive.org/details/xxx<br/>
                  Episodio 2 | https://drive.google.com/file/d/xxx
                </p>
                <textarea
                  value={episodesText}
                  onChange={(e) => setEpisodesText(e.target.value)}
                  rows="8"
                  placeholder="Episodio 1 | https://..."
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#333", color: "white", border: "1px solid #555" }}
                />
              </div>
            )}

            <button type="submit" style={{ padding: "10px 20px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              {editingId ? "Guardar cambios" : "Agregar"}
            </button>
          </form>

          <h2>Contenido actual ({content.length})</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#333" }}>
                <th style={{ padding: "12px", textAlign: "left" }}>Título</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Tipo</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Año</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #444" }}>
                  <td style={{ padding: "12px" }}>{item.title}</td>
                  <td style={{ padding: "12px" }}>{item.type === "movie" ? "Película" : "Serie"}</td>
                  <td style={{ padding: "12px" }}>{item.year || "-"}</td>
                  <td style={{ padding: "12px" }}>
                    <button 
                      onClick={() => handleEdit(item)} 
                      style={{ marginRight: "8px", padding: "6px 12px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      style={{ padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Admin;