import * as init from "./init/index.js";
import * as app from "./app/index.js";
import * as feature from "./feature/index.js";
import * as shared from "./shared/index.js";
import type { Tree } from "../types.js";

export const tree: Tree = {
  init: {
    leaf: true,
    description: "Bootstrap a new March Hare project",
    run: init.run,
  },
  app: {
    leaf: false,
    description: "Manage the host (pages, integration tests, actions)",
    children: {
      new: {
        leaf: true,
        description: "Create a new page under app/pages/",
        run: app.newPage,
      },
      integration: {
        leaf: true,
        description: "Add an integration test for an existing page",
        run: app.integration,
      },
      action: {
        leaf: true,
        description: "Add a new action handler to an existing page",
        run: app.action,
      },
    },
  },
  feature: {
    leaf: false,
    description: "Manage features (slices, unit tests, actions)",
    children: {
      new: {
        leaf: true,
        description: "Create a new feature slice",
        run: feature.newFeature,
      },
      unit: {
        leaf: true,
        description: "Add a unit test next to an existing feature",
        run: feature.unit,
      },
      action: {
        leaf: true,
        description: "Add a new action handler to an existing feature",
        run: feature.action,
      },
      multicast: {
        leaf: true,
        description: "Add a multicast action to an existing feature's Scope",
        run: feature.multicast,
      },
    },
  },
  shared: {
    leaf: false,
    description: "Manage shared building blocks",
    children: {
      component: {
        leaf: true,
        description: "Create a new shared component",
        run: shared.component,
      },
      resource: {
        leaf: true,
        description: "Create a new shared resource",
        run: shared.resource,
      },
      util: {
        leaf: true,
        description: "Create a new shared utility",
        run: shared.util,
      },
      type: {
        leaf: true,
        description: "Add a shared type/payload/broadcast namespace",
        run: shared.type,
      },
      unit: {
        leaf: true,
        description: "Add a unit test next to an existing shared module",
        run: shared.unit,
      },
    },
  },
};
