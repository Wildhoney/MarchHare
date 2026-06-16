import figlet from "figlet";
import kleur from "kleur";
import { config } from "../utils.js";

export function banner(): void {
  const art = figlet.textSync(config.banner.title, {
    font: config.banner.font,
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  console.log(kleur.magenta(art));
  console.log(
    kleur.gray(`  ${config.banner.tagline}  `) +
      kleur.dim(config.banner.subtitle),
  );
  console.log();
}
