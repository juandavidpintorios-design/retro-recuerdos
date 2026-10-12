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
  serverTimestamp,
  getDoc,
  updateDoc,
  onSnapshot
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
  const [deviceAllowed, setDeviceAllowed] = useState(true);

  const getDeviceId = () => {
    let id = localStorage.getItem("retro_device_id");
    if (!id) {
      id = "dev_" + Math.random().toString(36).slice(2) + "_" + Date.now();
      localStorage.setItem("retro_device_id", id);
    }
    return id;
  };

  const getDeviceLabel = () => {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return "Celular";
    if (/tablet|ipad/i.test(ua)) return "Tablet";
    return "PC / Laptop";
  };

  const isSubActive = () => {
    if (!user?.subscriptionExpiresAt) return false;
    const expire = user.subscriptionExpiresAt.toDate
      ? user.subscriptionExpiresAt.toDate()
      : new Date(user.subscriptionExpiresAt);
    return expire > new Date();
  };

  const checkDeviceLimit = async () => {
    if (!user?.uid) return;
    const deviceId = getDeviceId();
    const deviceRef = doc(db, "devices", `${user.uid}_${deviceId}`);

    try {
      const existing = await getDoc(deviceRef);
      if (existing.exists()) {
        await updateDoc(deviceRef, { lastSeen: serverTimestamp() });
        setDeviceAllowed(true);
        return;
      }

      const snap = await getDocs(
        query(collection(db, "devices"), where("userId", "==", user.uid))
      );

      if (snap.size >= 4) {
        setDeviceAllowed(false);
        return;
      }

      await setDoc(deviceRef, {
        userId: user.uid,
        deviceId,
        label: getDeviceLabel(),
        userAgent: navigator.userAgent.slice(0, 120),
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      });

      setDeviceAllowed(true);
    } catch (err) {
      console.error(err);
      setDeviceAllowed(true);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    checkDeviceLimit();

    const unsubContent = onSnapshot(collection(db, "content"), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setContents(list);
      setLoading(false);

      setSelected((prev) => {
        if (!prev) return null;
        const updated = list.find((c) => c.id === prev.id);
        return updated || prev;
      });
    });

    const unsubRatings = onSnapshot(collection(db, "ratings"), (snap) => {
      const allRatings = {};
      snap.forEach((d) => {
        const data = d.data();
        if (!allRatings[data.contentId]) allRatings[data.contentId] = [];
        allRatings[data.contentId].push(data);
      });

      setContents((currentList) => {
        const ratingsData = {};
        currentList.forEach((item) => {
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
        return currentList;
      });
    });

    const unsubFav = onSnapshot(
      query(collection(db, "favorites"), where("userId", "==", user.uid)),
      (snap) => {
        const favs = {};
        snap.forEach((d) => {
          favs[d.data().contentId] = true;
        });
        setFavorites(favs);
      }
    );

    const unsubHist = onSnapshot(
      query(collection(db, "history"), where("userId", "==", user.uid)),
      (snap) => {
        const hist = [];
        snap.forEach((d) => hist.push({ id: d.id, ...d.data() }));
        hist.sort((a, b) => (b.watchedAt?.seconds || 0) - (a.watchedAt?.seconds || 0));
        setHistory(hist.slice(0, 20));
      }
    );

    return () => {
      unsubContent();
      unsubRatings();
      unsubFav();
      unsubHist();
    };
  }, [user?.uid]);

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
      } else {
        await setDoc(doc(db, "favorites", favId), {
          userId: user.uid,
          contentId,
          createdAt: serverTimestamp()
        });
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
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la calificación");
    }
    setSavingRating(false);
  };

  useEffect(() => {
    if (!selected?.id) {
      setComments([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "comments"), where("contentId", "==", selected.id)),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setComments(list);
      }
    );
    return () => unsub();
  }, [selected?.id]);

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
    } catch (err) {
      console.error(err);
      alert("No se pudo publicar el comentario");
    }
    setSavingComment(false);
  };

  const Stars = ({ contentId, size = 18, interactive = false }) => {
    const data = ratings[contentId] || { average: 0, count: 0, userRating: 0 };
    const display = interactive ? data.userRating || 0 : data.average;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap" }}>
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

    const isFinished =
      item.seriesStatus === "finished" || item.seriesStatus === "finalizada";

    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: "bold",
          backgroundColor: isFinished ? "#2e7d32" : "#e65100",
          color: "#fff",
          marginLeft: "6px"
        }}
      >
        {isFinished ? "FINALIZADA" : "AÑADIÉNDOSE"}
      </span>
    );
  };

  const handleSelect = async (item) => {
    setSelected(item);
    setNewComment("");
    if (item.type === "series" && item.episodes?.length > 0) {
      const first = item.episodes[0];
      setCurrentEpisode({
        ...first,
        number: first.number || 1,
        season: first.season || 1
      });
    } else {
      setCurrentEpisode(null);
    }
    await addToHistory(item.id);
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
      const q = search.toLowerCase().trim();
      const inTitle = item.title?.toLowerCase().includes(q);
      const inArtists = Array.isArray(item.artists)
        ? item.artists.some((a) => a.toLowerCase().includes(q))
        : String(item.artists || "").toLowerCase().includes(q);
      if (!inTitle && !inArtists) return false;
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
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
          position: "relative",
          transition: "transform 0.2s, box-shadow 0.2s",
          border: "1px solid #2a2a2a"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.04)";
          e.currentTarget.style.boxShadow = "0 8px 25px rgba(255, 107, 0, 0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <button
          onClick={(e) => toggleFavorite(item.id, e)}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.7)",
            border: "none",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            cursor: "pointer",
            fontSize: "18px",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {favorites[item.id] ? "❤️" : "🤍"}
        </button>

        {poster ? (
          <img
            src={poster}
            alt={item.title}
            style={{ width: "100%", height: "240px", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "240px",
              background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
              fontSize: "14px"
            }}
          >
            Sin portada
          </div>
        )}

        <div style={{ padding: "12px" }}>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", lineHeight: 1.3, fontWeight: 600, color: "#fff" }}>
            {item.title}
          </h3>
          <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#aaa" }}>
            {item.type === "movie" ? "Película" : `Serie • ${item.episodes?.length || 0} eps`}
            {item.year && ` • ${item.year}`}
            <StatusBadge item={item} />
          </p>
          {item.artists?.length > 0 && (
            <p style={{ margin: "0 0 6px 0", fontSize: "11px", color: "#ffb74d" }}>
              {Array.isArray(item.artists)
                ? item.artists.slice(0, 2).join(", ")
                : item.artists}
              {Array.isArray(item.artists) && item.artists.length > 2 ? "…" : ""}
            </p>
          )}
          <Stars contentId={item.id} size={14} />
        </div>
      </div>
    );
  };

  if (selected) {
    const isSeries = selected.type === "series";
    const videoLink = isSeries
      ? currentEpisode?.link || currentEpisode?.driveLink
      : selected.driveLink;
    const embedUrl = getEmbedUrl(videoLink);
    const canPlay = isSubActive() && deviceAllowed;

    const bySeason = {};
    if (isSeries && selected.episodes?.length > 0) {
      selected.episodes.forEach((ep, i) => {
        const season = Number(ep.season) || 1;
        if (!bySeason[season]) bySeason[season] = [];
        bySeason[season].push({
          ...ep,
          number: ep.number || bySeason[season].length + 1,
          season,
          _index: i
        });
      });
    }
    const seasons = Object.keys(bySeason)
      .map(Number)
      .sort((a, b) => a - b);

    return (
      <div style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto", color: "#fff", minHeight: "100vh" }}>
        <button
          onClick={handleBack}
          style={{
            marginBottom: "20px",
            padding: "10px 20px",
            background: "#2a2a2a",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          ← Volver al catálogo
        </button>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "12px"
        }}>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700 }}>
            {selected.title}
            <StatusBadge item={selected} />
          </h1>
          <button
            onClick={(e) => toggleFavorite(selected.id, e)}
            style={{
              padding: "10px 18px",
              background: favorites[selected.id] ? "#c62828" : "#2a2a2a",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            {favorites[selected.id] ? "❤️ En favoritos" : "🤍 Agregar a favoritos"}
          </button>
        </div>

        {isSeries && currentEpisode && (
          <p style={{ color: "#ff9800", margin: "0 0 8px 0", fontWeight: 600 }}>
            Temporada {currentEpisode.season || 1} · Episodio {currentEpisode.number}
            {currentEpisode.title ? `: ${currentEpisode.title}` : ""}
          </p>
        )}

        <p style={{ color: "#aaa", margin: "0 0 8px 0", fontSize: "14px" }}>
          {selected.type === "movie" ? "Película" : "Serie"}
          {selected.year && ` • ${selected.year}`}
          {selected.genres?.length > 0 && ` • ${selected.genres.join(", ")}`}
        </p>

        {selected.artists?.length > 0 && (
          <p style={{ color: "#ffb74d", margin: "0 0 16px 0", fontSize: "14px" }}>
            <strong style={{ color: "#ccc" }}>Estrellas: </strong>
            {Array.isArray(selected.artists)
              ? selected.artists.join(", ")
              : selected.artists}
          </p>
        )}

        <div style={{ marginBottom: "20px" }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#ccc" }}>Tu calificación:</p>
          <Stars contentId={selected.id} size={28} interactive />
        </div>

        {selected.description && (
          <p style={{ marginBottom: "24px", color: "#ccc", lineHeight: 1.6, fontSize: "15px" }}>
            {selected.description}
          </p>
        )}

        {selected.trailer && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#ffaa55" }}>Tráiler</h3>
            {(() => {
              const yt = getYoutubeId(selected.trailer);
              if (yt) {
                return (
                  <div style={{
                    position: "relative",
                    paddingBottom: "56.25%",
                    height: 0,
                    overflow: "hidden",
                    borderRadius: "12px",
                    background: "#000",
                    maxWidth: "640px"
                  }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${yt}?rel=0`}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        border: "none"
                      }}
                      allow="encrypted-media; fullscreen"
                      allowFullScreen
                    />
                  </div>
                );
              }
              return (
                <a
                  href={selected.trailer}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#ff6b00", fontWeight: 600 }}
                >
                  Ver tráiler ↗
                </a>
              );
            })()}
          </div>
        )}

        {!canPlay ? (
          <div style={{
            padding: "50px",
            textAlign: "center",
            background: "#1a1a1a",
            borderRadius: "12px",
            marginBottom: "28px",
            border: "2px solid #e65100"
          }}>
            <h3 style={{ color: "#ff9800", marginTop: 0 }}>
              {!isSubActive() ? "Suscripción vencida" : "Límite de dispositivos"}
            </h3>
            <p style={{ color: "#ccc" }}>
              {!isSubActive()
                ? "Tu suscripción ha terminado. Puedes ver el catálogo, pero no reproducir contenido."
                : "Esta cuenta ya está siendo usada en 4 dispositivos. Elimina uno desde Mi Perfil para poder ver aquí."}
            </p>
          </div>
        ) : videoLink ? (
          isMegaLink(videoLink) ? (
            <div style={{
              padding: "50px",
              background: "#111",
              borderRadius: "12px",
              textAlign: "center",
              marginBottom: "28px",
              border: "1px solid #333"
            }}>
              <a
                href={videoLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "16px 36px",
                  background: "#D9272E",
                  color: "#fff",
                  fontWeight: "bold",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontSize: "16px"
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
              borderRadius: "12px",
              background: "#000",
              marginBottom: "28px",
              border: "1px solid #333"
            }}>
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
            <div style={{
              padding: "50px",
              textAlign: "center",
              color: "#888",
              background: "#111",
              borderRadius: "12px",
              marginBottom: "28px"
            }}>
              No se pudo cargar el video
            </div>
          )
        ) : (
          <div style={{
            padding: "50px",
            textAlign: "center",
            color: "#888",
            background: "#111",
            borderRadius: "12px",
            marginBottom: "28px"
          }}>
            No hay video disponible
          </div>
        )}

        {isSeries && seasons.length > 0 && (
          <div style={{ marginBottom: "36px" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "20px" }}>
              Episodios ({selected.episodes.length})
            </h2>

            {seasons.map((seasonNum) => (
              <div key={seasonNum} style={{ marginBottom: "28px" }}>
                <h3 style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  color: "#ffaa55",
                  borderBottom: "2px solid #ff6b00",
                  paddingBottom: "8px",
                  display: "inline-block"
                }}>
                  Temporada {seasonNum}
                  <span style={{ color: "#888", fontWeight: 400, fontSize: "14px", marginLeft: "8px" }}>
                    ({bySeason[seasonNum].length} episodios)
                  </span>
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  {bySeason[seasonNum].map((ep) => {
                    const num = ep.number;
                    const active =
                      currentEpisode?.number === num &&
                      Number(currentEpisode?.season || 1) === seasonNum;

                    return (
                      <div
                        key={`${seasonNum}-${num}-${ep._index}`}
                        onClick={() => {
                          if (!canPlay) return;
                          setCurrentEpisode({ ...ep, number: num, season: seasonNum });
                          addToHistory(selected.id, num);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "14px",
                          background: active ? "#1a2a3a" : "#1a1a1a",
                          borderRadius: "10px",
                          cursor: canPlay ? "pointer" : "not-allowed",
                          opacity: canPlay ? 1 : 0.6,
                          border: active ? "2px solid #ff6b00" : "1px solid #333"
                        }}
                      >
                        <div style={{
                          width: "52px",
                          height: "42px",
                          background: active ? "#ff6b00" : "#333",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          color: "#fff",
                          fontSize: "16px"
                        }}>
                          {num}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                            Episodio {num}
                            {ep.title ? ` · ${ep.title}` : ""}
                          </div>
                          <div style={{ fontSize: "13px", color: active ? "#ffb74d" : "#aaa" }}>
                            {active ? "▶ Reproduciendo" : "Episodio"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "10px", borderTop: "1px solid #333", paddingTop: "24px" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "20px" }}>
            Comentarios ({comments.length})
          </h2>
          <div style={{ marginBottom: "20px" }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario (máx. 500 caracteres)"
              rows={3}
              maxLength={500}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #444",
                background: "#1a1a1a",
                color: "#fff",
                resize: "vertical",
                marginBottom: "10px",
                boxSizing: "border-box",
                fontSize: "15px"
              }}
            />
            <button
              onClick={handleAddComment}
              disabled={savingComment || !newComment.trim()}
              style={{
                padding: "12px 24px",
                background: "#ff6b00",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                opacity: savingComment || !newComment.trim() ? 0.6 : 1
              }}
            >
              {savingComment ? "Publicando..." : "Publicar comentario"}
            </button>
          </div>
          {comments.length === 0 ? (
            <p style={{ color: "#666" }}>Sé el primero en comentar</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "#1a1a1a",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid #333"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "14px" }}>{c.displayName}</strong>
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", color: "#ccc", lineHeight: 1.5 }}>{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto", color: "#fff", minHeight: "100vh" }}>
      <div style={{ marginBottom: "28px" }}>
        <input
          type="text"
          placeholder="Buscar por título o artista..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: "12px",
            border: "1px solid #333",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: "16px",
            marginBottom: "14px",
            boxSizing: "border-box",
            outline: "none"
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          {["all", "movie", "series"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: "9px 18px",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                background: filterType === t ? "#ff6b00" : "#2a2a2a",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600
              }}
            >
              {t === "all" ? "Todos" : t === "movie" ? "Películas" : "Series"}
            </button>
          ))}

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            style={{
              padding: "9px 16px",
              borderRadius: "20px",
              border: "1px solid #444",
              background: "#2a2a2a",
              color: "#fff",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            <option value="all">Todos los años</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={{
              padding: "9px 18px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              background: showFavoritesOnly ? "#c62828" : "#2a2a2a",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600
            }}
          >
            {showFavoritesOnly ? "❤️ Favoritos" : "🤍 Favoritos"}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", marginTop: "60px" }}>Cargando contenido...</p>
      ) : (
        <>
          {!search && !showFavoritesOnly && filterType === "all" && filterYear === "all" && contents.length > 0 && (
            <div style={{ marginBottom: "36px" }}>
              <h2 style={{ margin: "0 0 16px 0", fontSize: "22px", fontWeight: 700, color: "#ff6b00" }}>
                ✨ Nuevos agregados
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "16px"
              }}>
                {contents.slice(0, 6).map((item) => (
                  <ContentCard key={`new-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          )}

          {!search && !showFavoritesOnly && filterType === "all" && filterYear === "all" && recentHistory.length > 0 && (
            <div style={{ marginBottom: "36px" }}>
              <h2 style={{ margin: "0 0 16px 0", fontSize: "22px", fontWeight: 700 }}>Seguir viendo</h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "16px"
              }}>
                {recentHistory.map((item) => (
                  <ContentCard key={`hist-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          )}

          {!search && !showFavoritesOnly && filterType === "all" && filterYear === "all" && featured.length > 0 && (
            <div style={{ marginBottom: "36px" }}>
              <h2 style={{ margin: "0 0 16px 0", fontSize: "22px", fontWeight: 700 }}>Destacados</h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "16px"
              }}>
                {featured.map((item) => (
                  <ContentCard key={`feat-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          )}

          <h2 style={{ margin: "0 0 16px 0", fontSize: "22px", fontWeight: 700 }}>
            {showFavoritesOnly
              ? "Mis favoritos"
              : search
              ? `Resultados de "${search}"`
              : "Catálogo"}{" "}
            <span style={{ color: "#888", fontSize: "16px", fontWeight: 400 }}>
              ({filtered.length})
            </span>
          </h2>

          {filtered.length === 0 ? (
            <p style={{ color: "#888", textAlign: "center", marginTop: "40px" }}>
              No se encontró contenido
            </p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: "18px"
            }}>
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