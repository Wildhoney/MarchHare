import * as ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/index.tsx";
import DecoratorTests from "./decorators/index.tsx";
import { Error, Reason } from "../library/index.ts";
import { message } from "antd";

/**
 * Wrapper for decorator tests that provides error handling.
 */
function DecoratorTestsWithErrorHandler() {
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <Error
      handler={({ reason, error, action }) => {
        switch (reason) {
          case Reason.Timeout:
            messageApi.warning(`${action}: ${error.message}`);
            break;
          case Reason.Aborted:
            messageApi.info(`${action}: ${error.message}`);
            break;
          case Reason.Error:
            messageApi.error(`${action}: ${error.message}`);
            break;
        }
      }}
    >
      <DecoratorTests />
      {contextHolder}
    </Error>
  );
}

const root = ReactDOM.createRoot(document.body);

root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/decorators" element={<DecoratorTestsWithErrorHandler />} />
    </Routes>
  </BrowserRouter>,
);
