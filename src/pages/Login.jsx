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
  const [showPass, setShowPass] = useState(false);

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
      await updateDoc(doc(db, "users", user.uid), { lastLogin: serverTimestamp() });
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
          status: userData.status,
          subscriptionPlan: userData.subscriptionPlan || null,
          subscriptionExpiresAt: userData.subscriptionExpiresAt || null
        });
      }
    } catch (err) {
      console.error(err);
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
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
      setMessage("Se ha enviado un correo para restablecer tu contraseña.");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found") setError("No existe una cuenta con ese correo.");
      else if (err.code === "auth/invalid-email") setError("El correo no es válido.");
      else setError("Error al enviar el correo. Intenta de nuevo.");
    }
    setLoading(false);
  };

  const page = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: `
      radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.75) 100%),
      repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,120,0,0.03) 2px, rgba(255,120,0,0.03) 4px),
      radial-gradient(ellipse at center, #2a1030 0%, #0d0221 55%, #000 100%)
    `,
    fontFamily: "system-ui, Segoe UI, sans-serif",
    position: "relative",
    overflow: "hidden"
  };

  const bezel = {
    width: "100%",
    maxWidth: 520,
    background: "linear-gradient(160deg, #2a2a2e 0%, #1a1a1c 40%, #0e0e10 100%)",
    borderRadius: 28,
    padding: "18px 18px 28px",
    boxShadow:
      "0 0 0 4px #111, 0 0 0 8px #333, 0 25px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
    position: "relative"
  };

  const screen = {
    background: "radial-gradient(ellipse at center, #1a0a28 0%, #0a0418 70%, #050208 100%)",
    borderRadius: 16,
    padding: "28px 22px 22px",
    border: "3px solid #ff6b00",
    boxShadow: "inset 0 0 40px rgba(255,100,0,0.15), 0 0 30px rgba(255,107,0,0.35)",
    position: "relative",
    overflow: "hidden"
  };

  const scan = {
    pointerEvents: "none",
    position: "absolute",
    inset: 0,
    background:
      "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)",
    zIndex: 2
  };

  const title = {
    margin: "0 0 6px",
    textAlign: "center",
    fontSize: "clamp(1.6rem, 6vw, 2.2rem)",
    fontWeight: 900,
    letterSpacing: 2,
    color: "#ff8c00",
    textShadow: "0 0 8px #ff6b00, 0 0 20px #ff6b00, 0 0 40px rgba(255,100,0,0.5)",
    textTransform: "uppercase",
    position: "relative",
    zIndex: 3
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
    boxSizing: "border-box"
  };

  const logos = [
    { src: "/heroes/thundercats-logo.png", alt: "Thundercats" },
    { src: "/heroes/heman-logo.png", alt: "He-Man" },
    { src: "/heroes/batman-logo.png", alt: "Batman" },
    { src: "/heroes/superman-logo.png", alt: "Superman" }
  ];

  const FormBox = ({ children }) => (
    <div
      style={{
        border: "2px solid #ff6b00",
        borderRadius: 14,
        padding: "18px 16px",
        background: "rgba(0,0,0,0.35)",
        position: "relative",
        zIndex: 3,
        boxShadow: "0 0 20px rgba(255,107,0,0.2)"
      }}
    >
      {children}
    </div>
  );

  const body = showReset ? (
    <FormBox>
      <p
        style={{
          margin: "0 0 14px",
          textAlign: "center",
          color: "#ffcc00",
          fontSize: 12,
          letterSpacing: 1,
          fontWeight: 700
        }}
      >
        RESTABLECER CONTRASEÑA
      </p>
      <form onSubmit={handleResetPassword}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Correo electrónico"
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        {error && <p style={{ color: "#ff5555", fontSize: 13 }}>{error}</p>}
        {message && <p style={{ color: "#55ff88", fontSize: 13 }}>{message}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            border: "none",
            borderRadius: 10,
            background: "linear-gradient(180deg, #ff8c00, #e65100)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer",
            letterSpacing: 1
          }}
        >
          {loading ? "Enviando..." : "ENVIAR ENLACE"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setShowReset(false);
          setError("");
          setMessage("");
        }}
        style={{
          marginTop: 14,
          background: "none",
          border: "none",
          color: "#ffaa55",
          cursor: "pointer",
          width: "100%",
          fontSize: 13
        }}
      >
        ← Volver al inicio de sesión
      </button>
    </FormBox>
  ) : (
    <FormBox>
      <p
        style={{
          margin: "0 0 14px",
          textAlign: "center",
          color: "#ffcc00",
          fontSize: 11,
          letterSpacing: 1.5,
          fontWeight: 700
        }}
      >
        INICIA SESIÓN PARA CONTINUAR
      </p>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Usuario / Correo"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 12, position: "relative" }}>
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Contraseña"
            style={{ ...inputStyle, paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "#ffaa55",
              cursor: "pointer",
              fontSize: 16
            }}
          >
            {showPass ? "🙈" : "👁"}
          </button>
        </div>
        {error && <p style={{ color: "#ff5555", fontSize: 13 }}>{error}</p>}
        {message && <p style={{ color: "#55ff88", fontSize: 13 }}>{message}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            border: "none",
            borderRadius: 12,
            background: "linear-gradient(180deg, #ff9f1a, #e65100)",
            color: "#fff",
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            letterSpacing: 2,
            boxShadow: "0 4px 20px rgba(255,100,0,0.45)",
            textTransform: "uppercase"
          }}
        >
          {loading ? "Entrando..." : "ENTRAR"}
        </button>
      </form>
      <p style={{ margin: "14px 0 0", textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setShowReset(true)}
          style={{
            background: "none",
            border: "none",
            color: "#ffaa55",
            cursor: "pointer",
            fontSize: 13
          }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </p>
    </FormBox>
  );

  return (
    <div style={page}>
      <div style={bezel}>
        <div style={screen}>
          <div style={scan} />
          <h1 style={title}>RETRO-RECUERDOS</h1>
          <p
            style={{
              textAlign: "center",
              color: "#ffcc00",
              margin: "0 0 18px",
              fontSize: 14,
              position: "relative",
              zIndex: 3,
              textShadow: "0 0 8px rgba(255,200,0,0.4)"
            }}
          >
            ¡Bienvenido, Héroe!
          </p>
          {body}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 16,
              marginTop: 22,
              flexWrap: "wrap",
              position: "relative",
              zIndex: 3
            }}
          >
            {logos.map((l) => (
              <img
                key={l.alt}
                src={l.src}
                alt={l.alt}
                style={{
                  height: 36,
                  maxWidth: 90,
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 6px rgba(255,140,0,0.5))"
                }}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 8px 0",
            color: "#666",
            fontSize: 10,
            letterSpacing: 1
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#c62828",
                marginRight: 6,
                boxShadow: "0 0 6px #f44336"
              }}
            />
            POWER
          </span>
          <span>VOLUME</span>
        </div>
      </div>
    </div>
  );
}

export default Login;