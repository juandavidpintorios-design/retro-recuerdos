import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

function Admin() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("+57 321 640 1956");
  const [newPhone, setNewPhone] = useState("");

  const PLANS = {
    trial30min: { label: "Prueba 30 min", minutes: 30 },
    "1month": { label: "1 mes", days: 30 },
    "3months": { label: "3 meses", days: 90 },
    "6months": { label: "6 meses", days: 180 },
    "1year": { label: "1 año", days: 365 },
    "2years": { label: "2 años", days: 730 }
  };

  // En línea = última actividad hace menos de 2 minutos
  const isOnline = (u) => {
    if (!u.lastActiveAt) return false;
    const last = u.lastActiveAt.toDate
      ? u.lastActiveAt.toDate()
      : new Date(u.lastActiveAt);
    return Date.now() - last.getTime() < 2 * 60 * 1000;
  };

  const loadRequests = async () => {
    const snap = await getDocs(collection(db, "requests"));
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setRequests(list);
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
    setLoading(true);

    // Usuarios en tiempo real (para ver quién está viendo)
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const usersList = [];
      snap.forEach((d) => usersList.push({ id: d.id, ...d.data() }));
      usersList.sort((a, b) => {
        const aOn = isOnline(a) ? 1 : 0;
        const bOn = isOnline(b) ? 1 : 0;
        if (bOn !== aOn) return bOn - aOn;
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return 0;
      });
      setUsers(usersList);
      setLoading(false);
    });

    loadRequests();
    loadPhone();

    // Refrescar “en línea” cada 30s (por el reloj de 2 min)
    const tick = setInterval(() => {
      setUsers((prev) => [...prev]);
    }, 30000);

    return () => {
      unsubUsers();
      clearInterval(tick);
    };
  }, []);

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3500);
  };

  const getExpirationDate = (planKey, fromDate = new Date()) => {
    const plan = PLANS[planKey];
    const date = new Date(fromDate);
    if (plan.minutes) date.setMinutes(date.getMinutes() + plan.minutes);
    else date.setDate(date.getDate() + plan.days);
    return date;
  };

  const activateWithPlan = async (userId, planKey) => {
    try {
      const expiresAt = getExpirationDate(planKey);
      await updateDoc(doc(db, "users", userId), {
        status: "active",
        subscriptionPlan: planKey,
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        updatedAt: serverTimestamp()
      });
      showMessage(`Usuario activado con plan ${PLANS[planKey].label}`);
    } catch (error) {
      console.error(error);
      showMessage("Error al activar usuario");
    }
  };

  const extendSubscription = async (userId, planKey) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      let baseDate = new Date();
      if (userData.subscriptionExpiresAt?.toDate) {
        const currentExpire = userData.subscriptionExpiresAt.toDate();
        if (currentExpire > baseDate) baseDate = currentExpire;
      }
      const expiresAt = getExpirationDate(planKey, baseDate);
      await updateDoc(userRef, {
        status: "active",
        subscriptionPlan: planKey,
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        updatedAt: serverTimestamp()
      });
      showMessage(`Suscripción extendida (${PLANS[planKey].label})`);
    } catch (error) {
      console.error(error);
      showMessage("Error al extender suscripción");
    }
  };

  const deactivateSubscription = async (userId) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        subscriptionPlan: null,
        subscriptionExpiresAt: Timestamp.fromDate(new Date(0)),
        updatedAt: serverTimestamp()
      });
      showMessage("Suscripción desactivada");
    } catch (error) {
      console.error(error);
      showMessage("Error al desactivar suscripción");
    }
  };

  const changeStatus = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), { status: newStatus });
      showMessage(`Usuario ${newStatus === "active" ? "activado" : "desactivado"}`);
    } catch (error) {
      showMessage("Error al cambiar estado");
    }
  };

  const savePhone = async () => {
    try {
      await setDoc(doc(db, "settings", "contact"), { phone: newPhone.trim() }, { merge: true });
      setPhone(newPhone.trim());
      showMessage("Número de teléfono actualizado");
    } catch (error) {
      console.error(error);
      showMessage("Error al guardar el número");
    }
  };

  const respondRequest = async (requestId, status, adminMessage = "") => {
    try {
      await updateDoc(doc(db, "requests", requestId), {
        status,
        adminMessage,
        updatedAt: serverTimestamp()
      });
      showMessage(
        status === "available"
          ? "Marcada como Disponible"
          : "Marcada como No se pudo agregar"
      );
      loadRequests();
    } catch (error) {
      console.error(error);
      showMessage("Error al actualizar solicitud");
    }
  };

  const activateUpdate = async () => {
    try {
      const until = new Date();
      until.setMinutes(until.getMinutes() + 4);
      await setDoc(
        doc(db, "settings", "app"),
        {
          version: Date.now().toString(),
          maintenanceUntil: Timestamp.fromDate(until)
        },
        { merge: true }
      );
      showMessage("Actualización activada. Bloqueo de 4 minutos iniciado.");
    } catch (err) {
      console.error(err);
      showMessage("Error al activar actualización");
    }
  };

  const getDaysLeft = (user) => {
    if (!user.subscriptionExpiresAt?.toDate) return null;
    const expire = user.subscriptionExpiresAt.toDate();
    const now = new Date();
    const diffMs = expire - now;
    if (diffMs <= 0) return -1;
    if (diffMs < 24 * 60 * 60 * 1000) return Math.ceil(diffMs / (1000 * 60));
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return "-";
    return timestamp.toDate().toLocaleString("es-CO");
  };

  const onlineUsers = users.filter(isOnline);
  const watchingUsers = onlineUsers.filter((u) => u.currentlyWatching);

  if (loading) {
    return (
      <p style={{ textAlign: "center", marginTop: "50px", color: "#fff" }}>
        Cargando...
      </p>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "30px auto", padding: "20px", color: "#eee" }}>
      <h1 style={{ marginTop: 0 }}>Panel de Administración</h1>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {["users", "requests", "settings"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px",
              backgroundColor: tab === t ? "#ff6b00" : "#444",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            {t === "users"
              ? "Usuarios"
              : t === "requests"
              ? `Solicitudes (${requests.filter((r) => r.status === "pending").length})`
              : "Configuración"}
          </button>
        ))}
      </div>

      {message && (
        <p
          style={{
            padding: "12px",
            backgroundColor: "#1b5e20",
            color: "#fff",
            borderRadius: "6px",
            marginBottom: "16px"
          }}
        >
          {message}
        </p>
      )}

      {/* ========== USUARIOS ========== */}
      {tab === "users" && (
        <div>
          <h2 style={{ marginBottom: "12px" }}>Usuarios ({users.length})</h2>

          {/* Resumen en línea / viendo */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "20px",
              padding: "14px 18px",
              background: "#1a1a1a",
              borderRadius: "10px",
              border: "1px solid #333"
            }}
          >
            <div>
              <span style={{ color: "#888", fontSize: "13px" }}>En línea</span>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#4CAF50" }}>
                ● {onlineUsers.length}
              </div>
            </div>
            <div>
              <span style={{ color: "#888", fontSize: "13px" }}>Viendo algo</span>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#ff9800" }}>
                ▶ {watchingUsers.length}
              </div>
            </div>
            <div>
              <span style={{ color: "#888", fontSize: "13px" }}>Desconectados</span>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#888" }}>
                ○ {users.length - onlineUsers.length}
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
              <thead>
                <tr style={{ backgroundColor: "#333" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>Nombre</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Correo</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Conexión</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Viendo ahora</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Estado</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Plan / Vence</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const timeLeft = getDaysLeft(user);
                  const isExpired = timeLeft !== null && timeLeft < 0;
                  const online = isOnline(user);

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: "1px solid #444",
                        background: online ? "rgba(76, 175, 80, 0.08)" : "transparent"
                      }}
                    >
                      <td style={{ padding: "12px" }}>{user.displayName || "-"}</td>
                      <td style={{ padding: "12px" }}>{user.email}</td>
                      <td style={{ padding: "12px" }}>
                        {online ? (
                          <span style={{ color: "#4CAF50", fontWeight: 600 }}>● En línea</span>
                        ) : (
                          <span style={{ color: "#888" }}>○ Desconectado</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#ffb74d", maxWidth: "220px" }}>
                        {online && user.currentlyWatching
                          ? user.currentlyWatching
                          : "—"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor:
                              user.status === "active"
                                ? isExpired
                                  ? "#e65100"
                                  : "#28a745"
                                : user.status === "pending"
                                ? "#ffc107"
                                : "#dc3545",
                            color: user.status === "pending" ? "#000" : "#fff",
                            fontSize: "13px",
                            fontWeight: 600
                          }}
                        >
                          {user.status === "active" && isExpired
                            ? "VENCIDO"
                            : user.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px" }}>
                        {user.subscriptionPlan ? (
                          <>
                            <div>
                              {PLANS[user.subscriptionPlan]?.label ||
                                user.subscriptionPlan}
                            </div>
                            <div style={{ color: isExpired ? "#f44336" : "#aaa" }}>
                              {formatDate(user.subscriptionExpiresAt)}
                              {timeLeft !== null && timeLeft >= 0 && (
                                <span>
                                  {" "}
                                  (
                                  {user.subscriptionPlan === "trial30min"
                                    ? `${timeLeft} min`
                                    : `${timeLeft} días`}
                                  )
                                </span>
                              )}
                              {isExpired && <span> (vencido)</span>}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: "#666" }}>Sin plan</span>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
                              <option value="" disabled>
                                Activar + Plan...
                              </option>
                              {Object.entries(PLANS).map(([key, p]) => (
                                <option key={key} value={key}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          )}
                          {user.status === "active" && (
                            <>
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
                                <option value="" disabled>
                                  Extender...
                                </option>
                                {Object.entries(PLANS).map(([key, p]) => (
                                  <option key={key} value={key}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => deactivateSubscription(user.id)}
                                style={{
                                  padding: "6px 10px",
                                  backgroundColor: "#e65100",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "13px"
                                }}
                              >
                                Desactivar suscripción
                              </button>
                            </>
                          )}
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
                              Desactivar cuenta
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

      {/* ========== SOLICITUDES ========== */}
      {tab === "requests" && (
        <div>
          <h2 style={{ marginBottom: "16px" }}>Solicitudes ({requests.length})</h2>
          {requests.length === 0 ? (
            <p style={{ color: "#888" }}>No hay solicitudes todavía</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    background: "#1e1e1e",
                    padding: "18px",
                    borderRadius: "10px",
                    border: "1px solid #333"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginBottom: "10px"
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "17px" }}>{req.title}</strong>
                      <div style={{ color: "#888", fontSize: "13px", marginTop: "4px" }}>
                        {req.type === "movie" ? "Película" : "Serie"}
                        {req.year ? ` • ${req.year}` : ""}
                        {" • "}Pedido por: {req.displayName || req.email}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background:
                          req.status === "available"
                            ? "#28a745"
                            : req.status === "unavailable"
                            ? "#dc3545"
                            : "#ffc107",
                        color: req.status === "pending" ? "#000" : "#fff"
                      }}
                    >
                      {req.status === "available"
                        ? "Disponible"
                        : req.status === "unavailable"
                        ? "No se pudo agregar"
                        : "En espera"}
                    </span>
                  </div>
                  {req.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "12px"
                      }}
                    >
                      <button
                        onClick={() =>
                          respondRequest(
                            req.id,
                            "available",
                            "Ya está disponible en el catálogo"
                          )
                        }
                        style={{
                          padding: "8px 16px",
                          background: "#28a745",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                      >
                        ✓ Disponible
                      </button>
                      <button
                        onClick={() => {
                          const msg = window.prompt(
                            "Mensaje para el usuario (opcional):",
                            "Por ahora no fue posible agregarla"
                          );
                          respondRequest(
                            req.id,
                            "unavailable",
                            msg || "No se pudo agregar"
                          );
                        }}
                        style={{
                          padding: "8px 16px",
                          background: "#dc3545",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                      >
                        ✗ No se pudo agregar
                      </button>
                    </div>
                  )}
                  {req.adminMessage && (
                    <p style={{ margin: "12px 0 0", color: "#aaa", fontSize: "14px" }}>
                      Mensaje: {req.adminMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== CONFIGURACIÓN ========== */}
      {tab === "settings" && (
        <div>
          <h2 style={{ marginBottom: "16px" }}>Configuración</h2>

          <div
            style={{
              background: "#1e1e1e",
              padding: "24px",
              borderRadius: "10px",
              maxWidth: "500px"
            }}
          >
            <h3 style={{ marginTop: 0, color: "#ffcc00" }}>
              Número de contacto (WhatsApp)
            </h3>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "12px" }}>
              Este número se muestra a los usuarios cuando se registran.
            </p>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
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

          <div
            style={{
              background: "#1e1e1e",
              padding: "24px",
              borderRadius: "10px",
              maxWidth: "500px",
              marginTop: "24px"
            }}
          >
            <h3 style={{ marginTop: 0, color: "#ffcc00" }}>
              Actualización de la página
            </h3>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "12px" }}>
              Al activarlo, todos los usuarios se desconectan y la página se bloquea
              durante 4 minutos. Después deben iniciar sesión otra vez.
            </p>
            <button
              onClick={activateUpdate}
              style={{
                padding: "12px 20px",
                background: "#e65100",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Activar actualización (bloqueo 4 min)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;