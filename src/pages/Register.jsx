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
  const [phone, setPhone] = useState("+57 321 640 1956"); // valor por defecto

  // Cargar el número de teléfono desde Firestore
  useEffect(() => {
    const loadPhone = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "contact"));
        if (snap.exists() && snap.data().phone) {
          setPhone(snap.data().phone);
        }
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
        email: email,
        displayName: displayName,
        status: "pending",
        role: "user",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      setSuccess(
        `Tu cuenta ha sido registrada correctamente.\n\nComunícate con el administrador al número ${phone} para que active tu cuenta.`
      );
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Este correo ya está registrado.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError("Error al registrarse. Intenta de nuevo.");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      maxWidth: "420px",
      margin: "50px auto",
      padding: "28px",
      background: "linear-gradient(145deg, #1e1e2f, #12121f)",
      border: "2px solid #ff6b00",
      borderRadius: "16px",
      color: "#fff"
    }}>
      <h2 style={{ marginTop: 0, textAlign: "center", color: "#ffcc00" }}>Crear cuenta</h2>

      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#ffaa55" }}>Nombre</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "2px solid #ff6b00",
              background: "#0d0d1a",
              color: "white",
              boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#ffaa55" }}>Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "2px solid #ff6b00",
              background: "#0d0d1a",
              color: "white",
              boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#ffaa55" }}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "2px solid #ff6b00",
              background: "#0d0d1a",
              color: "white",
              boxSizing: "border-box"
            }}
          />
        </div>

        {error && <p style={{ color: "#ff5555", fontWeight: 600 }}>{error}</p>}
        {success && (
          <p style={{
            color: "#55ff88",
            fontWeight: 600,
            whiteSpace: "pre-line",
            background: "#1a2e1a",
            padding: "12px",
            borderRadius: "8px"
          }}>
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: "linear-gradient(90deg, #ff6b00, #ff3300)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: "1rem",
            marginTop: "8px"
          }}
        >
          {loading ? "Creando cuenta..." : "Registrarse"}
        </button>
      </form>
    </div>
  );
}

export default Register;