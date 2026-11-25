import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./demo.css";
import { boot } from "./boot";
import { App } from "./App";

boot();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
