import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

function Requests({ user }) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("series");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [myRequests, setMyRequests] = useState([]);

  useEffect(() => {
    loadMyRequests();
  }, [user.uid]);

  const loadMyRequests = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "requests"), where("userId", "==", user.uid))
      );
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMyRequests(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!title.trim()) {
      setError("Escribe el nombre de la serie o película");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "requests"), {
        userId: user.uid,
        displayName: user.displayName || "Usuario",
        email: user.email,
        title: title.trim(),
        year: year ? Number(year) : null,
        type,
        status: "pending",
        adminMessage: "",
        createdAt: serverTimestamp()
      });

      setMessage("Solicitud enviada correctamente. El administrador la revisará pronto.");
      setTitle("");
      setYear("");
      setType("series");
      loadMyRequests();
    } catch (err) {
      console.error(err);
      setError("No se pudo enviar la solicitud. Intenta de nuevo.");
    }
    setLoading(false);
  };

  const statusLabel = (status) => {
    if (status === "available") return { text: "Disponible", color: "#28a745" };
    if (status === "unavailable") return { text: "No se pudo agregar", color: "#dc3545" };
    return { text: "Pendiente", color: "#ffc107" };
  };

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "24px", color: "#fff" }}>
      <h1 style={{ marginTop: 0, color: "#ffcc00" }}>Solicitar contenido</h1>
      <p style={{ color: "#aaa", marginBottom: "24px" }}>
        ¿Falta una serie o película? Pídela aquí. Indica el nombre, el año (si lo sabes) y si es película o serie.
      </p>

      {message && (
        <p style={{
          color: "#55ff88",
          background: "#1a2e1a",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px"
        }}>
          {message}
        </p>
      )}

      {error && (
        <p style={{
          color: "#ff5555",
          background: "#2e1a1a",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px"
        }}>
          {error}
        </p>
      )}

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#1e1e2f",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #333",
          marginBottom: "32px"
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#ffaa55" }}>
            Nombre *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Thundercats"
            required
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#0d0d1a",
              color: "#fff",
              boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#ffaa55" }}>
            Año (opcional)
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Ej: 1985"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#0d0d1a",
              color: "#fff",
              boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#ffaa55" }}>
            Tipo *
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#0d0d1a",
              color: "#fff"
            }}
          >
            <option value="series">Serie</option>
            <option value="movie">Película</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: "linear-gradient(90deg, #ff6b00, #ff3300)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: "1rem"
          }}
        >
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>
      </form>

      {/* Mis solicitudes */}
      <h2 style={{ color: "#ffcc00", marginBottom: "16px" }}>
        Mis solicitudes ({myRequests.length})
      </h2>

      {myRequests.length === 0 ? (
        <p style={{ color: "#666" }}>Aún no has hecho ninguna solicitud</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {myRequests.map((req) => {
            const st = statusLabel(req.status);
            return (
              <div
                key={req.id}
                style={{
                  background: "#1a1a1a",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #333"
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                  flexWrap: "wrap"
                }}>
                  <div>
                    <strong style={{ fontSize: "16px" }}>{req.title}</strong>
                    <div style={{ color: "#888", fontSize: "13px", marginTop: "4px" }}>
                      {req.type === "movie" ? "Película" : "Serie"}
                      {req.year ? ` • ${req.year}` : ""}
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    background: st.color,
                    color: req.status === "pending" ? "#000" : "#fff",
                    fontSize: "12px",
                    fontWeight: 700
                  }}>
                    {st.text}
                  </span>
                </div>

                {req.adminMessage && (
                  <p style={{
                    margin: "12px 0 0 0",
                    padding: "10px",
                    background: "#222",
                    borderRadius: "8px",
                    color: "#ccc",
                    fontSize: "14px"
                  }}>
                    <strong style={{ color: "#ffaa55" }}>Respuesta del admin:</strong>{" "}
                    {req.adminMessage}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Requests;