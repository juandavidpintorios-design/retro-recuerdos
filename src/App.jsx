import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Mantener la sesión aunque se recargue la página
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
          console.error("Error al cargar usuario:", error);
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
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2>Cargando...</h2>
      </div>
    );
  }

  // Si el usuario ya inició sesión
  if (user) {
    if (user.role === "admin" && showAdmin) {
      return (
        <div>
          <div style={{ padding: "15px", backgroundColor: "#222", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Retro Recuerdos - Admin</h2>
            <div>
              <button 
                onClick={() => setShowAdmin(false)}
                style={{ marginRight: "10px", padding: "8px 16px", cursor: "pointer" }}
              >
                Volver
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

    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Bienvenido a Retro Recuerdos</h1>
        <p>Hola, <strong>{user.displayName}</strong></p>
        <p>Correo: {user.email}</p>
        <p>Rol: {user.role}</p>
        <p>Estado: {user.status}</p>

        {user.role === "admin" && (
          <div style={{ marginTop: "20px" }}>
            <p style={{ color: "green", fontWeight: "bold" }}>Eres administrador</p>
            <button
              onClick={() => setShowAdmin(true)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              Ir al Panel de Administración
            </button>
          </div>
        )}

        <br /><br />
        <button
          onClick={handleLogout}
          style={{
            padding: "10px 20px",
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
    );
  }

  // Si no ha iniciado sesión
  return (
    <div>
      {showRegister ? (
        <>
          <Register />
          <p style={{ textAlign: "center" }}>
            ¿Ya tienes cuenta?{" "}
            <button 
              onClick={() => setShowRegister(false)} 
              style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}
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
              style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}
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