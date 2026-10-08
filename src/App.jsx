import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Catalog from "./pages/Catalog";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: userData.displayName,
              role: userData.role,
              status: userData.status
            });
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
    setShowAdmin(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px", color: "white", backgroundColor: "#111", minHeight: "100vh" }}>
        <h2>Cargando...</h2>
      </div>
    );
  }

  // Usuario logueado
  if (user) {
    // Si es admin y quiere ver el panel
    if (user.role === "admin" && showAdmin) {
      return (
        <div>
          <div style={{
            padding: "15px 30px",
            backgroundColor: "#1a1a1a",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <h2 style={{ margin: 0 }}>Panel de Administración</h2>
            <div>
              <button
                onClick={() => setShowAdmin(false)}
                style={{ marginRight: "10px", padding: "8px 16px", cursor: "pointer" }}
              >
                Volver al catálogo
              </button>
              <button
                onClick={handleLogout}
                style={{ padding: "8px 16px", backgroundColor: "#f44336", color: "white", border: "none", cursor: "pointer" }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
          <Admin />
        </div>
      );
    }

    // Catálogo para todos los usuarios activos
    return (
      <Catalog
        user={user}
        onLogout={handleLogout}
        onGoAdmin={() => setShowAdmin(true)}
      />
    );
  }

  // No logueado → Login / Registro
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