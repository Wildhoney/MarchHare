export const config = <const>{
  options: {
    help: { type: "boolean", short: "h" },
    name: { type: "string" },
    description: { type: "string" },
    apiBase: { type: "string" },
    heading: { type: "string" },
    tagline: { type: "string" },
    kind: { type: "string" },
    stateful: { type: "boolean" },
    presentational: { type: "boolean" },
  },
  banner: {
    title: "March Hare",
    tagline: "We're all mad here.",
    subtitle: "— scaffold tool for March Hare projects",
    font: <const>"Slant",
  },
  projectMarkers: <const>["package.json", "src/app"],
};
