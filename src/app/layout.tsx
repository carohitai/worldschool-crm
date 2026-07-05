import type { Metadata } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";
import "./theme.css";

const serif = Playfair_Display({
  variable: "--font-serif-var",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const sans = Poppins({
  variable: "--font-sans-var",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The World School CRM",
  description: "Parent Connect CRM for The World School",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
