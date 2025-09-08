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
      // 1. Get the current user's session to obtain the access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User is not authenticated. Please log in again.");

      const filePath = `${session.user.id}/${file.name}`;

      // 2. Upload the file to Supabase storage
      const { error: uploadError
