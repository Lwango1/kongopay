import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NotificationSetup from "@/components/NotificationSetup";

export const metadata: Metadata = {
  title: "KongoPay - Achetez et Vendez des Cryptos",
  description: "Plateforme crypto simple et sécurisée pour l'Afrique francophone",
};

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_ID || "ca-pub-7941414743853220";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="google-adsense-account" content="ca-pub-7941414743853220" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f0f1a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {AD_CLIENT && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <AuthProvider>
          {children}
          <NotificationSetup />
        </AuthProvider>
      </body>
    </html>
  );
}
