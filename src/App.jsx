import { useState } from "react";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ContentAdmin from "./pages/ContentAdmin";
import Catalog from "./pages/Catalog";

function App() {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [adminView, setAdminView] = useState(null); // null | "users" | "content"

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    setAdminView(null);
  };

  // ========== SI EL USUARIO YA INICIÓ SESIÓN ==========
  if (user) {

    // --- PANEL DE ADMINISTRACIÓN ---
    if (user.role === "admin" && adminView) {
      return (
        <div>
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: "#1a1a1a", 
            color: "white", 
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
                  backgroundColor: adminView === "content" ? "#2196F3" : "#444",
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

    // --- CATÁLOGO (para todos los usuarios activos) ---
    return (
      <div>
        {/* Barra superior */}
        <div style={{ 
          padding: "12px 20px", 
          backgroundColor: "#111", 
          color: "white", 
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

        {/* Catálogo */}
        <Catalog user={user} />
      </div>
    );
  }

  // ========== LOGIN / REGISTRO ==========
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