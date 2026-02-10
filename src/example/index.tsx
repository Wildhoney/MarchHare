import * as ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/index.tsx";
import StrictModeTest from "./strict-mode-test/index.tsx";

const root = ReactDOM.createRoot(document.body);

root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/test/strict-mode" element={<StrictModeTest />} />
    </Routes>
  </BrowserRouter>,
);
