import { renderNavbar } from "./Navbar";
import { renderHero } from "./Hero";
import { renderChallenge } from "./Challenge";
import { renderSolution } from "./Solution";
import { renderLevels } from "./Levels";
import { renderFeatures } from "./Features";
import { renderBenefits } from "./Benefits";
import { renderPlatform } from "./Platform";
import { renderContact } from "./Contact";
import { renderFooter } from "./Footer";

export function renderApp(): string {
  return `
    <div class="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] z-0" aria-hidden="true"></div>

    ${renderNavbar()}

    <main id="top" class="relative z-10">
      ${renderHero()}
      ${renderChallenge()}
      ${renderSolution()}
      ${renderLevels()}
      ${renderFeatures()}
      ${renderBenefits()}
      ${renderPlatform()}
      ${renderContact()}
    </main>

    ${renderFooter()}
  `;
}
