import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "firebase/auth";
import { auth, db } from "../firebase";

function Profile({ user, onUserUpdate }) {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ movies: 0, series: 0 });
  const [devices, setDevices] = useState([]);

  const currentDeviceId = localStorage.getItem("retro_device_id");

  useEffect(() => {
    loadData();
  }, [user.uid]);

  const loadData = async () => {
    try {
      const contentSnap = await getDocs(collection(db, "content"));
      const contentList = [];
      contentSnap.forEach((d) => contentList.push({ id: d.id, ...d.data() }));

      // Favoritos
      const favSnap = await getDocs(
        query(collection(db, "favorites"), where("userId", "==", user.uid))
      );
      const favIds = [];
      favSnap.forEach((d) => favIds.push(d.data().contentId));
      setFavorites(contentList.filter((c) => favIds.includes(c.id)));

      // Historial
      const histSnap = await getDocs(
        query(collection(db, "history"), where("userId", "==", user.uid))
      );
      const hist = [];
      histSnap.forEach((d) => hist.push({ id: d.id, ...d.data() }));
      hist.sort((a, b) => (b.watchedAt?.seconds || 0) - (a.watchedAt?.seconds || 0));

      const histItems = hist
        .map((h) => {
          const item = contentList.find((c) => c.id === h.contentId);
          return item
            ? { ...item, watchedAt: h.watchedAt, episodeNumber: h.episodeNumber }
            : null;
        })
        .filter(Boolean);

      setHistory(histItems);
      setStats({
        movies: histItems.filter((i) => i.type === "movie").length,
        series: histItems.filter((i) => i.type === "series").length
      });

      // Dispositivos
      const devSnap = await getDocs(
        query(collection(db, "devices"), where("userId", "==", user.uid))
      );
      const devList = [];
      devSnap.forEach((d) => devList.push({ id: d.id, ...d.data() }));
      devList.sort((a, b) => (b.lastSeen?.seconds || 0) - (a.lastSeen?.seconds || 0));
      setDevices(devList);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: displayName.trim()
      });
      if (onUserUpdate) {
        onUserUpdate({ ...user, displayName: displayName.trim() });
      }
      setMessage("Nombre actualizado correctamente");
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar el nombre");
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setMessage("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("La contraseña actual es incorrecta");
      } else {
        setError("No se pudo cambiar la contraseña");
      }
    }
    setLoading(false);
  };

  const handleRemoveDevice = async (deviceDocId, deviceId) => {
    if (deviceId === currentDeviceId) {
      alert("No puedes eliminar este dispositivo (es el que estás usando ahora).");
      return;
    }
    if (!window.confirm("¿Eliminar este dispositivo?")) return;

    try {
      await deleteDoc(doc(db, "devices", deviceDocId));
      setDevices((prev) => prev.filter((d) => d.id !== deviceDocId));
      setMessage("Dispositivo eliminado");
    } catch (err) {
      console.error(err);
      setError("No se pudo eliminar el dispositivo");
    }
  };

  const formatDate = (ts) => {
    if (!ts?.toDate) return "-";
    return ts.toDate().toLocaleString("es-CO");
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px", color: "#fff" }}>
      <h1 style={{ marginTop: 0, color: "#ffcc00" }}>Mi Perfil</h1>

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

      {/* Estadísticas */}
      <div style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "28px"
      }}>
        {[
          { value: stats.movies, label: "Películas vistas" },
          { value: stats.series, label: "Series vistas" },
          { value: favorites.length, label: "Favoritos" },
          { value: devices.length, label: "Dispositivos" }
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "#1e1e2f",
              padding: "20px",
              borderRadius: "12px",
              flex: 1,
              minWidth: "120px",
              border: "1px solid #333"
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#ff6b00" }}>
              {s.value}
            </div>
            <div style={{ color: "#aaa" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Editar nombre */}
      <div style={{
        background: "#1e1e2f",
        padding: "20px",
        borderRadius: "12px",
        marginBottom: "20px",
        border: "1px solid #333"
      }}>
        <h3 style={{ marginTop: 0, color: "#ffaa55" }}>Editar nombre</h3>
        <form onSubmit={handleUpdateName} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#0d0d1a",
              color: "#fff"
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 20px",
              background: "#ff6b00",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Guardar
          </button>
        </form>
      </div>

      {/* Cambiar contraseña */}
      <div style={{
        background: "#1e1e2f",
        padding: "20px",
        borderRadius: "12px",
        marginBottom: "28px",
        border: "1px solid #333"
      }}>
        <h3 style={{ marginTop: 0, color: "#ffaa55" }}>Cambiar contraseña</h3>
        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            placeholder="Contraseña actual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#0d0d1a",
              color: "#fff",
              marginBottom: "10px",
              boxSizing: "border-box"
            }}
          />
          <input
            type="password"
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#0d0d1a",
              color: "#fff",
              marginBottom: "10px",
              boxSizing: "border-box"
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 20px",
              background: "#ff6b00",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Cambiar contraseña
          </button>
        </form>
      </div>

      {/* Dispositivos */}
      <h2 style={{ color: "#ffcc00" }}>Dispositivos ({devices.length}/4)</h2>
      <p style={{ color: "#888", fontSize: "14px", marginBottom: "12px" }}>
        Máximo 4 dispositivos. Elimina uno si quieres entrar desde otro equipo.
      </p>

      {devices.length === 0 ? (
        <p style={{ color: "#666", marginBottom: "28px" }}>
          No hay dispositivos registrados aún. Se registran al reproducir contenido.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
          {devices.map((d) => {
            const isCurrent = d.deviceId === currentDeviceId;
            return (
              <div
                key={d.id}
                style={{
                  background: "#1a1a1a",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: isCurrent ? "1px solid #ff6b00" : "1px solid #333",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px"
                }}
              >
                <div>
                  <strong>{d.label || "Dispositivo"}</strong>
                  {isCurrent && (
                    <span style={{
                      marginLeft: "8px",
                      fontSize: "12px",
                      color: "#ff6b00",
                      fontWeight: 700
                    }}>
                      (este dispositivo)
                    </span>
                  )}
                  <div style={{ color: "#888", fontSize: "13px", marginTop: "4px" }}>
                    Última vez: {formatDate(d.lastSeen)}
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => handleRemoveDevice(d.id, d.deviceId)}
                    style={{
                      padding: "8px 14px",
                      background: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px"
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Favoritos */}
      <h2 style={{ color: "#ffcc00" }}>Mis favoritos ({favorites.length})</h2>
      {favorites.length === 0 ? (
        <p style={{ color: "#666" }}>Aún no tienes favoritos</p>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "12px",
          marginBottom: "28px"
        }}>
          {favorites.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#1a1a1a",
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid #333"
              }}
            >
              {item.poster ? (
                <img
                  src={item.poster}
                  alt={item.title}
                  style={{ width: "100%", height: "180px", objectFit: "cover" }}
                />
              ) : (
                <div style={{
                  height: "180px",
                  background: "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666"
                }}>
                  Sin portada
                </div>
              )}
              <div style={{ padding: "10px", fontSize: "13px" }}>{item.title}</div>
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      <h2 style={{ color: "#ffcc00" }}>Historial completo ({history.length})</h2>
      {history.length === 0 ? (
        <p style={{ color: "#666" }}>Aún no has visto nada</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {history.map((item, i) => (
            <div
              key={i}
              style={{
                background: "#1a1a1a",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #333",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px"
              }}
            >
              <div>
                <strong>{item.title}</strong>
                <span style={{ color: "#888", marginLeft: "8px", fontSize: "13px" }}>
                  {item.type === "movie"
                    ? "Película"
                    : `Serie${item.episodeNumber ? ` • Ep ${item.episodeNumber}` : ""}`}
                </span>
              </div>
              <span style={{ color: "#666", fontSize: "13px" }}>
                {item.watchedAt?.toDate
                  ? item.watchedAt.toDate().toLocaleDateString("es-CO")
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Profile;