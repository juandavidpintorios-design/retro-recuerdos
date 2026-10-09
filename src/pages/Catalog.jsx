import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

function Catalog({ user }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);

  // Calificaciones
  const [ratings, setRatings] = useState({}); // { contentId: { average, count, userRating } }
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    const loadContents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "content"));
        const list = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setContents(list);

        // Cargar calificaciones
        await loadRatings(list, user.uid);
      } catch (error) {
        console.error("Error al cargar contenido:", error);
      }
      setLoading(false);
    };

    loadContents();
  }, [user.uid]);

  const loadRatings = async (contentsList, userId) => {
    try {
      const ratingsSnap = await getDocs(collection(db, "ratings"));
      const allRatings = {};

      ratingsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!allRatings[data.contentId]) {
          allRatings[data.contentId] = [];
        }
        allRatings[data.contentId].push(data);
      });

      const ratingsData = {};

      contentsList.forEach((item) => {
        const itemRatings = allRatings[item.id] || [];
        const count = itemRatings.length;
        const average = count > 0
          ? itemRatings.reduce((sum, r) => sum + r.rating, 0) / count
          : 0;

        const userRatingObj = itemRatings.find((r) => r.userId === userId);

        ratingsData[item.id] = {
          average: Math.round(average * 10) / 10,
          count,
          userRating: userRatingObj ? userRatingObj.rating : 0
        };
      });

      setRatings(ratingsData);
    } catch (error) {
      console.error("Error al cargar calificaciones:", error);
    }
  };

  const handleRate = async (contentId, rating) => {
    if (!user || savingRating) return;

    setSavingRating(true);
    try {
      const ratingId = `${contentId}_${user.uid}`;
      await setDoc(doc(db, "ratings", ratingId), {
        contentId,
        userId: user.uid,
        rating,
        updatedAt: new Date()
      });

      // Actualizar localmente
      setRatings((prev) => {
        const current = prev[contentId] || { average: 0, count: 0, userRating: 0 };
        const wasRated = current.userRating > 0;
        const newCount = wasRated ? current.count : current.count + 1;

        // Recalcular promedio simple
        let newAverage;
        if (wasRated) {
          const total = current.average * current.count - current.userRating + rating;
          newAverage = total / current.count;
        } else {
          const total = current.average * current.count + rating;
          newAverage = total / newCount;
        }

        return {
          ...prev,
          [contentId]: {
            average: Math.round(newAverage * 10) / 10,
            count: newCount,
            userRating: rating
          }
        };
      });
    } catch (error) {
      console.error("Error al calificar:", error);
      alert("No se pudo guardar la calificación");
    }
    setSavingRating(false);
  };

  // ========== Helpers de video ==========
  const getYoutubeId = (link) => {
    if (!link) return null;
    const match = link.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  };

  const getEmbedUrl = (link) => {
    if (!link) return null;

    const youtubeId = getYoutubeId(link);
    if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}?rel=0`;

    const driveMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    if (link.includes("archive.org")) {
      if (link.includes("/details/")) return link.replace("/details/", "/embed/");
      if (link.includes("/embed/")) return link;
      return `https://archive.org/embed/${link.split("/").pop()}`;
    }

    return null;
  };

  const isMegaLink = (link) => link && link.includes("mega.nz");

  const getPoster = (item) => {
    if (item.poster) return item.poster;
    if (item.driveLink) {
      const youtubeId = getYoutubeId(item.driveLink);
      if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }
    if (item.episodes?.length > 0) {
      const youtubeId = getYoutubeId(item.episodes[0].link);
      if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }
    return null;
  };

  const handleSelect = (item) => {
    setSelected(item);
    if (item.type === "series" && item.episodes?.length > 0) {
      setCurrentEpisode({ ...item.episodes[0], number: item.episodes[0].number || 1 });
    } else {
      setCurrentEpisode(null);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setCurrentEpisode(null);
  };

  // Componente de estrellas
  const Stars = ({ contentId, size = 22, interactive = false }) => {
    const data = ratings[contentId] || { average: 0, count: 0, userRating: 0 };
    const displayRating = interactive ? (data.userRating || 0) : data.average;

    return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            onClick={interactive ? () => handleRate(contentId, star) : undefined}
            style={{
              fontSize: size,
              cursor: interactive ? "pointer" : "default",
              color: star <= Math.round(displayRating) ? "#FFD700" : "#555",
              transition: "color 0.15s",
              userSelect: "none"
            }}
            title={interactive ? `Calificar con ${star} estrella${star > 1 ? "s" : ""}` : ""}
          >
            ★
          </span>
        ))}
        {!interactive && data.count > 0 && (
          <span style={{ fontSize: "13px", color: "#aaa", marginLeft: "6px" }}>
            {data.average} ({data.count})
          </span>
        )}
        {interactive && data.userRating > 0 && (
          <span style={{ fontSize: "13px", color: "#4CAF50", marginLeft: "8px" }}>
            Tu calificación: {data.userRating}
          </span>
        )}
      </div>
    );
  };

  // ================== VISTA DE REPRODUCCIÓN ==================
  if (selected) {
    const isSeries = selected.type === "series";
    const videoLink = isSeries ? currentEpisode?.link : selected.driveLink;
    const embedUrl = getEmbedUrl(videoLink);

    return (
      <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto", color: "#fff" }}>
        <button
          onClick={handleBack}
          style={{
            marginBottom: "16px",
            padding: "10px 18px",
            backgroundColor: "#333",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "15px"
          }}
        >
          ← Volver al catálogo
        </button>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "22px", lineHeight: "1.3" }}>
          {selected.title}
        </h1>

        {isSeries && currentEpisode && (
          <p style={{ color: "#4CAF50", margin: "0 0 6px 0", fontSize: "16px" }}>
            Episodio {currentEpisode.number || "?"}
            {currentEpisode.title ? `: ${currentEpisode.title}` : ""}
          </p>
        )}

        <p style={{ color: "#aaa", margin: "0 0 12px 0", fontSize: "14px" }}>
          {selected.type === "movie" ? "Película" : "Serie"}
          {selected.year && ` • ${selected.year}`}
        </p>

        {/* CALIFICACIÓN */}
        <div style={{ marginBottom: "18px" }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#ccc" }}>
            Califica esta {selected.type === "movie" ? "película" : "serie"}:
          </p>
          <Stars contentId={selected.id} size={28} interactive={true} />
          {(ratings[selected.id]?.count || 0) > 0 && (
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#aaa" }}>
              Promedio: {ratings[selected.id].average} / 5 ({ratings[selected.id].count} calificación
              {ratings[selected.id].count !== 1 ? "es" : ""})
            </p>
          )}
        </div>

        {selected.description && (
          <p style={{ marginBottom: "20px", color: "#ccc", fontSize: "15px", lineHeight: "1.5" }}>
            {selected.description}
          </p>
        )}

        {/* REPRODUCTOR */}
        {videoLink ? (
          isMegaLink(videoLink) ? (
            <div style={{
              padding: "50px 20px",
              backgroundColor: "#111",
              borderRadius: "12px",
              textAlign: "center",
              marginBottom: "30px",
              border: "1px solid #333"
            }}>
              <h3 style={{ marginBottom: "10px" }}>Este contenido está en Mega</h3>
              <a
                href={videoLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "14px 32px",
                  backgroundColor: "#D9272E",
                  color: "white",
                  fontSize: "17px",
                  fontWeight: "bold",
                  borderRadius: "8px",
                  textDecoration: "none"
                }}
              >
                Ver en Mega
              </a>
            </div>
          ) : embedUrl ? (
            <div style={{
              position: "relative",
              paddingBottom: "56.25%",
              height: 0,
              overflow: "hidden",
              borderRadius: "10px",
              backgroundColor: "#000",
              marginBottom: "30px"
            }}>
              <iframe
                src={embedUrl}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#888", backgroundColor: "#111", borderRadius: "8px", marginBottom: "30px" }}>
              No se pudo cargar el video
            </div>
          )
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "#888", backgroundColor: "#111", borderRadius: "8px", marginBottom: "30px" }}>
            No hay video disponible
          </div>
        )}

        {/* EPISODIOS */}
        {isSeries && selected.episodes?.length > 0 && (
          <div>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "20px" }}>Episodios</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selected.episodes.map((ep, index) => {
                const epNumber = ep.number || index + 1;
                const isActive = currentEpisode && currentEpisode.number === epNumber;

                return (
                  <div
                    key={index}
                    onClick={() => setCurrentEpisode({ ...ep, number: epNumber })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "12px",
                      backgroundColor: isActive ? "#1a3a5c" : "#1e1e1e",
                      borderRadius: "10px",
                      cursor: "pointer",
                      border: isActive ? "2px solid #2196F3" : "1px solid #333"
                    }}
                  >
                    <div style={{
                      width: "60px",
                      height: "45px",
                      backgroundColor: "#333",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: isActive ? "#64b5f6" : "#aaa",
                      flexShrink: 0
                    }}>
                      {epNumber}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                        Episodio {epNumber}
                      </div>
                      <div style={{ fontSize: "13px", color: isActive ? "#90caf9" : "#aaa" }}>
                        {isActive ? "Reproduciendo" : (ep.title || "Episodio")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================== CATÁLOGO ==================
  return (
    <div style={{ padding: "20px 16px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "8px", fontSize: "26px" }}>Catálogo</h1>
      <p style={{ color: "#aaa", marginBottom: "24px" }}>
        Hola {user.displayName}, elige una película o serie
      </p>

      {loading ? (
        <p>Cargando contenido...</p>
      ) : contents.length === 0 ? (
        <p>No hay contenido disponible todavía.</p>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "16px"
        }}>
          {contents.map((item) => {
            const poster = getPoster(item);
            const ratingData = ratings[item.id];

            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                style={{
                  cursor: "pointer",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#1e1e1e"
                }}
              >
                {poster ? (
                  <img src={poster} alt={item.title} style={{ width: "100%", height: "210px", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: "100%", height: "210px", backgroundColor: "#333",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#888"
                  }}>
                    Sin portada
                  </div>
                )}
                <div style={{ padding: "10px" }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>{item.title}</h3>
                  <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#aaa" }}>
                    {item.type === "movie" ? "Película" : `Serie • ${item.episodes?.length || 0} eps`}
                    {item.year && ` • ${item.year}`}
                  </p>
                  {ratingData && ratingData.count > 0 && (
                    <div style={{ fontSize: "13px", color: "#FFD700" }}>
                      {"★".repeat(Math.round(ratingData.average))}
                      <span style={{ color: "#aaa", marginLeft: "4px" }}>
                        {ratingData.average}
                      </span>
                    </div>
                  )}
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