import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "../styles/aero.css";

export const metadata: Metadata = {
  title: "Green Gavel OS",
  description: "Understand what your town council is deciding about trees, water, transit, and climate with AI-powered answers backed by public records.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Script id="wallpaper" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("gg-wallpaper")==="portraits")document.documentElement.dataset.wallpaper="portraits"}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
