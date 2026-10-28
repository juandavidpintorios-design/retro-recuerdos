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
  const [heroIndex, setHeroIndex] = useState(0);
  const [shareMsg, setShareMsg] = useState("");

  const getDeviceId = () => {
    let id = localStorage.getItem("retro_device_id");
    if (!id) {
      id = "dev_" + Math.random().toString(36).slice(2) + "_" + Date.now();
      localStorage.setItem("retro_device_id", id);
    }
    return id;
  };

  const getDeviceLabel = () => {
    const ua = navigator.userAgent || "";
    if (/mobile/i.test(ua)) return "Celular";
    if (/tablet|ipad/i.test(ua)) return "Tablet";
    return "PC / Laptop";
  };

  const isSubActive = () => {
    if (!user?.subscriptionExpiresAt) return false;
    try {
      const expire = user.subscriptionExpiresAt.toDate
        ? user.subscriptionExpiresAt.toDate()
        : new Date(user.subscriptionExpiresAt);
      return expire > new Date();
    } catch {
      return false;
    }
  };

  const isNewItem = (item) => {
    if (!item?.createdAt) return false;
    try {
      const created = item.createdAt.toDate
        ? item.createdAt.toDate()
        : new Date(
            item.createdAt.seconds
              ? item.createdAt.seconds * 1000
              : item.createdAt
          );
      return Date.now() - created.getTime() < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
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
        userAgent: (navigator.userAgent || "").slice(0, 120),
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

    const unsubContent = onSnapshot(
      collection(db, "content"),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setContents(list);
        setLoading(false);
        setSelected((prev) => {
          if (!prev) return null;
          const updated = list.find((c) => c.id === prev.id);
          return updated || prev;
        });
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    const unsubRatings = onSnapshot(collection(db, "ratings"), (snap) => {
      const allRatings = {};
      snap.forEach((d) => {
        const data = d.data();
        if (!data?.contentId) return;
        if (!allRatings[data.contentId]) allRatings[data.contentId] = [];
        allRatings[data.contentId].push(data);
      });
      setRatings((prev) => {
        const ratingsData = { ...prev };
        Object.keys(allRatings).forEach((contentId) => {
          const itemRatings = allRatings[contentId] || [];
          const count = itemRatings.length;
          const average =
            count > 0
              ? itemRatings.reduce((s, r) => s + Number(r.rating || 0), 0) / count
              : 0;
          const userR = itemRatings.find((r) => r.userId === user.uid);
          ratingsData[contentId] = {
            average: Math.round(average * 10) / 10,
            count,
            userRating: userR ? Number(userR.rating) : 0
          };
        });
        return ratingsData;
      });
    });

    const unsubFav = onSnapshot(
      query(collection(db, "favorites"), where("userId", "==", user.uid)),
      (snap) => {
        const favs = {};
        snap.forEach((d) => {
          const cid = d.data()?.contentId;
          if (cid) favs[cid] = true;
        });
        setFavorites(favs);
      }
    );

    const unsubHist = onSnapshot(
      query(collection(db, "history"), where("userId", "==", user.uid)),
      (snap) => {
        const hist = [];
        snap.forEach((d) => hist.push({ id: d.id, ...d.data() }));
        hist.sort(
          (a, b) => (b.watchedAt?.seconds || 0) - (a.watchedAt?.seconds || 0)
        );
        setHistory(hist.slice(0, 30));
      }
    );

    return () => {
      unsubContent();
      unsubRatings();
      unsubFav();
      unsubHist();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const updatePresence = async (watchingTitle = null, watchingId = null) => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          lastActiveAt: serverTimestamp(),
          currentlyWatching: watchingTitle,
          currentlyWatchingId: watchingId
        });
      } catch (e) {
        console.error("presence", e);
      }
    };
    const getWatchingLabel = () => {
      if (!selected) return null;
      if (selected.type === "series" && currentEpisode) {
        return `${selected.title} — T${currentEpisode.season || 1}E${currentEpisode.number}`;
      }
      return selected.title || null;
    };
    updatePresence(getWatchingLabel(), selected?.id || null);
    const interval = setInterval(() => {
      updatePresence(getWatchingLabel(), selected?.id || null);
    }, 45000);
    return () => {
      clearInterval(interval);
      updateDoc(doc(db, "users", user.uid), {
        lastActiveAt: serverTimestamp(),
        currentlyWatching: null,
        currentlyWatchingId: null
      }).catch(() => {});
    };
  }, [user?.uid, selected?.id, currentEpisode?.number, currentEpisode?.season]);

  const getYoutubeId = (link) => {
    if (!link) return null;
    const m = String(link).match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return m ? m[1] : null;
  };

  const isDirectVideo = (link) =>
    !!link &&
    (/\.(mp4|webm|ogg)(\?|$)/i.test(link) ||
      link.includes("firebasestorage.googleapis.com") ||
      link.includes("supabase.co/storage") ||
      link.includes("r2.dev") ||
      link.includes("b-cdn.net"));

  const getEmbedUrl = (link) => {
    if (!link) return null;
    if (isDirectVideo(link)) return null;
    if (link.includes("geo.dailymotion.com/player/")) return link;
    const yt = getYoutubeId(link);
    if (yt) return `https://www.youtube.com/embed/${yt}?rel=0`;
    const dm =
      link.match(/dailymotion\.com\/(?:embed\/)?video\/([a-zA-Z0-9]+)/i) ||
      link.match(/dai\.ly\/([a-zA-Z0-9]+)/i);
    if (dm) return `https://www.dailymotion.com/embed/video/${dm[1]}`;
    const drive = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
    if (link.includes("archive.org")) {
      if (link.includes("/details/")) return link.replace("/details/", "/embed/");
      if (link.includes("/embed/")) return link;
      const id = link.split("/").filter(Boolean).pop();
      return `https://archive.org/embed/${id}`;
    }
    if (link.includes("vimeo.com")) {
      const vm = link.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    }
    return null;
  };

  const isMegaLink = (link) => link && link.includes("mega.nz");
  const isDailymotionLink = (link) =>
    link &&
    (link.includes("dailymotion.com") ||
      link.includes("dai.ly") ||
      link.includes("geo.dailymotion.com"));

  const getPoster = (item) => {
    if (!item) return null;
    if (item.poster) return item.poster;
    if (item.driveLink) {
      const yt = getYoutubeId(item.driveLink);
      if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
    }
    if (item.trailer) {
      const yt = getYoutubeId(item.trailer);
      if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
    }
    if (item.episodes?.[0]?.link) {
      const yt = getYoutubeId(item.episodes[0].link);
      if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
    }
    return null;
  };

  const getHistoryFor = (contentId) =>
    history.find((h) => h.contentId === contentId) || null;

  const getSeriesProgress = (item) => {
    if (!item || item.type !== "series" || !item.episodes?.length) return null;
    const h = getHistoryFor(item.id);
    const epNum = Number(h?.episodeNumber) || 0;
    const total = item.episodes.length;
    if (!epNum) return { pct: 4, label: "Empezar" };
    const pct = Math.min(100, Math.round((epNum / total) * 100));
    return { pct, label: `Ep. ${epNum}/${total}` };
  };

  const toggleFavorite = async (contentId, e) => {
    e?.stopPropagation?.();
    if (!user?.uid || !contentId) return;
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
    if (!user?.uid || !contentId) return;
    try {
      const histId = `${user.uid}_${contentId}`;
      await setDoc(
        doc(db, "history", histId),
        {
          userId: user.uid,
          contentId,
          episodeNumber: episodeNumber ?? null,
          watchedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRate = async (contentId, rating) => {
    if (savingRating || !user?.uid) return;
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
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
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

  const handleShare = async (item) => {
    if (!item) return;
    const url = window.location.origin;
    const text = `Mira "${item.title}" en Retro Recuerdos`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareMsg("Enlace copiado");
        setTimeout(() => setShareMsg(""), 2500);
      } else {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
          "_blank"
        );
      }
    } catch {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
        "_blank"
      );
    }
  };

  const Stars = ({ contentId, size = 18, interactive = false }) => {
    const data = ratings[contentId] || { average: 0, count: 0, userRating: 0 };
    const display = interactive ? data.userRating || 0 : data.average;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            onClick={
              interactive && !savingRating
                ? () => handleRate(contentId, s)
                : undefined
            }
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
    if (!item || item.type !== "series" || !item.seriesStatus) return null;
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

  const isSeriesFinished = (item) =>
    item?.seriesStatus === "finished" || item?.seriesStatus === "finalizada";

  const TrailerPlayer = ({ trailerUrl }) => {
    if (!trailerUrl || !String(trailerUrl).trim()) return null;
    const embed = getEmbedUrl(trailerUrl);
    const direct = isDirectVideo(trailerUrl);
    return (
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#ffaa55", fontSize: "16px" }}>
          ▶ Tráiler
        </h3>
        {direct ? (
          <video
            src={trailerUrl}
            controls
            playsInline
            style={{
              width: "100%",
              maxWidth: 640,
              borderRadius: 12,
              background: "#000",
              border: "1px solid #333"
            }}
          />
        ) : embed ? (
          <div
            style={{
              position: "relative",
              paddingBottom: "56.25%",
              height: 0,
              overflow: "hidden",
              borderRadius: "12px",
              background: "#000",
              maxWidth: "640px",
              border: "1px solid #333"
            }}
          >
            <iframe
              src={embed}
              title="Tráiler"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none"
              }}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div
            style={{
              padding: "24px",
              background: "#1a1a1a",
              borderRadius: "12px",
              border: "1px solid #333",
              maxWidth: "640px",
              textAlign: "center"
            }}
          >
            <a
              href={trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                background: "#ff6b00",
                color: "#fff",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 600
              }}
            >
              Ver tráiler ↗
            </a>
          </div>
        )}
      </div>
    );
  };

  const handleSelect = async (item) => {
    if (!item) return;
    setShareMsg("");
    setNewComment("");
    setSelected(item);

    if (item.type === "series" && item.episodes?.length > 0) {
      const h = getHistoryFor(item.id);
      const savedEp = Number(h?.episodeNumber) || 0;
      let ep = item.episodes[0];
      if (savedEp) {
        const found = item.episodes.find(
          (e, i) => Number(e.number || i + 1) === savedEp
        );
        if (found) ep = found;
      }
      const idx = item.episodes.indexOf(ep);
      setCurrentEpisode({
        ...ep,
        number: Number(ep.number) || idx + 1,
        season: Number(ep.season) || 1
      });
    } else {
      setCurrentEpisode(null);
    }

    await addToHistory(
      item.id,
      item.type === "series" ? getHistoryFor(item.id)?.episodeNumber || null : null
    );

    try {
      if (user?.uid) {
        await updateDoc(doc(db, "users", user.uid), {
          lastActiveAt: serverTimestamp(),
          currentlyWatching: item.title || null,
          currentlyWatchingId: item.id
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    setCurrentEpisode(null);
    setComments([]);
    setNewComment("");
    setShareMsg("");
    setSelected(null);
    try {
      window.scrollTo(0, 0);
    } catch {}
    if (user?.uid) {
      updateDoc(doc(db, "users", user.uid), {
        lastActiveAt: serverTimestamp(),
        currentlyWatching: null,
        currentlyWatchingId: null
      }).catch(() => {});
    }
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
      const inTitle = (item.title || "").toLowerCase().includes(q);
      const inArtists = Array.isArray(item.artists)
        ? item.artists.some((a) => String(a).toLowerCase().includes(q))
        : String(item.artists || "").toLowerCase().includes(q);
      if (!inTitle && !inArtists) return false;
    }
    return true;
  });

  const featured = contents
    .filter((c) => (ratings[c.id]?.average || 0) >= 4)
    .slice(0, 12);

  const recentHistory = history
    .map((h) => {
      const c = contents.find((x) => x.id === h.contentId);
      if (!c) return null;
      return { ...c, _histEp: h.episodeNumber };
    })
    .filter(Boolean)
    .slice(0, 12);

  const withTrailer = contents.filter((c) => c.trailer && String(c.trailer).trim());
  const seriesOnly = contents.filter((c) => c.type === "series");
  const moviesOnly = contents.filter((c) => c.type === "movie");
  const newest = contents.slice(0, 12);

  const heroPool = (() => {
    const pool = [];
    const seen = new Set();
    const add = (item) => {
      if (item?.id && !seen.has(item.id) && getPoster(item)) {
        seen.add(item.id);
        pool.push(item);
      }
    };
    recentHistory.forEach(add);
    featured.forEach(add);
    newest.forEach(add);
    if (pool.length === 0 && contents[0]) pool.push(contents[0]);
    return pool;
  })();

  const safeHeroIndex = heroPool.length > 0 ? heroIndex % heroPool.length : 0;
  const heroItem = heroPool[safeHeroIndex] || null;

  useEffect(() => {
    if (selected) return;
    if (heroPool.length <= 1) return;
    const t = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroPool.length);
    }, 8000);
    return () => clearInterval(t);
  }, [selected, heroPool.length]);

  const showHomeLanes =
    !search && !showFavoritesOnly && filterType === "all" && filterYear === "all";

  const rowScrollStyle = {
    display: "flex",
    gap: "14px",
    overflowX: "auto",
    paddingBottom: "12px",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "thin"
  };

  const ContentCard = ({ item, showProgress }) => {
    if (!item) return null;
    const poster = getPoster(item);
    const progress = showProgress ? getSeriesProgress(item) : null;
    const w = 168;
    const h = 240;
    const hasStatus = item.type === "series" && item.seriesStatus;
    const leftOffset = (isNewItem(item) ? 64 : 8) + (hasStatus && isNewItem(item) ? 0 : 0);

    return (
      <div
        onClick={() => handleSelect(item)}
        style={{
          cursor: "pointer",
          borderRadius: "10px",
          overflow: "hidden",
          backgroundColor: "#141414",
          position: "relative",
          transition: "transform 0.2s, box-shadow 0.2s",
          border: "1px solid #2a2a2a",
          flex: `0 0 ${w}px`,
          width: w,
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 10px 28px rgba(255, 107, 0, 0.35)";
          e.currentTarget.style.borderColor = "#ff6b00";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)";
          e.currentTarget.style.borderColor = "#2a2a2a";
        }}
      >
        {isNewItem(item) && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "#ff6b00",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 7px",
              borderRadius: 4,
              zIndex: 2
            }}
          >
            NUEVO
          </span>
        )}
        {hasStatus && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: isNewItem(item) ? 72 : 8,
              zIndex: 2,
              fontSize: 9,
              fontWeight: 800,
              padding: "3px 6px",
              borderRadius: 4,
              background: isSeriesFinished(item) ? "#2e7d32" : "#e65100",
              color: "#fff"
            }}
          >
            {isSeriesFinished(item) ? "FINALIZADA" : "AÑADIÉNDOSE"}
          </span>
        )}
        <button
          onClick={(e) => toggleFavorite(item.id, e)}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(0,0,0,0.75)",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: 16,
            zIndex: 2
          }}
        >
          {favorites[item.id] ? "❤️" : "🤍"}
        </button>

        <div style={{ position: "relative" }}>
          {poster ? (
            <img
              src={poster}
              alt={item.title || ""}
              style={{
                width: "100%",
                height: h,
                objectFit: "cover",
                display: "block"
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: h,
                background: "linear-gradient(135deg,#2a2a2a,#111)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
                fontSize: 13
              }}
            >
              Sin portada
            </div>
          )}
          {progress && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 4,
                background: "rgba(0,0,0,0.55)"
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress.pct}%`,
                  background: "#ff6b00"
                }}
              />
            </div>
          )}
          {item.trailer && !progress && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                background: "rgba(0,0,0,0.85)",
                color: "#ff6b00",
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 4,
                fontWeight: 700
              }}
            >
              ▶ Trailer
            </div>
          )}
        </div>

        <div style={{ padding: "10px 10px 12px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {item.title}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#999" }}>
            {progress
              ? progress.label
              : `${item.type === "movie" ? "Película" : "Serie"}${
                  item.year ? ` · ${item.year}` : ""
                }`}
          </p>
        </div>
      </div>
    );
  };

  const Lane = ({ title, items, color = "#fff", showProgress }) => {
    if (!items?.length) return null;
    return (
      <div style={{ marginBottom: 36 }}>
        <h2
          style={{
            margin: "0 0 14px 0",
            fontSize: 20,
            fontWeight: 700,
            color,
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          <span
            style={{
              width: 4,
              height: 20,
              background: "#ff6b00",
              borderRadius: 2,
              display: "inline-block"
            }}
          />
          {title}
        </h2>
        <div style={rowScrollStyle}>
          {items.map((item) => (
            <ContentCard
              key={`${title}-${item.id}`}
              item={item}
              showProgress={showProgress}
            />
          ))}
        </div>
      </div>
    );
  };

  // ========== DETALLE ==========
  if (selected) {
    const isSeries = selected.type === "series";
    const videoLink = isSeries
      ? currentEpisode?.link || currentEpisode?.driveLink
      : selected.driveLink;
    const embedUrl = getEmbedUrl(videoLink);
    const directVideo = isDirectVideo(videoLink);
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
      <div
        key={`detail-${selected.id}`}
        style={{
          padding: "20px",
          maxWidth: "1100px",
          margin: "0 auto",
          color: "#fff",
          minHeight: "100vh",
          background: "#0a0a0a"
        }}
      >
        <button
          onClick={handleBack}
          style={{
            marginBottom: 20,
            padding: "10px 20px",
            background: "#2a2a2a",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14
          }}
        >
          ← Volver al catálogo
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 12
          }}
        >
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>
            {selected.title}
            <StatusBadge item={selected} />
            {isNewItem(selected) && (
              <span
                style={{
                  marginLeft: 8,
                  background: "#ff6b00",
                  color: "#fff",
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontWeight: 800
                }}
              >
                NUEVO
              </span>
            )}
          </h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => handleShare(selected)}
              style={{
                padding: "10px 18px",
                background: "#1565c0",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              Compartir
            </button>
            <button
              onClick={(e) => toggleFavorite(selected.id, e)}
              style={{
                padding: "10px 18px",
                background: favorites[selected.id] ? "#c62828" : "#2a2a2a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              {favorites[selected.id] ? "❤️ En favoritos" : "🤍 Agregar a favoritos"}
            </button>
          </div>
        </div>
        {shareMsg && (
          <p style={{ color: "#4CAF50", margin: "0 0 12px", fontSize: 14 }}>{shareMsg}</p>
        )}

        {isSeries && currentEpisode && (
          <p style={{ color: "#ff9800", margin: "0 0 8px", fontWeight: 600 }}>
            Temporada {currentEpisode.season || 1} · Episodio {currentEpisode.number}
            {currentEpisode.title ? `: ${currentEpisode.title}` : ""}
          </p>
        )}

        <p style={{ color: "#aaa", margin: "0 0 8px", fontSize: 14 }}>
          {selected.type === "movie" ? "Película" : "Serie"}
          {selected.year && ` • ${selected.year}`}
          {selected.genres?.length > 0 && ` • ${selected.genres.join(", ")}`}
        </p>

        {selected.artists?.length > 0 && (
          <p style={{ color: "#ffb74d", margin: "0 0 16px", fontSize: 14 }}>
            <strong style={{ color: "#ccc" }}>Estrellas: </strong>
            {Array.isArray(selected.artists)
              ? selected.artists.join(", ")
              : selected.artists}
          </p>
        )}

        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 6px", fontSize: 14, color: "#ccc" }}>Tu calificación:</p>
          <Stars contentId={selected.id} size={28} interactive />
        </div>

        {selected.description && (
          <p style={{ marginBottom: 24, color: "#ccc", lineHeight: 1.6, fontSize: 15 }}>
            {selected.description}
          </p>
        )}

        <TrailerPlayer trailerUrl={selected.trailer} />

        {!canPlay ? (
          <div
            style={{
              padding: 50,
              textAlign: "center",
              background: "#1a1a1a",
              borderRadius: 12,
              marginBottom: 28,
              border: "2px solid #e65100"
            }}
          >
            <h3 style={{ color: "#ff9800", marginTop: 0 }}>
              {!isSubActive() ? "Suscripción vencida" : "Límite de dispositivos"}
            </h3>
            <p style={{ color: "#ccc" }}>
              {!isSubActive()
                ? "Tu suscripción ha terminado. Puedes ver el catálogo, pero no reproducir contenido."
                : "Esta cuenta ya está siendo usada en 4 dispositivos. Elimina uno desde Mi Perfil."}
            </p>
          </div>
        ) : videoLink ? (
          isMegaLink(videoLink) ? (
            <div
              style={{
                padding: 50,
                background: "#111",
                borderRadius: 12,
                textAlign: "center",
                marginBottom: 28,
                border: "1px solid #333"
              }}
            >
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
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 16
                }}
              >
                Ver en Mega
              </a>
            </div>
          ) : directVideo ? (
            <div style={{ marginBottom: 28 }}>
              <video
                src={videoLink}
                controls
                playsInline
                style={{
                  width: "100%",
                  maxHeight: "70vh",
                  borderRadius: 12,
                  background: "#000",
                  border: "1px solid #333"
                }}
              />
            </div>
          ) : embedUrl ? (
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%",
                  height: 0,
                  overflow: "hidden",
                  borderRadius: 12,
                  background: "#000",
                  border: "1px solid #333"
                }}
              >
                <iframe
                  src={embedUrl}
                  title="player"
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
              {isDailymotionLink(videoLink) && (
                <p style={{ textAlign: "center", marginTop: 12 }}>
                  <a
                    href={videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#00aaff", fontSize: 14 }}
                  >
                    Si no carga, abrir en Dailymotion ↗
                  </a>
                </p>
              )}
            </div>
          ) : isDailymotionLink(videoLink) ? (
            <div
              style={{
                padding: 50,
                background: "#111",
                borderRadius: 12,
                textAlign: "center",
                marginBottom: 28,
                border: "1px solid #333"
              }}
            >
              <a
                href={videoLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "16px 36px",
                  background: "#0066DC",
                  color: "#fff",
                  fontWeight: "bold",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 16
                }}
              >
                Ver en Dailymotion
              </a>
            </div>
          ) : (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: "#888",
                background: "#1a1a1a",
                borderRadius: 12,
                marginBottom: 28
              }}
            >
              No se pudo cargar el video
            </div>
          )
        ) : (
          <div
            style={{
              padding: 50,
              textAlign: "center",
              color: "#888",
              background: "#1a1a1a",
              borderRadius: 12,
              marginBottom: 28
            }}
          >
            No hay video disponible
          </div>
        )}

        {isSeries && seasons.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>
              Episodios ({selected.episodes.length})
            </h2>
            {seasons.map((seasonNum) => (
              <div key={seasonNum} style={{ marginBottom: 28 }}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 16,
                    color: "#ffaa55",
                    borderBottom: "2px solid #ff6b00",
                    paddingBottom: 8,
                    display: "inline-block"
                  }}
                >
                  Temporada {seasonNum}
                  <span
                    style={{
                      color: "#888",
                      fontWeight: 400,
                      fontSize: 14,
                      marginLeft: 8
                    }}
                  >
                    ({bySeason[seasonNum].length} episodios)
                  </span>
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 12
                  }}
                >
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
                          gap: 14,
                          padding: 14,
                          background: active ? "#1a2a3a" : "#1a1a1a",
                          borderRadius: 10,
                          cursor: canPlay ? "pointer" : "not-allowed",
                          opacity: canPlay ? 1 : 0.6,
                          border: active ? "2px solid #ff6b00" : "1px solid #333"
                        }}
                      >
                        <div
                          style={{
                            width: 52,
                            height: 42,
                            background: active ? "#ff6b00" : "#333",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            color: "#fff",
                            fontSize: 16
                          }}
                        >
                          {num}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", fontSize: 15 }}>
                            Episodio {num}
                            {ep.title ? ` · ${ep.title}` : ""}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: active ? "#ffb74d" : "#aaa"
                            }}
                          >
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

        <div style={{ marginTop: 10, borderTop: "1px solid #333", paddingTop: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>
            Comentarios ({comments.length})
          </h2>
          <div style={{ marginBottom: 20 }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario (máx. 500 caracteres)"
              rows={3}
              maxLength={500}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border: "1px solid #444",
                background: "#1a1a1a",
                color: "#fff",
                resize: "vertical",
                marginBottom: 10,
                boxSizing: "border-box",
                fontSize: 15
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
                borderRadius: 8,
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
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "#1a1a1a",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid #333"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{c.displayName}</strong>
                    <span style={{ fontSize: 12, color: "#666" }}>
                      {c.createdAt?.toDate
                        ? c.createdAt.toDate().toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "#ccc", lineHeight: 1.5 }}>
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

  // ========== HOME ==========
  return (
    <div
      key="catalog-home"
      style={{
        position: "relative",
        padding: "0 0 48px",
        maxWidth: 1400,
        margin: "0 auto",
        color: "#fff",
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #1a1208 0%, #0a0a0a 45%, #000 100%)"
      }}
    >
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.04,
          fontSize: "clamp(36px, 10vw, 100px)",
          fontWeight: 900,
          letterSpacing: 6,
          color: "#ff6b00",
          transform: "rotate(-12deg)",
          userSelect: "none"
        }}
      >
        RETRO RECUERDOS
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {showHomeLanes && heroItem && (
          <div
            style={{
              position: "relative",
              width: "100%",
              minHeight: 320,
              maxHeight: 420,
              marginBottom: 28,
              overflow: "hidden",
              background: "#111"
            }}
          >
            {getPoster(heroItem) && (
              <img
                src={getPoster(heroItem)}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.45,
                  filter: "blur(2px)"
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.3) 100%)"
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                padding: "40px 24px",
                maxWidth: 700,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                minHeight: 320
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  color: "#ff6b00",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 1
                }}
              >
                {recentHistory[0]?.id === heroItem.id
                  ? "CONTINUAR VIENDO"
                  : isNewItem(heroItem)
                  ? "NUEVO EN RETRO RECUERDOS"
                  : "DESTACADO"}
              </p>
              <h1
                style={{
                  margin: "0 0 12px",
                  fontSize: "clamp(24px, 5vw, 40px)",
                  fontWeight: 800,
                  lineHeight: 1.15
                }}
              >
                {heroItem.title}
              </h1>
              <p style={{ margin: "0 0 8px", color: "#ccc", fontSize: 14 }}>
                {heroItem.type === "movie" ? "Película" : "Serie"}
                {heroItem.year ? ` · ${heroItem.year}` : ""}
                {heroItem.episodes?.length
                  ? ` · ${heroItem.episodes.length} episodios`
                  : ""}
              </p>
              {heroItem.description && (
                <p
                  style={{
                    margin: "0 0 20px",
                    color: "#bbb",
                    fontSize: 14,
                    lineHeight: 1.5,
                    maxWidth: 520,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}
                >
                  {heroItem.description}
                </p>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => handleSelect(heroItem)}
                  style={{
                    padding: "12px 28px",
                    background: "#ff6b00",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: "pointer"
                  }}
                >
                  ▶ Reproducir
                </button>
                <button
                  onClick={(e) => toggleFavorite(heroItem.id, e)}
                  style={{
                    padding: "12px 22px",
                    background: "rgba(255,255,255,0.12)",
                    color: "#fff",
                    border: "1px solid #555",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  {favorites[heroItem.id] ? "❤️ En favoritos" : "+ Mi lista"}
                </button>
                <button
                  onClick={() => handleShare(heroItem)}
                  style={{
                    padding: "12px 22px",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    border: "1px solid #555",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  Compartir
                </button>
              </div>
              {heroPool.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                  {heroPool.slice(0, 6).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setHeroIndex(i)}
                      style={{
                        width: i === safeHeroIndex ? 20 : 8,
                        height: 8,
                        borderRadius: 4,
                        border: "none",
                        background: i === safeHeroIndex ? "#ff6b00" : "#555",
                        cursor: "pointer",
                        padding: 0
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: "0 20px" }}>
          <div style={{ marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Buscar por título o artista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 12,
                border: "1px solid #333",
                background: "#1a1a1a",
                color: "#fff",
                fontSize: 16,
                marginBottom: 12,
                boxSizing: "border-box",
                outline: "none"
              }}
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center"
              }}
            >
              {["all", "movie", "series"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 20,
                    border: "none",
                    cursor: "pointer",
                    background: filterType === t ? "#ff6b00" : "#2a2a2a",
                    color: "#fff",
                    fontSize: 14,
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
                  borderRadius: 20,
                  border: "1px solid #444",
                  background: "#2a2a2a",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer"
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
                type="button"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  background: showFavoritesOnly ? "#c62828" : "#2a2a2a",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                {showFavoritesOnly ? "❤️ Favoritos" : "🤍 Favoritos"}
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "#888", marginTop: 60 }}>
              Cargando contenido...
            </p>
          ) : showHomeLanes ? (
            <>
              <Lane title="▶ Trailers" items={withTrailer} color="#ff6b00" />
              <Lane title="Seguir viendo" items={recentHistory} showProgress />
              <Lane title="✨ Nuevos agregados" items={newest} color="#ff6b00" />
              <Lane title="Series" items={seriesOnly} />
              <Lane title="Películas" items={moviesOnly} />
              <Lane title="Destacados" items={featured} />
              {contents.length === 0 && (
                <p style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
                  Aún no hay contenido en el catálogo
                </p>
              )}
            </>
          ) : (
            <>
              <h2 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700 }}>
                {showFavoritesOnly
                  ? "Mis favoritos"
                  : search
                  ? `Resultados de "${search}"`
                  : filterType === "movie"
                  ? "Películas"
                  : filterType === "series"
                  ? "Series"
                  : "Catálogo"}{" "}
                <span style={{ color: "#888", fontSize: 16, fontWeight: 400 }}>
                  ({filtered.length})
                </span>
              </h2>
              {filtered.length === 0 ? (
                <p style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
                  No se encontró contenido
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: 16
                  }}
                >
                  {filtered.map((item) => (
                    <div key={item.id} style={{ minWidth: 0 }}>
                      <ContentCard item={item} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Catalog;