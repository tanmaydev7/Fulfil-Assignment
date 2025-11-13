import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import axios from "axios";

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const API_BASE_URL = process.env.BACKEND_URL || "http://localhost:8000";

type UploadStep = "upload" | "processing" | "success" | "error";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductUploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const [step, setStep] = useState<UploadStep>("upload");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setUploadProgress(0);
      setSelectedFile(null);
      setUploadId(null);
      setTaskId(null);
      setError(null);
      setProcessingStatus("");
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [open]);

  // Poll task status after upload completes
  useEffect(() => {
    if (step === "processing" && taskId) {
      let pollCount = 0;
      const maxPolls = 300; // Max 10 minutes (300 * 2 seconds)
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
          setStep("error");
          setError("Processing took too long. Please check the server logs.");
          clearInterval(pollInterval);
          return;
        }
        
        try {
          const response = await axios.get(
            `${API_BASE_URL}/api/tasks/${taskId}/status/`
          );
          const taskData = response.data.message;

          if (taskData.state === "SUCCESS") {
            setStep("success");
            setProcessingStatus("Processing completed successfully!");
            clearInterval(pollInterval);
          } else if (taskData.state === "FAILURE") {
            setStep("error");
            const errorMsg = taskData.error || taskData.result?.error || "Processing failed";
            setError(errorMsg);
            clearInterval(pollInterval);
          } else {
            // PENDING, STARTED, etc.
            const statusMessages: Record<string, string> = {
              PENDING: "Waiting to start...",
              STARTED: "Processing in progress...",
              RETRY: "Retrying...",
            };
            setProcessingStatus(
              statusMessages[taskData.state] || `Processing... (${taskData.state})`
            );
          }
        } catch (err: any) {
          console.error("Error polling task status:", err);
          // Continue polling even if one request fails, but stop after many failures
          if (pollCount > 10) {
            setStep("error");
            setError("Unable to check task status. Please try again later.");
            clearInterval(pollInterval);
          }
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(pollInterval);
    }
  }, [step, taskId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const uploadFileInChunks = async (file: File) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let currentUploadId: string | null = null;

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const isLastChunk = chunkIndex === totalChunks - 1;

        const formData = new FormData();
        formData.append("file", chunk);
        if (currentUploadId) {
          formData.append("upload_id", currentUploadId);
        }
        formData.append("end", isLastChunk ? "1" : "0");

        const response = await axios.post(
          `${API_BASE_URL}/api/products/upload/`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            signal: abortControllerRef.current?.signal,
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const chunkProgress = (progressEvent.loaded / progressEvent.total) * 100;
                const overallProgress =
                  ((chunkIndex + chunkProgress / 100) / totalChunks) * 100;
                setUploadProgress(Math.min(overallProgress, 100));
              }
            },
          }
        );

        const data = response.data.message;

        // Store upload_id from first response
        if (data.upload_id && !currentUploadId) {
          currentUploadId = data.upload_id;
          setUploadId(currentUploadId);
        }

        // If this is the last chunk, we should get task_id
        if (isLastChunk && data.task_id) {
          setTaskId(data.task_id);
          setStep("processing");
          setUploadProgress(100);
          setProcessingStatus("File uploaded. Starting processing...");
        }
      }
    } catch (err: any) {
      if (axios.isCancel(err)) {
        setError("Upload cancelled");
      } else {
        const errorMessage =
          err.response?.data?.message || err.message || "Upload failed";
        setError(errorMessage);
        setStep("error");
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setStep("upload");
    setUploadProgress(0);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      await uploadFileInChunks(selectedFile);
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onOpenChange(false);
  };

  const handleReset = () => {
    setStep("upload");
    setUploadProgress(0);
    setSelectedFile(null);
    setUploadId(null);
    setTaskId(null);
    setError(null);
    setProcessingStatus("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={step !== "upload"}>
        <DialogHeader>
          <DialogTitle>Upload Product CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import products into the system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  step === "upload"
                    ? "bg-primary text-primary-foreground"
                    : step === "processing" || step === "success" || step === "error"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step === "upload" ? (
                  <Upload className="h-4 w-4" />
                ) : step === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : step === "error" ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <span className="text-sm font-medium">Upload CSV</span>
            </div>

            <div className="h-0.5 flex-1 bg-muted mx-2" />

            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  step === "processing"
                    ? "bg-primary text-primary-foreground"
                    : step === "success" || step === "error"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step === "processing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : step === "error" ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <span className="text-sm font-medium">Processing</span>
            </div>

            <div className="h-0.5 flex-1 bg-muted mx-2" />

            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  step === "success"
                    ? "bg-green-500 text-white"
                    : step === "error"
                    ? "bg-red-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : step === "error" ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <span className="text-sm font-medium">
                {step === "error" ? "Error" : "Complete"}
              </span>
            </div>
          </div>

          {/* Step 1: Upload CSV */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : "Click to select CSV file"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Only CSV files are supported
                  </div>
                </label>
              </div>

              {selectedFile && (
                <div className="text-sm text-muted-foreground">
                  File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadProgress > 0}
                className="w-full"
              >
                {uploadProgress > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Processing CSV */}
          {step === "processing" && (
            <div className="space-y-4 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div className="space-y-2">
                <div className="font-medium">Processing CSV file...</div>
                <div className="text-sm text-muted-foreground">
                  {processingStatus || "Please wait while we process your file"}
                </div>
              </div>
              {taskId && (
                <div className="text-xs text-muted-foreground">
                  Task ID: {taskId}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Success */}
          {step === "success" && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div className="space-y-2">
                <div className="font-medium text-lg">Upload Successful!</div>
                <div className="text-sm text-muted-foreground">
                  Your CSV file has been processed successfully. Products have been imported.
                </div>
              </div>
              <Button onClick={handleReset} className="w-full" variant="outline">
                Upload Another File
              </Button>
            </div>
          )}

          {/* Step 3: Error */}
          {step === "error" && (
            <div className="space-y-4 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <div className="space-y-2">
                <div className="font-medium text-lg">Upload Failed</div>
                <div className="text-sm text-muted-foreground">
                  {error || "An error occurred while processing your file"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleReset} className="flex-1" variant="outline">
                  Try Again
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

