import { injectGlobal } from "@emotion/css";

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
