import logoColor from "../../assets/leterago-logo.webp";
import logoWhite from "../../assets/leterago-logo-white.webp";

/**
 * Brand logo that swaps with the theme: the blue version on light surfaces and
 * the white version on dark ones. Both images receive `className` so callers
 * size/position it exactly like a plain <img>. Visibility is toggled with the
 * `dark` variant (driven by the `.dark` class on <html>, see index.css).
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <>
      <img src={logoColor} alt="Logo Leterago" className={`${className} block dark:hidden`} />
      <img src={logoWhite} alt="Logo Leterago" className={`${className} hidden dark:block`} />
    </>
  );
}
