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
    console.log("=== DEBUG: Import function started ===");
    
    if (!file) {
      setError("Please select a PDF document to import.");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      // Step 1: Get session
      console.log("🔐 Getting user session...");
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log("🔐 Session check:", {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        tokenLength: session?.access_token?.length
      });

      if (!session) {
        throw new Error("User is not authenticated. Please log in again.");
      }

      // Step 2: Upload file to storage
      console.log("📁 Uploading file to storage...");
      const filePath = `${session.user.id}/${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("temp-uploads")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("❌ File upload failed:", uploadError);
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      console.log("✅ File uploaded successfully");

      // Step 3: Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("temp-uploads")
        .getPublicUrl(filePath);

      console.log("📄 Public URL generated:", publicUrl);

      // Step 4: Call Edge Function with CORRECT URL
      const edgeFunctionUrl = "https://augcjvagyjbwhjncuash.supabase.co/functions/v1/import-property";
      
      console.log("🚀 About to call Edge Function");
      console.log("🚀 URL:", edgeFunctionUrl);
      console.log("🚀 Authorization header:", `Bearer ${session.access_token.substring(0, 20)}...`);
      console.log("🚀 Request body:", { pdfUrl: publicUrl, fileName: file.name });

      const res = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          pdfUrl: publicUrl, 
          fileName: file.name 
        }),
      });

      console.log("📡 Response received:", {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok
      });

      const responseText = await res.text();
      console.log("📡 Raw response:", responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log("📡 Parsed response:", result);
      } catch (parseError) {
        console.error("❌ Failed to parse response as JSON:", parseError);
        console.error("Raw response was:", responseText);
        throw new Error(`Invalid response from server: ${responseText}`);
      }

      if (!res.ok) {
        console.error("❌ Edge Function returned error:", result);
        throw new Error(result.error || `Server error: ${res.status} ${res.statusText}`);
      }

      console.log("✅ Import successful!");
      alert("Import Successful!");
      setFile(null);

    } catch (err: any) {
      console.error("💥 Import error:", err);
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud size={24} /> AI Real Estate Importer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pdf-upload">Upload PDF Document</Label>
          <Input 
            id="pdf-upload" 
            type="file" 
            accept=".pdf" 
            onChange={handleFileChange} 
          />
        </div>
        <Button 
          onClick={handleImport} 
          disabled={!file || isImporting} 
          className="w-full"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            "Import Listing"
          )}
        </Button>
        {error && (
          <div className="text-sm text-red-600 mt-2">
            <strong>File upload failed:</strong> {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
