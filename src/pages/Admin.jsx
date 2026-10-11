import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "../firebase";

function Admin() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("+57 321 640 1956");
  const [newPhone, setNewPhone] = useState("");

  // Planes de suscripción
  const PLANS = {
    "1month": { label: "1 mes", days: 30 },
    "3months": { label: "3 meses", days: 90 },
    "6months": { label: "6 meses", days: 180 },
    "1year": { label: "1 año", days: 365 },
    "2years": { label: "2 años", days: 730 }
  };

  const loadUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const usersList = [];
    querySnapshot.forEach((d) => {
      usersList.push({ id: d.id, ...d.data() });
    });
    // Ordenar: primero los pendientes
    usersList.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return 0;
    });
    setUsers(usersList);
  };

  const loadPhone = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "contact"));
      if (snap.exists() && snap.data().phone) {
        setPhone(snap.data().phone);
        setNewPhone(snap.data().phone);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await loadUsers();
      await loadPhone();
      setLoading(false);
    };
    loadAll();
  }, []);

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3500);
  };

  // Activar usuario + asignar plan
  const activateWithPlan = async (userId, planKey) => {
    try {
      const plan = PLANS[planKey];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + plan.days);

      await updateDoc(doc(db, "users", userId), {
        status: "active",
        subscriptionPlan: planKey,
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        updatedAt: serverTimestamp()
      });

      showMessage(`Usuario activado con plan ${plan.label}`);
      loadUsers();
    } catch (error) {
      console.error(error);
      showMessage("Error al activar usuario");
    }
  };

  // Extender suscripción
  const extendSubscription = async (userId, planKey) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      let baseDate = new Date();
      // Si todavía tiene días, partimos desde la fecha actual de vencimiento
      if (userData.subscriptionExpiresAt?.toDate) {
        const currentExpire = userData.subscriptionExpiresAt.toDate();
        if (currentExpire > baseDate) {
          baseDate = currentExpire;
        }
      }

      const plan = PLANS[planKey];
      baseDate.setDate(baseDate.getDate() + plan.days);

      await updateDoc(userRef, {
        status: "active",
        subscriptionPlan: planKey,
        subscriptionExpiresAt: Timestamp.fromDate(baseDate),
        updatedAt: serverTimestamp()
      });

      showMessage(`Suscripción extendida (${plan.label})`);
      loadUsers();
    } catch (error) {
      console.error(error);
      showMessage("Error al extender suscripción");
    }
  };

  const changeStatus = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), { status: newStatus });
      showMessage(`Usuario ${newStatus === "active" ? "activado" : "desactivado"}`);
      loadUsers();
    } catch (error) {
      showMessage("Error al cambiar estado");
    }
  };

  const savePhone = async () => {
    try {
      await setDoc(doc(db, "settings", "contact"), {
        phone: newPhone.trim()
      }, { merge: true });
      setPhone(newPhone.trim());
      showMessage("Número de teléfono actualizado");
    } catch (error) {
      console.error(error);
      showMessage("Error al guardar el número");
    }
  };

  // Calcular días restantes
  const getDaysLeft = (user) => {
    if (!user.subscriptionExpiresAt?.toDate) return null;
    const expire = user.subscriptionExpiresAt.toDate();
    const now = new Date();
    const diff = Math.ceil((expire - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return "-";
    return timestamp.toDate().toLocaleDateString("es-CO");
  };

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "50px", color: "#fff" }}>Cargando...</p>;
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "30px auto", padding: "20px", color: "#eee" }}>
      <h1 style={{ marginTop: 0 }}>Panel de Administración</h1>

      {/* Tabs */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => setTab("users")}
          style={{
            padding: "10px 20px",
            backgroundColor: tab === "users" ? "#ff6b00" : "#444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Usuarios
        </button>
        <button
          onClick={() => setTab("settings")}
          style={{
            padding: "10px 20px",
            backgroundColor: tab === "settings" ? "#ff6b00" : "#444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Configuración
        </button>
      </div>

      {message && (
        <p style={{
          padding: "12px",
          backgroundColor: "#1b5e20",
          color: "#fff",
          borderRadius: "6px",
          marginBottom: "16px"
        }}>
          {message}
        </p>
      )}

      {/* ========== USUARIOS ========== */}
      {tab === "users" && (
        <div>
          <h2 style={{ marginBottom: "16px" }}>Usuarios ({users.length})</h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
              <thead>
                <tr style={{ backgroundColor: "#333" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>Nombre</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Correo</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Estado</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Plan / Vence</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const daysLeft = getDaysLeft(user);
                  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                  const isExpired = daysLeft !== null && daysLeft < 0;

                  return (
                    <tr key={user.id} style={{ borderBottom: "1px solid #444" }}>
                      <td style={{ padding: "12px" }}>{user.displayName || "-"}</td>
                      <td style={{ padding: "12px" }}>{user.email}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          backgroundColor:
                            user.status === "active" ? (isExpired ? "#e65100" : "#28a745") :
                            user.status === "pending" ? "#ffc107" : "#dc3545",
                          color: user.status === "pending" ? "#000" : "#fff",
                          fontSize: "13px",
                          fontWeight: 600
                        }}>
                          {user.status === "active" && isExpired ? "VENCIDO" : user.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px" }}>
                        {user.subscriptionPlan ? (
                          <>
                            <div>{PLANS[user.subscriptionPlan]?.label || user.subscriptionPlan}</div>
                            <div style={{ color: isExpiringSoon ? "#ff9800" : isExpired ? "#f44336" : "#aaa" }}>
                              {formatDate(user.subscriptionExpiresAt)}
                              {daysLeft !== null && (
                                <span> ({daysLeft >= 0 ? `${daysLeft} días` : "vencido"})</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: "#666" }}>Sin plan</span>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {/* Activar con plan */}
                          {(user.status === "pending" || user.status === "disabled") && (
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  activateWithPlan(user.id, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                              style={{
                                padding: "6px 8px",
                                background: "#28a745",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "13px"
                              }}
                            >
                              <option value="" disabled>Activar + Plan...</option>
                              {Object.entries(PLANS).map(([key, p]) => (
                                <option key={key} value={key}>{p.label}</option>
                              ))}
                            </select>
                          )}

                          {/* Extender suscripción */}
                          {user.status === "active" && (
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  extendSubscription(user.id, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                              style={{
                                padding: "6px 8px",
                                background: "#2196F3",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "13px"
                              }}
                            >
                              <option value="" disabled>Extender...</option>
                              {Object.entries(PLANS).map(([key, p]) => (
                                <option key={key} value={key}>{p.label}</option>
                              ))}
                            </select>
                          )}

                          {/* Desactivar */}
                          {user.status !== "disabled" && (
                            <button
                              onClick={() => changeStatus(user.id, "disabled")}
                              style={{
                                padding: "6px 10px",
                                backgroundColor: "#dc3545",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "13px"
                              }}
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== CONFIGURACIÓN ========== */}
      {tab === "settings" && (
        <div>
          <h2 style={{ marginBottom: "16px" }}>Configuración</h2>

          <div style={{
            background: "#1e1e1e",
            padding: "24px",
            borderRadius: "10px",
            maxWidth: "500px"
          }}>
            <h3 style={{ marginTop: 0, color: "#ffcc00" }}>Número de contacto (WhatsApp)</h3>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "12px" }}>
              Este número se muestra a los usuarios cuando se registran.
            </p>

            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+57 321 640 1956"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #555",
                background: "#333",
                color: "white",
                marginBottom: "12px",
                boxSizing: "border-box"
              }}
            />

            <button
              onClick={savePhone}
              style={{
                padding: "10px 20px",
                background: "#ff6b00",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              Guardar número
            </button>

            <p style={{ marginTop: "16px", color: "#888", fontSize: "13px" }}>
              Número actual: <strong style={{ color: "#fff" }}>{phone}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;