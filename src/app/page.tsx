"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud, CheckCircle, XCircle } from "lucide-react";

// Notification component for user feedback
function Notification({ 
  message, 
  type, 
  onDismiss 
}: { 
  message: string; 
  type: 'success' | 'error'; 
  onDismiss: () => void 
}) {
  const bgColor = type === 'success' ? 'bg-green-50' : 'bg-red-50';
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800';
  const borderColor = type === 'success' ? 'border-green-200' : 'border-red-200';
  const Icon = type === 'success' ? CheckCircle : XCircle;

  return (
    <div className={`p-4 mt-4 rounded-md border ${bgColor} ${textColor} ${borderColor} flex items-start gap-3`}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button 
        onClick={onDismiss} 
        className="text-current hover:text-opacity-75 text-lg font-bold"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{ 
    message: string; 
    type: 'success' | 'error' 
  } | null>(null);

  const supabase = createClientComponentClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      if (selectedFile.type !== 'application/pdf') {
        setNotification({ 
          message: "Please select a PDF file.", 
          type: 'error' 
        });
        return;
      }
      
      // Validate file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setNotification({ 
          message: "File size must be less than 10MB.", 
          type: 'error' 
        });
        return;
      }

      setFile(selectedFile);
      setNotification(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setNotification({ 
        message: "Please select a PDF document to import.", 
        type: 'error' 
      });
      return;
    }

    setIsImporting(true);
    setNotification(null);
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;

    try {
      // 1. Upload PDF to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("temp-uploads")
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 2. Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from("temp-uploads")
        .getPublicUrl(fileName);
      
      const publicUrl = publicUrlData.publicUrl;

      // 3. Call Supabase Edge Function to process PDF
      const { data, error: functionError } = await supabase.functions.invoke('import-property', {
        body: { 
          pdfUrl: publicUrl, 
          fileName: fileName 
        },
      });

      if (functionError) {
        throw new Error(`Processing failed: ${functionError.message}`);
      }

      // 4. Success - show results
      const propertyAddress = data?.property?.address || 'Unknown address';
      setNotification({ 
        message: `Success! Property "${propertyAddress}" has been imported and processed.`, 
        type: 'success' 
      });

      // Clear file input after successful import
      setFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (err: unknown) {
      console.error("Import failed:", err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during import.";
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
              <UploadCloud className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              AI Real Estate Importer
            </CardTitle>
            <CardDescription className="text-gray-600 max-w-md mx-auto">
              Upload a real estate PDF document to automatically extract property details 
              using AI-powered analysis.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pdf-upload" className="text-sm font-medium text-gray-700">
                Select PDF Document
              </Label>
              <Input 
                id="pdf-upload" 
                type="file" 
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer file:cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500">
                Maximum file size: 10MB. Only PDF files are accepted.
              </p>
            </div>
            
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing Document...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-5 w-5" />
                  Import Property Listing
                </>
              )}
            </Button>
            
            {file && (
              <div className="p-3 bg-gray-50 rounded-md border">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Selected file:</span> {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
            
            {notification && (
              <Notification 
                message={notification.message} 
                type={notification.type} 
                onDismiss={() => setNotification(null)} 
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
