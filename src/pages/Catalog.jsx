import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

function Catalog({ user }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [ratings, setRatings] = useState({});
  const [favorites, setFavorites] = useState({});
  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [savingComment, setSavingComment] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    loadAll();
  }, [user?.uid]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const contentSnap = await getDocs(collection(db, "content"));
      const list = [];
      contentSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setContents(list);

      const ratingsSnap = await getDocs(collection(db, "ratings"));
      const allRatings = {};
      ratingsSnap.forEach((d) => {
        const data = d.data();
        if (!allRatings[data.contentId]) allRatings[data.contentId] = [];
        allRatings[data.contentId].push(data);
      });
      const ratingsData = {};
      list.forEach((item) => {
        const itemRatings = allRatings[item.id] || [];
        const count = itemRatings.length;
        const average =
          count > 0
            ? itemRatings.reduce((s, r) => s + Number(r.rating), 0) / count
            : 0;
        const userR = itemRatings.find((r) => r.userId === user.uid);
        ratingsData[item.id] = {
          average: Math.round(average * 10) / 10,
          count,
          userRating: userR ? Number(userR.rating) : 0
        };
      });
      setRatings(ratingsData);

      const favSnap = await getDocs(
        query(collection(db, "favorites"), where("userId", "==", user.uid))
      );
      const favs = {};
      favSnap.forEach((d) => {
        favs[d.data().contentId] = true;
      });
      setFavorites(favs);

      const histSnap = await getDocs(
        query(collection(db, "history"), where("userId", "==", user.uid))
      );
      const hist = [];
      histSnap.forEach((d) => hist.push({ id: d.id, ...d.data() }));
      hist.sort((a, b) => (b.watchedAt?.seconds || 0) - (a.watchedAt?.seconds || 0));
      setHistory(hist.slice(0, 20));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getYoutubeId = (link) => {
    if (!link) return null;
    const m = link.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return m ? m[1] : null;
  };

  const getEmbedUrl = (link) => {
    if (!link) return null;
    const yt = getYoutubeId(link);
    if (yt) return `https://www.youtube.com/embed/${yt}?rel=0`;

    const drive = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

    if (link.includes("archive.org")) {
      if (link.includes("/details/")) return link.replace("/details/", "/embed/");
      if (link.includes("/embed/")) return link;
      const id = link.split("/").filter(Boolean).pop();
      return `https://archive.org/embed/${id}`;
    }
    return null;
  };

  const isMegaLink = (link) => link && link.includes("mega.nz");

  const getPoster = (item) => {
    if (item.poster) return item.poster;
    if (item.driveLink) {
      const yt = getYoutubeId(item.driveLink);
      if (yt) return `https://img.youtube.com/vi/${yt}/maxresdefault.jpg`;
    }
    if (item.episodes?.[0]?.link) {
      const yt = getYoutubeId(item.episodes[0].link);
      if (yt) return `https://img.youtube.com/vi/${yt}/maxresdefault.jpg`;
    }
    return null;
  };

  const toggleFavorite = async (contentId, e) => {
    e?.stopPropagation();
    const favId = `${user.uid}_${contentId}`;
    try {
      if (favorites[contentId]) {
        await deleteDoc(doc(db, "favorites", favId));
        setFavorites((prev) => {
          const n = { ...prev };
          delete n[contentId];
          return n;
        });
      } else {
        await setDoc(doc(db, "favorites", favId), {
          userId: user.uid,
          contentId,
          createdAt: serverTimestamp()
        });
        setFavorites((prev) => ({ ...prev, [contentId]: true }));
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar favorito");
    }
  };

  const addToHistory = async (contentId, episodeNumber = null) => {
    try {
      const histId = `${user.uid}_${contentId}`;
      await setDoc(
        doc(db, "history", histId),
        {
          userId: user.uid,
          contentId,
          episodeNumber,
          watchedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRate = async (contentId, rating) => {
    if (savingRating) return;
    setSavingRating(true);
    try {
      const ratingId = `${contentId}_${user.uid}`;
      await setDoc(doc(db, "ratings", ratingId), {
        contentId,
        userId: user.uid,
        rating: Number(rating),
        updatedAt: new Date()
      });
      setRatings((prev) => {
        const cur = prev[contentId] || { average: 0, count: 0, userRating: 0 };
        const was = cur.userRating > 0;
        const newCount = was ? cur.count : cur.count + 1;
        let avg;
        if (was) {
          avg = (cur.average * cur.count - cur.userRating + rating) / cur.count;
        } else {
          avg = (cur.average * cur.count + rating) / newCount;
        }
        return {
          ...prev,
          [contentId]: {
            average: Math.round(avg * 10) / 10,
            count: newCount,
            userRating: rating
          }
        };
      });
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la calificación");
    }
    setSavingRating(false);
  };

  const loadComments = async (contentId) => {
    try {
      const snap = await getDocs(
        query(collection(db, "comments"), where("contentId", "==", contentId))
      );
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setComments(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || savingComment || !selected) return;
    setSavingComment(true);
    try {
      await addDoc(collection(db, "comments"), {
        contentId: selected.id,
        userId: user.uid,
        displayName: user.displayName || "Usuario",
        text: newComment.trim().slice(0, 500),
        createdAt: serverTimestamp()
      });
      setNewComment("");
      await loadComments(selected.id);
    } catch (err) {
      console.error(err);
      alert("No se pudo publicar el comentario");
    }
    setSavingComment(false);
  };

  const Stars = ({ contentId, size = 22, interactive = false }) => {
    const data = ratings[contentId] || { average: 0, count: 0, userRating: 0 };
    const display = interactive ? data.userRating || 0 : data.average;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "3px", flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            onClick={interactive && !savingRating ? () => handleRate(contentId, s) : undefined}
            style={{
              fontSize: size,
              cursor: interactive ? "pointer" : "default",
              color: s <= Math.round(display) ? "#FFD700" : "#555",
              userSelect: "none"
            }}
          >
            ★
          </span>
        ))}
        {!interactive && data.count > 0 && (
          <span style={{ fontSize: "12px", color: "#aaa", marginLeft: "4px" }}>
            {data.average} ({data.count})
          </span>
        )}
        {interactive && data.userRating > 0 && (
          <span style={{ fontSize: "12px", color: "#4CAF50", marginLeft: "6px" }}>
            Tu nota: {data.userRating}
          </span>
        )}
      </div>
    );
  };

  const StatusBadge = ({ item }) => {
    if (item.type !== "series" || !item.seriesStatus) return null;
    const isAiring = item.seriesStatus === "airing";
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: "bold",
          backgroundColor: isAiring ? "#e65100" : "#2e7d32",
          color: "#fff",
          marginLeft: "6px"
        }}
      >
        {isAiring ? "EN EMISIÓN" : "FINALIZADA"}
      </span>
    );
  };

  const handleSelect = async (item) => {
    setSelected(item);
    setNewComment("");
    if (item.type === "series" && item.episodes?.length > 0) {
      setCurrentEpisode({
        ...item.episodes[0],
        number: item.episodes[0].number || 1
      });
    } else {
      setCurrentEpisode(null);
    }
    await addToHistory(item.id);
    await loadComments(item.id);
  };

  const handleBack = () => {
    setSelected(null);
    setCurrentEpisode(null);
    setComments([]);
  };

  const years = [...new Set(contents.map((c) => c.year).filter(Boolean))].sort(
    (a, b) => b - a
  );

  const filtered = contents.filter((item) => {
    if (showFavoritesOnly && !favorites[item.id]) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterYear !== "all" && String(item.year) !== String(filterYear)) return false;
    if (search.trim()) {
      if (!item.title?.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const featured = contents
    .filter((c) => (ratings[c.id]?.average || 0) >= 4)
    .slice(0, 8);

  const recentHistory = history
    .map((h) => contents.find((c) => c.id === h.contentId))
    .filter(Boolean)
    .slice(0, 6);

  const ContentCard = ({ item }) => {
    const poster = getPoster(item);
    return (
      <div
        onClick={() => handleSelect(item)}
        style={{
          cursor: "pointer",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: "#1e1e1e",
          position: "relative"
        }}
      >
        <button
          onClick={(e) => toggleFavorite(item.id, e)}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            background: "rgba(0,0,0,0.6)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            cursor: "pointer",
            fontSize: "16px",
            zIndex: 2
          }}
        >
          {favorites[item.id] ? "❤️" : "🤍"}
        </button>
        {poster ? (
          <img src={poster} alt={item.title} style={{ width: "100%", height: "210px", objectFit: "cover" }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "210px",
              background: "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#888"
            }}
          >
            Sin portada
          </div>
        )}
        <div style={{ padding: "10px" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", lineHeight: 1.3 }}>{item.title}</h3>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#aaa" }}>
            {item.type === "movie" ? "Película" : `Serie • ${item.episodes?.length || 0} eps`}
            {item.year && ` • ${item.year}`}
            <StatusBadge item={item} />
          </p>
          <Stars contentId={item.id} size={14} />
        </div>
      </div>
    );
  };

  // ========== DETALLE ==========
  if (selected) {
    const isSeries = selected.type === "series";
    const videoLink = isSeries ? currentEpisode?.link : selected.driveLink;
    const embedUrl = getEmbedUrl(videoLink);

    return (
      <div style={{ padding: "16px", maxWidth: "1100px", margin: "0 auto", color: "#fff" }}>
        <button
          onClick={handleBack}
          style={{
            marginBottom: "16px",
            padding: "10px 18px",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          ← Volver
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            flexWrap: "wrap"
          }}
        >
          <h1 style={{ margin: "0 0 8px 0", fontSize: "22px" }}>
            {selected.title}
            <StatusBadge item={selected} />
          </h1>
          <button
            onClick={(e) => toggleFavorite(selected.id, e)}
            style={{
              padding: "8px 14px",
              background: favorites[selected.id] ? "#c62828" : "#333",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            {favorites[selected.id] ? "❤️ En favoritos" : "🤍 Favorito"}
          </button>
        </div>

        {isSeries && currentEpisode && (
          <p style={{ color: "#4CAF50", margin: "0 0 6px 0" }}>
            Episodio {currentEpisode.number}
            {currentEpisode.title ? `: ${currentEpisode.title}` : ""}
          </p>
        )}

        <p style={{ color: "#aaa", margin: "0 0 12px 0", fontSize: "14px" }}>
          {selected.type === "movie" ? "Película" : "Serie"}
          {selected.year && ` • ${selected.year}`}
        </p>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#ccc" }}>Tu calificación:</p>
          <Stars contentId={selected.id} size={28} interactive />
        </div>

        {selected.description && (
          <p style={{ marginBottom: "20px", color: "#ccc", lineHeight: 1.5 }}>{selected.description}</p>
        )}

        {/* REPRODUCTOR - solo Archive, YouTube, Drive, Mega */}
        {videoLink ? (
          isMegaLink(videoLink) ? (
            <div
              style={{
                padding: "40px",
                background: "#111",
                borderRadius: "12px",
                textAlign: "center",
                marginBottom: "24px",
                border: "1px solid #333"
              }}
            >
              <a
                href={videoLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "14px 32px",
                  background: "#D9272E",
                  color: "#fff",
                  fontWeight: "bold",
                  borderRadius: "8px",
                  textDecoration: "none"
                }}
              >
                Ver en Mega
              </a>
            </div>
          ) : embedUrl ? (
            <div
              style={{
                position: "relative",
                paddingBottom: "56.25%",
                height: 0,
                overflow: "hidden",
                borderRadius: "10px",
                background: "#000",
                marginBottom: "24px"
              }}
            >
              <iframe
                src={embedUrl}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none"
                }}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#888",
                background: "#111",
                borderRadius: "8px",
                marginBottom: "24px"
              }}
            >
              No se pudo cargar el video
              <br />
              <small style={{ color: "#666" }}>
                Solo se admiten Archive, YouTube, Google Drive o Mega
              </small>
            </div>
          )
        ) : (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#888",
              background: "#111",
              borderRadius: "8px",
              marginBottom: "24px"
            }}
          >
            No hay video disponible
          </div>
        )}

        {/* Episodios */}
        {isSeries && selected.episodes?.length > 0 && (
          <div style={{ marginBottom: "30px" }}>
            <h2 style={{ margin: "0 0 14px 0", fontSize: "18px" }}>Episodios</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {selected.episodes.map((ep, i) => {
                const num = ep.number || i + 1;
                const active = currentEpisode?.number === num;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      setCurrentEpisode({ ...ep, number: num });
                      addToHistory(selected.id, num);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      background: active ? "#1a3a5c" : "#1e1e1e",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: active ? "2px solid #2196F3" : "1px solid #333"
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "40px",
                        background: "#333",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        color: active ? "#64b5f6" : "#aaa"
                      }}
                    >
                      {num}
                    </div>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "14px" }}>Episodio {num}</div>
                      <div style={{ fontSize: "12px", color: active ? "#90caf9" : "#aaa" }}>
                        {active ? "Reproduciendo" : ep.title || "Episodio"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comentarios */}
        <div style={{ marginTop: "10px", borderTop: "1px solid #333", paddingTop: "20px" }}>
          <h2 style={{ margin: "0 0 14px 0", fontSize: "18px" }}>
            Comentarios ({comments.length})
          </h2>

          <div style={{ marginBottom: "16px" }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario (máx. 500 caracteres)"
              rows={3}
              maxLength={500}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #444",
                background: "#1a1a1a",
                color: "#fff",
                resize: "vertical",
                marginBottom: "8px",
                boxSizing: "border-box"
              }}
            />
            <button
              onClick={handleAddComment}
              disabled={savingComment || !newComment.trim()}
              style={{
                padding: "10px 20px",
                background: "#2196F3",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                opacity: savingComment || !newComment.trim() ? 0.6 : 1
              }}
            >
              {savingComment ? "Publicando..." : "Publicar comentario"}
            </button>
          </div>

          {comments.length === 0 ? (
            <p style={{ color: "#666" }}>Sé el primero en comentar</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "#1a1a1a",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #333"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "6px"
                    }}
                  >
                    <strong style={{ fontSize: "14px" }}>{c.displayName}</strong>
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", color: "#ccc", lineHeight: 1.4 }}>
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== CATÁLOGO ==========
  return (
    <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto", color: "#fff" }}>
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #444",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: "16px",
            marginBottom: "12px",
            boxSizing: "border-box"
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {["all", "movie", "series"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: "8px 14px",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                background: filterType === t ? "#2196F3" : "#333",
                color: "#fff",
                fontSize: "13px"
              }}
            >
              {t === "all" ? "Todos" : t === "movie" ? "Películas" : "Series"}
            </button>
          ))}

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "20px",
              border: "1px solid #444",
              background: "#333",
              color: "#fff",
              fontSize: "13px"
            }}
          >
            <option value="all">Todos los años</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={{
              padding: "8px 14px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              background: showFavoritesOnly ? "#c62828" : "#333",
              color: "#fff",
              fontSize: "13px"
            }}
          >
            {showFavoritesOnly ? "❤️ Favoritos" : "🤍 Favoritos"}
          </button>
        </div>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          {!search &&
            !showFavoritesOnly &&
            filterType === "all" &&
            filterYear === "all" &&
            recentHistory.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>Seguir viendo</h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: "12px"
                  }}
                >
                  {recentHistory.map((item) => (
                    <ContentCard key={`hist-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            )}

          {!search &&
            !showFavoritesOnly &&
            filterType === "all" &&
            filterYear === "all" &&
            featured.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>Destacados</h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: "12px"
                  }}
                >
                  {featured.map((item) => (
                    <ContentCard key={`feat-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            )}

          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>
            {showFavoritesOnly
              ? "Mis favoritos"
              : search
              ? `Resultados de "${search}"`
              : "Catálogo"}{" "}
            ({filtered.length})
          </h2>

          {filtered.length === 0 ? (
            <p style={{ color: "#888" }}>No se encontró contenido</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "14px"
              }}
            >
              {filtered.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Catalog;