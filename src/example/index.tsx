import * as ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { injectGlobal } from "@emotion/css";
import App from "./app/index.tsx";
import DecoratorTests from "./decorators/index.tsx";
import { Error, Reason } from "../library/index.ts";
import { message } from "antd";

injectGlobal`
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    width: 100%;
    min-height: 100%;
  }

  html::before {
    content: "";
    position: fixed;
    inset: -50vh -50vw;
    width: 200vw;
    height: 200vh;
    background: linear-gradient(to right, #0a0a0f 50%, #fafafa 50%);
    z-index: -1;
  }

  @media (max-width: 900px) {
    html::before {
      background: linear-gradient(to bottom, #fafafa 50%, #0a0a0f 50%);
    }
  }

  body > div {
    width: 100%;
  }
`;

/**
 * Wrapper for decorator tests that provides error handling.
 */
function DecoratorTestsWithErrorHandler() {
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <Error
      handler={({ reason, error, action }) => {
        switch (reason) {
          case Reason.Timedout:
            messageApi.warning(`${action}: ${error.message}`);
            break;
          case Reason.Supplanted:
            messageApi.info(`${action}: ${error.message}`);
            break;
          case Reason.Errored:
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
