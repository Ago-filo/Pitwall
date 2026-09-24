import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { PitwallApiError } from "./api";
import "./styles.css";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60_000,
      retry: (count, error) =>
        count < 1 &&
        !(
          error instanceof PitwallApiError && [429, 503].includes(error.status)
        ),
      refetchOnWindowFocus: false,
    },
  },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
