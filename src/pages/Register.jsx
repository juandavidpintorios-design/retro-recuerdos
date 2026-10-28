import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("+57 321 640 1956");

  useEffect(() => {
    const loadPhone = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "contact"));
        if (snap.exists() && snap.data().phone) setPhone(snap.data().phone);
      } catch (err) {
        console.error(err);
      }
    };
    loadPhone();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        email,
        displayName,
        status: "pending",
        role: "user",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      setSuccess(
        `Cuenta registrada.\nComunícate con el administrador al ${phone} para activarla.`
      );
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") setError("Este correo ya está registrado.");
      else if (err.code === "auth/weak-password")
        setError("La contraseña debe tener al menos 6 caracteres.");
      else setError("Error al registrarse. Intenta de nuevo.");
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "2px solid #ff6b00",
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: `
          radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.75) 100%),
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,120,0,0.03) 2px, rgba(255,120,0,0.03) 4px),
          radial-gradient(ellipse at center, #2a1030 0%, #0d0221 55%, #000 100%)
        `
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "linear-gradient(160deg, #2a2a2e, #0e0e10)",
          borderRadius: 28,
          padding: "18px 18px 24px",
          boxShadow: "0 0 0 4px #111, 0 0 0 8px #333, 0 25px 60px rgba(0,0,0,0.8)"
        }}
      >
        <div
          style={{
            background: "radial-gradient(ellipse at center, #1a0a28, #050208)",
            borderRadius: 16,
            padding: 24,
            border: "3px solid #ff6b00",
            boxShadow: "0 0 30px rgba(255,107,0,0.35)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)"
            }}
          />
          <h1
            style={{
              margin: "0 0 6px",
              textAlign: "center",
              fontSize: "1.8rem",
              fontWeight: 900,
              color: "#ff8c00",
              textShadow: "0 0 12px #ff6b00",
              letterSpacing: 2,
              position: "relative"
            }}
          >
            RETRO-RECUERDOS
          </h1>
          <p
            style={{
              textAlign: "center",
              color: "#ffcc00",
              margin: "0 0 18px",
              position: "relative"
            }}
          >
            Crear cuenta de héroe
          </p>
          <form onSubmit={handleRegister} style={{ position: "relative" }}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Nombre"
              style={inputStyle}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Correo electrónico"
              style={inputStyle}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Contraseña (mín. 6)"
              style={inputStyle}
            />
            {error && <p style={{ color: "#ff5555" }}>{error}</p>}
            {success && (
              <p
                style={{
                  color: "#55ff88",
                  whiteSpace: "pre-line",
                  background: "#1a2e1a",
                  padding: 12,
                  borderRadius: 8
                }}
              >
                {success}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: 14,
                border: "none",
                borderRadius: 12,
                background: "linear-gradient(180deg, #ff9f1a, #e65100)",
                color: "#fff",
                fontWeight: 900,
                fontSize: 15,
                cursor: "pointer",
                letterSpacing: 1
              }}
            >
              {loading ? "Creando..." : "REGISTRARSE"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;