import * as ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/index.tsx";
import Cats from "./cats/index.tsx";
import StrictModeTest from "./strict-mode-test/index.tsx";
import Transactions from "./transactions/index.tsx";

const root = ReactDOM.createRoot(document.body);

root.render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/cats/*" element={<Cats />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/test/strict-mode" element={<StrictModeTest />} />
    </Routes>
  </BrowserRouter>,
);
