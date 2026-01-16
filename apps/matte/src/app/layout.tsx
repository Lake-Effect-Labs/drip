import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

// NOTE: Using system fonts for now due to Google Fonts network restrictions in build env
// In production on Vercel, you can switch back to:
// import { DM_Sans } from "next/font/google";
// const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const dmSans = {
  variable: "--font-dm-sans",
  className: "",
};

export const metadata: Metadata = {
  title: "Matte - Painting Company OS",
  description: "The all-in-one operating system for residential repaint painting companies",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
