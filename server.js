// API REST - Control de giro con sensor (EAI441)
// Hecha con Node.js + Express. Guarda el estado en memoria.

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());          // en producción: cors({ origin: "https://TU-USUARIO.github.io" })
app.use(express.json());

// Clave que debe enviar el Arduino en el header "x-api-key" (se define en Render como variable de entorno)
const DEVICE_KEY = process.env.DEVICE_KEY || "cambia-esta-clave";

const ACCIONES = ["izquierda", "derecha", "detener"];
const MODOS = ["auto", "manual"];

const estado = {
  distancia: 0,            // cm, la reporta el Arduino
  modo: "manual",          // "auto" | "manual"
  motor: "detenido",       // lo reporta el Arduino (texto libre: "detenido", "girando derecha"...)
  comando: "detener",      // última orden manual enviada desde la web
  ultimaLectura: null      // timestamp (ms) del último reporte del Arduino
};

// ---------- Rutas para la WEB ----------

// Estado actual (la web lo consulta cada ~1 s)
app.get("/api/estado", (req, res) => {
  const conectado = estado.ultimaLectura !== null && Date.now() - estado.ultimaLectura < 5000;
  res.json({
    distancia: estado.distancia,
    modo: estado.modo,
    motor: estado.motor,
    dispositivoConectado: conectado
  });
});

// Cambiar modo: { "modo": "auto" | "manual" }
app.post("/api/modo", (req, res) => {
  const { modo } = req.body || {};
  if (!MODOS.includes(modo)) {
    return res.status(400).json({ error: "modo inválido, usa 'auto' o 'manual'" });
  }
  estado.modo = modo;
  estado.comando = "detener"; // al cambiar de modo, el motor arranca detenido
  res.json({ ok: true, modo: estado.modo });
});

// Comando manual: { "accion": "izquierda" | "derecha" | "detener" }
app.post("/api/motor", (req, res) => {
  if (estado.modo !== "manual") {
    return res.status(409).json({ error: "El sistema está en modo automático" });
  }
  const { accion } = req.body || {};
  if (!ACCIONES.includes(accion)) {
    return res.status(400).json({ error: "acción inválida" });
  }
  estado.comando = accion;
  res.json({ ok: true, accion });
});

// ---------- Ruta para el ARDUINO ----------

// El Arduino envía { "distancia": 23.4, "motor": "girando derecha" }
// y recibe { "modo": "...", "comando": "..." }
app.post("/api/dispositivo", (req, res) => {
  if (req.get("x-api-key") !== DEVICE_KEY) {
    return res.status(401).json({ error: "no autorizado" });
  }
  const { distancia, motor } = req.body || {};
  if (typeof distancia === "number") estado.distancia = distancia;
  if (typeof motor === "string") estado.motor = motor;
  estado.ultimaLectura = Date.now();
  res.json({ modo: estado.modo, comando: estado.comando });
});

app.get("/", (req, res) => res.json({ servicio: "API control de giro con sensor", ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API escuchando en puerto " + PORT));
