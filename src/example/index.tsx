import * as ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/index.tsx";
import Cats from "./cats/index.tsx";
import StrictModeTest from "./strict-mode-test/index.tsx";
import Portal from "./portal/index.tsx";

const root = ReactDOM.createRoot(document.body);

root.render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/cats/*" element={<Cats />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/test/strict-mode" element={<StrictModeTest />} />
    </Routes>
  </BrowserRouter>,
);
