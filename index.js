import { app, port } from "./src/app.js"

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor levantado en el puerto ${port}`);
});