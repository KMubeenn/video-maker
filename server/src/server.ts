// Load environment variables from .env file FIRST, before any other imports
import "dotenv/config";

import app from "./app.js";
import { initializeCleanup } from "./services/file-cleanup.service.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Initialize file cleanup system after server starts
  initializeCleanup();
});
