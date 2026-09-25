import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dwellwise — Find the place that fits your life", template: "%s · Dwellwise" },
  description:
    "Search homes for sale and rent on an open, free-first marketplace with map search, AI home matching, and collaborative home search.",
  applicationName: "Dwellwise",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1412" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before first paint so there is no light/dark flash. Resolves the stored
 * preference (system | light | dark) onto <html data-theme>, follows OS changes
 * while on "system", and exposes window.__dwApplyTheme for the toggle.
 */
const THEME_SCRIPT = `(function(){var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var t=null;try{t=localStorage.getItem('dw-theme')}catch(e){}t=t||d.dataset.themePref||'system';d.dataset.themePref=t;d.dataset.theme=t==='dark'||(t==='system'&&m.matches)?'dark':'light'}a();m.addEventListener('change',a);window.__dwApplyTheme=a})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
