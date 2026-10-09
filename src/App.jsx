import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ContentAdmin from "./pages/ContentAdmin";
import Catalog from "./pages/Catalog";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [adminView, setAdminView] = useState(null); // null | "users" | "content"

  // Mantener la sesión al recargar la página
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Solo dejamos entrar si está activo
            if (userData.status === "active") {
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: userData.displayName || "Usuario",
                role: userData.role || "user",
                status: userData.status
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

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setAdminView(null);
  };

  if (loading) {
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

  // ========== USUARIO LOGUEADO ==========
  if (user) {
    // Panel de administración
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

          {adminView === "users" && <Admin />}
          {adminView === "content" && <ContentAdmin />}
        </div>
      );
    }

    // Catálogo normal
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#111", color: "white" }}>
        {/* Barra superior */}
        <div style={{
          padding: "12px 20px",
          backgroundColor: "#1a1a1a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px"
        }}>
          <h2 style={{ margin: 0 }}>Retro Recuerdos</h2>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px" }}>Hola, {user.displayName}</span>

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

        <Catalog user={user} />
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