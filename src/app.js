import pg from "pg";
import express from "express";
import moment from "moment";

const { Pool } = pg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  password: "Pauli1989+",
  database: "bancosolar",
  port: 5432,
});

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());

// Ruta para enviar el HTML de la aplicación cliente
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

//AGREGAR USUARIO
app.post("/usuario", async (req, res) => {
  const { nombre, balance } = req.body;
  try {
    // Verificar si se recibieron los datos correctamente
    if (!nombre || !balance) {
      throw new Error("Se requieren nombre y balance para crear un usuario");
    }

    const result = await pool.query(
      "INSERT INTO usuarios (nombre, balance) VALUES ($1, $2) RETURNING *",
      [nombre, balance]
    );
    console.log("Usuario creado:", result.rows[0]);
    res.status(201).json(result.rows[0]); 
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error al crear usuario" }); 
  }
});

//OBTENER USUARIOS
app.get("/usuarios", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM usuarios");
    console.log("Usuarios obtenidos:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

//ACTUALIZAR USUARIO
app.put("/usuario/:id", async (req, res) => {
  const id = req.params.id;
  const { nombre, balance } = req.body;
  try {
    const result = await pool.query(
      "UPDATE usuarios SET nombre = $1, balance = $2 WHERE id = $3 RETURNING *",
      [nombre, balance, id]
    );
    if (result.rows.length === 0) {
      console.log("Usuario no encontrado");
      res.status(404).json({ error: "Usuario no encontrado" }); 
    } else {
      console.log("Usuario actualizado:", result.rows[0]);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

//ELIMINAR USUARIO
app.delete("/usuario/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      "DELETE FROM usuarios WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      console.log("Usuario no encontrado");
      res.status(404).json({ error: "Usuario no encontrado" });
    } else {
      console.log("Usuario eliminado correctamente");

      res.json({ message: "Usuario eliminado correctamente" });
    }
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

//REALIZAR TRANSFERENCIAS
app.post("/transferencia", async (req, res) => {
  const { emisor, receptor, monto } = req.body;
  try {
    // Buscar ID de emisor y receptor
    const emisorResult = await pool.query(
      "SELECT id, balance FROM usuarios WHERE nombre = $1",
      [emisor]
    );
    const receptorResult = await pool.query(
      "SELECT id FROM usuarios WHERE nombre = $1",
      [receptor]
    );

    // Verificar si se encontraron los usuarios
    if (emisorResult.rows.length === 0 || receptorResult.rows.length === 0) {
      throw new Error("Emisor o receptor no encontrado");
    }

    const emisorID = emisorResult.rows[0].id;
    const receptorID = receptorResult.rows[0].id;

    // Verificar saldo suficiente del emisor
    const emisorBalance = emisorResult.rows[0].balance;
    if (emisorBalance < monto) {
      throw new Error("Saldo insuficiente.");
    }

    const fechaHora = moment().format("YYYY-MM-DD HH:mm:ss");

    // Iniciar transacción
    await pool.query("BEGIN");

    // Actualizar saldos
    await pool.query(
      "UPDATE usuarios SET balance = balance - $1 WHERE id = $2",
      [monto, emisorID]
    );
    await pool.query(
      "UPDATE usuarios SET balance = balance + $1 WHERE id = $2",
      [monto, receptorID]
    );

    // Insertar en la tabla de transferencias
    const result = await pool.query(
      "INSERT INTO transferencias (emisor, receptor, monto, fecha) VALUES ($1, $2, $3, $4) RETURNING *",
      [emisorID, receptorID, monto, fechaHora]
    );

    // Confirmar transacción
    await pool.query("COMMIT");

    console.log("Transferencia realizada:", result.rows[0]);
    res.status(201).json(result.rows[0]); 

  } catch (error) {
    // Revertir transacción en caso de error
    await pool.query("ROLLBACK");
    console.error("Error al realizar la transferencia:", error.message);
    res.status(500).json({ error: error.message });
  }
});

//CONSULTAR TRANSFERENCIAS
app.get("/transferencias", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.fecha, u_emisor.nombre as emisor, u_receptor.nombre as receptor, t.monto
      FROM transferencias t
      INNER JOIN usuarios u_emisor ON t.emisor = u_emisor.id
      INNER JOIN usuarios u_receptor ON t.receptor = u_receptor.id
    `);
    console.log("Transferencias obtenidas:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener transferencias:", error);
    res.status(500).json({ error: "Error al obtener transferencias" });
  }
});

export { app, port };
