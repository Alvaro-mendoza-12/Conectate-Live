import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./providers/AuthProvider.jsx";
import { MeetingDataProvider } from "./providers/MeetingDataProvider.jsx";
import { RealtimeProvider } from "./providers/RealtimeProvider.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <MeetingDataProvider>
        <RealtimeProvider>
          <App />
        </RealtimeProvider>
      </MeetingDataProvider>
    </AuthProvider>
  </React.StrictMode>
);
