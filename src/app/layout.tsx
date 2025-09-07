import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Real Estate Importer",
  description: "Upload and extract property details from PDF documents using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
