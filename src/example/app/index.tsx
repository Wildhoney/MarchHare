import * as React from "react";
import { Link } from "react-router-dom";
import Counter from "../counter/index.tsx";
import Mood from "../mood/index.tsx";
import Visitor from "../visitor/index.tsx";
import { Lifecycle, Reason } from "march-hare";
import { app } from "../app.ts";
import { message } from "antd";
import * as styles from "./styles.ts";
import logo from "../assets/logo.png";
import { features } from "./utils.ts";

export default function App(): React.ReactElement {
  const [messageApi, contextHolder] = message.useMessage();
  const context = app.useContext();
  const actions = context.useActions();

  actions.useAction(Lifecycle.Fault, (_context, { reason, error }) => {
    switch (reason) {
      case Reason.Aborted:
        messageApi.info(error.message);
        break;
      case Reason.Errored:
        messageApi.error(error.message);
        break;
    }
  });

  return (
    <div className={styles.layout}>
      <div className={styles.marketing}>
        <div className={styles.content}>
          <img src={logo} alt="March Hare" className={styles.logo} />

          <h1 className={styles.headline}>
            The <span>event-driven</span> React framework
          </h1>

          <p className={styles.tagline}>
            Strongly typed React framework using generators and efficiently
            updated views alongside the publish-subscribe pattern.
          </p>

          <div className={styles.cta}>
            <a
              href="https://github.com/Wildhoney/march-hare"
              className={`${styles.button} primary`}
            >
              View on GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/march-hare"
              className={`${styles.button} secondary`}
            >
              Documentation
            </a>
          </div>

          <div className={styles.cta}>
            <Link to="/cats" className={`${styles.button} secondary`}>
              Cats demo
            </Link>
            <Link to="/transactions" className={`${styles.button} secondary`}>
              Transactions demo
            </Link>
          </div>

          <div className={styles.install}>
            <span>$</span> npm install march-hare
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
        <div className={styles.demoHeader}>
          <Visitor />
          <div className={styles.demoLabel}>
            <span className={styles.liveDot} />
            Live Demo
          </div>
        </div>

        <div className={styles.demoCard}>
          <Counter />
        </div>

        <Mood />
      </div>

      {contextHolder}
    </div>
  );
}
