"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, UploadCloud, CheckCircle, XCircle } from "lucide-react";

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}

function Notification({ message, type, onDismiss }: NotificationProps) {
  const bgColor = type === 'success' ? 'notification-success' : 'notification-error';
  const Icon = type === 'success' ? CheckCircle : XCircle;

  return (
    <div className={`notification ${bgColor}`}>
      <Icon className="notification-icon" />
      <div className="notification-content">
        <p>{message}</p>
      </div>
      <button 
        onClick={onDismiss} 
        className="notification-close"
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (selectedFile.type !== 'application/pdf') {
        setNotification({ 
          message: "Please select a PDF file.", 
          type: 'error' 
        });
        return;
      }
      
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
    
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("temp-uploads")
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from("temp-uploads")
        .getPublicUrl(fileName);
      
      const publicUrl = publicUrlData.publicUrl;

      const { data, error: functionError } = await supabase.functions.invoke('import-property', {
        body: { 
          pdfUrl: publicUrl, 
          fileName: fileName 
        },
      });

      if (functionError) {
        throw new Error(`Processing failed: ${functionError.message}`);
      }

      const propertyAddress = (data as { property?: { address?: string } })?.property?.address || 'Unknown address';
      setNotification({ 
        message: `Success! Property "${propertyAddress}" has been imported and processed.`, 
        type: 'success' 
      });

      setFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (error) {
      console.error("Import failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during import.";
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container">
      <div className="card-wrapper">
        <div className="card">
          <div className="card-header">
            <div className="icon-wrapper">
              <UploadCloud className="upload-icon" />
            </div>
            <h1 className="title">AI Real Estate Importer</h1>
            <p className="description">
              Upload a real estate PDF document to automatically extract property details 
              using AI-powered analysis.
            </p>
          </div>
          
          <div className="card-content">
            <div className="form-group">
              <label htmlFor="pdf-upload" className="label">
                Select PDF Document
              </label>
              <input 
                id="pdf-upload" 
                type="file" 
                accept=".pdf"
                onChange={handleFileChange}
                className="file-input"
              />
              <p className="help-text">
                Maximum file size: 10MB. Only PDF files are accepted.
              </p>
            </div>
            
            <button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="btn-primary"
            >
              {isImporting ? (
                <>
                  <Loader2 className="btn-icon animate-spin" />
                  Processing Document...
                </>
              ) : (
                <>
                  <UploadCloud className="btn-icon" />
                  Import Property Listing
                </>
              )}
            </button>
            
            {file && (
              <div className="file-info">
                <p>
                  <span className="file-label">Selected file:</span> {file.name}
                </p>
                <p className="file-size">
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
          </div>
        </div>
      </div>
    </div>
  );
}
