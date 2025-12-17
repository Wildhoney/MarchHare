import * as React from "react";
import Counter from "../counter/index.tsx";
import { Error, Reason } from "../../library/index.ts";
import { message } from "antd";
import * as styles from "./styles.ts";
import logo from "../assets/logo.png";
import { features } from "./utils.ts";

export default function App(): React.ReactElement {
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <div className={styles.layout}>
      <div className={styles.marketing}>
        <div className={styles.content}>
          <img src={logo} alt="Chizu" className={styles.logo} />

          <h1 className={styles.headline}>
            The <span>event-driven</span> React framework
          </h1>

          <p className={styles.tagline}>
            Strongly typed React framework using generators and efficiently
            updated views alongside the publish-subscribe pattern.
          </p>

          <div className={styles.cta}>
            <a
              href="https://github.com/Wildhoney/Chizu"
              className={`${styles.button} primary`}
            >
              View on GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/chizu"
              className={`${styles.button} secondary`}
            >
              Documentation
            </a>
          </div>

          <div className={styles.install}>
            <span>$</span> npm install chizu
          </div>

          <div className={styles.features}>
            {features.map((f, i) => (
              <div key={i} className={styles.feature}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <div className={styles.featureTitle}>{f.title}</div>
                <div className={styles.featureDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.demo}>
        <div className={styles.demoLabel}>
          <span className={styles.liveDot} />
          Live Demo
        </div>

        <div className={styles.demoCard}>
          <Error
            handler={({ reason, error }) => {
              switch (reason) {
                case Reason.Timeout:
                  messageApi.warning(error.message);
                  break;
                case Reason.Aborted:
                  messageApi.info(error.message);
                  break;
                case Reason.Error:
                  messageApi.error(error.message);
                  break;
              }
            }}
          >
            <Counter />
          </Error>
        </div>
      </div>

      {contextHolder}
    </div>
  );
}
