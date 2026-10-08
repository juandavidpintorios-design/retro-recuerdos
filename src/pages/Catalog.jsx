import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function Catalog({ user, onLogout, onGoAdmin }) {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

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

  // Convertir cualquier enlace a formato de visualización
  const getEmbedUrl = (link) => {
    if (!link) return null;

    // Google Drive
    const driveMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    // Archive.org
    if (link.includes("archive.org/details/")) {
      const id = link.split("archive.org/details/")[1].split("/")[0].split("?")[0];
      return `https://archive.org/embed/${id}`;
    }

    // Si ya es un enlace de embed o directo
    return link;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "80px", color: "white", backgroundColor: "#111", minHeight: "100vh" }}>
        <h2>Cargando catálogo...</h2>
      </div>
    );
  }

  // ===== REPRODUCTOR =====
  if (selected) {
    const isSeries = selected.type === "series" && selected.episodes && selected.episodes.length > 0;
    const currentVideo = selectedEpisode || (isSeries ? null : selected);
    const embedUrl = currentVideo ? getEmbedUrl(currentVideo.driveLink || currentVideo.link) : null;

    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white", padding: "20px" }}>
        <button
          onClick={() => {
            setSelected(null);
            setSelectedEpisode(null);
          }}
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
        {selected.description && <p style={{ color: "#ccc" }}>{selected.description}</p>}

        {/* Lista de episodios (si es serie) */}
        {isSeries && (
          <div style={{ margin: "20px 0" }}>
            <h3>Episodios</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {selected.episodes.map((ep, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedEpisode(ep)}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: selectedEpisode === ep ? "#2196F3" : "#333",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  {ep.title || `Episodio ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reproductor */}
        <div style={{ marginTop: "20px", maxWidth: "1000px" }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              width="100%"
              height="500"
              allow="autoplay; fullscreen"
              allowFullScreen
              style={{ border: "none", borderRadius: "8px" }}
              title={selected.title}
            ></iframe>
          ) : (
            <p style={{ color: "#aaa" }}>
              {isSeries ? "Selecciona un episodio para verlo" : "No hay enlace de video disponible."}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ===== CATÁLOGO =====
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

      <div style={{ padding: "30px" }}>
        <h1 style={{ marginBottom: "30px" }}>Catálogo</h1>

        {content.length === 0 ? (
          <p style={{ color: "#aaa" }}>Todavía no hay películas ni series agregadas.</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
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
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    style={{ width: "100%", height: "260px", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{
                    width: "100%",
                    height: "260px",
                    backgroundColor: "#333",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#777",
                    fontSize: "14px"
                  }}>
                    Sin portada
                  </div>
                )}
                <div style={{ padding: "12px" }}>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: "15px" }}>{item.title}</h3>
                  <p style={{ margin: 0, color: "#aaa", fontSize: "13px" }}>
                    {item.type === "movie" ? "Película" : "Serie"}
                    {item.year ? ` • ${item.year}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Catalog;