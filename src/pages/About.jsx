function About() {
  return (
    <div style={{
      maxWidth: "800px",
      margin: "0 auto",
      padding: "32px 20px",
      color: "#fff",
      lineHeight: 1.7
    }}>
      <h1 style={{
        marginTop: 0,
        color: "#ffcc00",
        fontSize: "2rem",
        textAlign: "center"
      }}>
        Acerca de Retro Recuerdos
      </h1>

      <div style={{
        background: "linear-gradient(145deg, #1e1e2f, #12121f)",
        border: "2px solid #ff6b00",
        borderRadius: "16px",
        padding: "28px",
        marginTop: "24px"
      }}>
        <p style={{ fontSize: "1.1rem", color: "#ddd" }}>
          <strong style={{ color: "#ff6b00" }}>Retro Recuerdos</strong> nació de una idea simple:
          recuperar esa emoción de los sábados por la mañana, cuando las caricaturas y series
          de los 70s, 80s y 90s llenaban la pantalla y la imaginación.
        </p>

        <p style={{ color: "#ccc" }}>
          He-Man, Thundercats, Superman, Batman y tantos héroes más no eran solo dibujos:
          eran parte de nuestra infancia. Esta plataforma existe para que esos recuerdos
          no se pierdan y puedan volver a verse, compartirse y disfrutarse.
        </p>

        <p style={{ color: "#ccc" }}>
          Aquí encontrarás películas y series clásicas, un catálogo pensado para nostálgicos
          y un espacio donde pedir el contenido que aún falta.
        </p>

        <p style={{ color: "#aaa", fontStyle: "italic", marginBottom: 0 }}>
          Porque algunos recuerdos no envejecen… solo esperan a ser reproducidos otra vez.
        </p>
      </div>

      <div style={{
        marginTop: "28px",
        textAlign: "center",
        color: "#888",
        fontSize: "0.95rem"
      }}>
        <p>¿Tienes una serie o película que te gustaría ver aquí?</p>
        <p>Usa la sección <strong style={{ color: "#ffaa55" }}>Solicitar contenido</strong> y cuéntanos.</p>
      </div>
    </div>
  );
}

export default About;