import "./globals.css";
import BottomNav from "./components/BottomNav";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: "Controle Financeiro Familiar",
  description: "Web/App para controle financeiro familiar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#16a34a" />
      </head>
      <body className={`pb-28 ${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
