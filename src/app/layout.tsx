import type { Metadata , Viewport  } from "next";
import { Inter, Lora } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lora",
});

export const viewport: Viewport = {
  themeColor: "#faf8f5",
};

export const metadata: Metadata = {
  title: "Kindred",
  description: "Save the moment before it becomes a memory.",
  manifest: "/manifest.json",
  colorScheme: "light",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kindred",
  },
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${lora.variable} font-sans antialiased`}>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}