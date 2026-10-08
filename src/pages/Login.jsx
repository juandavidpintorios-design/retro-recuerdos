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

  // Enviar correo para restablecer contraseña
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

  // Pantalla de "Olvidé mi contraseña"
  if (showReset) {
    return (
      <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
        <h2>Restablecer contraseña</h2>
        <p>Ingresa tu correo y te enviaremos un enlace para cambiar la contraseña.</p>
        
        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom: "15px" }}>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            />
          </div>

          {error && <p style={{ color: "red" }}>{error}</p>}
          {message && <p style={{ color: "green" }}>{message}</p>}

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: "100%", padding: "10px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "15px" }}>
          <button 
            onClick={() => setShowReset(false)} 
            style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}
          >
            Volver al inicio de sesión
          </button>
        </p>
      </div>
    );
  }

  // Pantalla normal de Login
  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Iniciar sesión</h2>
      
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: "15px" }}>
          <label>Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {message && <p style={{ color: "green" }}>{message}</p>}

        <button 
          type="submit" 
          disabled={loading}
          style={{ width: "100%", padding: "10px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "15px" }}>
        <button 
          onClick={() => setShowReset(true)} 
          style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </p>
    </div>
  );
}

export default Login;