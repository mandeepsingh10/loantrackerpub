import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App";
import "./index.css";
import { AppProvider } from "./providers/AppProvider";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class">
    <AppProvider>
      <App />
    </AppProvider>
  </ThemeProvider>
);
