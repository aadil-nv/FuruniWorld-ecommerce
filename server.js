// server.js
const colors = require("colors");
const app = require("./app");

const PORT = process.env.PORT || 7777;

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`.bgMagenta.bold);
});
