import { createRoot } from "react-dom/client";
import { setTokenProvider } from "@workspace/api-client-react";
import { authClient } from "./lib/auth";
import App from "./App";
import "./index.css";

setTokenProvider(async () => {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
});

createRoot(document.getElementById("root")!).render(<App />);
