import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ContentAdmin from "./pages/ContentAdmin";
import Catalog from "./pages/Catalog";
import Profile from "./pages/Profile";
import About from "./pages/About";
import Requests from "./pages/Requests";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [adminView, setAdminView] = useState(null);
  const [page, setPage] = useState("catalog");
  const [maintenance, setMaintenance] = useState(null); // Date o null
  const [checkingUpdate, setCheckingUpdate] = useState(true);
  const [countdown, setCountdown] = useState({ m: 0, s: 0, total: 0, pct: 100 });
  const [theme, setTheme] = useState(
    () => localStorage.getItem("retro_theme") || "villano"
  );

  const isAdmin = user?.role === "admin";
  const isEditor = user?.role === "editor" || isAdmin;

  const toggleTheme = () => {
    const next = theme === "villano" ? "heroe" : "villano";
    setTheme(next);
    localStorage.setItem("retro_theme", next);
  };

  const isHeroe = theme === "heroe";
  const colors = {
    bg: isHeroe ? "#f5f0e8" : "#111",
    header: isHeroe ? "#e8e0d4" : "#1a1a1a",
    text: isHeroe ? "#1a1a1a" : "#fff",
    muted: isHeroe ? "#555" : "#aaa",
    border: isHeroe ? "#d0c8b8" : "#333",
    accent: "#ff6b00"
  };

  const getDaysLeft = () => {
    if (!user?.subscriptionExpiresAt) return null;
    const expire = user.subscriptionExpiresAt.toDate
      ? user.subscriptionExpiresAt.toDate()
      : new Date(user.subscriptionExpiresAt);
    return Math.ceil((expire - new Date()) / (1000 * 60 * 60 * 24));
  };

  const daysLeft = getDaysLeft();
  const showSubWarning = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  // Mantenimiento / versión (tiempo real)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "app"),
      async (snap) => {
        try {
          if (!snap.exists()) {
            setMaintenance(null);
            setCheckingUpdate(false);
            return;
          }
          const data = snap.data();
          const remoteVersion = data.version || "1";
          const localVersion = localStorage.getItem("app_version");

          if (data.maintenanceUntil?.toDate) {
            const until = data.maintenanceUntil.toDate();
            if (until > new Date()) {
              setMaintenance(until);
              if (auth.currentUser) {
                await signOut(auth);
                setUser(null);
              }
              setCheckingUpdate(false);
              return;
            }
          }

          setMaintenance(null);

          if (localVersion && localVersion !== remoteVersion) {
            if (auth.currentUser) {
              await signOut(auth);
              setUser(null);
            }
          }
          localStorage.setItem("app_version", remoteVersion);
        } catch (err) {
          console.error(err);
        }
        setCheckingUpdate(false);
      },
      (err) => {
        console.error(err);
        setCheckingUpdate(false);
      }
    );
    return () => unsub();
  }, []);

  // Cuenta regresiva cada segundo
  useEffect(() => {
    if (!maintenance) return;

    const TOTAL_MS = 4 * 60 * 1000; // referencia visual de 4 min

    const tick = () => {
      const left = Math.max(0, maintenance.getTime() - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      const pct = Math.min(100, Math.round((left / TOTAL_MS) * 100));
      setCountdown({ m, s, total: left, pct });

      if (left <= 0) {
        setMaintenance(null);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [maintenance]);

  // Auth inicial
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.status === "active") {
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: userData.displayName || "Usuario",
                role: userData.role || "user",
                status: userData.status,
                subscriptionPlan: userData.subscriptionPlan || null,
                subscriptionExpiresAt: userData.subscriptionExpiresAt || null
              });
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error(error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Suscripción + rol en tiempo real
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) {
        setUser(null);
        return;
      }
      const data = snap.data();
      if (data.status !== "active") {
        signOut(auth);
        setUser(null);
        return;
      }
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          displayName: data.displayName || prev.displayName,
          role: data.role || "user",
          status: data.status,
          subscriptionPlan: data.subscriptionPlan || null,
          subscriptionExpiresAt: data.subscriptionExpiresAt || null
        };
      });
      const role = data.role || "user";
      if (role !== "admin" && role !== "editor") {
        setAdminView(null);
      } else if (role === "editor") {
        setAdminView((v) => (v === "users" ? "content" : v));
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setPage("catalog");
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setAdminView(null);
    setPage("catalog");
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  // ========== PANTALLA DE ACTUALIZACIÓN ==========
  if (maintenance && countdown.total > 0) {
    const mm = String(countdown.m).padStart(2, "0");
    const ss = String(countdown.s).padStart(2, "0");

    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(ellipse at top, #2a1500 0%, #0d0d0d 55%, #000 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            background: "rgba(20,20,20,0.92)",
            border: "1px solid #ff6b00",
            borderRadius: 20,
            padding: "32px 24px",
            boxShadow: "0 0 40px rgba(255,107,0,0.25)"
          }}
        >
          {/* Cambia el nombre si tu archivo no es goku.gif */}
          <img
            src="/goku.gif"
            alt="Actualizando..."
            style={{
              width: "100%",
              maxWidth: 300,
              height: "auto",
              margin: "0 auto 16px",
              display: "block",
              borderRadius: 12,
              border: "2px solid #ff6b00",
              boxShadow: "0 0 24px rgba(255, 200, 0, 0.3)"
            }}
          />

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 22,
              fontWeight: 800,
              color: "#ff6b00"
            }}
          >
            ¡Poder al máximo!
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              color: "#bbb",
              fontSize: 14,
              lineHeight: 1.5
            }}
          >
            Retro Recuerdos se está transformando…
            <br />
            El acceso se reabre cuando el contador llegue a cero.
          </p>

          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: 4,
              marginBottom: 6,
              textShadow: "0 0 20px rgba(255,107,0,0.5)"
            }}
          >
            {mm}:{ss}
          </div>
          <p style={{ margin: "0 0 16px", color: "#888", fontSize: 13 }}>
            minutos restantes
          </p>

          <div
            style={{
              height: 10,
              background: "#333",
              borderRadius: 8,
              overflow: "hidden",
              marginBottom: 20
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${countdown.pct}%`,
                background: "linear-gradient(90deg, #e65100, #ff6b00, #ffb74d)",
                borderRadius: 8,
                transition: "width 1s linear"
              }}
            />
          </div>

          <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
            Luego inicia sesión otra vez para continuar.
          </p>
        </div>
      </div>
    );
  }

  if (loading || checkingUpdate) {
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "100px",
          color: "white",
          backgroundColor: "#111",
          minHeight: "100vh"
        }}
      >
        <h2>Cargando...</h2>
      </div>
    );
  }

  // ========== PANEL ADMIN / EDITOR ==========
  if (user && isEditor && adminView) {
    const view = isAdmin ? adminView : "content";
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white" }}>
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "#1a1a1a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px"
          }}
        >
          <h2 style={{ margin: 0 }}>
            Retro Recuerdos - {isAdmin ? "Admin" : "Editor"}
          </h2>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {isAdmin && (
              <button
                onClick={() => setAdminView("users")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: view === "users" ? "#2196F3" : "#444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Usuarios
              </button>
            )}
            <button
              onClick={() => setAdminView("content")}
              style={{
                padding: "8px 16px",
                backgroundColor: view === "content" ? "#4CAF50" : "#444",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Películas / Series
            </button>
            <button
              onClick={() => setAdminView(null)}
              style={{ padding: "8px 16px", cursor: "pointer" }}
            >
              Volver al catálogo
            </button>
            <button
              onClick={handleLogout}
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
        {isAdmin && view === "users" && <Admin />}
        {view === "content" && <ContentAdmin user={user} />}
      </div>
    );
  }

  // ========== USUARIO LOGUEADO ==========
  if (user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: colors.bg,
          color: colors.text
        }}
      >
        {showSubWarning && (
          <div
            style={{
              background: daysLeft <= 2 ? "#c62828" : "#e65100",
              color: "#fff",
              padding: "10px 16px",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 600
            }}
          >
            {daysLeft === 0
              ? "⚠️ Tu suscripción vence hoy. Renueva para no perder el acceso."
              : `⚠️ Tu suscripción vence en ${daysLeft} día${
                  daysLeft === 1 ? "" : "s"
                }. Contacta al administrador para renovar.`}
          </div>
        )}
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: colors.header,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            borderBottom: `1px solid ${colors.border}`
          }}
        >
          <h2
            style={{ margin: 0, cursor: "pointer", color: colors.accent }}
            onClick={() => setPage("catalog")}
          >
            Retro Recuerdos
          </h2>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            {[
              { id: "catalog", label: "Catálogo" },
              { id: "profile", label: "Mi Perfil" },
              { id: "requests", label: "Solicitar" },
              { id: "about", label: "Acerca de" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPage(p.id)}
                style={{
                  padding: "7px 14px",
                  backgroundColor:
                    page === p.id ? colors.accent : isHeroe ? "#ddd" : "#333",
                  color: page === p.id || !isHeroe ? "#fff" : "#222",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={toggleTheme}
              style={{
                padding: "7px 14px",
                backgroundColor: isHeroe ? "#333" : "#ffcc00",
                color: isHeroe ? "#fff" : "#111",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 700
              }}
            >
              {isHeroe ? "😈 Villano" : "🦸 Héroe"}
            </button>
            {isAdmin && (
              <button
                onClick={() => setAdminView("users")}
                style={{
                  padding: "7px 14px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                Usuarios
              </button>
            )}
            {isEditor && (
              <button
                onClick={() => setAdminView("content")}
                style={{
                  padding: "7px 14px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                Contenido
              </button>
            )}
            <span style={{ fontSize: "13px", color: colors.muted }}>
              Hola, {user.displayName}
              {user.role === "editor" && " (Editor)"}
              {user.role === "admin" && " (Admin)"}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "7px 14px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
        {page === "catalog" && <Catalog user={user} />}
        {page === "profile" && (
          <Profile user={user} onUserUpdate={handleUserUpdate} />
        )}
        {page === "requests" && <Requests user={user} />}
        {page === "about" && <About />}
      </div>
    );
  }

  // ========== NO LOGUEADO ==========
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white" }}>
      {showRegister ? (
        <>
          <Register />
          <p style={{ textAlign: "center" }}>
            ¿Ya tienes cuenta?{" "}
            <button
              onClick={() => setShowRegister(false)}
              style={{
                background: "none",
                border: "none",
                color: "#64b5f6",
                cursor: "pointer"
              }}
            >
              Inicia sesión
            </button>
          </p>
        </>
      ) : (
        <>
          <Login onLoginSuccess={handleLoginSuccess} />
          <p style={{ textAlign: "center" }}>
            ¿No tienes cuenta?{" "}
            <button
              onClick={() => setShowRegister(true)}
              style={{
                background: "none",
                border: "none",
                color: "#64b5f6",
                cursor: "pointer"
              }}
            >
              Regístrate
            </button>
          </p>
        </>
      )}
    </div>
  );
}

export default App;