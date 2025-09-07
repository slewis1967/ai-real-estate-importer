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
      <body className="bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
