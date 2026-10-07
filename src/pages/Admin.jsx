import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Cargar todos los usuarios
  const loadUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = [];
      querySnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersList);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Activar o desactivar usuario
  const changeStatus = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        status: newStatus
      });
      setMessage(`Usuario ${newStatus === "active" ? "activado" : "desactivado"} correctamente`);
      loadUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage("Error al cambiar el estado");
    }
  };

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "50px" }}>Cargando usuarios...</p>;
  }

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto", padding: "20px" }}>
      <h1>Panel de Administración - Usuarios</h1>
      <p>Gestiona las cuentas de los usuarios</p>

      {message && (
        <p style={{ 
          padding: "10px", 
          backgroundColor: "#d4edda", 
          color: "#155724", 
          borderRadius: "4px" 
        }}>
          {message}
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
        <thead>
          <tr style={{ backgroundColor: "#333", color: "white" }}>
            <th style={{ padding: "12px", textAlign: "left" }}>Nombre</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Correo</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Estado</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Rol</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "12px" }}>{user.displayName}</td>
              <td style={{ padding: "12px" }}>{user.email}</td>
              <td style={{ padding: "12px" }}>
                <span style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  backgroundColor: 
                    user.status === "active" ? "#28a745" : 
                    user.status === "pending" ? "#ffc107" : "#dc3545",
                  color: user.status === "pending" ? "#000" : "#fff",
                  fontSize: "13px"
                }}>
                  {user.status}
                </span>
              </td>
              <td style={{ padding: "12px" }}>{user.role}</td>
              <td style={{ padding: "12px" }}>
                {user.status !== "active" && (
                  <button
                    onClick={() => changeStatus(user.id, "active")}
                    style={{
                      marginRight: "8px",
                      padding: "6px 12px",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    Activar
                  </button>
                )}
                {user.status !== "disabled" && (
                  <button
                    onClick={() => changeStatus(user.id, "disabled")}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    Desactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Admin;