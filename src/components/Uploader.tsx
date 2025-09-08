// src/components/Uploader.tsx
'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud } from "lucide-react";

export default function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please select a PDF document to import.");
      return;
    }
    setIsImporting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User is not authenticated. Please log in again.");

      const filePath = `${session.user.id}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("temp-uploads")
        .upload(filePath, file, { upsert: true }); // This line was incomplete
      if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from("temp-uploads")
        .getPublicUrl(filePath);

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-property`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pdfUrl: publicUrl, fileName: file.name }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "An unknown error occurred during import.");

      alert("Import Successful!");
      setFile(null);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UploadCloud size={24} /> AI Real Estate Importer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pdf-upload">Upload PDF Document</Label>
          <Input id="pdf-upload" type="file" accept=".pdf" onChange={handleFileChange} />
        </div>
        <Button onClick={handleImport} disabled={!file || isImporting} className="w-full">
          {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : "Import Listing"}
        </Button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
