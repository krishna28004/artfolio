"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, X, Check, ArrowRight } from "lucide-react";
import {
  commissionSchema,
  CommissionFormData,
} from "@/features/commission/schema/commission-schema";
import { uploadImageToCloudinarySigned } from "@/shared/services/cloudinary";

interface CommissionFormProps {
  initialReference?: string;
}

const SCALE_OPTIONS = [
  { id: "small", label: "Small (< 24\")", subtitle: "Desk & Cabinet" },
  { id: "medium", label: "Medium (24\" – 48\")", subtitle: "Salon & Study" },
  { id: "large", label: "Large (> 48\")", subtitle: "Gallery Scale" },
  { id: "undecided", label: "Undecided", subtitle: "Bespoke Size" },
];

const BUDGET_OPTIONS = [
  { id: "tier-1", label: "₹2,000 – ₹5,000", subtitle: "Study" },
  { id: "tier-2", label: "₹5,000 – ₹10,000", subtitle: "Archival Canvas" },
  { id: "tier-3", label: "₹10,000+", subtitle: "Major Piece" },
  { id: "undisclosed", label: "Undisclosed", subtitle: "Custom Scope" },
];

export function CommissionForm({ initialReference = "" }: CommissionFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [fileMeta, setFileMeta] = useState<{ name: string; size: string } | null>(null);
  const [serverError, setServerError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedScale, setSelectedScale] = useState("Medium (24\" – 48\")");
  const [selectedBudget, setSelectedBudget] = useState("₹5,000 – ₹10,000");
  const [messageLength, setMessageLength] = useState(
    initialReference ? `Inquiry regarding artwork: ${initialReference}\n\n`.length : 0
  );

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CommissionFormData>({
    resolver: zodResolver(commissionSchema),
    defaultValues: {
      idempotencyKey: "",
      name: "",
      email: "",
      imageUrl: "",
      publicId: "",
      size: "Medium (24\" – 48\")",
      budget: "₹5,000 – ₹10,000",
      deadline: "",
      message: initialReference ? `Inquiry regarding artwork: ${initialReference}\n\n` : "",
    },
  });

  // Bind unique session idempotency key
  useEffect(() => {
    const currentIdem = getValues("idempotencyKey");
    if (!currentIdem) {
      setValue("idempotencyKey", crypto.randomUUID());
    }
  }, [setValue, getValues]);

  const processUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setServerError("Please upload a valid image file (JPG, PNG, WebP).");
        setUploadState("error");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setServerError("Image exceeds 10MB limit. Please compress and try again.");
        setUploadState("error");
        return;
      }

      setUploadState("uploading");
      setServerError("");

      try {
        const result = await uploadImageToCloudinarySigned(file);
        if (result && result.url) {
          setValue("imageUrl", result.url, { shouldValidate: true });
          setValue("publicId", result.publicId);
          setFileMeta({
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
          });
          setUploadState("done");
        } else {
          setUploadState("error");
          setServerError("Failed to upload reference image. Please retry.");
        }
      } catch {
        setUploadState("error");
        setServerError("Failed to upload reference image.");
      }
    },
    [setValue]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
  };

  const handleRemoveAttachment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue("imageUrl", "");
    setValue("publicId", "");
    setFileMeta(null);
    setUploadState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (data: CommissionFormData) => {
    setServerError("");
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch("/api/commission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.message || "Failed to submit commission request.");
        }

        setIsSubmitted(true);
        return;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        attempt++;
        if (attempt >= maxRetries) {
          if (err instanceof Error && err.name === "AbortError") {
            setServerError("The network took too long to respond. Please verify your connection.");
          } else {
            setServerError(err instanceof Error ? err.message : "An unexpected error occurred.");
          }
        } else {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
  };

  // Minimal Clean Success View
  if (isSubmitted) {
    return (
      <div className="py-20 sm:py-28 text-center max-w-md mx-auto animate-reveal">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-primary/40 text-primary mb-6 bg-primary/[0.05]">
          <Check className="w-5 h-5" />
        </div>
        <p className="font-sans text-[11px] tracking-[0.24em] uppercase text-primary mb-2">
          Request Received
        </p>
        <h2 className="font-serif text-[28px] sm:text-[34px] text-text mb-4 tracking-tight font-normal">
          Thank You
        </h2>
        <p className="font-sans text-[14px] sm:text-[15px] text-muted leading-relaxed font-light mb-8">
          Your commission request has been received and will be reviewed personally by the artist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-8 py-3.5 border border-white/20 text-[11px] uppercase tracking-[0.2em] text-text hover:border-primary hover:text-primary transition-colors font-sans"
        >
          Return to Gallery
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`flex flex-col gap-10 sm:gap-12 w-full transition-opacity duration-300 ${
        isSubmitting ? "opacity-50 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* 1. Patron Details: Name + Email (2 cols desktop, 1 col mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className="flex flex-col">
          <label htmlFor="patron-name" className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2 font-sans">
            Your Name <span className="text-primary">*</span>
          </label>
          <input
            id="patron-name"
            type="text"
            placeholder="e.g. Julian Vane"
            {...register("name")}
            className="w-full bg-transparent border-b border-white/15 py-3 px-0 text-text placeholder:text-muted/30 focus:outline-none focus:border-primary transition-colors text-[15px] font-sans"
          />
          {errors.name && (
            <span className="text-red-400/90 text-[12px] mt-1.5 font-sans">{errors.name.message}</span>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="patron-email" className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2 font-sans">
            Email Address <span className="text-primary">*</span>
          </label>
          <input
            id="patron-email"
            type="email"
            placeholder="name@domain.com"
            {...register("email")}
            className="w-full bg-transparent border-b border-white/15 py-3 px-0 text-text placeholder:text-muted/30 focus:outline-none focus:border-primary transition-colors text-[15px] font-sans"
          />
          {errors.email && (
            <span className="text-red-400/90 text-[12px] mt-1.5 font-sans">{errors.email.message}</span>
          )}
        </div>
      </div>

      {/* 2. Reference Material Upload Area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-[0.2em] text-muted font-sans">
            Reference Material
          </label>
          <span className="text-[11px] text-muted/60 font-sans tracking-wide">Optional</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg, image/png, image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {uploadState === "done" && fileMeta ? (
          <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <div className="truncate">
                <p className="text-[13px] text-text font-sans truncate">{fileMeta.name}</p>
                <p className="text-[11px] text-muted/60 font-sans">{fileMeta.size} · Uploaded</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveAttachment}
              className="text-[11px] text-muted hover:text-red-400 transition-colors uppercase tracking-wider px-2 py-1 flex items-center gap-1 font-sans"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-2 group ${
              isDragOver
                ? "border-primary bg-primary/[0.04]"
                : "border-white/15 hover:border-primary/50 bg-white/[0.01] hover:bg-white/[0.03]"
            }`}
          >
            <Upload className="w-4 h-4 text-muted/60 group-hover:text-primary transition-colors" />
            <p className="text-[13px] text-text/90 font-sans font-light">
              {uploadState === "uploading"
                ? "Uploading reference safely..."
                : "Drag & drop reference image, or browse"}
            </p>
            <p className="text-[10px] text-muted/50 tracking-wider uppercase font-sans">
              JPG, PNG or WebP · Up to 10 MB
            </p>
          </div>
        )}
      </div>

      {/* 3. Desired Scale (4 cols desktop, 2x2 mobile) */}
      <div className="flex flex-col gap-2.5">
        <label className="text-[11px] uppercase tracking-[0.2em] text-muted font-sans">
          Desired Scale <span className="text-primary">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SCALE_OPTIONS.map((opt) => {
            const isSelected = selectedScale === opt.label;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedScale(opt.label);
                  setValue("size", opt.label, { shouldValidate: true });
                }}
                className={`relative text-left p-3.5 sm:p-4 border transition-all duration-200 flex flex-col justify-between h-20 sm:h-22 ${
                  isSelected
                    ? "border-primary bg-primary/[0.06] text-text"
                    : "border-white/12 bg-white/[0.015] hover:border-white/30 text-text/80"
                }`}
              >
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-2.5 right-2.5" />
                )}
                <span className={`text-[13px] font-sans font-medium tracking-wide ${isSelected ? "text-primary" : "text-text"}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] tracking-wider uppercase text-muted/60 font-sans">
                  {opt.subtitle}
                </span>
              </button>
            );
          })}
        </div>
        {errors.size && (
          <span className="text-red-400/90 text-[12px] font-sans">{errors.size.message}</span>
        )}
      </div>

      {/* 4. Budget Range (4 cols desktop, 2x2 mobile) */}
      <div className="flex flex-col gap-2.5">
        <label className="text-[11px] uppercase tracking-[0.2em] text-muted font-sans">
          Budget Range <span className="text-primary">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BUDGET_OPTIONS.map((opt) => {
            const isSelected = selectedBudget === opt.label;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedBudget(opt.label);
                  setValue("budget", opt.label, { shouldValidate: true });
                }}
                className={`relative text-left p-3.5 sm:p-4 border transition-all duration-200 flex flex-col justify-between h-20 sm:h-22 ${
                  isSelected
                    ? "border-primary bg-primary/[0.06] text-text"
                    : "border-white/12 bg-white/[0.015] hover:border-white/30 text-text/80"
                }`}
              >
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-2.5 right-2.5" />
                )}
                <span className={`font-serif text-[14px] sm:text-[15px] ${isSelected ? "text-primary" : "text-text"}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] tracking-wider uppercase text-muted/60 font-sans">
                  {opt.subtitle}
                </span>
              </button>
            );
          })}
        </div>
        {errors.budget && (
          <span className="text-red-400/90 text-[12px] font-sans">{errors.budget.message}</span>
        )}
      </div>

      {/* 5. Target Deadline (Optional) */}
      <div className="flex flex-col">
        <label htmlFor="commission-deadline" className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2 font-sans">
          Target Deadline
        </label>
        <input
          id="commission-deadline"
          type="date"
          {...register("deadline")}
          className="w-full bg-transparent border-b border-white/15 py-3 px-0 text-text placeholder:text-muted/30 focus:outline-none focus:border-primary transition-colors text-[14px] font-sans [color-scheme:dark]"
        />
        <span className="text-[11px] text-muted/50 font-sans mt-1">Optional completion timeframe</span>
      </div>

      {/* 6. Your Vision Narrative */}
      <div className="flex flex-col">
        <label htmlFor="vision-text" className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2 font-sans">
          Your Vision <span className="text-primary">*</span>
        </label>
        <textarea
          id="vision-text"
          rows={5}
          placeholder="Describe the subject, mood, or details you would like captured..."
          {...register("message")}
          onChange={(e) => {
            register("message").onChange(e);
            setMessageLength(e.target.value.length);
          }}
          className="w-full bg-white/[0.02] border border-white/15 focus:border-primary p-4 text-[14px] text-text placeholder:text-muted/40 leading-relaxed resize-y min-h-[140px] focus:outline-none transition-colors font-sans"
        />
        <div className="flex items-center justify-between mt-1.5 text-[11px] font-sans">
          {errors.message ? (
            <span className="text-red-400/90">{errors.message.message}</span>
          ) : (
            <span className="text-muted/50">Minimum 10 characters</span>
          )}
          <span className="text-muted/50 tracking-wider">
            {messageLength} / 2000
          </span>
        </div>
      </div>

      {serverError && (
        <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 text-[13px] font-sans text-center">
          {serverError}
        </div>
      )}

      {/* 7. Reassurance & Primary CTA */}
      <div className="flex flex-col gap-4 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || uploadState === "uploading"}
          className="w-full py-4 bg-[#F5F2EB] hover:bg-[#E8E0D2] active:bg-[#C5A880] text-[#0C0C0E] font-sans font-medium text-[12px] tracking-[0.24em] uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2 cursor-pointer group"
        >
          {isSubmitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-[#0C0C0E]/30 border-t-[#0C0C0E] rounded-full animate-spin" />
              <span>Transmitting Request...</span>
            </>
          ) : (
            <>
              <span>Submit Request</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <p className="text-[12px] text-muted/60 font-sans text-center font-light">
          No initial payment is requested at this stage.
        </p>
      </div>
    </form>
  );
}
