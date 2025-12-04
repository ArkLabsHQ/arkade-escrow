import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// biome-ignore lint/style/noNonNullAssertion: index page
createRoot(document.getElementById("root")!).render(<App />);
