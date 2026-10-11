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
  const [maintenance, setMaintenance] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(true);

  const [theme, setTheme] = useState(() => localStorage.getItem("retro_theme") || "villano");

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

  // Mantenimiento / versión
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "app"));
        if (!snap.exists()) {
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
    };

    checkUpdate();
    const interval = setInterval(checkUpdate, 20000);
    return () => clearInterval(interval);
  }, []);

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

  // Suscripción en tiempo real (sin recargar)
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
          role: data.role || prev.role,
          status: data.status,
          subscriptionPlan: data.subscriptionPlan || null,
          subscriptionExpiresAt: data.subscriptionExpiresAt || null
        };
      });
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

  if (maintenance && maintenance > new Date()) {
    const mins = Math.max(1, Math.ceil((maintenance - new Date()) / 60000));
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0d0221",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        textAlign: "center"
      }}>
        <h1 style={{ color: "#ff6b00", marginBottom: "12px" }}>
          Actualizando Retro Recuerdos
        </h1>
        <p style={{ color: "#ccc", fontSize: "18px", maxWidth: "400px" }}>
          Estamos aplicando una actualización. El acceso estará disponible en aproximadamente:
        </p>
        <p style={{ fontSize: "48px", fontWeight: 900, color: "#ffcc00", margin: "20px 0" }}>
          {mins} min
        </p>
        <p style={{ color: "#888" }}>Luego inicia sesión otra vez para continuar.</p>
      </div>
    );
  }

  if (loading || checkingUpdate) {
    return (
      <div style={{
        textAlign: "center",
        marginTop: "100px",
        color: "white",
        backgroundColor: "#111",
        minHeight: "100vh"
      }}>
        <h2>Cargando...</h2>
      </div>
    );
  }

  if (user) {
    if (user.role === "admin" && adminView) {
      return (
        <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white" }}>
          <div style={{
            padding: "12px 20px",
            backgroundColor: "#1a1a1a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <h2 style={{ margin: 0 }}>Retro Recuerdos - Admin</h2>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={() => setAdminView("users")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: adminView === "users" ? "#2196F3" : "#444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Usuarios
              </button>
              <button
                onClick={() => setAdminView("content")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: adminView === "content" ? "#4CAF50" : "#444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Películas / Series
              </button>
              <button onClick={() => setAdminView(null)} style={{ padding: "8px 16px", cursor: "pointer" }}>
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
          {adminView === "users" && <Admin />}
          {adminView === "content" && <ContentAdmin />}
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", backgroundColor: colors.bg, color: colors.text }}>
        {showSubWarning && (
          <div style={{
            background: daysLeft <= 2 ? "#c62828" : "#e65100",
            color: "#fff",
            padding: "10px 16px",
            textAlign: "center",
            fontSize: "14px",
            fontWeight: 600
          }}>
            {daysLeft === 0
              ? "⚠️ Tu suscripción vence hoy. Renueva para no perder el acceso."
              : `⚠️ Tu suscripción vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}. Contacta al administrador para renovar.`}
          </div>
        )}

        <div style={{
          padding: "12px 20px",
          backgroundColor: colors.header,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h2
            style={{ margin: 0, cursor: "pointer", color: colors.accent }}
            onClick={() => setPage("catalog")}
          >
            Retro Recuerdos
          </h2>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
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
                  backgroundColor: page === p.id ? colors.accent : isHeroe ? "#ddd" : "#333",
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

            {user.role === "admin" && (
              <>
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
              </>
            )}

            <span style={{ fontSize: "13px", color: colors.muted }}>
              Hola, {user.displayName}
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
        {page === "profile" && <Profile user={user} onUserUpdate={handleUserUpdate} />}
        {page === "requests" && <Requests user={user} />}
        {page === "about" && <About />}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white" }}>
      {showRegister ? (
        <>
          <Register />
          <p style={{ textAlign: "center" }}>
            ¿Ya tienes cuenta?{" "}
            <button
              onClick={() => setShowRegister(false)}
              style={{ background: "none", border: "none", color: "#64b5f6", cursor: "pointer" }}
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
              style={{ background: "none", border: "none", color: "#64b5f6", cursor: "pointer" }}
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