import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        setError("No se encontró información del usuario.");
        setLoading(false);
        return;
      }
      const userData = userDoc.data();
      await updateDoc(doc(db, "users", user.uid), {
        lastLogin: serverTimestamp()
      });
      if (userData.status === "pending") {
        setError("Tu cuenta está pendiente de activación. Espera a que el administrador la active.");
        setLoading(false);
        return;
      }
      if (userData.status === "disabled") {
        setError("Tu cuenta ha sido desactivada. Contacta al administrador.");
        setLoading(false);
        return;
      }
      if (userData.status === "active") {
        onLoginSuccess({
          uid: user.uid,
          email: user.email,
          displayName: userData.displayName,
          role: userData.role,
          status: userData.status
        });
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Correo o contraseña incorrectos.");
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
      }
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("No existe una cuenta con ese correo.");
      } else if (err.code === "auth/invalid-email") {
        setError("El correo no es válido.");
      } else {
        setError("Error al enviar el correo. Intenta de nuevo.");
      }
    }
    setLoading(false);
  };

  // ========== ESTILOS ==========
  const styles = {
    page: {
      minHeight: "100vh",
      background: "radial-gradient(ellipse at center, #1a0a2e 0%, #0d0221 50%, #000000 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: "20px",
    },
    hero: {
      position: "absolute",
      maxWidth: "260px",
      opacity: 0.85,
      filter: "drop-shadow(0 0 18px rgba(255, 100, 0, 0.6))",
      zIndex: 1,
      pointerEvents: "none",
    },
    card: {
      background: "linear-gradient(145deg, #1e1e2f, #12121f)",
      border: "3px solid #ff6b00",
      borderRadius: "16px",
      padding: "40px 36px",
      width: "100%",
      maxWidth: "420px",
      zIndex: 10,
      boxShadow: "0 0 30px rgba(255, 107, 0, 0.4), 0 0 60px rgba(255, 50, 0, 0.2)",
      textAlign: "center",
      position: "relative",
    },
    logo: {
      fontSize: "2.3rem",
      fontWeight: 900,
      background: "linear-gradient(90deg, #ff6b00, #ffcc00, #ff6b00)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      margin: "0 0 6px 0",
      letterSpacing: "1px",
      textTransform: "uppercase",
    },
    slogan: {
      color: "#ffcc00",
      fontSize: "0.95rem",
      marginBottom: "22px",
      fontWeight: 600,
    },
    title: {
      color: "#ffffff",
      fontSize: "1.45rem",
      marginBottom: "26px",
      textShadow: "0 0 10px rgba(255, 107, 0, 0.5)",
    },
    inputGroup: {
      marginBottom: "16px",
      textAlign: "left",
    },
    label: {
      display: "block",
      color: "#ffaa55",
      fontSize: "0.9rem",
      marginBottom: "6px",
      fontWeight: 600,
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      border: "2px solid #ff6b00",
      borderRadius: "8px",
      background: "#0d0d1a",
      color: "white",
      fontSize: "1rem",
      outline: "none",
      boxSizing: "border-box",
    },
    button: {
      width: "100%",
      padding: "14px",
      marginTop: "10px",
      background: "linear-gradient(90deg, #ff6b00, #ff3300)",
      border: "none",
      borderRadius: "10px",
      color: "white",
      fontSize: "1.05rem",
      fontWeight: 800,
      cursor: "pointer",
      textTransform: "uppercase",
      letterSpacing: "1px",
      boxShadow: "0 4px 15px rgba(255, 80, 0, 0.5)",
    },
    linkBtn: {
      background: "none",
      border: "none",
      color: "#ffaa55",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "0.95rem",
    },
    error: {
      color: "#ff5555",
      margin: "10px 0",
      fontWeight: 600,
    },
    success: {
      color: "#55ff88",
      margin: "10px 0",
      fontWeight: 600,
    },
  };

  // ========== PANTALLA DE RESTABLECER CONTRASEÑA ==========
  if (showReset) {
    return (
      <div style={styles.page}>
        {/* Personajes */}
        <img src="/heroes/heman.png" alt="He-Man" style={{ ...styles.hero, top: "4%", right: "2%" }} />
        <img src="/heroes/thundercats.png" alt="Thundercats" style={{ ...styles.hero, bottom: "3%", left: "1%", maxWidth: "280px" }} />
        <img src="/heroes/silverhawks.png" alt="SilverHawks" style={{ ...styles.hero, top: "12%", left: "2%", maxWidth: "230px" }} />

        <div style={styles.card}>
          <h1 style={styles.logo}>retro-recuerdos</h1>
          <p style={styles.slogan}>¡Recupera el poder de tu cuenta!</p>
          <h2 style={styles.title}>Restablecer contraseña</h2>
          <p style={{ color: "#ccc", marginBottom: "20px", fontSize: "0.95rem" }}>
            Ingresa tu correo y te enviaremos un enlace para cambiar la contraseña.
          </p>

          <form onSubmit={handleResetPassword}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
                placeholder="tu@email.com"
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}
            {message && <p style={styles.success}>{message}</p>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>

          <p style={{ marginTop: "20px" }}>
            <button onClick={() => setShowReset(false)} style={styles.linkBtn}>
              ← Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ========== PANTALLA NORMAL DE LOGIN ==========
  return (
    <div style={styles.page}>
      {/* Personajes */}
      <img src="/heroes/heman.png" alt="He-Man" style={{ ...styles.hero, top: "4%", right: "2%" }} />
      <img src="/heroes/thundercats.png" alt="Thundercats" style={{ ...styles.hero, bottom: "3%", left: "1%", maxWidth: "280px" }} />
      <img src="/heroes/silverhawks.png" alt="SilverHawks" style={{ ...styles.hero, top: "12%", left: "2%", maxWidth: "230px" }} />
      <img src="/heroes/superman.png" alt="Superman" style={{ ...styles.hero, bottom: "8%", right: "3%", maxWidth: "210px" }} />

      <div style={styles.card}>
        <h1 style={styles.logo}>retro-recuerdos</h1>
        <p style={styles.slogan}>¡Recupera el poder de tus sábados por la mañana!</p>
        <h2 style={styles.title}>¡Bienvenido, Héroe!</h2>

        <form onSubmit={handleLogin}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="tu@email.com"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.success}>{message}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Entrando..." : "¡ENTRAR AL UNIVERSO RETRO!"}
          </button>
        </form>

        <p style={{ marginTop: "18px" }}>
          <button onClick={() => setShowReset(true)} style={styles.linkBtn}>
            ¿Olvidaste tu contraseña?
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;