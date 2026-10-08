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
  const [tab, setTab] = useState("users"); // "users" o "content"
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Formulario para agregar contenido
  const [title, setTitle] = useState("");
  const [type, setType] = useState("movie");
  const [description, setDescription] = useState("");
  const [poster, setPoster] = useState("");
  const [year, setYear] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [genres, setGenres] = useState("");

  // Cargar usuarios
  const loadUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const usersList = [];
    querySnapshot.forEach((doc) => {
      usersList.push({ id: doc.id, ...doc.data() });
    });
    setUsers(usersList);
  };

  // Cargar contenido
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

  // Activar / Desactivar usuario
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

  // Agregar película o serie
  const handleAddContent = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "content"), {
        title,
        type,
        description,
        poster,
        year: Number(year) || null,
        driveLink,
        genres: genres.split(",").map(g => g.trim()).filter(g => g),
        status: "published",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setMessage("Contenido agregado correctamente");
      setTitle("");
      setDescription("");
      setPoster("");
      setYear("");
      setDriveLink("");
      setGenres("");
      loadContent();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage("Error al agregar contenido");
    }
  };

  // Eliminar contenido
  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que quieres eliminar este título?")) {
      await deleteDoc(doc(db, "content", id));
      setMessage("Eliminado correctamente");
      loadContent();
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "50px" }}>Cargando...</p>;
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "30px auto", padding: "20px" }}>
      <h1>Panel de Administración</h1>

      {/* Pestañas */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => setTab("users")}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: tab === "users" ? "#2196F3" : "#555",
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
            backgroundColor: tab === "content" ? "#2196F3" : "#555",
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
        <p style={{ padding: "10px", backgroundColor: "#d4edda", color: "#155724", borderRadius: "4px" }}>
          {message}
        </p>
      )}

      {/* ===== PESTAÑA USUARIOS ===== */}
      {tab === "users" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#333", color: "white" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>Nombre</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Correo</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Estado</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Rol</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid #ddd" }}>
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

      {/* ===== PESTAÑA CONTENIDO ===== */}
      {tab === "content" && (
        <div>
          <h2>Agregar Película o Serie</h2>
          <form onSubmit={handleAddContent} style={{ backgroundColor: "#222", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
            <div style={{ marginBottom: "12px" }}>
              <label>Título *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px" }}>
                <option value="movie">Película</option>
                <option value="series">Serie</option>
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>URL de la portada (imagen)</label>
              <input type="url" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Año</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Géneros (separados por coma)</label>
              <input type="text" value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Acción, Drama, Comedia" style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Enlace de Google Drive *</label>
              <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} required placeholder="https://drive.google.com/file/d/..." style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
            </div>

            <button type="submit" style={{ padding: "10px 20px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Agregar
            </button>
          </form>

          <h2>Contenido actual ({content.length})</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#333", color: "white" }}>
                <th style={{ padding: "12px", textAlign: "left" }}>Título</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Tipo</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Año</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "12px" }}>{item.title}</td>
                  <td style={{ padding: "12px" }}>{item.type === "movie" ? "Película" : "Serie"}</td>
                  <td style={{ padding: "12px" }}>{item.year || "-"}</td>
                  <td style={{ padding: "12px" }}>
                    <button onClick={() => handleDelete(item.id)} style={{ padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
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