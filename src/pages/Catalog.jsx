import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function Catalog({ user, onLogout, onGoAdmin }) {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // para ver el video

  useEffect(() => {
    const loadContent = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "content"));
        const list = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setContent(list);
      } catch (error) {
        console.error("Error cargando contenido:", error);
      }
      setLoading(false);
    };
    loadContent();
  }, []);

  // Convertir enlace de Google Drive a formato de visualización
  const getEmbedUrl = (driveLink) => {
    if (!driveLink) return null;
    // Extrae el ID del archivo
    const match = driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return driveLink;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "80px", color: "white" }}>
        <h2>Cargando catálogo...</h2>
      </div>
    );
  }

  // Si el usuario eligió ver una película/serie
  if (selected) {
    const embedUrl = getEmbedUrl(selected.driveLink);
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white", padding: "20px" }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            marginBottom: "20px",
            padding: "10px 20px",
            backgroundColor: "#333",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          ← Volver al catálogo
        </button>

        <h1>{selected.title}</h1>
        <p>{selected.description}</p>

        <div style={{ marginTop: "20px", maxWidth: "900px" }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              width="100%"
              height="500"
              allow="autoplay"
              style={{ border: "none", borderRadius: "8px" }}
              title={selected.title}
            ></iframe>
          ) : (
            <p>No hay enlace de video disponible.</p>
          )}
        </div>
      </div>
    );
  }

  // Catálogo principal
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white" }}>
      {/* Header */}
      <div style={{
        padding: "15px 30px",
        backgroundColor: "#1a1a1a",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #333"
      }}>
        <h2 style={{ margin: 0 }}>Retro Recuerdos</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <span>Hola, {user.displayName}</span>
          {user.role === "admin" && (
            <button
              onClick={onGoAdmin}
              style={{
                padding: "8px 16px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Panel Admin
            </button>
          )}
          <button
            onClick={onLogout}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding: "30px" }}>
        <h1 style={{ marginBottom: "30px" }}>Catálogo</h1>

        {content.length === 0 ? (
          <p style={{ color: "#aaa" }}>Todavía no hay películas ni series agregadas.</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "25px"
          }}>
            {content.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                style={{
                  backgroundColor: "#1e1e1e",
                  borderRadius: "10px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 0.2s",
                }}
                onMouseEnter={(e) => 