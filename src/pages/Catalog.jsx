import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function Catalog({ user }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);

  useEffect(() => {
    const loadContents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "content"));
        const list = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setContents(list);
      } catch (error) {
        console.error("Error al cargar contenido:", error);
      }
      setLoading(false);
    };

    loadContents();
  }, []);

  const getYoutubeId = (link) => {
    if (!link) return null;
    const match = link.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  };

  const getEmbedUrl = (link) => {
    if (!link) return null;

    // YouTube
    const youtubeId = getYoutubeId(link);
    if (youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}?rel=0`;
    }

    // Google Drive
    const driveMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    // Internet Archive
    if (link.includes("archive.org")) {
      // Convierte /details/ a /embed/
      if (link.includes("/details/")) {
        return link.replace("/details/", "/embed/");
      }
      // Si ya es /embed/, lo dejamos
      if (link.includes("/embed/")) {
        return link;
      }
      // Si es solo el identificador
      const identifier = link.split("/").pop();
      return `https://archive.org/embed/${identifier}`;
    }

    // Mega u otros → null (mostramos botón)
    return null;
  };

  const isMegaLink = (link) => {
    return link && link.includes("mega.nz");
  };

  const getPoster = (item) => {
    if (item.poster) return item.poster;

    if (item.driveLink) {
      const youtubeId = getYoutubeId(item.driveLink);
      if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }

    if (item.episodes && item.episodes.length > 0) {
      const youtubeId = getYoutubeId(item.episodes[0].link);
      if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }

    return null;
  };

  const handleSelect = (item) => {
    setSelected(item);
    if (item.type === "series" && item.episodes && item.episodes.length > 0) {
      setCurrentEpisode(item.episodes[0]);
    } else {
      setCurrentEpisode(null);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setCurrentEpisode(null);
  };

  // ================== VISTA DE REPRODUCCIÓN ==================
  if (selected) {
    const isSeries = selected.type === "series";
    const videoLink = isSeries ? currentEpisode?.link : selected.driveLink;
    const embedUrl = getEmbedUrl(videoLink);

    return (
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        <button
          onClick={handleBack}
          style={{
            marginBottom: "20px",
            padding: "10px 20px",
            backgroundColor: "#444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          ← Volver al catálogo
        </button>

        <h2>{selected.title}</h2>

        {isSeries && currentEpisode && (
          <p style={{ color: "#4CAF50", marginBottom: "5px" }}>
            Episodio {currentEpisode.number}
            {currentEpisode.title && `: ${currentEpisode.title}`}
          </p>
        )}

        <p style={{ color: "#aaa", marginBottom: "20px" }}>
          {selected.type === "movie" ? "Película" : "Serie"}
          {selected.year && ` • ${selected.year}`}
        </p>

        {selected.description && (
          <p style={{ marginBottom: "20px", maxWidth: "800px" }}>{selected.description}</p>
        )}

        {/* ========== REPRODUCTOR ========== */}
        {videoLink ? (
          isMegaLink(videoLink) ? (
            // Botón para Mega
            <div
              style={{
                padding: "60px 20px",
                backgroundColor: "#111",
                borderRadius: "12px",
                textAlign: "center",
                marginBottom: "25px",
                border: "1px solid #333"
              }}
            >
              <h3 style={{ marginBottom: "10px", color: "#fff" }}>Este contenido está alojado en Mega</h3>
              <p style={{ color: "#aaa", marginBottom: "25px" }}>
                Haz clic en el botón para verlo o descargarlo
              </p>
              <a
                href={videoLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "16px 40px",
                  backgroundColor: "#D9272E",
                  color: "white",
                  fontSize: "18px",
                  fontWeight: "bold",
                  borderRadius: "8px",
                  textDecoration: "none"
                }}
              >
                Ver en Mega
              </a>
            </div>
          ) : embedUrl ? (
            // Iframe para YouTube / Drive / Internet Archive
            <div
              style={{
                position: "relative",
                paddingBottom: "56.25%",
                height: 0,
                overflow: "hidden",
                borderRadius: "8px",
                backgroundColor: "#000",
                marginBottom: "25px"
              }}
            >
              <iframe
                src={embedUrl}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#888", backgroundColor: "#111", borderRadius: "8px", marginBottom: "25px" }}>
              No se pudo cargar el video
            </div>
          )
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "#888", backgroundColor: "#111", borderRadius: "8px", marginBottom: "25px" }}>
            No hay video disponible
          </div>
        )}

        {/* Lista de episodios (solo series) */}
        {isSeries && selected.episodes && selected.episodes.length > 0 && (
          <div>
            <h3 style={{ marginBottom: "15px" }}>Episodios</h3>
            <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "10px" }}>
              {selected.episodes.map((ep) => (
                <div
                  key={ep.number}
                  onClick={() => setCurrentEpisode(ep)}
                  style={{
                    minWidth: "160px",
                    padding: "14px",
                    backgroundColor: currentEpisode?.number === ep.number ? "#2196F3" : "#1e1e1e",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: currentEpisode?.number === ep.number ? "2px solid #64b5f6" : "1px solid #333"
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Episodio {ep.number}</div>
                  <div style={{ fontSize: "13px", color: currentEpisode?.number === ep.number ? "#e3f2fd" : "#aaa" }}>
                    {ep.title || `Episodio ${ep.number}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================== VISTA DEL CATÁLOGO ==================
  return (
    <div style={{ padding: "30px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "10px" }}>Catálogo</h1>
      <p style={{ color: "#aaa", marginBottom: "30px" }}>
        Hola {user.displayName}, elige una película o serie
      </p>

      {loading ? (
        <p>Cargando contenido...</p>
      ) : contents.length === 0 ? (
        <p>No hay contenido disponible todavía.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
          {contents.map((item) => {
            const poster = getPoster(item);
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                style={{
                  cursor: "pointer",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#1e1e1e",
                  transition: "transform 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {poster ? (
                  <img src={poster} alt={item.title} style={{ width: "100%", height: "270px", objectFit: "cover" }} />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "270px",
                      backgroundColor: "#333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#888"
                    }}
                  >
                    Sin portada
                  </div>
                )}
                <div style={{ padding: "12px" }}>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: "15px" }}>{item.title}</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#aaa" }}>
                    {item.type === "movie" ? "Película" : `Serie • ${item.episodes?.length || 0} eps`}
                    {item.year && ` • ${item.year}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Catalog;